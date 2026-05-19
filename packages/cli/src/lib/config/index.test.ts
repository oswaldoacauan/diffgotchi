import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { CONFIG_SCHEMA_URL, DEFAULT_CONFIG, createConfigFileContent, normalizeConfig } from ".";
import { generateConfigSchema } from "./schema";

describe("config", () => {
  test("normalizes missing config to nested defaults", () => {
    expect(normalizeConfig({})).toEqual(DEFAULT_CONFIG);
  });

  test("deep-merges partial nested config with defaults", () => {
    expect(
      normalizeConfig({
        general: { theme: "dracula" },
        display: { wrap: "none" },
        diff: { context_lines: 10 },
        upgrade: { channel: "canary" },
        keybinds: { "global.quit": "ctrl+c", "diff.scroll_top": "g g" },
      }),
    ).toEqual({
      ...DEFAULT_CONFIG,
      general: { ...DEFAULT_CONFIG.general, theme: "dracula" },
      display: { ...DEFAULT_CONFIG.display, wrap: "none" },
      diff: { ...DEFAULT_CONFIG.diff, context_lines: 10 },
      upgrade: { ...DEFAULT_CONFIG.upgrade, channel: "canary" },
      keybinds: { ...DEFAULT_CONFIG.keybinds, "global.quit": "ctrl+c", "diff.scroll_top": "g g" },
    });
  });

  test("ignores old flat keybind names", () => {
    expect(
      normalizeConfig({
        theme: "dracula",
        context_lines: 20,
        mouse: false,
        keybinds: { app_quit: "ctrl+c" },
      }),
    ).toEqual({
      ...DEFAULT_CONFIG,
      keybinds: { ...DEFAULT_CONFIG.keybinds },
    });
  });

  test("serializes schema and nested sections", () => {
    const json = JSON.parse(createConfigFileContent(DEFAULT_CONFIG));
    expect(json.$schema).toBe(CONFIG_SCHEMA_URL);
    expect(json.general.theme).toBe("github");
    expect(json.display.wrap).toBe("word");
    expect(json.diff.max_bytes).toBe(20 * 1024 * 1024);
    expect(json.upgrade.channel).toBe("stable");
    expect(json.storage.cleanup_stale_days).toBe(30);
    expect(json.keybinds["global.quit"]).toBe("ctrl+c, ctrl+d");
  });

  test("generated schema matches checked-in schema", () => {
    const schemaPath = join(import.meta.dir, "../../../../../schemas/config.json");
    const checkedIn = JSON.parse(readFileSync(schemaPath, "utf-8"));
    expect(checkedIn).toEqual(generateConfigSchema());
  });
});
