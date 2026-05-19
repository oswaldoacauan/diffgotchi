import { spawnSync } from "child_process";
import { goke } from "goke";
import { buildGitCommand, execGit, getCurrentBranch } from "@/lib/git";
import { loadConfig } from "@/lib/config";
import { BUILD_META } from "@/lib/update";
import {
  cleanupStaleReviewState,
  appendReviewComment,
  appendReviewCommentReply,
  filterReviewComments,
  listReviewSessions,
  loadActiveReviewSessionId,
  loadReviewSession,
  markReviewCommentDone,
  saveReviewSession,
  updateReviewCommentStatus,
  type NewReviewComment,
  type ReviewComment,
  type ReviewCommentStatus,
  type ReviewSession,
  type ReviewTarget,
} from "@/lib/review-comments";
import {
  getFileName,
  getOldFileName,
  isIgnoredFile,
  parseGitDiffFiles,
  processFiles,
  type ParsedFile,
} from "@/lib/git/parse";
import {
  describeReviewTarget,
  serializeComment,
  serializeCommentForList,
  serializeSession,
  serializeSessionSummary,
  summarizeReviewSession,
} from "@/commands/review-output";
import { diffHash } from "@/lib/review";
import { buildDisplayRows } from "@/util/review-comment-targets";

export function createReviewCommands() {
  const cli = goke();

  cli
    .command("review doctor", "Report review storage and current-session state")
    .action((options: any) => {
      const json = wantsJson(options);
      cleanupStaleReviewState(loadConfig().storage.cleanup_stale_days);
      const inGitRepo = isInGitRepo();
      const activeSessionId = inGitRepo ? loadActiveReviewSessionId() : null;
      const activeSession = activeSessionId ? loadReviewSession(activeSessionId) : null;
      const sessions = inGitRepo ? listReviewSessions() : [];
      const openCommentCount = sessions.reduce(
        (count, session) =>
          count + session.comments.filter((comment) => comment.status === "open").length,
        0,
      );
      const result = {
        ok: true,
        command: "review.doctor",
        version: BUILD_META.version,
        git: {
          is_repo: inGitRepo,
          branch: inGitRepo ? getCurrentBranch() || null : null,
        },
        review: {
          storage_ok: inGitRepo,
          active_session_id: activeSessionId,
          active_session_found: activeSession !== null,
          session_count: sessions.length,
          open_comment_count: openCommentCount,
        },
      };

      writeOutput(
        json,
        result,
        [
          `Review storage: ${inGitRepo ? "ok" : "not in git repo"}`,
          `Branch: ${result.git.branch ?? "none"}`,
          `Active session: ${activeSessionId ?? "none"}${activeSessionId && !activeSession ? " (missing)" : ""}`,
          `Sessions: ${sessions.length}`,
          `Open comments: ${openCommentCount}`,
        ].join("\n"),
      );
    });

  cli
    .command("review sessions list", "List review sessions")
    .option("--limit <n>", "Maximum number of sessions to return")
    .option("--all", "List sessions for all repositories")
    .action((options: any) => {
      const json = wantsJson(options);
      cleanupStaleReviewState(loadConfig().storage.cleanup_stale_days);
      if (!options.all) ensureGitRepoOrExit(json);
      const limit = parsePositiveIntegerOption(options.limit, "limit", json) ?? 100;
      const allSessions = listReviewSessions({ all: options.all === true });
      const sessions = allSessions.slice(0, limit);
      const result = {
        ok: true,
        command: "review.sessions.list",
        scope: options.all === true ? "all" : "repository",
        sessions: sessions.map(serializeSessionSummary),
        count: sessions.length,
        truncated: allSessions.length > sessions.length,
      };

      writeOutput(
        json,
        result,
        sessions.length === 0
          ? "No review sessions."
          : [
              `Review sessions (${sessions.length}${result.truncated ? "+" : ""})`,
              ...sessions.map((session) => formatSessionLine(summarizeReviewSession(session))),
            ].join("\n"),
      );
    });

  cli
    .command("review sessions current", "Read the active review session pointer")
    .action((options: any) => {
      const json = wantsJson(options);
      ensureGitRepoOrExit(json);
      const activeSessionId = loadActiveReviewSessionId();
      const session = activeSessionId ? loadReviewSession(activeSessionId) : null;
      const summary = session ? summarizeReviewSession(session) : null;
      const result = {
        ok: true,
        command: "review.sessions.current",
        session_id: activeSessionId,
        session: session ? serializeSessionSummary(session) : null,
      };

      writeOutput(
        json,
        result,
        summary
          ? `Current review session: ${formatSessionLine(summary)}`
          : "No active review session.",
      );
    });

  cli
    .command("review sessions get <session>", "Read a review session by id")
    .action((id: string, options: any) => {
      const json = wantsJson(options);
      ensureGitRepoOrExit(json);
      const session = loadReviewSession(id);
      if (!session) {
        exitError("session_not_found", `Review session not found: ${id}`, json, {
          session_id: id,
        });
      }
      const result = {
        ok: true,
        command: "review.sessions.get",
        session: serializeSession(session),
      };

      writeOutput(
        json,
        result,
        [
          `Session: ${session.id}`,
          `Branch: ${session.branch ?? "unknown"}`,
          `Target: ${describeReviewTarget(session.target)}`,
          `Head: ${session.headSha ?? "unknown"}`,
          `Comments: ${session.comments.length} (${summarizeReviewSession(session).openComments} open)`,
          `Updated: ${session.updatedAt}`,
        ].join("\n"),
      );
    });

  cli
    .command("review comments list", "List comments for a review session")
    .option("--session <id>", "Review session id (default: current)")
    .option("--status <status>", "Comment status: open, resolved, or all")
    .option("--limit <n>", "Maximum number of comments to return")
    .action((options: any) => {
      const json = wantsJson(options);
      ensureGitRepoOrExit(json);
      const session = resolveSessionOrExit(options.session, json);
      const status = parseCommentStatusOrExit(options.status, json);
      const limit = parsePositiveIntegerOption(options.limit, "limit", json) ?? 100;
      const allComments = filterReviewComments(session, status);
      const comments = allComments.slice(0, limit);

      const result = {
        ok: true,
        command: "review.comments.list",
        session_id: session.id,
        status,
        comments: comments.map(serializeCommentForList),
        count: comments.length,
        truncated: allComments.length > comments.length,
      };

      writeOutput(
        json,
        result,
        comments.length === 0
          ? `No ${status} comments for ${session.id}.`
          : [
              `Comments for ${session.id} (${status}, ${comments.length}${result.truncated ? "+" : ""})`,
              ...comments.map(formatCommentLine),
            ].join("\n"),
      );
    });

  cli
    .command("review comments add", "Add an agent-authored review comment")
    .option("--session <id>", "Review session id (default: current)")
    .option("--file <path>", "Changed file to comment on")
    .option("--line <n>", "New-file line number to comment on")
    .option("--new-line <n>", "New-file line number to comment on")
    .option("--old-line <n>", "Old-file line number to comment on")
    .option("--body <text>", "Comment body")
    .action(async (options: any) => {
      await addAgentCommentCommand(options, wantsJson(options));
    });

  cli
    .command("review comments get <comment>", "Read one review comment by id")
    .option("--session <id>", "Review session id (default: current)")
    .action((commentId: string, options: any) => {
      const json = wantsJson(options);
      ensureGitRepoOrExit(json);
      const session = resolveSessionOrExit(options.session, json);
      const comment = findCommentOrExit(session, commentId, json);

      const result = {
        ok: true,
        command: "review.comments.get",
        session_id: session.id,
        comment: serializeComment(comment),
      };

      writeOutput(
        json,
        result,
        [
          `Comment: ${comment.id} [${comment.status}]`,
          `Author: ${comment.author}`,
          `Session: ${session.id}`,
          `Location: ${formatCommentLocation(comment)}`,
          `Created: ${comment.createdAt}`,
          "Body:",
          comment.body,
        ].join("\n"),
      );
    });

  cli
    .command("review comments resolve <comment>", "Mark one review comment resolved")
    .option("--session <id>", "Review session id (default: current)")
    .action((commentId: string, options: any) => {
      updateCommentStatusCommand(
        "review.comments.resolve",
        options.session,
        commentId,
        "resolved",
        wantsJson(options),
      );
    });

  cli
    .command("review comments done <comment>", "Mark one review comment done")
    .option("--session <id>", "Review session id (default: current)")
    .option("--reply <text>", "Reply to add while marking the comment done")
    .action((commentId: string, options: any) => {
      markCommentDoneCommand(
        options.session,
        commentId,
        parseOptionalText(options.reply),
        wantsJson(options),
      );
    });

  cli
    .command("review comments reply <comment>", "Add a reply to one review comment")
    .option("--session <id>", "Review session id (default: current)")
    .option("--body <text>", "Reply body")
    .action((commentId: string, options: any) => {
      addCommentReplyCommand(
        options.session,
        commentId,
        parseRequiredText(options.body, "body", wantsJson(options)),
        wantsJson(options),
      );
    });

  cli
    .command("review comments reopen <comment>", "Reopen one resolved review comment")
    .option("--session <id>", "Review session id (default: current)")
    .action((commentId: string, options: any) => {
      updateCommentStatusCommand(
        "review.comments.reopen",
        options.session,
        commentId,
        "open",
        wantsJson(options),
      );
    });

  return cli;
}

