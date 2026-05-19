import * as React from "react";
import { useAtomValue } from "jotai/react";
import { resolvedThemeAtom } from "@/atoms/derived";
import { useOptionalKeybind } from "@/providers/keybind";
import { rgbaToHex } from "@/lib/themes";

export const COMMAND_LABELS: Record<string, string> = {
  "global.command_palette": "palette",
  "global.quit": "quit",
  "global.help_keybinds": "keybinds",
  "global.help_about": "about",
  "global.help_docs": "docs",
  "global.open_config": "config",
  "diff.next_file": "next file",
  "diff.prev_file": "previous file",
  "diff.pick_file": "pick",
  "diff.edit_file": "edit",
  "diff.scroll_down": "scroll down",
  "diff.scroll_up": "scroll up",
  "diff.scroll_half_down": "half down",
  "diff.scroll_half_up": "half up",
  "diff.scroll_top": "top",
  "diff.scroll_bottom": "bottom",
  "diff.next_hunk": "next hunk",
  "diff.prev_hunk": "previous hunk",
  "diff.mark_done": "done",
  "diff.add_comment": "comment",
  "diff.list_comments": "comments",
  "diff.pick_theme": "theme",
  "diff.force_expand": "expand",
  "diff.display_view": "layout",
  "diff.display_line_numbers": "line numbers",
  "diff.display_wrap": "wrap",
  "diff.display_inline_highlights": "highlights",
  "diff.display_backgrounds": "backgrounds",
  "diff.display_indicators": "indicators",
  "diff.display_hunk_headers": "hunks",
  "diff.context_lines": "context",
  "diff.toggle_mouse": "mouse",
  "select.next": "next",
  "select.prev": "previous",
  "select.accept": "accept",
  "select.cancel": "cancel",
  "file_picker.toggle_done": "toggle done",
  "comments_list.resolve": "resolve",
  "comments_list.delete": "delete",
  "comment_editor.submit": "save",
  "comment_editor.delete": "delete",
  "comment_editor.cancel": "cancel",
  "error.retry": "retry",
  "error.copy": "copy error",
  "error.quit": "quit",
};

export function KeybindHint({
  command,
  keys,
  label,
  showLabel = true,
  fg,
  labelFg,
  attributes,
  labelAttributes,
}: {
  command?: string;
  keys?: string;
  label?: string;
  showLabel?: boolean;
  fg?: string;
  labelFg?: string;
  attributes?: number;
  labelAttributes?: number;
}) {
  const keybind = useOptionalKeybind();
  const { theme } = useAtomValue(resolvedThemeAtom);
  const keyText = command ? (keybind?.print(command) ?? "") : (keys ?? "");
  const labelText = label ?? (command ? COMMAND_LABELS[command] : "");

  if (!keyText) return null;

  const keyColor = fg ?? rgbaToHex(theme.text);
  const mutedColor = labelFg ?? rgbaToHex(theme.textMuted);

  return (
    <>
      <text fg={keyColor} attributes={attributes}>
        {keyText}
      </text>
      {showLabel && labelText ? (
        <text fg={mutedColor} attributes={labelAttributes}>
          {" "}
          {labelText}
        </text>
      ) : null}
    </>
  );
}
