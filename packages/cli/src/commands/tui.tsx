import { goke, type Command } from "goke";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useRenderer } from "@opentui/react";
import { Provider } from "jotai/react";
import * as React from "react";
import { App } from "@/app";
import { parsedFilesAtom, branchAtom, currentFileNameAtom } from "@/atoms/core";
import { contextLinesAtom, initDisplay } from "@/atoms/display";
import { setReviewSessionAtom } from "@/atoms/review";
import { queueToastAtom, setFilesAtom } from "@/atoms/actions";
import { appStore } from "@/atoms/store";
import { themeNameAtom } from "@/atoms/ui";
import { GlobalErrorBoundary } from "@/components/ui/error-boundary";
import { DialogProvider } from "@/providers/dialog";
import { CommandProvider } from "@/providers/command";
import { KeybindProvider } from "@/providers/keybind";
import { ToastProvider, useToast } from "@/providers/toast";
import { loadConfig } from "@/lib/config";
import {
  buildGitCommand,
  buildSubmoduleDiffArgs,
  ensureGitRepo,
  execGit,
  getCurrentBranch,
  getDirtySubmodulePaths,
  startWatcher,
} from "@/lib/git";
import {
  buildReviewTarget,
  cleanupStaleReviewState,
  getCurrentHeadSha,
  loadOrCreateReviewSession,
  saveActiveReviewSessionId,
} from "@/lib/review-comments";
import { saveLastFile } from "@/lib/review";
import {
  filterParsedFilesByPatterns,
  getFileName,
  isIgnoredFile,
  parseGitDiffFiles,
  processFiles,
  stripSubmoduleHeaders,
  type ParsedFile,
} from "@/lib/git/parse";
import { registerParsers } from "@/lib/parsers";
import { BUILD_META } from "@/lib/update";
import { copySelection } from "@/util/selection";

interface TuiOptions {
  staged?: boolean;
  commit?: string;
  context?: number;
  filter?: string;
  theme?: string;
  session?: string;
  force?: boolean;
  "--"?: string[];
}

function CopyWrapper({ children }: { children: React.ReactNode }) {
  const renderer = useRenderer();
  const toast = useToast();
  return (
    <box
      flexGrow={1}
      flexDirection="column"
      height="100%"
      onMouseUp={() => copySelection(renderer, toast)}
    >
      {children}
    </box>
  );
}

export function createTuiCommands() {
  const cli = goke();

  registerTuiCommand(cli.command("[base] [head]", "TUI diff viewer"));
  registerTuiCommand(
    cli.command("diff [base] [head]", "TUI diff viewer with an explicit command prefix"),
  );

  return cli;
}

function registerTuiCommand(command: Command<any, any>): void {
  command
    .option("--staged", "Show staged changes")
    .option("--commit <ref>", "Show changes from a specific commit")
    .option("--context <lines>", "Number of context lines (default: 6)")
    .option("--filter <pattern>", "Filter files by glob pattern")
    .option("--theme <name>", "Theme to use")
    .option("--session <id>", "Review comment session name/id")
    .option("--force, -f", "Bypass diff size limit")
    .action(async (...args: any[]) => {
      const [base, head, options] = args as [string | undefined, string | undefined, TuiOptions];
      await runTui(base, head, options);
    });
}

