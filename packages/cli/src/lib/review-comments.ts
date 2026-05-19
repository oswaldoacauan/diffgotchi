import { execSync } from "child_process";
import { createHash, randomUUID } from "crypto";
import fs from "fs";
import { join } from "path";
import {
  cleanupStaleJsonFiles,
  getCurrentRepoKey,
  getCurrentRepoRoot,
  getRepoStatePath,
  getStateRootPath,
} from "@/lib/state";

export type ReviewTargetKind = "worktree" | "staged" | "commit" | "range";
export type ReviewCommentSide = "old" | "new" | "context" | "file";
export type ReviewCommentDisplaySide = "left" | "right" | "both";
export type ReviewCommentStatus = "open" | "resolved";
export type ReviewCommentAuthor = "user" | "agent";

export interface ReviewCommentReply {
  id: string;
  author: ReviewCommentAuthor;
  body: string;
  createdAt: string;
}

export interface ReviewTarget {
  kind: ReviewTargetKind;
  base?: string;
  head?: string;
  commit?: string;
  filters?: string[];
}

export interface ReviewComment {
  id: string;
  author: ReviewCommentAuthor;
  file: string;
  oldFile?: string | null;
  side: ReviewCommentSide;
  oldLine?: number | null;
  newLine?: number | null;
  displaySide?: ReviewCommentDisplaySide;
  hunkIndex?: number;
  diffLineIndex?: number;
  code?: string;
  body: string;
  status: ReviewCommentStatus;
  replies?: ReviewCommentReply[];
  createdAt: string;
  updatedAt: string;
  diffHashAtCreate: number;
}

export interface ReviewSession {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  repoRoot?: string | null;
  repoKey?: string | null;
  branch: string | null;
  target: ReviewTarget;
  headSha: string | null;
  comments: ReviewComment[];
}

export type NewReviewComment = Omit<ReviewComment, "id" | "status" | "createdAt" | "updatedAt"> & {
  id?: string;
  status?: ReviewCommentStatus;
};

export interface ReviewTargetInput {
  staged?: boolean;
  commit?: string;
  base?: string;
  head?: string;
  filter?: string | string[];
  positionalFilters?: string[];
}

export interface SelectedCommentTarget {
  file: string;
  oldFile: string | null;
  side: ReviewCommentSide;
  oldLine: number | null;
  newLine: number | null;
  displaySide?: ReviewCommentDisplaySide;
  hunkIndex?: number;
  diffLineIndex?: number;
  code?: string;
}

const REVIEW_SESSIONS_DIR = "reviews";
const ACTIVE_SESSION_FILE = "current-session.json";

export interface ReviewStorageInfo {
  root: string | null;
  sessions: string | null;
  activeSessionFile: string | null;
  repoRoot: string | null;
  repoKey: string | null;
}

export function buildReviewTarget(input: ReviewTargetInput): ReviewTarget {
  const filters = [
    ...(Array.isArray(input.filter) ? input.filter : input.filter ? [input.filter] : []),
    ...(input.positionalFilters ?? []),
  ];

  const withFilters = (target: ReviewTarget): ReviewTarget =>
    filters.length > 0 ? { ...target, filters } : target;

  if (input.commit) return withFilters({ kind: "commit", commit: input.commit });
  if (input.base || input.head) {
    return withFilters({ kind: "range", base: input.base, head: input.head });
  }
  if (input.staged) return withFilters({ kind: "staged" });
  return withFilters({ kind: "worktree" });
}

export function getCurrentHeadSha(): string | null {
  try {
    return execSync("git rev-parse HEAD", { stdio: "pipe" }).toString().trim() || null;
  } catch {
    return null;
  }
}

export function createReviewSessionId(
  target: ReviewTarget,
  branch: string | null,
  explicitName?: string,
): string {
  if (explicitName && explicitName !== "current") return sanitizeSessionId(explicitName);

  const hash = createHash("sha1")
    .update(stableStringify({ branch, target }))
    .digest("hex")
    .slice(0, 10);
  return `${target.kind}-${sanitizeSessionId(branch || "detached")}-${hash}`;
}

