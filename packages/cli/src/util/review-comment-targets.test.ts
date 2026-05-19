import { describe, expect, test } from "bun:test";
import type { StructuredPatchHunk } from "diff";
import {
  buildDisplayRows,
  getSplitCommentTarget,
  getSplitCommentTargetForPosition,
  resolveReviewCommentAnchor,
  resolveLogicalDiffPosition,
} from "./review-comment-targets";
import type { ReviewComment } from "@/lib/review-comments";

const hunk = {
  oldStart: 1,
  oldLines: 4,
  newStart: 1,
  newLines: 5,
  lines: [
    " same before",
    "-removed one",
    "-removed two",
    "+added one",
    "+added two",
    "+added three",
    " same after",
  ],
} as StructuredPatchHunk;

describe("split review comment targets", () => {
  test("uses the clicked right-side added line", () => {
    const target = getSplitCommentTarget(hunk, 0, 3, "right", "src/app.tsx", null);

    expect(target).toMatchObject({
      file: "src/app.tsx",
      side: "new",
      oldLine: null,
      newLine: 4,
      displaySide: "right",
      diffLineIndex: 3,
      code: "added three",
    });
  });

  test("does not fall through when the clicked split side is empty", () => {
    expect(getSplitCommentTarget(hunk, 0, 3, "left", "src/app.tsx", null)).toBeNull();
  });

  test("keeps context lines available from both split sides", () => {
    const left = getSplitCommentTarget(hunk, 0, 0, "left", "src/app.tsx", null);
    const right = getSplitCommentTarget(hunk, 0, 0, "right", "src/app.tsx", null);

    expect(left).toMatchObject({
      side: "context",
      displaySide: "left",
      oldLine: 1,
      newLine: 1,
      code: "same before",
    });
    expect(right).toMatchObject({
      side: "context",
      displaySide: "right",
      oldLine: 1,
      newLine: 1,
      code: "same before",
    });
  });

  test("uses line-number metadata for wrapped split rows with alignment padding", () => {
    const target = getSplitCommentTargetForPosition(
      hunk,
      0,
      { lineIndex: 99, lineNumber: 4, hasLineNumberMap: true },
      "right",
      "src/app.tsx",
      null,
    );

    expect(target).toMatchObject({
      side: "new",
      displaySide: "right",
      newLine: 4,
      diffLineIndex: 3,
      code: "added three",
    });
  });

  test("ignores hidden split alignment rows", () => {
    expect(
      getSplitCommentTargetForPosition(
        hunk,
        0,
        { lineIndex: 2, lineNumber: null, hasLineNumberMap: true },
        "left",
        "src/app.tsx",
        null,
      ),
    ).toBeNull();
  });
});

describe("logical diff positions", () => {
  test("anchors wrapped visual rows to the last visual row for the logical line", () => {
    const target = {
      screenY: 20,
      lineInfo: { lineSources: [0, 1, 1, 1, 2] },
    };

    expect(resolveLogicalDiffPosition({ target: target as any, x: 0, y: 23 })).toEqual({
      lineIndex: 1,
      anchorY: 23,
      lineNumber: null,
      hasLineNumberMap: false,
    });
  });

  test("falls back to the clicked visual row when line source metadata is absent", () => {
    const target = {
      screenY: 20,
      lineInfo: { lineSources: [] },
    };

    expect(resolveLogicalDiffPosition({ target: target as any, x: 0, y: 23 })).toEqual({
      lineIndex: 3,
      anchorY: 23,
      lineNumber: null,
      hasLineNumberMap: false,
    });
  });

  test("chooses the line-info renderable under the click when the event target is a parent", () => {
    const rightCode = {
      screenX: 50,
      screenY: 20,
      width: 50,
      height: 4,
      lineInfo: { lineSources: [0, 1, 1, 2] },
    } as any;
    const rightPane = {
      screenX: 50,
      screenY: 20,
      width: 50,
      height: 4,
      target: rightCode,
      getChildren: () => [],
      getLineNumbers: () =>
        new Map([
          [0, 10],
          [1, 11],
          [2, 12],
        ]),
    } as any;
    rightCode.parent = rightPane;

    const leftCode = {
      screenX: 0,
      screenY: 20,
      width: 50,
      height: 4,
      lineInfo: { lineSources: [0, 1, 2, 3] },
    } as any;
    const leftPane = {
      screenX: 0,
      screenY: 20,
      width: 50,
      height: 4,
      target: leftCode,
      getChildren: () => [],
      getLineNumbers: () =>
        new Map([
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 4],
        ]),
    } as any;
    leftCode.parent = leftPane;

    const root = {
      screenX: 0,
      screenY: 20,
      width: 100,
      height: 4,
      getChildren: () => [leftPane, rightPane],
    } as any;
    leftPane.parent = root;
    rightPane.parent = root;

    expect(resolveLogicalDiffPosition({ target: root, x: 75, y: 22 } as any, root)).toEqual({
      lineIndex: 1,
      anchorY: 22,
      lineNumber: 11,
      hasLineNumberMap: true,
    });
  });
});

describe("review comment anchors", () => {
  const rows = buildDisplayRows(hunk);
  const baseComment: ReviewComment = {
    id: "cmt_1",
    author: "user",
    file: "src/app.tsx",
    oldFile: null,
    side: "new",
    oldLine: null,
    newLine: 4,
    hunkIndex: 0,
    diffLineIndex: 5,
    code: "added three",
    body: "Check this",
    status: "open",
    createdAt: "2026-05-10T09:30:00.000Z",
    updatedAt: "2026-05-10T09:30:00.000Z",
    diffHashAtCreate: 123,
  };

  test("marks exact matching line and code as fresh", () => {
    expect(resolveReviewCommentAnchor(baseComment, rows)).toMatchObject({
      anchor: 5,
      anchorStatus: "fresh",
    });
  });

  test("marks exact line with changed code as stale", () => {
    expect(resolveReviewCommentAnchor({ ...baseComment, code: "old code" }, rows)).toMatchObject({
      anchor: 5,
      anchorStatus: "stale",
    });
  });

  test("marks fallback match with same code as moved", () => {
    expect(
      resolveReviewCommentAnchor({ ...baseComment, newLine: 99, diffLineIndex: 5 }, rows),
    ).toMatchObject({
      anchor: 5,
      anchorStatus: "moved",
    });
  });

  test("marks missing fallback as stale", () => {
    expect(
      resolveReviewCommentAnchor({ ...baseComment, newLine: 99, diffLineIndex: 99 }, rows),
    ).toMatchObject({
      anchor: null,
      anchorStatus: "stale",
    });
  });
});