async function runTui(
  base: string | undefined,
  head: string | undefined,
  options: TuiOptions,
): Promise<void> {
  ensureGitRepo();

  const config = loadConfig();
  cleanupStaleReviewState(config.storage.cleanup_stale_days);
  const initialContextLines = options.context ?? config.diff.context_lines;

  const isDefaultMode = !options.staged && !options.commit && !base && !head;

  const gitBaseOpts = {
    staged: options.staged,
    commit: options.commit,
    base,
    head,
    filter: options.filter,
    positionalFilters: options["--"],
  };

  const maxOutputBytes = options.force ? 0 : config.diff.max_bytes;

  async function fetchDiff(
    ctx?: number,
  ): Promise<{ content: string; truncated: boolean; totalBytes: number }> {
    const context = ctx ?? appStore.get(contextLinesAtom);
    const { args, preCommands } = buildGitCommand({ ...gitBaseOpts, context });

    if (preCommands) {
      for (const pre of preCommands) {
        await execGit(pre, { maxOutputBytes: 0 });
      }
    }

    const result = await execGit(args, { maxOutputBytes });
    let content = result.stdout;
    let { truncated, totalBytes } = result;

    if (isDefaultMode) {
      const dirtySubmodules = getDirtySubmodulePaths();
      if (dirtySubmodules.length > 0) {
        const subArgs = buildSubmoduleDiffArgs(dirtySubmodules, { context });
        try {
          const sub = await execGit(subArgs, { maxOutputBytes });
          if (sub.stdout.trim()) content = content + "\n" + sub.stdout;
          totalBytes += sub.totalBytes;
          if (sub.truncated) truncated = true;
        } catch (err: any) {
          appStore.set(queueToastAtom, {
            message: `Submodule diff failed: ${err?.message ?? "unknown error"}`,
            variant: "warning",
          });
        }
      }

      content = await filterCombined(content, options);
    }

    return { content: stripSubmoduleHeaders(content), truncated, totalBytes };
  }

  const currentBranch = getCurrentBranch();
  const reviewTarget = buildReviewTarget(gitBaseOpts);
  const themeName = options.theme ?? config.general.theme;

  registerParsers();

  try {
    const [diffModule, renderer] = await Promise.all([
      import("diff"),
      createCliRenderer({
        onDestroy() {
          process.exit(0);
        },
        exitOnCtrlC: true,
        useMouse: config.general.mouse,
        enableMouseMovement: true,
      }),
    ]);

    const { parsePatch, formatPatch } = diffModule;

    function parseDiff(raw: string): ParsedFile[] {
      if (!raw.trim()) return [];
      try {
        const files = processFiles(parseGitDiffFiles(raw, parsePatch), formatPatch);
        return files.filter((f) => !isIgnoredFile(getFileName(f), config.diff.ignored_files));
      } catch {
        const segments = raw.split(/(?=^diff --git )/m);
        const parsed: ParsedFile[] = [];
        for (const seg of segments) {
          if (!seg.trim()) continue;
          try {
            parsed.push(...processFiles(parseGitDiffFiles(seg, parsePatch), formatPatch));
          } catch {
            // truncated segment, skip
          }
        }
        return parsed.filter((f) => !isIgnoredFile(getFileName(f), config.diff.ignored_files));
      }
    }

    let currentFiles: ParsedFile[] = [];
    let currentError: string | null = null;
    let currentTruncation = { truncated: false, totalBytes: 0 };
    try {
      const { content, truncated, totalBytes } = await fetchDiff(initialContextLines);
      currentFiles = parseDiff(content);
      currentTruncation = { truncated, totalBytes };
    } catch (err: any) {
      currentError = err?.message ?? "Failed to load diff";
    }

    const root = createRoot(renderer);

    appStore.set(themeNameAtom, themeName);
    initDisplay(appStore, config);
    const reviewSession = loadOrCreateReviewSession({
      sessionName: options.session,
      branch: currentBranch || null,
      target: reviewTarget,
      headSha: getCurrentHeadSha(),
    });
    appStore.set(setReviewSessionAtom, reviewSession);
    saveActiveReviewSessionId(reviewSession.id);

    if (!process.env.DIFFGOTCHI_NO_UPDATE) {
      import("@/lib/update")
        .then(({ checkForUpdate }) =>
          checkForUpdate(BUILD_META.version, { channel: config.upgrade.channel }).then(
            async (info) => {
              if (!info?.available) return;

              if (config.upgrade.auto) {
                try {
                  const { performUpgrade } = await import("@/lib/update");
                  await performUpgrade(info);
                  appStore.set(queueToastAtom, {
                    message: `Updated to v${info.latest}. Restart.`,
                    variant: "success",
                  });
                  return;
                } catch {
                  // Fall through to the notification path when auto-upgrade fails.
                }
              }

              const { shouldNotifyUpdateAvailable } = await import("@/lib/update");
              if (shouldNotifyUpdateAvailable(info)) {
                appStore.set(queueToastAtom, {
                  message: `v${info.latest} available. Run diffgotchi upgrade.`,
                  variant: "info",
                });
              }
            },
          ),
        )
        .catch(() => {});
    }

    appStore.set(setFilesAtom, {
      files: currentFiles,
      error: currentError,
      truncation: currentTruncation,
    });
    appStore.set(branchAtom, currentBranch || "");
    root.render(
      <Provider store={appStore}>
        <KeybindProvider overrides={config.keybinds}>
          <GlobalErrorBoundary onQuit={() => renderer.destroy()}>
            <ToastProvider>
              <CopyWrapper>
                <DialogProvider>
                  <CommandProvider>
                    <App />
                  </CommandProvider>
                </DialogProvider>
              </CopyWrapper>
            </ToastProvider>
          </GlobalErrorBoundary>
        </KeybindProvider>
      </Provider>,
    );

    const cwd = process.cwd();
    const cleanup = await startWatcher({
      cwd,
      debounceMs: config.diff.refresh_debounce_ms,
      onUpdate: async (signal) => {
        try {
          const { content, truncated, totalBytes } = await fetchDiff();
          if (signal.aborted) return;
          const files = parseDiff(content);
          if (signal.aborted) return;
          appStore.set(setFilesAtom, { files, truncation: { truncated, totalBytes } });
        } catch (err: any) {
          if (signal.aborted) return;
          appStore.set(setFilesAtom, {
            files: appStore.get(parsedFilesAtom),
            error: err?.message ?? "Failed to load diff",
          });
        }
      },
    });

    const unsubSession = appStore.sub(currentFileNameAtom, () => {
      saveLastFile(appStore.get(currentFileNameAtom));
    });

    const unsubContext = appStore.sub(contextLinesAtom, async () => {
      try {
        const { content, truncated, totalBytes } = await fetchDiff();
        const files = parseDiff(content);
        appStore.set(setFilesAtom, { files, truncation: { truncated, totalBytes } });
      } catch (err: any) {
        appStore.set(setFilesAtom, {
          files: appStore.get(parsedFilesAtom),
          error: err?.message ?? "Failed to load diff",
        });
      }
    });

    (renderer as any).onDestroy = () => {
      cleanup();
      unsubSession();
      unsubContext();
      process.exit(0);
    };
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

async function filterCombined(
  diffContent: string,
  options: { filter?: string; "--"?: string[] },
): Promise<string> {
  if (!diffContent.trim()) return diffContent;
  const filters = [...(options.filter ? [options.filter] : []), ...(options["--"] ?? [])];
  if (filters.length === 0) return diffContent;

  const { parsePatch, formatPatch } = await import("diff");
  const parsed = parseGitDiffFiles(stripSubmoduleHeaders(diffContent), parsePatch);
  const filtered = filterParsedFilesByPatterns(parsed, { filter: filters });
  if (filtered.length === 0) return "";
  return filtered.map((f) => formatPatch(f)).join("\n");
}
