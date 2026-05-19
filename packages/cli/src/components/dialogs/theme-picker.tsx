import * as React from "react";
import { TextAttributes } from "@opentui/core";
import { DialogList, DialogListRow } from "@/components/ui/dialog-list";
import { getThemeDisplayName, themeNames } from "@/lib/themes";

export function ThemePickerDialog({
  onSelect,
  onClose,
  onPreview,
  currentTheme,
}: {
  onSelect: (theme: string) => void;
  onClose: () => void;
  onPreview?: (theme: string) => void;
  currentTheme: string;
}) {
  const allNames = React.useMemo(() => themeNames(), []);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!search.trim()) return allNames;
    const lower = search.toLowerCase();
    return allNames.filter((n) => getThemeDisplayName(n).toLowerCase().includes(lower));
  }, [allNames, search]);

  const handleClose = React.useCallback(() => {
    onPreview?.(currentTheme);
    onClose();
  }, [currentTheme, onPreview, onClose]);

  const currentIdx = filtered.indexOf(currentTheme);

  return (
    <DialogList
      title="Switch theme"
      placeholder="Search themes..."
      count={filtered.length}
      initialIndex={currentIdx >= 0 ? currentIdx : 0}
      onSelect={(i) => onSelect(filtered[i]!)}
      onEscape={handleClose}
      onHighlight={(i) => onPreview?.(filtered[i]!)}
      onSearchChange={setSearch}
    >
      {({ active, fg }) =>
        filtered.map((name, i) => (
          <DialogListRow key={name} index={i} active={active}>
            <text fg={name === currentTheme ? fg(i) : "transparent"} flexShrink={0}>
              ●
            </text>
            <text
              fg={fg(i)}
              attributes={i === active ? TextAttributes.BOLD : undefined}
              flexGrow={1}
            >
              {getThemeDisplayName(name)}
            </text>
          </DialogListRow>
        ))
      }
    </DialogList>
  );
}