function markCommentDoneCommand(
  sessionId: unknown,
  commentId: string,
  replyBody: string | undefined,
  json: boolean,
) {
  ensureGitRepoOrExit(json);
  const session = resolveSessionOrExit(sessionId, json);
  const previous = findCommentOrExit(session, commentId, json);
  const nextSession = markReviewCommentDone(session, commentId, replyBody, "agent");
  const result = saveReviewSession(nextSession);
  if (!result.ok) {
    exitError("save_failed", result.error ?? "Failed to save review session", json, {
      session_id: session.id,
      comment_id: commentId,
    });
  }
  const updated = findCommentOrExit(nextSession, commentId, json);
  const output = {
    ok: true,
    command: "review.comments.done",
    session_id: nextSession.id,
    comment_id: updated.id,
    status: updated.status,
    previous_status: previous.status,
    reply_count: updated.replies?.length ?? 0,
  };

  writeOutput(
    json,
    output,
    replyBody
      ? `Done ${updated.id} with reply (was ${previous.status})`
      : `Done ${updated.id} (was ${previous.status})`,
  );
}

function addCommentReplyCommand(
  sessionId: unknown,
  commentId: string,
  body: string,
  json: boolean,
) {
  ensureGitRepoOrExit(json);
  const session = resolveSessionOrExit(sessionId, json);
  findCommentOrExit(session, commentId, json);
  const nextSession = appendReviewCommentReply(session, commentId, body, "agent");
  const result = saveReviewSession(nextSession);
  if (!result.ok) {
    exitError("save_failed", result.error ?? "Failed to save review session", json, {
      session_id: session.id,
      comment_id: commentId,
    });
  }
  const updated = findCommentOrExit(nextSession, commentId, json);
  const output = {
    ok: true,
    command: "review.comments.reply",
    session_id: nextSession.id,
    comment_id: updated.id,
    reply_count: updated.replies?.length ?? 0,
  };

  writeOutput(json, output, `Replied to ${updated.id}`);
}

