import type { ReviewComment } from "@/lib/review-comments";

export function formatReviewCommentTime(
  comment: Pick<ReviewComment, "createdAt" | "updatedAt">,
  now: number,
): string | null {
  const created = Date.parse(comment.createdAt);
  if (!Number.isFinite(created)) return null;

  const updated = Date.parse(comment.updatedAt);
  const edited = Number.isFinite(updated) && updated - created > 1000;
  const time = edited ? updated : created;
  const relative = formatRelativeTime(time, now, edited);

  if (!relative) return null;
  return edited ? `edited ${relative}` : relative;
}

function formatRelativeTime(time: number, now: number, includeRecent: boolean): string | null {
  const elapsedMs = Math.max(0, now - time);
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 5) return includeRecent ? "just now" : null;
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(days / 365)}y ago`;
}
