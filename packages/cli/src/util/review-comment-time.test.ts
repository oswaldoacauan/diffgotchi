import { describe, expect, test } from "bun:test";
import { formatReviewCommentTime } from "./review-comment-time";

const now = Date.parse("2026-05-10T10:30:00.000Z");

describe("review comment time", () => {
  test("hides new unedited comments for the first few minutes", () => {
    expect(
      formatReviewCommentTime(
        {
          createdAt: "2026-05-10T10:28:00.000Z",
          updatedAt: "2026-05-10T10:28:00.000Z",
        },
        now,
      ),
    ).toBeNull();
  });

  test("shows relative creation time for older unedited comments", () => {
    expect(
      formatReviewCommentTime(
        {
          createdAt: "2026-05-10T10:20:00.000Z",
          updatedAt: "2026-05-10T10:20:00.000Z",
        },
        now,
      ),
    ).toBe("10m ago");
  });

  test("uses updatedAt when a comment was edited recently", () => {
    expect(
      formatReviewCommentTime(
        {
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T10:28:00.000Z",
        },
        now,
      ),
    ).toBe("edited just now");
  });

  test("shows relative edit time for older edits", () => {
    expect(
      formatReviewCommentTime(
        {
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T10:10:00.000Z",
        },
        now,
      ),
    ).toBe("edited 20m ago");
  });
});
