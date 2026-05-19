import { atom } from "jotai";
import type { ParsedFile } from "@/lib/git/parse";
import { getFileName } from "@/lib/git/parse";
import { diffHash, saveDoneFiles, isFileDone as checkFileDone } from "@/lib/review";
import { parsedFilesAtom, doneFilesAtom, currentFileNameAtom, errorAtom } from "./core";
import {
  browsingAtom,
  forceExpandedFilesAtom,
  forceExpandVersionAtom,
  startupToastsAtom,
  diffTruncatedAtom,
  diffTotalBytesAtom,
  type StartupToast,
} from "./ui";
import { currentFileIndexAtom, isFileDoneAt } from "./derived";

export const setFilesAtom = atom(
  null,
  (
    _get,
    set,
    args: {
      files: ParsedFile[];
      error?: string | null;
      truncation?: { truncated: boolean; totalBytes: number };
    },
  ) => {
    set(parsedFilesAtom, args.files);
    set(errorAtom, args.error ?? null);
    set(diffTruncatedAtom, args.truncation?.truncated ?? false);
    set(diffTotalBytesAtom, args.truncation?.totalBytes ?? 0);
  },
);

export const setForceExpandAtom = atom(
  null,
  (get, set, args: { fileName: string; expanded: boolean }) => {
    const prev = get(forceExpandedFilesAtom);
    if (!!prev[args.fileName] === args.expanded) return;
    const next = { ...prev };
    if (args.expanded) next[args.fileName] = true;
    else delete next[args.fileName];
    set(forceExpandedFilesAtom, next);
    set(forceExpandVersionAtom, get(forceExpandVersionAtom) + 1);
  },
);

export const forceExpandCurrentAtom = atom(null, (get, set) => {
  const idx = get(currentFileIndexAtom);
  const parsedFiles = get(parsedFilesAtom);
  const f = parsedFiles[idx];
  if (!f) return;
  const fileName = getFileName(f);
  const expanded = get(forceExpandedFilesAtom);
  if (expanded[fileName]) return;
  set(forceExpandedFilesAtom, { ...expanded, [fileName]: true });
  set(forceExpandVersionAtom, get(forceExpandVersionAtom) + 1);
});

export const queueToastAtom = atom(
  null,
  (get, set, args: { message: string; variant: StartupToast["variant"] }) => {
    set(startupToastsAtom, [...get(startupToastsAtom), args]);
  },
);

export const drainToastsAtom = atom(null, (get, set) => {
  const toasts = get(startupToastsAtom);
  set(startupToastsAtom, []);
  return toasts;
});

export const navigateFileAtom = atom(null, (get, set, dir: 1 | -1) => {
  const parsedFiles = get(parsedFilesAtom);
  const browsing = get(browsingAtom);
  const currentIndex = get(currentFileIndexAtom);

  if (browsing) {
    const next = (currentIndex + dir + parsedFiles.length) % parsedFiles.length;
    const f = parsedFiles[next];
    set(currentFileNameAtom, f ? getFileName(f) : null);
  } else {
    const doneFiles = get(doneFilesAtom);
    const nextIdx = findNextUndone(parsedFiles, doneFiles, currentIndex, dir);
    const f = parsedFiles[nextIdx];
    set(currentFileNameAtom, f ? getFileName(f) : null);
  }
});

export const selectFileFromPickerAtom = atom(null, (get, set, idx: number) => {
  const parsedFiles = get(parsedFilesAtom);
  const f = parsedFiles[idx];
  if (!f) return;
  set(currentFileNameAtom, getFileName(f));
  const doneFiles = get(doneFilesAtom);
  const error = get(errorAtom);
  const allDone = parsedFiles.every((_, i) => isFileDoneAt(parsedFiles, doneFiles, i)) && !error;
  if (allDone) set(browsingAtom, true);
});

export const toggleDoneByIndexAtom = atom(null, (get, set, idx: number) => {
  const parsedFiles = get(parsedFilesAtom);
  const doneFiles = get(doneFilesAtom);
  const f = parsedFiles[idx];
  if (!f) return;
  const name = getFileName(f);
  const raw = f.rawDiff || "";
  const next = new Map(doneFiles);
  if (checkFileDone(doneFiles, name, raw)) {
    next.delete(name);
  } else {
    next.set(name, diffHash(raw));
  }
  const result = saveDoneFiles(next);
  if (!result.ok) {
    set(queueToastAtom, {
      message: `Done save failed: ${result.error}`,
      variant: "warning" as const,
    });
  }
  set(doneFilesAtom, next);
});

export const toggleDoneCurrentAtom = atom(null, (get, set) => {
  const parsedFiles = get(parsedFilesAtom);
  const doneFiles = get(doneFilesAtom);
  const idx = get(currentFileIndexAtom);
  const wasDone = isFileDoneAt(parsedFiles, doneFiles, idx);

  set(toggleDoneByIndexAtom, idx);

  if (!wasDone) {
    const updatedDoneFiles = get(doneFilesAtom);
    const nextIdx = findNextUndone(parsedFiles, updatedDoneFiles, idx, 1);
    const f = parsedFiles[nextIdx];
    set(currentFileNameAtom, f ? getFileName(f) : null);
  }
});

function findNextUndone(
  parsedFiles: ParsedFile[],
  doneFiles: Map<string, number>,
  from: number,
  dir: 1 | -1,
): number {
  const len = parsedFiles.length;
  for (let step = 1; step < len; step++) {
    const idx = (from + dir * step + len) % len;
    if (!isFileDoneAt(parsedFiles, doneFiles, idx)) return idx;
  }
  return from;
}
