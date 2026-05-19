import type { StructuredPatch, StructuredPatchHunk } from "diff";
import { extname } from "path";

export interface HunkInfo {
  label: string;
  oldStart: number;
  newStart: number;
  hiddenLines: number;
  diff: string;
}

export interface ParsedFile extends StructuredPatch {
  rawDiff?: string;
  hunkInfos?: HunkInfo[];
}

const DEFAULT_IGNORED_PATTERNS = [
  "\\.lock$",
  "lock\\.json$",
  "lock\\.yaml$",
  "lock\\.toml$",
  "\\.sum$",
];

const SUBPROJECT_RE = /^Subproject commit [a-f0-9]+\n?/gm;

export function parseGitDiffFiles(
  content: string,
  parsePatch: (diff: string) => StructuredPatch[],
): ParsedFile[] {
  return parsePatch(content) as ParsedFile[];
}

export function processFiles(
  files: ParsedFile[],
  formatPatch: (patch: StructuredPatch) => string,
): ParsedFile[] {
  return files.map((file) => {
    const rawDiff = formatPatch(file);
    const labels = extractHunkLabels(rawDiff);
    const hunkInfos = file.hunks.map((hunk, i) => {
      const prevEnd = i > 0 ? file.hunks[i - 1]!.oldStart + file.hunks[i - 1]!.oldLines : 1;
      return {
        label: labels[i] || "",
        oldStart: hunk.oldStart,
        newStart: hunk.newStart,
        hiddenLines: Math.max(0, hunk.oldStart - prevEnd),
        diff: formatPatch({ ...file, hunks: [hunk] }),
      };
    });
    return { ...file, rawDiff, hunkInfos };
  });
}

function extractHunkLabels(rawDiff: string): string[] {
  const labels: string[] = [];
  for (const line of rawDiff.split("\n")) {
    if (line.startsWith("@@")) {
      const match = line.match(/^@@\s[^@]+@@\s*(.*)/);
      labels.push(match?.[1]?.trim() || "");
    }
  }
  return labels;
}

export function stripSubmoduleHeaders(diff: string): string {
  return diff.replace(SUBPROJECT_RE, "");
}

export function getFilterPatterns(options: {
  filter?: string | string[];
  positionalFilters?: string[];
}): string[] {
  const filters = Array.isArray(options.filter)
    ? options.filter
    : options.filter
      ? [options.filter]
      : [];
  return [...filters, ...(options.positionalFilters ?? [])];
}

function matchesGlob(filename: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    // eslint-disable-next-line no-control-regex
    .replace(/\0/g, ".*")
    .replace(/\?/g, ".");

  return new RegExp(`^${escaped}$`).test(filename);
}

export function filterParsedFilesByPatterns(
  files: ParsedFile[],
  options: { filter?: string | string[]; positionalFilters?: string[] },
): ParsedFile[] {
  const patterns = getFilterPatterns(options);
  if (patterns.length === 0) return files;

  return files.filter((file) => {
    const name = getFileName(file);
    return patterns.some((pattern) => matchesGlob(name, pattern));
  });
}

export function getFileName(file: StructuredPatch): string {
  return file.newFileName === "/dev/null" ? (file.oldFileName ?? "") : (file.newFileName ?? "");
}

export function getOldFileName(file: StructuredPatch): string | null {
  if (!file.oldFileName || file.oldFileName === "/dev/null") return null;
  if (file.oldFileName === file.newFileName) return null;
  return file.oldFileName;
}

export function getFileStatus(file: StructuredPatch): "added" | "modified" | "deleted" | "renamed" {
  if (file.oldFileName === "/dev/null") return "added";
  if (file.newFileName === "/dev/null") return "deleted";
  if (file.oldFileName !== file.newFileName) return "renamed";
  return "modified";
}

export function countChanges(hunks: StructuredPatchHunk[]): {
  additions: number;
  deletions: number;
} {
  let additions = 0;
  let deletions = 0;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith("+")) additions++;
      else if (line.startsWith("-")) deletions++;
    }
  }

  return { additions, deletions };
}

// Split view becomes unreadable when columns get too narrow.
const DEFAULT_SPLIT_THRESHOLD = 40;

export function getViewMode(
  additions: number,
  deletions: number,
  width: number,
  threshold: number = DEFAULT_SPLIT_THRESHOLD,
): "split" | "unified" {
  if (width / 2 < threshold) return "unified";
  if (additions === 0 || deletions === 0) return "unified";
  return "split";
}

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".js": "typescript",
  ".mjs": "typescript",
  ".cjs": "typescript",
  ".jsx": "typescript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "typescript",
  ".md": "markdown",
  ".mdx": "markdown",
  ".markdown": "markdown",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".cc": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".csx": "csharp",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".rb": "ruby",
  ".rake": "ruby",
  ".gemspec": "ruby",
  ".php": "php",
  ".scala": "scala",
  ".swift": "swift",
  ".lua": "lua",
  ".hs": "haskell",
  ".lhs": "haskell",
  ".ml": "ocaml",
  ".mli": "ocaml",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".cljc": "clojure",
  ".jl": "julia",
  ".nix": "nix",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".ksh": "bash",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".hcl": "hcl",
  ".tf": "hcl",
  ".tfvars": "hcl",
};

const FILENAME_TO_LANGUAGE: Record<string, string> = {
  Dockerfile: "typescript",
  Makefile: "bash",
  makefile: "bash",
  Gemfile: "ruby",
  Rakefile: "ruby",
};

export function detectFiletype(filename: string, overrides?: Record<string, string>): string {
  const base = filename.split("/").pop() ?? filename;
  const ext = extname(base).toLowerCase();

  if (overrides?.[ext]) return overrides[ext]!;
  if (overrides?.[base]) return overrides[base]!;

  return FILENAME_TO_LANGUAGE[base] ?? EXTENSION_TO_LANGUAGE[ext] ?? "text";
}

export function countDiffLines(file: ParsedFile): number {
  if (!file.rawDiff) return 0;
  return file.rawDiff.split("\n").length;
}

export function isIgnoredFile(filename: string, patterns?: string[]): boolean {
  const list = patterns ?? DEFAULT_IGNORED_PATTERNS;
  return list.some((pattern) => new RegExp(pattern).test(filename));
}
