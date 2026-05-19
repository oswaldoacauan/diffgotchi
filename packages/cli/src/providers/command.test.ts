import { describe, expect, test } from "bun:test";
import type { ParsedKey } from "@opentui/core";
import { shouldDeferGlobalShortcut } from "./command";
import { createKeybindResolver } from "./keybind";

function key(name: string, mods: Partial<ParsedKey> = {}): ParsedKey {
  return {
    name,
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    sequence: "",
    number: false,
    raw: "",
    eventType: "press",
    source: "raw",
    ...mods,
  };
}

describe("command global dispatch", () => {
  test("defers global quit when file picker binds the same key", () => {
    const keybind = createKeybindResolver({
      "global.quit": "ctrl+d",
      "file_picker.toggle_done": "ctrl+d",
    });

    expect(
      shouldDeferGlobalShortcut({
        dialogOpen: true,
        activeContext: "file_picker",
        keybind,
        key: key("d", { ctrl: true }),
      }),
    ).toBe(true);
  });

  test("does not defer global shortcuts for unrelated active context keys", () => {
    const keybind = createKeybindResolver({
      "global.quit": "ctrl+d",
      "file_picker.toggle_done": "ctrl+x",
    });

    expect(
      shouldDeferGlobalShortcut({
        dialogOpen: true,
        activeContext: "file_picker",
        keybind,
        key: key("d", { ctrl: true }),
      }),
    ).toBe(false);
  });

  test("does not defer global shortcuts when no dialog is open", () => {
    const keybind = createKeybindResolver({
      "global.quit": "ctrl+d",
      "file_picker.toggle_done": "ctrl+d",
    });

    expect(
      shouldDeferGlobalShortcut({
        dialogOpen: false,
        activeContext: "file_picker",
        keybind,
        key: key("d", { ctrl: true }),
      }),
    ).toBe(false);
  });
});
