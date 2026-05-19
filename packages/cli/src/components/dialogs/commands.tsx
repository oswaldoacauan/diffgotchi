import * as React from "react";
import { TextAttributes } from "@opentui/core";
import type { DialogContextValue } from "@/providers/dialog";
import { DialogList, DialogListRow } from "@/components/ui/dialog-list";
import { KeybindHint } from "@/components/ui/keybind-hint";
import type { CommandOption } from "@/providers/command";
import { fuzzyMatch } from "@/util/fuzzy-match";

export function CommandPalette({
  commands,
  dialog,
}: {
  commands: CommandOption[];
  dialog: DialogContextValue;
}) {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const visible = commands.filter((cmd) => !cmd.hidden);
    if (!search.trim()) return visible;
    return visible.filter(
      (cmd) =>
        fuzzyMatch(search, cmd.title) !== null ||
        fuzzyMatch(search, cmd.description ?? "") !== null,
    );
  }, [commands, search]);

  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    for (const cmd of filtered) {
      if (cmd.category) cats.add(cmd.category);
    }
    return cats.size;
  }, [filtered]);

  const visibleRows = filtered.length + categories + Math.max(0, categories - 1);

  const handleSelect = React.useCallback(
    (i: number) => {
      const cmd = filtered[i];
      if (cmd) {
        dialog.clear();
        cmd.onSelect(dialog);
      }
    },
    [filtered, dialog],
  );

  const handleEscape = React.useCallback(() => dialog.clear(), [dialog]);

  return (
    <DialogList
      title="Commands"
      placeholder="search..."
      count={filtered.length}
      visibleRows={visibleRows}
      onSelect={handleSelect}
      onEscape={handleEscape}
      onSearchChange={setSearch}
    >
      {({ active, accent, fg, muted }) => {
        const rows: React.ReactNode[] = [];
        let lastCat = "";

        for (let i = 0; i < filtered.length; i++) {
          const cmd = filtered[i]!;

          if (cmd.category && cmd.category !== lastCat) {
            lastCat = cmd.category;
            rows.push(
              <box key={`cat-${cmd.category}`} paddingTop={rows.length > 0 ? 1 : 0} paddingLeft={1}>
                <text fg={accent} attributes={TextAttributes.BOLD}>
                  {cmd.category}
                </text>
              </box>,
            );
          }

          rows.push(
            <DialogListRow key={cmd.value} index={i} active={active}>
              <text
                fg={fg(i)}
                attributes={i === active ? TextAttributes.BOLD : undefined}
                flexGrow={1}
                overflow="hidden"
                wrapMode="none"
              >
                {cmd.title}
              </text>
              {cmd.options ? (
                <text fg={muted(i)} flexShrink={0} attributes={TextAttributes.ITALIC}>
                  {cmd.options.map((opt, oi) => (
                    <span key={oi}>
                      {oi > 0 && " "}
                      <span attributes={opt.active ? TextAttributes.UNDERLINE : undefined}>
                        {opt.label}
                      </span>
                    </span>
                  ))}
                </text>
              ) : cmd.description ? (
                <text fg={muted(i)} flexShrink={0} attributes={TextAttributes.ITALIC}>
                  {cmd.description}
                </text>
              ) : cmd.keybind ? (
                <box flexShrink={0}>
                  <KeybindHint command={cmd.keybind} showLabel={false} />
                </box>
              ) : null}
            </DialogListRow>,
          );
        }
        return rows;
      }}
    </DialogList>
  );
}
