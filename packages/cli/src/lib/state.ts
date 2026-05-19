import { execSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import { homedir } from "os";
import { basename, join } from "path";

const APP_DIR = "diffgotchi";

export function getStateRootPath(ensureDir = false): string {
  const explicit = process.env.DIFFGOTCHI_STATE_HOME?.trim();
  const base =
    explicit || join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), APP_DIR);
  if (ensureDir) fs.mkdirSync(base, { recursive: true });
  return base;
}

export function getCurrentRepoRoot(): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", { stdio: "pipe" }).toString().trim() || null;
  } catch {
    return null;
  }
}

export function getCurrentRepoKey(): string | null {
  const root = getCurrentRepoRoot();
  return root ? createRepoKey(root) : null;
}

export function createRepoKey(repoRoot: string): string {
  const slug = sanitizePathPart(basename(repoRoot) || "repo");
  const hash = createHash("sha1").update(repoRoot).digest("hex").slice(0, 12);
  return `${slug}-${hash}`;
}

export function getRepoStatePath(ensureDir = false): string | null {
  const key = getCurrentRepoKey();
  if (!key) return null;
  const dir = join(getStateRootPath(ensureDir), "repositories", key);
  if (ensureDir) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function cleanupStaleJsonFiles(
  dir: string,
  cutoffMs: number,
  getTimestampMs: (value: unknown) => number | null,
): number {
  let removed = 0;
  if (!fs.existsSync(dir)) return removed;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += cleanupStaleJsonFiles(path, cutoffMs, getTimestampMs);
      try {
        if (fs.readdirSync(path).length === 0) fs.rmdirSync(path);
      } catch {}
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path, "utf-8")) as unknown;
      const timestamp = getTimestampMs(parsed);
      if (timestamp !== null && timestamp < cutoffMs) {
        fs.unlinkSync(path);
        removed++;
      }
    } catch {
      // Ignore unreadable state. The caller can still load valid files.
    }
  }

  return removed;
}

function sanitizePathPart(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return sanitized || "repo";
}
