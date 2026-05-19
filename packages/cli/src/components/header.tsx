import * as React from "react";
import { useAtomValue } from "jotai/react";
import { parsedFilesAtom, doneFilesAtom } from "@/atoms/core";
import {
  currentFileIndexAtom,
  doneCountAtom,
  isFileDoneAt,
  resolvedThemeAtom,
} from "@/atoms/derived";
import { terminalWidthAtom } from "@/atoms/ui";
import { countChanges, getFileName, getFileStatus, getOldFileName } from "@/lib/git/parse";
import { rgbaToHex } from "@/lib/themes";
import { getStatusBadge, type FileStatus } from "@/util/status-badge";
import { truncatePath } from "@/util/truncated-path";

export function Header() {
  const parsedFiles = useAtomValue(parsedFilesAtom);
  const doneFiles = useAtomValue(doneFilesAtom);
  const currentFileIndex = useAtomValue(currentFileIndexAtom);
  const doneCount = useAtomValue(doneCountAtom);
  const width = useAtomValue(terminalWidthAtom);
  const { theme, textColor, mutedColor, successColor } = useAtomValue(resolvedThemeAtom);

  const file = parsedFiles[currentFileIndex] ?? null;
  if (!file) return null;

  const fileName = getFileName(file);
  const oldFileName = getOldFileName(file);
  const { additions, deletions } = countChanges(file.hunks);
  const currentDone = isFileDoneAt(parsedFiles, doneFiles, currentFileIndex);
  const remainingCount = parsedFiles.length - doneCount;

  let posAmongRemaining = 0;
  if (!currentDone) {
    let pos = 0;
    for (let i = 0; i < parsedFiles.length; i++) {
      if (!isFileDoneAt(parsedFiles, doneFiles, i)) {
        pos++;
        if (i === currentFileIndex) {
          posAmongRemaining = pos;
          break;
        }
      }
    }
  }

  const badge = getStatusBadge(getFileStatus(file) as FileStatus, {
    added: successColor,
    deleted: rgbaToHex(theme.error),
    modified: rgbaToHex(theme.warning),
  });

  const rightText = currentDone ? "done" : `${posAmongRemaining}/${remainingCount}`;
  const statsLen = ` +${additions}-${deletions}`.length;
  const fixedLen = (currentDone ? 2 : 0) + 4 + statsLen + 2 + rightText.length + 2;
  const nameMax = width - fixedLen;

  const isRename = !!oldFileName;
  const renameArrow = " -> ";
  const fileNameRaw = fileName.trim();
  const oldNameRaw = oldFileName?.trim() ?? "";

  let displayName: React.ReactNode;
  if (isRename) {
    const half = Math.floor((nameMax - renameArrow.length) / 2);
    displayName = (
      <>
        <text fg={mutedColor}>{truncatePath(oldNameRaw, half)}</text>
        <text fg={mutedColor}>{renameArrow}</text>
        <text fg={textColor}>{truncatePath(fileNameRaw, half)}</text>
      </>
    );
  } else {
    displayName = <text fg={textColor}>{truncatePath(fileNameRaw, nameMax)}</text>;
  }

  return (
    <box
      style={{
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: 1,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {currentDone && <text fg={successColor}>✓ </text>}
      <text fg={badge.color}>[{badge.label}] </text>
      {displayName}
      <text fg={successColor}> +{additions}</text>
      <text fg={rgbaToHex(theme.error)}>-{deletions}</text>
      <box flexGrow={1} />
      <text fg={mutedColor}>{rightText}</text>
    </box>
  );
}