export function loadOrCreateReviewSession(input: {
  sessionName?: string;
  branch: string | null;
  target: ReviewTarget;
  headSha?: string | null;
}): ReviewSession {
  const id = createReviewSessionId(input.target, input.branch, input.sessionName);
  const existing = loadReviewSession(id);
  if (existing) {
    const next: ReviewSession = {
      ...existing,
      repoRoot: existing.repoRoot ?? getCurrentRepoRoot(),
      repoKey: existing.repoKey ?? getCurrentRepoKey(),
      branch: existing.branch ?? input.branch,
      target: existing.target ?? input.target,
      headSha: input.headSha ?? existing.headSha ?? null,
    };
    saveReviewSession(next);
    return next;
  }

  const now = new Date().toISOString();
  const session: ReviewSession = {
    schemaVersion: 1,
    id,
    createdAt: now,
    updatedAt: now,
    repoRoot: getCurrentRepoRoot(),
    repoKey: getCurrentRepoKey(),
    branch: input.branch,
    target: input.target,
    headSha: input.headSha ?? null,
    comments: [],
  };
  saveReviewSession(session);
  return session;
}

export function appendReviewComment(
  session: ReviewSession,
  input: NewReviewComment,
): ReviewSession {
  const now = new Date().toISOString();
  const comment: ReviewComment = {
    ...input,
    id: input.id ?? `cmt_${randomUUID()}`,
    status: input.status ?? "open",
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...session,
    updatedAt: now,
    comments: [...session.comments, comment],
  };
}

export function updateReviewCommentStatus(
  session: ReviewSession,
  commentId: string,
  status: ReviewCommentStatus,
): ReviewSession {
  const now = new Date().toISOString();
  return {
    ...session,
    updatedAt: now,
    comments: session.comments.map((comment) =>
      comment.id === commentId ? { ...comment, status, updatedAt: now } : comment,
    ),
  };
}

export function markReviewCommentDone(
  session: ReviewSession,
  commentId: string,
  replyBody?: string,
  replyAuthor?: ReviewCommentAuthor,
): ReviewSession {
  const now = new Date().toISOString();
  const body = replyBody?.trim();
  return {
    ...session,
    updatedAt: now,
    comments: session.comments.map((comment) => {
      if (comment.id !== commentId) return comment;
      return {
        ...comment,
        status: "resolved",
        replies: body
          ? [...(comment.replies ?? []), createCommentReply(body, replyAuthor ?? "agent", now)]
          : comment.replies,
        updatedAt: now,
      };
    }),
  };
}

export function appendReviewCommentReply(
  session: ReviewSession,
  commentId: string,
  body: string,
  author: ReviewCommentAuthor,
): ReviewSession {
  const now = new Date().toISOString();
  return {
    ...session,
    updatedAt: now,
    comments: session.comments.map((comment) =>
      comment.id === commentId
        ? {
            ...comment,
            replies: [...(comment.replies ?? []), createCommentReply(body.trim(), author, now)],
            updatedAt: now,
          }
        : comment,
    ),
  };
}

export function updateReviewCommentBody(
  session: ReviewSession,
  commentId: string,
  body: string,
): ReviewSession {
  const now = new Date().toISOString();
  return {
    ...session,
    updatedAt: now,
    comments: session.comments.map((comment) =>
      comment.id === commentId ? { ...comment, body, updatedAt: now } : comment,
    ),
  };
}

export function deleteReviewComment(session: ReviewSession, commentId: string): ReviewSession {
  const now = new Date().toISOString();
  return {
    ...session,
    updatedAt: now,
    comments: session.comments.filter((comment) => comment.id !== commentId),
  };
}

export function saveReviewSession(session: ReviewSession): { ok: boolean; error?: string } {
  try {
    const filePath = getReviewSessionFilePath(session.id, true);
    if (!filePath) return { ok: false, error: "Not in a git repository" };
    fs.writeFileSync(filePath, JSON.stringify(toStoredSession(session), null, 2) + "\n", "utf-8");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Unknown write error" };
  }
}

export function loadReviewSession(id: string): ReviewSession | null {
  try {
    const filePath = getReviewSessionFilePath(id, false);
    const source = filePath && fs.existsSync(filePath) ? filePath : findReviewSessionFilePath(id);
    if (!source || !fs.existsSync(source)) return null;
    return normalizeSession(JSON.parse(fs.readFileSync(source, "utf-8")));
  } catch {
    return null;
  }
}

