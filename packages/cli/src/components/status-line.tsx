import { useAtomValue } from "jotai/react";
import { parsedFilesAtom, branchAtom } from "@/atoms/core";
import { doneCountAtom, resolvedThemeAtom, totalsAtom } from "@/atoms/derived";
import { terminalWidthAtom } from "@/atoms/ui";
import { KeybindHint } from "@/components/ui/keybind-hint";
import { rgbaToHex } from "@/lib/themes";

export function StatusLine() {
  const branch = useAtomValue(branchAtom);
  const parsedFiles = useAtomValue(parsedFilesAtom);
  const doneCount = useAtomValue(doneCountAtom);
  const { totalAdded, totalRemoved } = useAtomValue(totalsAtom);
  const width = useAtomValue(terminalWidthAtom);
  const { theme, textColor, mutedColor, successColor } = useAtomValue(resolvedThemeAtom);
  const half = Math.floor(width / 2);

  return (
    <box
      style={{
        flexDirection: "row",
        paddingTop: 1,
        paddingLeft: 1,
        paddingRight: 1,
        flexShrink: 0,
        alignItems: "center",
      }}
    >
      {half >= 64 && (
        <>
          <text fg={textColor}>←→</text>
          <text fg={mutedColor}> files </text>
          <text fg={textColor}>↑↓</text>
          <text fg={mutedColor}> scroll </text>
          <KeybindHint command="diff.mark_done" />
          <text fg={mutedColor}> </text>
          <KeybindHint command="diff.add_comment" />
          <text fg={mutedColor}> </text>
          <KeybindHint command="diff.edit_file" />
          <text fg={mutedColor}> </text>
          <KeybindHint command="diff.pick_file" />
        </>
      )}
      {half >= 30 && half < 64 && (
        <>
          <text fg={textColor}>←→</text>
          <text fg={mutedColor}> files </text>
          <KeybindHint command="diff.mark_done" />
          <text fg={mutedColor}> </text>
          <KeybindHint command="diff.pick_file" />
        </>
      )}
      {half >= 14 && half < 30 && (
        <>
          <KeybindHint command="diff.mark_done" />
          <text fg={mutedColor}> </text>
          <KeybindHint command="diff.pick_file" />
        </>
      )}
      <box flexGrow={1} />
      {doneCount > 0 && (
        <>
          <text fg={successColor}>✓{doneCount}</text>
          <text fg={mutedColor}>/{parsedFiles.length} </text>
        </>
      )}
      <text fg={successColor}>+{totalAdded}</text>
      <text fg={rgbaToHex(theme.error)}>-{totalRemoved}</text>
      {branch && (
        <>
          <text fg={mutedColor}> </text>
          <text fg={mutedColor}>{branch}</text>
        </>
      )}
    </box>
  );
}
