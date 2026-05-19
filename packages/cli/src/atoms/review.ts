import { atom } from "jotai";
import { queueToastAtom } from "@/atoms/actions";
import {
  appendReviewComment,
  appendReviewCommentReply,
  deleteReviewComment,
  loadReviewSession,
  saveReviewSession,
  updateReviewCommentBody,
  updateReviewCommentStatus,
  type NewReviewComment,
  type ReviewComment,
  type ReviewCommentStatus,
  type ReviewSession,
} from "@/lib/review-comments";

const EMPTY_COMMENTS: ReviewComment[] = [];

export const reviewSessionAtom = atom<ReviewSession | null>(null);

export const reviewCommentsAtom = atom((get) => get(reviewSessionAtom)?.comments ?? EMPTY_COMMENTS);

export const openReviewCommentsAtom = atom((get) =>
  get(reviewCommentsAtom).filter((comment) => comment.status === "open"),
);

export const reviewOpenCommentCountAtom = atom((get) => {
  let count = 0;
  for (const comment of get(reviewCommentsAtom)) {
    if (comment.status === "open") count++;
  }
  return count;
});

export const setReviewSessionAtom = atom(null, (_get, set, session: ReviewSession | null) => {
  set(reviewSessionAtom, session);
});

function getLatestSession(session: ReviewSession): ReviewSession {
  return loadReviewSession(session.id) ?? session;
}

export const addReviewCommentAtom = atom(null, (get, set, comment: NewReviewComment) => {
  const session = get(reviewSessionAtom);
  if (!session) {
    set(queueToastAtom, { message: "No review session", variant: "warning" });
    return;
  }

  const next = appendReviewComment(getLatestSession(session), comment);
  const result = saveReviewSession(next);
  if (!result.ok) {
    set(queueToastAtom, {
      message: `Comment save failed: ${result.error}`,
      variant: "warning",
    });
    return;
  }
  set(reviewSessionAtom, next);
});

export const deleteReviewCommentAtom = atom(null, (get, set, commentId: string) => {
  const session = get(reviewSessionAtom);
  if (!session) return;

  const next = deleteReviewComment(getLatestSession(session), commentId);
  const result = saveReviewSession(next);
  if (!result.ok) {
    set(queueToastAtom, {
      message: `Comment delete failed: ${result.error}`,
      variant: "warning",
    });
    return;
  }
  set(reviewSessionAtom, next);
});

export const setReviewCommentStatusAtom = atom(
  null,
  (get, set, args: { commentId: string; status: ReviewCommentStatus }) => {
    const session = get(reviewSessionAtom);
    if (!session) return;

    const next = updateReviewCommentStatus(getLatestSession(session), args.commentId, args.status);
    const result = saveReviewSession(next);
    if (!result.ok) {
      set(queueToastAtom, {
        message: `Comment update failed: ${result.error}`,
        variant: "warning",
      });
      return;
    }
    set(reviewSessionAtom, next);
  },
);

export const editReviewCommentAtom = atom(
  null,
  (get, set, args: { commentId: string; body: string }) => {
    const session = get(reviewSessionAtom);
    if (!session) return;

    const next = updateReviewCommentBody(getLatestSession(session), args.commentId, args.body);
    const result = saveReviewSession(next);
    if (!result.ok) {
      set(queueToastAtom, {
        message: `Comment update failed: ${result.error}`,
        variant: "warning",
      });
      return;
    }
    set(reviewSessionAtom, next);
  },
);

export const addReviewCommentReplyAtom = atom(
  null,
  (get, set, args: { commentId: string; body: string }) => {
    const session = get(reviewSessionAtom);
    if (!session) return;

    const next = appendReviewCommentReply(
      getLatestSession(session),
      args.commentId,
      args.body,
      "user",
    );
    const result = saveReviewSession(next);
    if (!result.ok) {
      set(queueToastAtom, {
        message: `Reply save failed: ${result.error}`,
        variant: "warning",
      });
      return;
    }
    set(reviewSessionAtom, next);
  },
);