async function addAgentCommentCommand(options: any, json: boolean): Promise<void> {
  ensureGitRepoOrExit(json);
  const session = resolveSessionOrExit(options.session, json);
  const fileName = parseRequiredText(options.file, "file", json);
  const body = parseRequiredText(options.body, "body", json);
  const lineTarget = parseCommentLineTargetOrExit(options, json);
  const files = await loadReviewDiffFiles(session, json);
  const file = files.find((item) => {
    const current = getFileName(item);
    return current === fileName || getOldFileName(item) === fileName;
  });

  if (!file) {
    exitError("file_not_in_diff", `Changed file not found in review diff: ${fileName}`, json, {
      session_id: session.id,
      file: fileName,
    });
  }

  const comment = buildAgentCommentForFile(file, lineTarget, body, json);
  const nextSession = appendReviewComment(session, comment);
  const result = saveReviewSession(nextSession);
  if (!result.ok) {
    exitError("save_failed", result.error ?? "Failed to save review session", json, {
      session_id: session.id,
    });
  }

  const created = nextSession.comments.at(-1)!;
  const output = {
    ok: true,
    command: "review.comments.add",
    session_id: nextSession.id,
    comment_id: created.id,
    comment: serializeComment(created),
  };

  writeOutput(
    json,
    output,
    `Added agent comment ${created.id} at ${formatCommentLocation(created)}`,
  );
}

interface CommentLineTarget {
  oldLine: number | null;
  newLine: number | null;
}

