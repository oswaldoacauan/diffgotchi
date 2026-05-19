import { describe, expect, test } from "bun:test";
import type { ReviewSession } from "@/lib/review-comments";
import {
  appendReviewCommentReply,
  markReviewCommentDone,
  updateReviewCommentBody,
} from "@/lib/review-comments";

const session: ReviewSession = {
  schemaVersion: 1,
  id: "worktree-main-abc123",
  createdAt: "2026-05-10T09:00:00.000Z",
  updatedAt: "2026-05-10T10:00:00.000Z",
  branch: "main",
  target: { kind: "worktree" },
  headSha: "abc123",
  comments: [
    {
      id: "cmt_1",
      author: "user",
      file: "src/app.tsx",
      oldFile: null,
      side: "new",
      oldLine: null,
      newLine: 10,
      hunkIndex: 0,
      diffLineIndex: 1,
      code: "const label = 'old';",
      body: "Original body",
      status: "open",
      createdAt: "2026-05-10T09:30:00.000Z",
      updatedAt: "2026-05-10T09:30:00.000Z",
      diffHashAtCreate: 123,
    },
    {
      id: "cmt_2",
      author: "agent",
      file: "src/app.tsx",
      oldFile: null,
      side: "context",
      oldLine: 12,
      newLine: 12,
      body: "Leave this alone",
      status: "resolved",
      createdAt: "2026-05-10T09:40:00.000Z",
      updatedAt: "2026-05-10T09:40:00.000Z",
      diffHashAtCreate: 456,
    },
  ],
};

describe("review comment updates", () => {
  test("updates only the selected comment body and timestamp", () => {
    const next = updateReviewCommentBody(session, "cmt_1", "Edited body");

    expect(next).not.toBe(session);
    expect(next.updatedAt).not.toBe(session.updatedAt);
    expect(next.comments[0]).toMatchObject({
      id: "cmt_1",
      body: "Edited body",
      status: "open",
      createdAt: "2026-05-10T09:30:00.000Z",
    });
    expect(next.comments[0]!.updatedAt).not.toBe(session.comments[0]!.updatedAt);
    expect(next.comments[1]).toEqual(session.comments[1]);
  });

  test("marks a comment done and appends a reply", () => {
    const next = markReviewCommentDone(session, "cmt_1", "Fixed in the latest patch.", "agent");

    expect(next.comments[0]).toMatchObject({
      id: "cmt_1",
      status: "resolved",
      body: "Original body",
    });
    expect(next.comments[0]!.replies).toHaveLength(1);
    expect(next.comments[0]!.replies?.[0]).toMatchObject({
      author: "agent",
      body: "Fixed in the latest patch.",
    });
    expect(next.comments[0]!.updatedAt).not.toBe(session.comments[0]!.updatedAt);
    expect(next.comments[1]).toEqual(session.comments[1]);
  });

  test("adds a reply without changing comment status", () => {
    const next = appendReviewCommentReply(
      session,
      "cmt_1",
      "I will handle this separately.",
      "user",
    );

    expect(next.comments[0]).toMatchObject({
      id: "cmt_1",
      status: "open",
    });
    expect(next.comments[0]!.replies?.[0]).toMatchObject({
      author: "user",
      body: "I will handle this separately.",
    });
  });
});
