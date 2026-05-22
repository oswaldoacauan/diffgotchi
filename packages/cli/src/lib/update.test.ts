import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { checkForUpdate, shouldNotifyUpdateAvailable, type UpdateInfo } from "@/lib/update";

const originalStateHome = process.env.DIFFGOTCHI_STATE_HOME;
const originalFetch = globalThis.fetch;
let tempDir: string;

const updateInfo: UpdateInfo = {
  available: true,
  current: "1.0.0",
  latest: "1.1.0",
  assets: [],
  channel: "stable",
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "diffgotchi-update-test-"));
  process.env.DIFFGOTCHI_STATE_HOME = join(tempDir, "state");
});

afterEach(() => {
  if (originalStateHome === undefined) delete process.env.DIFFGOTCHI_STATE_HOME;
  else process.env.DIFFGOTCHI_STATE_HOME = originalStateHome;
  globalThis.fetch = originalFetch;
  rmSync(tempDir, { recursive: true, force: true });
});

function writeUpdateState(state: Record<string, unknown>): void {
  const stateRoot = process.env.DIFFGOTCHI_STATE_HOME;
  if (!stateRoot) throw new Error("DIFFGOTCHI_STATE_HOME is not set");
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(join(stateRoot, "upgrade-check.json"), JSON.stringify(state) + "\n");
}

function mockReleaseFetch(data: Record<string, unknown>): { getCallCount: () => number } {
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount++;
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { getCallCount: () => callCount };
}

describe("update notifications", () => {
  test("throttles repeated notifications for the same version", () => {
    const now = Date.UTC(2026, 4, 12);

    expect(shouldNotifyUpdateAvailable(updateInfo, now)).toBe(true);
    expect(shouldNotifyUpdateAvailable(updateInfo, now + 60_000)).toBe(false);
    expect(shouldNotifyUpdateAvailable(updateInfo, now + 24 * 60 * 60 * 1000 + 1)).toBe(true);
  });

  test("allows new versions before the throttle expires", () => {
    const now = Date.UTC(2026, 4, 12);

    expect(shouldNotifyUpdateAvailable(updateInfo, now)).toBe(true);
    expect(shouldNotifyUpdateAvailable({ ...updateInfo, latest: "1.2.0" }, now + 60_000)).toBe(
      true,
    );
  });

  test("throttles edge notifications like stable notifications", () => {
    const now = Date.UTC(2026, 4, 12);
    const edgeInfo = { ...updateInfo, latest: "0.0.3-edge.123", channel: "edge" as const };

    expect(shouldNotifyUpdateAvailable(edgeInfo, now)).toBe(true);
    expect(shouldNotifyUpdateAvailable(edgeInfo, now + 60_000)).toBe(false);
  });
});

describe("update checks", () => {
  test("stable checks use the 24-hour cache", async () => {
    writeUpdateState({
      last_check: Date.now(),
      latest_version: "1.0.0",
      channel: "stable",
    });
    const fetchMock = mockReleaseFetch({ tag_name: "v1.1.0", assets: [] });

    await expect(checkForUpdate("1.0.0", { channel: "stable" })).resolves.toBeNull();
    expect(fetchMock.getCallCount()).toBe(0);
  });

  test("stable checks fetch when the cache is older than 24 hours", async () => {
    writeUpdateState({
      last_check: Date.now() - 25 * 60 * 60 * 1000,
      latest_version: "1.0.0",
      channel: "stable",
    });
    const fetchMock = mockReleaseFetch({ tag_name: "v1.1.0", assets: [] });

    await expect(checkForUpdate("1.0.0", { channel: "stable" })).resolves.toEqual({
      available: true,
      current: "1.0.0",
      latest: "1.1.0",
      assets: [],
      channel: "stable",
    });
    expect(fetchMock.getCallCount()).toBe(1);
  });

  test("forced checks bypass fresh stable cache", async () => {
    writeUpdateState({
      last_check: Date.now(),
      latest_version: "1.0.0",
      channel: "stable",
    });
    const fetchMock = mockReleaseFetch({ tag_name: "v1.1.0", assets: [] });

    await expect(checkForUpdate("1.0.0", { channel: "stable", force: true })).resolves.toEqual({
      available: true,
      current: "1.0.0",
      latest: "1.1.0",
      assets: [],
      channel: "stable",
    });
    expect(fetchMock.getCallCount()).toBe(1);
  });

  test("edge checks always fetch", async () => {
    writeUpdateState({
      last_check: Date.now(),
      latest_version: "0.0.3-edge.122",
      channel: "edge",
    });
    const fetchMock = mockReleaseFetch({ name: "Edge (0.0.3-edge.123)", assets: [] });

    await expect(checkForUpdate("0.0.3-edge.122", { channel: "edge" })).resolves.toEqual({
      available: true,
      current: "0.0.3-edge.122",
      latest: "0.0.3-edge.123",
      assets: [],
      channel: "edge",
    });
    expect(fetchMock.getCallCount()).toBe(1);
  });

  test("does not reuse cached stable state for edge checks", async () => {
    writeUpdateState({
      last_check: Date.now(),
      latest_version: "1.1.0",
      channel: "stable",
    });
    const fetchMock = mockReleaseFetch({ name: "Edge (0.0.3-edge.123)", assets: [] });

    await expect(checkForUpdate("0.0.3-edge.122", { channel: "edge" })).resolves.toEqual({
      available: true,
      current: "0.0.3-edge.122",
      latest: "0.0.3-edge.123",
      assets: [],
      channel: "edge",
    });
    expect(fetchMock.getCallCount()).toBe(1);
  });
});
