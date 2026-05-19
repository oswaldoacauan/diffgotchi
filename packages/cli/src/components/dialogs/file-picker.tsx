import * as React from "react";
import type { ParsedKey } from "@opentui/core";
import { useAtomValue } from "jotai/react";
import { appStore } from "@/atoms/store";
import { resolvedThemeAtom, filePickerDataAtom } from "@/atoms/derived";
import { toggleDoneByIndexAtom } from "@/atoms/actions";
import { rgbaToHex } from "@/lib/themes";
import { DialogList, DialogListRow } from "@/components/ui/dialog-list";
import { HighlightedText } from "@/components/ui/highlighted-text";
import { KeybindHint } from "@/components/ui/keybind-hint";
import { useKeybind } from "@/providers/keybind";
import { fuzzyMatch } from "@/util/fuzzy-match";
import { formatMatchedPreview } from "@/util/matched-preview";
import { getStatusBadge, type FileStatus } from "@/util/status-badge";
import { truncatePath } from "@/util/truncated-path";

export function FilePickerDialog({
  currentIndex,
  onSelect,
  onClose,
}: {
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const files = useAtomValue(filePickerDataAtom);
  const { theme } = useAtomValue(resolvedThemeAtom);
  const keybind = useKeybind();

  const textMuted = rgbaToHex(theme.textMuted);
  const primary = rgbaToHex(theme.primary);
  const success = rgbaToHex(theme.success);
  const added = rgbaToHex(theme.diffAdded);
  const removed = rgbaToHex(theme.error);
  const warning = rgbaToHex(theme.warning);

  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = search.trim();
    if (!needle) {
      return files.map((f, i) => ({ ...f, originalIndex: i }));
    }
    const results: Array<(typeof files)[number] & { originalIndex: number }> = [];
    for (let i = 0; i < files.length; i++) {
      const indices = fuzzyMatch(needle, files[i]!.name);
      if (indices) results.push({ ...files[i]!, originalIndex: i });
    }
    return results;
  }, [files, search]);

  const doneCount = files.filter((f) => f.done).length;

  const handleKey = React.useCallback(
    (key: ParsedKey, index: number) => {
      if (keybind.matchInContext("file_picker", "toggle_done", key)) {
        const item = filtered[index];
        if (item) appStore.set(toggleDoneByIndexAtom, item.originalIndex);
        return true;
      }
      return false;
    },
    [filtered],
  );

  return (
    <DialogList
      title="Files"
      placeholder="Search files..."
      count={filtered.length}
      onSelect={(i) => {
        const item = filtered[i];
        if (item) onSelect(item.originalIndex);
      }}
      onEscape={onClose}
      onSearchChange={setSearch}
      onKey={handleKey}
      footer={
        <box flexDirection="row" justifyContent="space-between">
          <box flexDirection="row">
            <KeybindHint command="file_picker.toggle_done" label="toggle done" />
          </box>
          <text fg={textMuted}>
            {doneCount}/{files.length} done
          </text>
        </box>
      }
    >
      {({ active, width, fg, muted }) =>
        filtered.map((f, i) => {
          const badge = getStatusBadge(f.status as FileStatus, {
            added,
            deleted: removed,
            modified: warning,
          });
          const isCurrent = f.originalIndex === currentIndex;
          const statsLen = ` +${f.additions} -${f.deletions}`.length;
          const fixedLen = 4 + statsLen + (f.done ? 2 : 0);
          const nameMax = width - fixedLen;
          const searchNeedle = search.trim();
          const namePreview = searchNeedle
            ? formatMatchedPreview(f.name, searchNeedle, nameMax)
            : { text: truncatePath(f.name, nameMax), matchIndices: [] };
          return (
            <DialogListRow key={String(f.originalIndex)} index={i} active={active}>
              {isCurrent && (
                <text position="absolute" left={0} fg={fg(i)}>
                  {"›"}
                </text>
              )}
              <text fg={i === active ? fg(i) : badge.color} flexShrink={0}>
                {badge.label}
              </text>
              <text fg={fg(i)} flexGrow={1} overflow="hidden" wrapMode="none">
                <HighlightedText
                  text={namePreview.text}
                  indices={namePreview.matchIndices}
                  fg={fg(i)}
                  highlightFg={i === active ? fg(i) : primary}
                />
                <span style={{ fg: muted(i) }}>
                  {" "}
                  <span style={{ fg: i === active ? fg(i) : added }}>+{f.additions}</span>{" "}
                  <span style={{ fg: i === active ? fg(i) : removed }}>-{f.deletions}</span>
                </span>
              </text>
              {f.done && (
                <text fg={i === active ? fg(i) : success} flexShrink={0}>
                  ✓
                </text>
              )}
            </DialogListRow>
          );
        })
      }
    </DialogList>
  );
}
