import fs from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { BUILD_META } from "./build-meta";
import { getStateRootPath } from "@/lib/state";

export { BUILD_META } from "./build-meta";

// --- Update check ---

const CHECK_INTERVAL_STABLE_MS = 24 * 60 * 60 * 1000;
const UPDATE_NOTIFICATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const API_BASE = `https://api.github.com/repos/${BUILD_META.repo}`;

interface UpdateState {
  lastCheck?: number;
  latestVersion?: string;
  lastNotification?: number;
  notifiedVersion?: string;
}

function loadUpdateState(): UpdateState {
  try {
    return normalizeUpdateState(
      JSON.parse(fs.readFileSync(getUpgradeStateFilePath(false), "utf-8")) as unknown,
    );
  } catch {
    return {};
  }
}

function saveUpdateState(state: UpdateState): void {
  try {
    fs.writeFileSync(
      getUpgradeStateFilePath(true),
      JSON.stringify(toStoredUpdateState(state)) + "\n",
    );
  } catch {}
}

function getUpgradeStateFilePath(ensureDir: boolean): string {
  return join(getStateRootPath(ensureDir), "upgrade-check.json");
}

function toStoredUpdateState(state: UpdateState): Record<string, unknown> {
  return {
    ...(typeof state.lastCheck === "number" ? { last_check: state.lastCheck } : {}),
    ...(state.latestVersion ? { latest_version: state.latestVersion } : {}),
    ...(typeof state.lastNotification === "number"
      ? { last_notification: state.lastNotification }
      : {}),
    ...(state.notifiedVersion ? { notified_version: state.notifiedVersion } : {}),
  };
}

function normalizeUpdateState(value: unknown): UpdateState {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const lastCheck = record.last_check;
  const latestVersion = record.latest_version;
  const lastNotification = record.last_notification;
  const notifiedVersion = record.notified_version;
  return {
    ...(typeof lastCheck === "number" ? { lastCheck } : {}),
    ...(typeof latestVersion === "string" ? { latestVersion } : {}),
    ...(typeof lastNotification === "number" ? { lastNotification } : {}),
    ...(typeof notifiedVersion === "string" ? { notifiedVersion } : {}),
  };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface UpdateInfo {
  available: boolean;
  current: string;
  latest: string;
  assets: ReleaseAsset[];
}

interface CheckOptions {
  channel?: "stable" | "canary";
  force?: boolean;
}

async function fetchRelease(
  channel: "stable" | "canary",
): Promise<{ version: string; assets: ReleaseAsset[] } | null> {
  const url =
    channel === "canary" ? `${API_BASE}/releases/tags/canary` : `${API_BASE}/releases/latest`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    tag_name?: string;
    name?: string;
    assets?: Array<{ name: string; browser_download_url: string }>;
  };

  let version: string | undefined;
  if (channel === "canary") {
    const match = data.name?.match(/\(([^)]+)\)/);
    version = match?.[1];
  } else {
    version = data.tag_name?.replace(/^v/, "");
  }

  if (!version) return null;

  const assets = (data.assets ?? []).map((a) => ({
    name: a.name,
    browser_download_url: a.browser_download_url,
  }));

  return { version, assets };
}

export async function checkForUpdate(
  currentVersion: string,
  options?: CheckOptions,
): Promise<UpdateInfo | null> {
  const channel = options?.channel ?? BUILD_META.channel;
  const state = loadUpdateState();
  const now = Date.now();

  if (
    !options?.force &&
    channel !== "canary" &&
    state.lastCheck &&
    now - state.lastCheck < CHECK_INTERVAL_STABLE_MS
  ) {
    if (state.latestVersion && compareVersions(state.latestVersion, currentVersion) > 0) {
      return {
        available: true,
        current: currentVersion,
        latest: state.latestVersion,
        assets: [],
      };
    }
    return null;
  }

  try {
    const release = await fetchRelease(channel);
    if (!release) return null;

    saveUpdateState({ ...state, lastCheck: now, latestVersion: release.version });

    const isNewer =
      channel === "canary"
        ? release.version !== currentVersion
        : compareVersions(release.version, currentVersion) > 0;

    if (isNewer) {
      return {
        available: true,
        current: currentVersion,
        latest: release.version,
        assets: release.assets,
      };
    }
  } catch {}

  return null;
}

export function shouldNotifyUpdateAvailable(info: UpdateInfo, now = Date.now()): boolean {
  if (BUILD_META.channel === "canary") return false;

  const state = loadUpdateState();
  const sameVersion = state.notifiedVersion === info.latest;
  const recentlyNotified =
    typeof state.lastNotification === "number" &&
    now - state.lastNotification < UPDATE_NOTIFICATION_INTERVAL_MS;

  if (sameVersion && recentlyNotified) return false;

  saveUpdateState({
    ...state,
    lastNotification: now,
    notifiedVersion: info.latest,
  });
  return true;
}

// --- Upgrade ---

const PLATFORM_MAP: Record<string, string> = {
  "darwin-arm64": "diffgotchi-darwin-arm64.tar.gz",
  "linux-x64": "diffgotchi-linux-x64.tar.gz",
};

function getAssetName(): string {
  const key = `${process.platform}-${process.arch}`;
  const name = PLATFORM_MAP[key];
  if (!name) throw new Error(`Unsupported platform: ${key}`);
  return name;
}

async function fetchAssets(channel: "stable" | "canary"): Promise<ReleaseAsset[]> {
  const url =
    channel === "canary" ? `${API_BASE}/releases/tags/canary` : `${API_BASE}/releases/latest`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`Failed to fetch release: ${res.status}`);

  const data = (await res.json()) as {
    assets?: Array<{ name: string; browser_download_url: string }>;
  };
  return (data.assets ?? []).map((a) => ({
    name: a.name,
    browser_download_url: a.browser_download_url,
  }));
}

async function downloadAndExtract(url: string, destDir: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const tarPath = join(destDir, "diffgotchi.tar.gz");
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(tarPath, Buffer.from(buffer));

  const { execSync } = await import("child_process");
  execSync(`tar -xzf "${tarPath}" -C "${destDir}"`);

  return join(destDir, "diffgotchi");
}

export async function performUpgrade(info?: UpdateInfo): Promise<void> {
  const assetName = getAssetName();
  const channel = BUILD_META.channel;

  let assets = info?.assets ?? [];
  if (assets.length === 0) {
    assets = await fetchAssets(channel);
  }

  const asset = assets.find((a) => a.name === assetName);
  if (!asset) throw new Error(`No binary for ${process.platform}-${process.arch}`);

  const tmpDir = fs.mkdtempSync(join(tmpdir(), "diffgotchi-upgrade-"));

  try {
    const newBinary = await downloadAndExtract(asset.browser_download_url, tmpDir);
    const currentBinary = fs.realpathSync(process.execPath);

    if (!currentBinary.includes("diffgotchi")) {
      throw new Error(`Refusing to replace non-diffgotchi binary: ${currentBinary}`);
    }

    fs.chmodSync(newBinary, 0o755);

    const backupPath = `${currentBinary}.bak`;
    try {
      fs.unlinkSync(backupPath);
    } catch {}
    fs.renameSync(currentBinary, backupPath);
    try {
      fs.renameSync(newBinary, currentBinary);
      try {
        fs.unlinkSync(backupPath);
      } catch {}
    } catch (err) {
      fs.renameSync(backupPath, currentBinary);
      throw err;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
