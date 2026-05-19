import { describe, expect, test } from "bun:test";
import type { ReviewComment, ReviewSession } from "@/lib/review-comments";
import {
  serializeComment,
  serializeCommentForList,
  serializeSession,
  serializeSessionSummary,
} from "./review-output";

const baseComment: ReviewComment = {
  id: "cmt_1",
  author: "user",
  file: "src/app.tsx",
  oldFile: null,
  side: "new",
  oldLine: null,
  newLine: 58,
  displaySide: "right",
  hunkIndex: 3,
  diffLineIndex: 12,
  code: "const value = true;",
  body: "Use a clearer name.",
  status: "open",
  createdAt: "2026-05-10T10:00:00.000Z",
  updatedAt: "2026-05-10T10:01:00.000Z",
  diffHashAtCreate: 12345,
};

function comment(input: Partial<ReviewComment>): ReviewComment {
  return { ...baseComment, ...input };
}

function session(input: Partial<ReviewSession> = {}): ReviewSession {
  return {
    schemaVersion: 1,
    id: "worktree-main-abc123",
    createdAt: "2026-05-10T09:00:00.000Z",
    updatedAt: "2026-05-10T10:00:00.000Z",
    branch: "main",
    target: { kind: "worktree" },
    headSha: "abc123",
    comments: [
      comment({ id: "cmt_open", status: "open" }),
      comment({ id: "cmt_resolved", status: "resolved" }),
    ],
    ...input,
  };
}

describe("review JSON output", () => {
  test("serializes added-line comments for list output", () => {
    expect(serializeCommentForList(baseComment)).toEqual({
      id: "cmt_1",
      author: "user",
      status: "open",
      location: {
        file: "src/app.tsx",
        line_type: "added",
        line: 58,
      },
      body: "Use a clearer name.",
    });
  });

  test("serializes removed-line comments without leaking old/new internals", () => {
    expect(
      serializeCommentForList(
        comment({
          side: "old",
          oldLine: 41,
          newLine: null,
        }),
      ),
    ).toEqual({
      id: "cmt_1",
      author: "user",
      status: "open",
      location: {
        file: "src/app.tsx",
        line_type: "removed",
        line: 41,
      },
      body: "Use a clearer name.",
    });
  });

  test("serializes context comments with both old and new line numbers", () => {
    expect(
      serializeCommentForList(
        comment({
          side: "context",
          oldLine: 33,
          newLine: 34,
        }),
      ).location,
    ).toEqual({
      file: "src/app.tsx",
      line_type: "context",
      old_line: 33,
      new_line: 34,
    });
  });

  test("serializes file-level comments without line numbers", () => {
    expect(
      serializeCommentForList(
        comment({
          side: "file",
          oldLine: null,
          newLine: null,
        }),
      ).location,
    ).toEqual({
      file: "src/app.tsx",
      line_type: "file",
    });
  });

  test("list output excludes storage and diff-rendering internals", () => {
    const output = serializeCommentForList(baseComment);

    expect(output).not.toHaveProperty("code");
    expect(output).not.toHaveProperty("oldFile");
    expect(output).not.toHaveProperty("hunkIndex");
    expect(output).not.toHaveProperty("diffLineIndex");
    expect(output).not.toHaveProperty("displaySide");
    expect(output).not.toHaveProperty("diffHashAtCreate");
    expect(output).not.toHaveProperty("createdAt");
    expect(output).not.toHaveProperty("updatedAt");
  });

  test("detail output includes code when available", () => {
    expect(serializeComment(baseComment)).toEqual({
      id: "cmt_1",
      author: "user",
      status: "open",
      location: {
        file: "src/app.tsx",
        line_type: "added",
        line: 58,
      },
      body: "Use a clearer name.",
      code: "const value = true;",
    });
  });

  test("serializes replies with compact comment output", () => {
    expect(
      serializeCommentForList(
        comment({
          replies: [
            {
              id: "reply_1",
              author: "agent",
              body: "Fixed in latest patch.",
              createdAt: "2026-05-10T10:02:00.000Z",
            },
          ],
        }),
      ),
    ).toEqual({
      id: "cmt_1",
      author: "user",
      status: "open",
      location: {
        file: "src/app.tsx",
        line_type: "added",
        line: 58,
      },
      body: "Use a clearer name.",
      replies: [
        {
          id: "reply_1",
          author: "agent",
          body: "Fixed in latest patch.",
          created_at: "2026-05-10T10:02:00.000Z",
        },
      ],
    });
  });

  test("detail output omits empty code", () => {
    expect(serializeComment(comment({ code: "" }))).not.toHaveProperty("code");
    expect(serializeComment(comment({ code: undefined }))).not.toHaveProperty("code");
  });

  test("session summaries use snake_case and hide raw session internals", () => {
    expect(serializeSessionSummary(session())).toEqual({
      id: "worktree-main-abc123",
      branch: "main",
      target: "worktree",
      comment_count: 2,
      open_comments: 1,
      resolved_comments: 1,
      updated_at: "2026-05-10T10:00:00.000Z",
    });
  });

  test("session detail includes compact comments only", () => {
    const output = serializeSession(session());

    expect(output.comments).toHaveLength(2);
    expect(output.comments[0]).toEqual(serializeCommentForList(session().comments[0]!));
    expect(output).not.toHaveProperty("schemaVersion");
    expect(output).not.toHaveProperty("headSha");
    expect(output).not.toHaveProperty("createdAt");
  });

  test("range targets are described without exposing raw target objects", () => {
    const output = serializeSessionSummary(
      session({
        target: { kind: "range", base: "main", head: "feature/review" },
      }),
    );

    expect(output.target).toBe("main...feature/review");
  });
});