function parseCommentLineTargetOrExit(options: any, json: boolean): CommentLineTarget {
  const line = parsePositiveIntegerOption(options.line, "line", json);
  const explicitNewLine = parsePositiveIntegerOption(
    options.newLine ?? options["new-line"],
    "new-line",
    json,
  );
  const oldLine = parsePositiveIntegerOption(
    options.oldLine ?? options["old-line"],
    "old-line",
    json,
  );
  const newLine = explicitNewLine ?? line;

  if (line != null && explicitNewLine != null && line !== explicitNewLine) {
    exitError("invalid_option", "--line and --new-line must match when both are provided.", json, {
      line,
      new_line: explicitNewLine,
    });
  }

  return { oldLine, newLine };
}

async function loadReviewDiffFiles(session: ReviewSession, json: boolean): Promise<ParsedFile[]> {
  try {
    const config = loadConfig();
    const { args, preCommands } = buildGitCommand({
      ...gitOptionsForReviewTarget(session.target),
      context: config.diff.context_lines,
    });
    if (preCommands) {
      for (const pre of preCommands) {
        await execGit(pre, { maxOutputBytes: 0 });
      }
    }

    const result = await execGit(args, { maxOutputBytes: config.diff.max_bytes });
    const { parsePatch, formatPatch } = await import("diff");
    return processFiles(parseGitDiffFiles(result.stdout, parsePatch), formatPatch).filter(
      (file) => !isIgnoredFile(getFileName(file), config.diff.ignored_files),
    );
  } catch (err: any) {
    exitError("diff_load_failed", err?.message ?? "Failed to load review diff.", json, {
      session_id: session.id,
    });
  }
}

function gitOptionsForReviewTarget(target: ReviewTarget) {
  return {
    staged: target.kind === "staged" ? true : undefined,
    commit: target.kind === "commit" ? target.commit : undefined,
    base: target.kind === "range" ? target.base : undefined,
    head: target.kind === "range" ? target.head : undefined,
    filter: target.filters,
  };
}

function buildAgentCommentForFile(
  file: ParsedFile,
  target: CommentLineTarget,
  body: string,
  json: boolean,
): NewReviewComment {
  const fileName = getFileName(file);
  const oldFileName = getOldFileName(file);
  const base = {
    author: "agent" as const,
    file: fileName,
    oldFile: oldFileName,
    body,
    diffHashAtCreate: diffHash(file.rawDiff || ""),
  };

  if (target.oldLine == null && target.newLine == null) {
    return {
      ...base,
      side: "file",
      oldLine: null,
      newLine: null,
      hunkIndex: -1,
    };
  }

  for (let hunkIndex = 0; hunkIndex < file.hunks.length; hunkIndex++) {
    const hunk = file.hunks[hunkIndex]!;
    const rows = buildDisplayRows(hunk);
    for (let diffLineIndex = 0; diffLineIndex < rows.length; diffLineIndex++) {
      const row = rows[diffLineIndex]!;
      if (!matchesCommentLineTarget(row, target)) continue;

      const marker = row.marker;
      const side = marker === "-" ? "old" : marker === "+" ? "new" : "context";
      return {
        ...base,
        side,
        oldLine: row.oldLine,
        newLine: row.newLine,
        hunkIndex,
        diffLineIndex,
        code: row.raw.slice(1),
      };
    }
  }

  exitError("line_not_in_diff", "Line not found in review diff.", json, {
    file: fileName,
    old_line: target.oldLine,
    new_line: target.newLine,
  });
}

function matchesCommentLineTarget(
  row: { marker: string | undefined; oldLine: number | null; newLine: number | null },
  target: CommentLineTarget,
): boolean {
  if (target.oldLine != null && row.oldLine !== target.oldLine) return false;
  if (target.newLine != null && row.newLine !== target.newLine) return false;
  if (target.oldLine != null || target.newLine != null) return row.marker !== undefined;
  return false;
}

