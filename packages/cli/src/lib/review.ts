import fs from "fs";
import { join } from "path";
import { getRepoStatePath } from "@/lib/state";

// --- Done tracking ---

export function diffHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function getDoneFilePath(): string | null {
  const repoState = getRepoStatePath(true);
  return repoState ? join(repoState, "done.json") : null;
}

export function loadDoneFiles(): Map<string, number> {
  try {
    const filePath = getDoneFilePath();
    if (!filePath) return new Map();
    const raw = fs.readFileSync(filePath, "utf-8");
    const obj = JSON.parse(raw) as { files?: Record<string, number> };
    return new Map(Object.entries(obj.files ?? {}));
  } catch {
    return new Map();
  }
}

export function saveDoneFiles(done: Map<string, number>): { ok: boolean; error?: string } {
  try {
    const filePath = getDoneFilePath();
    if (!filePath) return { ok: false, error: "Not in a git repository" };

    if (done.size === 0) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // File may not exist
      }
      return { ok: true };
    }

    const obj = { updated_at: new Date().toISOString(), files: Object.fromEntries(done) };
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf-8");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Unknown write error" };
  }
}

export function isFileDone(
  doneFiles: Map<string, number>,
  filename: string,
  rawDiff: string,
): boolean {
  const stored = doneFiles.get(filename);
  return stored !== undefined && stored === diffHash(rawDiff);
}

export function findFirstUndoneIndex(
  files: Array<{ filename: string; rawDiff: string }>,
  doneFiles: Map<string, number>,
): number {
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    if (!isFileDone(doneFiles, f.filename, f.rawDiff)) return i;
  }
  return 0;
}

// --- Session persistence ---

function getSessionFilePath(): string | null {
  const repoState = getRepoStatePath(true);
  return repoState ? join(repoState, "session.json") : null;
}

export function loadLastFile(): string | null {
  try {
    const filePath = getSessionFilePath();
    if (!filePath) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const obj = JSON.parse(raw) as { last_file?: string };
    return obj.last_file ?? null;
  } catch {
    return null;
  }
}

export function saveLastFile(filename: string | null): void {
  try {
    const filePath = getSessionFilePath();
    if (!filePath) return;
    if (!filename) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    }
    fs.writeFileSync(
      filePath,
      JSON.stringify({ updated_at: new Date().toISOString(), last_file: filename }, null, 2) + "\n",
      "utf-8",
    );
  } catch {
    // Silently ignore write/delete errors
  }
}
