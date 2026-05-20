import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { BUILD_META, shouldNotifyUpdateAvailable, type UpdateInfo } from "@/lib/update";

const originalStateHome = process.env.DIFFGOTCHI_STATE_HOME;
const originalChannel = BUILD_META.channel;
let tempDir: string;

const updateInfo: UpdateInfo = {
  available: true,
  current: "1.0.0",
  latest: "1.1.0",
  assets: [],
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "diffgotchi-update-test-"));
  process.env.DIFFGOTCHI_STATE_HOME = join(tempDir, "state");
  BUILD_META.channel = originalChannel;
});

afterEach(() => {
  if (originalStateHome === undefined) delete process.env.DIFFGOTCHI_STATE_HOME;
  else process.env.DIFFGOTCHI_STATE_HOME = originalStateHome;
  BUILD_META.channel = originalChannel;
  rmSync(tempDir, { recursive: true, force: true });
});

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

  test("does not notify from edge builds", () => {
    BUILD_META.channel = "edge";

    expect(shouldNotifyUpdateAvailable(updateInfo, Date.UTC(2026, 4, 12))).toBe(false);
  });
});