function updateCommentStatusCommand(
  command: string,
  sessionId: unknown,
  commentId: string,
  status: ReviewCommentStatus,
  json: boolean,
) {
  ensureGitRepoOrExit(json);
  const session = resolveSessionOrExit(sessionId, json);
  const previous = findCommentOrExit(session, commentId, json);
  const nextSession = updateReviewCommentStatus(session, commentId, status);
  const result = saveReviewSession(nextSession);
  if (!result.ok) {
    exitError("save_failed", result.error ?? "Failed to save review session", json, {
      session_id: session.id,
      comment_id: commentId,
    });
  }
  const updated = findCommentOrExit(nextSession, commentId, json);
  const output = {
    ok: true,
    command,
    session_id: nextSession.id,
    comment_id: updated.id,
    status: updated.status,
    previous_status: previous.status,
  };

  writeOutput(
    json,
    output,
    `${status === "resolved" ? "Resolved" : "Reopened"} ${updated.id} (was ${previous.status})`,
  );
}

function resolveSessionOrExit(value: unknown, json: boolean): ReviewSession {
  const requested = typeof value === "string" && value.trim() ? value.trim() : "current";
  const sessionId = requested === "current" ? loadActiveReviewSessionId() : requested;

  if (!sessionId) {
    exitError("no_active_session", "No active review session. Pass --session <id>.", json, {
      next_command: "diffgotchi --json review sessions list",
    });
  }

  const session = loadReviewSession(sessionId);
  if (!session) {
    exitError("session_not_found", `Review session not found: ${sessionId}`, json, {
      session_id: sessionId,
    });
  }

  return session;
}

function findCommentOrExit(
  session: ReviewSession,
  commentId: string,
  json: boolean,
): ReviewComment {
  const comment = session.comments.find((item) => item.id === commentId);
  if (!comment) {
    exitError("comment_not_found", `Review comment not found: ${commentId}`, json, {
      session_id: session.id,
      comment_id: commentId,
    });
  }
  return comment;
}

function parseCommentStatusOrExit(
  value: unknown,
  json: boolean,
): ReviewCommentStatus | "done" | "all" {
  if (value == null || value === "") return "open";
  if (value === "open" || value === "resolved" || value === "done" || value === "all") {
    return value;
  }
  exitError("invalid_status", "Status must be one of: open, resolved, done, all.", json, {
    status: value,
  });
}

function parseOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseRequiredText(value: unknown, name: string, json: boolean): string {
  const trimmed = parseOptionalText(value);
  if (!trimmed) {
    exitError("invalid_option", `--${name} is required.`, json, { [name]: value });
  }
  return trimmed;
}

function parsePositiveIntegerOption(value: unknown, name: string, json: boolean): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    exitError("invalid_option", `--${name} must be a positive integer.`, json, { [name]: value });
  }
  return parsed;
}

function wantsJson(options: any): boolean {
  return options?.json === true;
}

function writeOutput(json: boolean, value: unknown, text: string): void {
  if (json) {
    writeJson(value);
    return;
  }
  console.log(text);
}

type ReviewSessionSummary = ReturnType<typeof summarizeReviewSession>;

function formatSessionLine(session: ReviewSessionSummary): string {
  const parts = [
    session.id,
    `${session.openComments}/${session.comments} open`,
    session.branch ?? "unknown",
    describeReviewTarget(session.target),
    session.updatedAt,
  ];
  if (session.repoRoot) parts.push(session.repoRoot);
  return parts.join("  ");
}

function formatCommentLine(comment: ReviewComment): string {
  const body = truncateText(comment.body.replace(/\s+/g, " "), 96);
  return `${comment.id} [${comment.author}/${comment.status}] ${formatCommentLocation(comment)} ${body}`;
}

function formatCommentLocation(comment: ReviewComment): string {
  if (comment.newLine != null) return `${comment.file}:${comment.newLine}`;
  if (comment.oldLine != null) return `${comment.file}:-${comment.oldLine}`;
  return comment.file;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function isInGitRepo(): boolean {
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 && result.stdout.toString().trim() === "true";
}

function ensureGitRepoOrExit(json: boolean): void {
  if (isInGitRepo()) return;
  exitError("not_git_repo", "Not a git repository.", json);
}

function writeJson(value: unknown): void {
  console.log(JSON.stringify(value));
}

function exitError(
  code: string,
  message: string,
  json: boolean,
  details?: Record<string, unknown>,
): never {
  if (json) {
    process.stderr.write(
      JSON.stringify({
        ok: false,
        error: {
          code,
          message,
          ...(details ? { details } : {}),
        },
      }) + "\n",
    );
    process.exit(1);
  }

  process.stderr.write(`diffgotchi: ${message}\n`);
  process.exit(1);
}