export function listReviewSessions(options: { all?: boolean } = {}): ReviewSession[] {
  try {
    const roots = getReviewSessionsPaths(options.all === true);
    return roots
      .flatMap((root) =>
        fs.existsSync(root)
          ? fs
              .readdirSync(root)
              .filter((name) => name.endsWith(".json"))
              .map((name) => loadReviewSessionFile(join(root, name)))
          : [],
      )
      .filter((session): session is ReviewSession => session !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveActiveReviewSessionId(id: string): void {
  try {
    const root = getRepoStatePath(true);
    if (!root) return;
    fs.writeFileSync(
      join(root, ACTIVE_SESSION_FILE),
      JSON.stringify({ id, updated_at: new Date().toISOString() }, null, 2) + "\n",
      "utf-8",
    );
  } catch {
    // Active session metadata is best-effort.
  }
}

export function loadActiveReviewSessionId(): string | null {
  try {
    const root = getRepoStatePath(false);
    if (!root) return null;
    const filePath = join(root, ACTIVE_SESSION_FILE);
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
      id?: unknown;
      updated_at?: unknown;
    };
    const id = typeof parsed.id === "string" ? parsed.id : null;
    return id;
  } catch {
    return null;
  }
}

export function getReviewStorageInfo(): ReviewStorageInfo {
  const root = getStateRootPath(false);
  const repoKey = getCurrentRepoKey();
  const repoState = getRepoStatePath(false);
  return {
    root,
    sessions: repoKey ? join(root, REVIEW_SESSIONS_DIR, repoKey) : null,
    activeSessionFile: repoState ? join(repoState, ACTIVE_SESSION_FILE) : null,
    repoRoot: getCurrentRepoRoot(),
    repoKey,
  };
}

export function cleanupStaleReviewState(retentionDays: number): number {
  if (retentionDays <= 0) return 0;
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const root = getStateRootPath(false);
  let removed = cleanupStaleJsonFiles(join(root, REVIEW_SESSIONS_DIR), cutoffMs, (value) => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    return typeof record.updated_at === "string" ? Date.parse(record.updated_at) || null : null;
  });
  removed += cleanupStaleJsonFiles(join(root, "repositories"), cutoffMs, (value) => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    return typeof record.updated_at === "string" ? Date.parse(record.updated_at) || null : null;
  });
  return removed;
}

export function filterReviewComments(
  session: ReviewSession,
  status: ReviewCommentStatus | "done" | "all" = "open",
): ReviewComment[] {
  if (status === "all") return session.comments;
  const normalized = status === "done" ? "resolved" : status;
  return session.comments.filter((comment) => comment.status === normalized);
}

function createCommentReply(
  body: string,
  author: ReviewCommentAuthor,
  createdAt: string,
): ReviewCommentReply {
  return {
    id: `reply_${randomUUID()}`,
    author,
    body,
    createdAt,
  };
}

function getReviewSessionFilePath(id: string, ensureDir: boolean): string | null {
  const root = getReviewSessionsPath(ensureDir);
  if (!root) return null;
  return join(root, `${sanitizeSessionId(id)}.json`);
}

function getReviewSessionsPath(ensureDir: boolean): string | null {
  const repoKey = getCurrentRepoKey();
  if (!repoKey) return null;
  const sessions = join(getStateRootPath(ensureDir), REVIEW_SESSIONS_DIR, repoKey);
  if (ensureDir) fs.mkdirSync(sessions, { recursive: true });
  return sessions;
}

function getReviewSessionsPaths(all: boolean): string[] {
  const root = join(getStateRootPath(false), REVIEW_SESSIONS_DIR);
  if (!all) {
    const current = getReviewSessionsPath(false);
    return current ? [current] : [];
  }
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name));
}

