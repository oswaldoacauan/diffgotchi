import { atom } from "jotai";
import type { ParsedFile } from "@/lib/git/parse";
import { loadDoneFiles, loadLastFile } from "@/lib/review";

export const parsedFilesAtom = atom<ParsedFile[]>([]);
export const branchAtom = atom("");
export const errorAtom = atom<string | null>(null);
export const doneFilesAtom = atom<Map<string, number>>(loadDoneFiles());
export const currentFileNameAtom = atom<string | null>(loadLastFile());
