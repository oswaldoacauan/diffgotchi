import type { ReviewComment, ReviewSession, ReviewTarget } from "@/lib/review-comments";

export function summarizeReviewSession(session: ReviewSession) {
  const openComments = session.comments.filter((comment) => comment.status === "open").length;
  return {
    id: session.id,
    repoRoot: session.repoRoot,
    repoKey: session.repoKey,
    branch: session.branch,
    target: session.target,
    headSha: session.headSha,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    comments: session.comments.length,
    openComments,
    resolvedComments: session.comments.length - openComments,
  };
}

export function serializeSessionSummary(session: ReviewSession) {
  const summary = summarizeReviewSession(session);
  return {
    id: summary.id,
    ...(summary.repoRoot ? { repo_root: summary.repoRoot } : {}),
    ...(summary.repoKey ? { repo_key: summary.repoKey } : {}),
    branch: summary.branch,
    target: describeReviewTarget(summary.target),
    comment_count: summary.comments,
    open_comments: summary.openComments,
    resolved_comments: summary.resolvedComments,
    updated_at: summary.updatedAt,
  };
}

export function serializeSession(session: ReviewSession) {
  return {
    ...serializeSessionSummary(session),
    comments: session.comments.map(serializeCommentForList),
  };
}

export function serializeCommentForList(comment: ReviewComment) {
  return {
    id: comment.id,
    author: comment.author,
    status: comment.status,
    location: serializeCommentLocation(comment),
    body: comment.body,
    ...(comment.replies && comment.replies.length > 0
      ? { replies: comment.replies.map(serializeCommentReply) }
      : {}),
  };
}

export function serializeComment(comment: ReviewComment) {
  return {
    ...serializeCommentForList(comment),
    ...(comment.code ? { code: comment.code } : {}),
  };
}

function serializeCommentReply(reply: NonNullable<ReviewComment["replies"]>[number]) {
  return {
    id: reply.id,
    author: reply.author,
    body: reply.body,
    created_at: reply.createdAt,
  };
}

export function describeReviewTarget(target: ReviewTarget): string {
  if (target.kind === "commit") return `commit ${target.commit ?? ""}`.trim();
  if (target.kind === "range") return `${target.base ?? ""}...${target.head ?? ""}`.trim();
  if (target.kind === "staged") return "staged";
  return "worktree";
}

function serializeCommentLocation(comment: ReviewComment) {
  const location: {
    file: string;
    line_type: string;
    line?: number;
    old_line?: number;
    new_line?: number;
  } = {
    file: comment.file,
    line_type: formatLineType(comment.side),
  };

  if (comment.side === "new" && comment.newLine != null) {
    location.line = comment.newLine;
  } else if (comment.side === "old" && comment.oldLine != null) {
    location.line = comment.oldLine;
  } else {
    if (comment.oldLine != null) location.old_line = comment.oldLine;
    if (comment.newLine != null) location.new_line = comment.newLine;
  }

  return location;
}

function formatLineType(side: ReviewComment["side"]): string {
  if (side === "new") return "added";
  if (side === "old") return "removed";
  if (side === "context") return "context";
  return "file";
}
