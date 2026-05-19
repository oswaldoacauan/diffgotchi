import * as React from "react";
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useAtomValue } from "jotai/react";
import { resolvedThemeAtom } from "@/atoms/derived";
import { useKeybind } from "@/providers/keybind";
import { COMMAND_LABELS, KeybindHint } from "@/components/ui/keybind-hint";

const KEYBIND_ORDER = [
  "global.command_palette",
  "global.quit",
  "global.open_config",
  "global.help_docs",
  "global.help_keybinds",
  "global.help_about",
  "diff.prev_file",
  "diff.next_file",
  "diff.scroll_up",
  "diff.scroll_down",
  "diff.scroll_half_up",
  "diff.scroll_half_down",
  "diff.scroll_top",
  "diff.scroll_bottom",
  "diff.prev_hunk",
  "diff.next_hunk",
  "diff.mark_done",
  "diff.add_comment",
  "diff.list_comments",
  "diff.pick_file",
  "diff.edit_file",
  "diff.pick_theme",
  "diff.force_expand",
  "diff.display_view",
  "diff.display_line_numbers",
  "diff.display_wrap",
  "diff.display_inline_highlights",
  "diff.display_backgrounds",
  "diff.display_indicators",
  "diff.display_hunk_headers",
  "diff.context_lines",
  "diff.toggle_mouse",
  "select.prev",
  "select.next",
  "select.accept",
  "select.cancel",
  "file_picker.toggle_done",
  "comments_list.resolve",
  "comments_list.delete",
  "comment_editor.submit",
  "comment_editor.delete",
  "comment_editor.cancel",
  "error.retry",
  "error.copy",
  "error.quit",
];

export function KeybindsDialog({ onClose }: { onClose: () => void }) {
  const { theme } = useAtomValue(resolvedThemeAtom);
  const keybind = useKeybind();

  useKeyboard((key) => {
    if (key.ctrl || key.meta || key.option) return;
    key.stopPropagation?.();
    onClose();
  });

  const order = React.useMemo(() => new Map(KEYBIND_ORDER.map((action, i) => [action, i])), []);
  const rows = React.useMemo(() => {
    return keybind
      .list()
      .sort(
        (a, b) =>
          (order.get(a.action) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(b.action) ?? Number.MAX_SAFE_INTEGER) || a.action.localeCompare(b.action),
      );
  }, [keybind, order]);

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        Keybinds
      </text>
      <box flexDirection="column">
        {rows.map(({ action }) => (
          <box key={action} flexDirection="row">
            <box width={18}>
              <KeybindHint command={action} showLabel={false} />
            </box>
            <text fg={theme.textMuted}>{COMMAND_LABELS[action] ?? action}</text>
            <text fg={theme.textMuted}> </text>
            <text fg={theme.textMuted}>({action})</text>
          </box>
        ))}
      </box>
      <text fg={theme.textMuted}>Press any key to close</text>
    </box>
  );
}
