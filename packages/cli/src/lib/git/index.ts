import { spawn, spawnSync } from "child_process";
import { watch } from "fs";
import { DEFAULT_CONFIG } from "@/lib/config";

// --- Git command building ---

export interface GitCommandOptions {
  staged?: boolean;
  commit?: string;
  base?: string;
  head?: string;
  context?: number;
  filter?: string | string[];
  positionalFilters?: string[];
}

export interface GitCommandResult {
  args: string[];
  preCommands?: string[][];
}

const DEFAULT_CONTEXT = 6;

function contextFlag(context: number | undefined): string {
  return `-U${context ?? DEFAULT_CONTEXT}`;
}

function hasRangeSyntax(ref: string): boolean {
  return ref.includes("..") || ref.includes("...");
}

function buildFilterArgs(options: GitCommandOptions): string[] {
  const filters = Array.isArray(options.filter)
    ? options.filter
    : options.filter
      ? [options.filter]
      : [];
  const positional = options.positionalFilters ?? [];
  const all = [...filters, ...positional];

  if (all.length === 0) return [];
  return ["--", ...all];
}

export function buildGitCommand(options: GitCommandOptions): GitCommandResult {
  const ctx = contextFlag(options.context);
  const filterTokens = buildFilterArgs(options);

  if (options.base || options.commit) {
    const base = options.base ?? options.commit!;
    const head = options.head ?? "";

    const refPart = hasRangeSyntax(base) ? base : head ? `${base}...${head}` : base;

    return {
      args: ["diff", refPart, "--no-prefix", "-M", "--submodule=diff", ctx, ...filterTokens],
    };
  }

  if (options.staged) {
    return {
      args: ["diff", "--cached", "--no-prefix", "-M", "--submodule=diff", ctx, ...filterTokens],
    };
  }

  return {
    preCommands: [["add", "-N", "."]],
    args: ["diff", "--no-prefix", "-M", "--ignore-submodules=all", ctx, ...filterTokens],
  };
}

export function buildSubmoduleDiffArgs(
  paths: string[],
  options: { context?: number } = {},
): string[] {
  if (paths.length === 0) return [];
  const ctx = contextFlag(options.context);
  return ["diff", "--no-prefix", "-M", "--submodule=diff", ctx, "--", ...paths];
}

export function ensureGitRepo(): void {
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    console.error("diffgotchi: not a git repository (or any of the parent directories)");
    process.exit(1);
  }
}

export function getCurrentBranch(): string {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.stdout.toString().trim();
}

export function getDirtySubmodulePaths(): string[] {
  const result = spawnSync("git", ["submodule", "status", "--recursive"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = result.stdout.toString().trim();

  if (!output) return [];

  return output
    .split("\n")
    .filter((line) => line.startsWith("+"))
    .map((line) => line.trim().split(/\s+/)[1]!)
    .filter(Boolean);
}

// --- Git execution ---

export interface ExecResult {
  stdout: string;
  stderr: string;
  truncated: boolean;
  totalBytes: number;
}

export function execGit(args: string[], opts?: { maxOutputBytes?: number }): Promise<ExecResult> {
  const cap = opts?.maxOutputBytes ?? DEFAULT_CONFIG.diff.max_bytes;
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let bytes = 0;
    let truncated = false;
    child.stdout.on("data", (d: Buffer) => {
      const remaining = cap > 0 ? cap - bytes : Infinity;
      if (remaining > 0) chunks.push(remaining >= d.length ? d : d.subarray(0, remaining));
      bytes += d.length;
      if (cap > 0 && bytes > cap) truncated = true;
    });
    child.stderr.on("data", (d: Buffer) => errChunks.push(d));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(chunks).toString("utf-8");
      const stderr = Buffer.concat(errChunks).toString("utf-8");
      if (code !== null && code >= 128) {
        reject(new Error(`git failed (exit ${code}): ${stderr.slice(0, 500)}`));
      } else if (code !== 0 && !stdout && stderr) {
        reject(new Error(`git failed (exit ${code}): ${stderr.slice(0, 500)}`));
      } else {
        resolve({ stdout, stderr, truncated, totalBytes: bytes });
      }
    });
  });
}

// --- File watcher ---

export interface WatchOptions {
  cwd: string;
  debounceMs: number;
  onUpdate: (signal: AbortSignal) => Promise<void> | void;
}

export async function startWatcher(options: WatchOptions): Promise<() => void> {
  let timeout: NodeJS.Timeout | undefined;
  let currentController: AbortController | null = null;

  function debounced() {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (currentController) currentController.abort();
      currentController = new AbortController();
      const controller = currentController;

      Promise.resolve(options.onUpdate(controller.signal)).finally(() => {
        if (currentController === controller) currentController = null;
      });
    }, options.debounceMs);
  }

  const watcher = watch(options.cwd, { recursive: true }, (_event, filename) => {
    if (filename && !filename.includes(".git/")) debounced();
  });

  return () => {
    if (timeout) clearTimeout(timeout);
    if (currentController) currentController.abort();
    watcher.close();
  };
}
