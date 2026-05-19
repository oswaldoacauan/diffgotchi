import { describe, expect, test } from "bun:test";
import type { ParsedKey } from "@opentui/core";
import { comboMatchesEvent, createKeybindResolver, parseKeybindString } from "./keybind";

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

describe("keybind parsing", () => {
  test("empty keybinds intentionally produce no matches", () => {
    expect(parseKeybindString("")).toEqual([]);
  });

  test("treats commas as alternative bindings", () => {
    const parsed = parseKeybindString("ctrl+c, ctrl+d");

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toHaveLength(1);
    expect(parsed[1]).toHaveLength(1);
  });

  test("treats spaces as one chord", () => {
    const parsed = parseKeybindString("ctrl+k e");

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toHaveLength(2);
  });

  test("parses shift+n distinctly from plain n", () => {
    const prev = parseKeybindString("shift+n");
    const next = parseKeybindString("n");

    expect(comboMatchesEvent(prev[0]![0]!, key("n", { shift: true }))).toBe(true);
    expect(comboMatchesEvent(prev[0]![0]!, key("n"))).toBe(false);
    expect(comboMatchesEvent(next[0]![0]!, key("n"))).toBe(true);
    expect(comboMatchesEvent(next[0]![0]!, key("n", { shift: true }))).toBe(false);
  });
});

describe("keybind matching", () => {
  test("matches a comma-separated alternative", () => {
    const keybind = createKeybindResolver({ "global.quit": "ctrl+c, ctrl+d" });

    expect(keybind.match("global.quit", key("c", { ctrl: true }))).toBe(true);
    expect(keybind.matchInContext("global", "quit", key("d", { ctrl: true }))).toBe(true);
  });

  test("matches alt as the terminal option modifier", () => {
    const keybind = createKeybindResolver({ "diff.scroll_bottom": "ctrl+alt+g, end" });

    expect(keybind.match("diff.scroll_bottom", key("g", { ctrl: true, option: true }))).toBe(true);
  });

  test("matches a space-separated chord", () => {
    const keybind = createKeybindResolver({ "diff.edit_file": "ctrl+g, ctrl+k e" });

    expect(keybind.matchInContext("diff", "edit_file", key("k", { ctrl: true }))).toBe(false);
    expect(keybind.matchInContext("diff", "edit_file", key("e"))).toBe(true);
  });

  test("does not treat chord parts as separate bindings", () => {
    const keybind = createKeybindResolver({ "diff.pick_theme": "ctrl+x t" });

    expect(keybind.match("diff.pick_theme", key("x", { ctrl: true }))).toBe(false);
    expect(keybind.match("diff.pick_theme", key("t"))).toBe(true);
  });

  test("keeps prefixes context-aware for chorded commands", () => {
    const keybind = createKeybindResolver({
      "global.command_palette": "ctrl+p",
      "diff.list_comments": "ctrl+k r",
      "diff.edit_file": "ctrl+k e",
    });

    const prefix = key("k", { ctrl: true });
    expect(keybind.match("global.command_palette", prefix)).toBe(false);
    expect(keybind.match("diff.list_comments", prefix)).toBe(false);
    expect(keybind.match("diff.list_comments", key("r"))).toBe(true);
    expect(keybind.match("diff.edit_file", prefix)).toBe(false);
    expect(keybind.match("diff.edit_file", key("e"))).toBe(true);
    expect(keybind.match("global.command_palette", key("p", { ctrl: true }))).toBe(true);
  });

  test("allows the same physical key in different contexts", () => {
    const keybind = createKeybindResolver({
      "diff.scroll_down": "j",
      "select.next": "j",
    });

    expect(keybind.matchInContext("diff", "scroll_down", key("j"))).toBe(true);
    expect(keybind.matchInContext("select", "next", key("j"))).toBe(true);
  });

  test("detects single-key active context collisions before global dispatch", () => {
    const keybind = createKeybindResolver({
      "global.quit": "ctrl+d",
      "file_picker.toggle_done": "ctrl+d",
    });

    expect(keybind.matchesAnyInContext("file_picker", key("d", { ctrl: true }))).toBe(true);
  });

  test("does not let chord prefixes leak across contexts", () => {
    const keybind = createKeybindResolver({
      "diff.open": "ctrl+k o",
      "select.cancel": "ctrl+k",
    });

    expect(keybind.matchInContext("select", "cancel", key("k", { ctrl: true }))).toBe(true);
  });

  test("prints escape keybinds as esc", () => {
    const keybind = createKeybindResolver({ "select.cancel": "escape" });

    expect(keybind.print("select.cancel")).toBe("esc");
  });
});