function findReviewSessionFilePath(id: string): string | null {
  const fileName = `${sanitizeSessionId(id)}.json`;
  for (const root of getReviewSessionsPaths(true)) {
    const candidate = join(root, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function loadReviewSessionFile(path: string): ReviewSession | null {
  try {
    return normalizeSession(JSON.parse(fs.readFileSync(path, "utf-8")));
  } catch {
    return null;
  }
}

function sanitizeSessionId(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return sanitized || "default";
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function toStoredSession(session: ReviewSession): Record<string, unknown> {
  return {
    schema_version: session.schemaVersion,
    id: session.id,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    repo_root: session.repoRoot,
    repo_key: session.repoKey,
    branch: session.branch,
    target: session.target,
    head_sha: session.headSha,
    comments: session.comments.map(toStoredComment),
  };
}

function toStoredComment(comment: ReviewComment): Record<string, unknown> {
  return {
    id: comment.id,
    author: comment.author,
    file: comment.file,
    old_file: comment.oldFile ?? null,
    side: comment.side,
    old_line: comment.oldLine ?? null,
    new_line: comment.newLine ?? null,
    ...(comment.displaySide ? { display_side: comment.displaySide } : {}),
    ...(typeof comment.hunkIndex === "number" ? { hunk_index: comment.hunkIndex } : {}),
    ...(typeof comment.diffLineIndex === "number"
      ? { diff_line_index: comment.diffLineIndex }
      : {}),
    ...(comment.code ? { code: comment.code } : {}),
    body: comment.body,
    status: comment.status,
    ...(comment.replies && comment.replies.length > 0
      ? {
          replies: comment.replies.map((reply) => ({
            id: reply.id,
            author: reply.author,
            body: reply.body,
            created_at: reply.createdAt,
          })),
        }
      : {}),
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
    diff_hash_at_create: comment.diffHashAtCreate,
  };
}

function normalizeSession(value: any): ReviewSession | null {
  if (!value || typeof value !== "object") return null;
  if (value.schema_version !== 1 || typeof value.id !== "string") return null;
  return {
    schemaVersion: 1,
    id: value.id,
    createdAt: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
    updatedAt: typeof value.updated_at === "string" ? value.updated_at : new Date().toISOString(),
    repoRoot: typeof value.repo_root === "string" ? value.repo_root : null,
    repoKey: typeof value.repo_key === "string" ? value.repo_key : null,
    branch: typeof value.branch === "string" ? value.branch : null,
    target: normalizeTarget(value.target),
    headSha: typeof value.head_sha === "string" ? value.head_sha : null,
    comments: Array.isArray(value.comments)
      ? value.comments.map(normalizeComment).filter(Boolean)
      : [],
  };
}

function normalizeTarget(value: any): ReviewTarget {
  if (!value || typeof value !== "object") return { kind: "worktree" };
  const kind: ReviewTargetKind =
    value.kind === "staged" || value.kind === "commit" || value.kind === "range"
      ? value.kind
      : "worktree";
  return {
    kind,
    base: typeof value.base === "string" ? value.base : undefined,
    head: typeof value.head === "string" ? value.head : undefined,
    commit: typeof value.commit === "string" ? value.commit : undefined,
    filters: Array.isArray(value.filters)
      ? value.filters.filter((item: unknown): item is string => typeof item === "string")
      : undefined,
  };
}

function normalizeComment(value: any): ReviewComment | null {
  if (!value || typeof value !== "object") return null;
  if (typeof value.id !== "string" || typeof value.file !== "string") return null;
  if (typeof value.body !== "string") return null;
  if (!isReviewCommentAuthor(value.author)) return null;
  return {
    id: value.id,
    author: value.author,
    file: value.file,
    oldFile: typeof value.old_file === "string" ? value.old_file : null,
    side:
      value.side === "old" || value.side === "new" || value.side === "context"
        ? value.side
        : "file",
    oldLine: typeof value.old_line === "number" ? value.old_line : null,
    newLine: typeof value.new_line === "number" ? value.new_line : null,
    displaySide:
      value.display_side === "left" ||
      value.display_side === "right" ||
      value.display_side === "both"
        ? value.display_side
        : undefined,
    hunkIndex: typeof value.hunk_index === "number" ? value.hunk_index : undefined,
    diffLineIndex: typeof value.diff_line_index === "number" ? value.diff_line_index : undefined,
    code: typeof value.code === "string" ? value.code : undefined,
    body: value.body,
    status: value.status === "resolved" ? "resolved" : "open",
    replies: Array.isArray(value.replies)
      ? value.replies.map(normalizeCommentReply).filter(Boolean)
      : undefined,
    createdAt: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
    updatedAt: typeof value.updated_at === "string" ? value.updated_at : new Date().toISOString(),
    diffHashAtCreate: typeof value.diff_hash_at_create === "number" ? value.diff_hash_at_create : 0,
  };
}

function normalizeCommentReply(value: any): ReviewCommentReply | null {
  if (!value || typeof value !== "object") return null;
  if (typeof value.id !== "string" || typeof value.body !== "string") return null;
  if (!isReviewCommentAuthor(value.author)) return null;
  return {
    id: value.id,
    author: value.author,
    body: value.body,
    createdAt: typeof value.created_at === "string" ? value.created_at : new Date().toISOString(),
  };
}

function isReviewCommentAuthor(value: unknown): value is ReviewCommentAuthor {
  return value === "user" || value === "agent";
}
