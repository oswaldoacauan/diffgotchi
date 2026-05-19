import { atom } from "jotai";
import { getFileName, getFileStatus, countChanges, type ParsedFile } from "@/lib/git/parse";
import { isFileDone as checkFileDone, findFirstUndoneIndex } from "@/lib/review";
import { getResolvedTheme, rgbaToHex } from "@/lib/themes";
import { parsedFilesAtom, doneFilesAtom, currentFileNameAtom } from "./core";
import { themeNameAtom } from "./ui";

export const currentFileIndexAtom = atom((get) => {
  const parsedFiles = get(parsedFilesAtom);
  const currentFileName = get(currentFileNameAtom);
  const doneFiles = get(doneFilesAtom);

  if (currentFileName) {
    const idx = parsedFiles.findIndex((f) => getFileName(f) === currentFileName);
    if (idx >= 0) return idx;
  }
  const files = parsedFiles.map((f) => ({
    filename: getFileName(f),
    rawDiff: f.rawDiff || "",
  }));
  return findFirstUndoneIndex(files, doneFiles);
});

export const doneCountAtom = atom((get) => {
  const parsedFiles = get(parsedFilesAtom);
  const doneFiles = get(doneFilesAtom);
  let count = 0;
  for (const f of parsedFiles) {
    if (checkFileDone(doneFiles, getFileName(f), f.rawDiff || "")) count++;
  }
  return count;
});

export const totalsAtom = atom((get) => {
  const parsedFiles = get(parsedFilesAtom);
  let totalAdded = 0;
  let totalRemoved = 0;
  for (const f of parsedFiles) {
    const c = countChanges(f.hunks);
    totalAdded += c.additions;
    totalRemoved += c.deletions;
  }
  return { totalAdded, totalRemoved };
});

export const filePickerDataAtom = atom((get) => {
  const parsedFiles = get(parsedFilesAtom);
  const doneFiles = get(doneFilesAtom);
  return parsedFiles.map((f) => {
    const c = countChanges(f.hunks);
    return {
      name: getFileName(f),
      done: checkFileDone(doneFiles, getFileName(f), f.rawDiff || ""),
      status: getFileStatus(f) as "added" | "modified" | "deleted" | "renamed",
      additions: c.additions,
      deletions: c.deletions,
    };
  });
});

export const resolvedThemeAtom = atom((get) => {
  const themeName = get(themeNameAtom);
  const theme = getResolvedTheme(themeName);
  return {
    theme,
    themeName,
    textColor: rgbaToHex(theme.text),
    mutedColor: rgbaToHex(theme.textMuted),
    successColor: rgbaToHex(theme.success),
  };
});

export function isFileDoneAt(
  parsedFiles: ParsedFile[],
  doneFiles: Map<string, number>,
  idx: number,
): boolean {
  const f = parsedFiles[idx];
  if (!f) return false;
  return checkFileDone(doneFiles, getFileName(f), f.rawDiff || "");
}
