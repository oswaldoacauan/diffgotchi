import type { MouseEvent, Renderable } from "@opentui/core";
import type { StructuredPatchHunk } from "diff";
import type { ReviewComment, SelectedCommentTarget } from "@/lib/review-comments";

export interface DiffDisplayRow {
  raw: string;
  marker: string | undefined;
  oldLine: number | null;
  newLine: number | null;
  oldCursorBefore: number;
  newCursorBefore: number;
}

interface LineInfoRenderable extends Renderable {
  lineInfo?: { lineSources?: number[] };
  target?: LineInfoRenderable;
}

export interface LogicalDiffPosition {
  lineIndex: number;
  anchorY: number;
  lineNumber: number | null;
  hasLineNumberMap: boolean;
}

export type ReviewCommentAnchorStatus = "fresh" | "moved" | "stale" | "orphaned";

export interface ReviewCommentAnchor {
  comment: ReviewComment;
  anchor: number | null;
  anchorStatus: ReviewCommentAnchorStatus;
}

export function findRenderableById(target: Renderable | null, id: string): Renderable | null {
  let current: Renderable | null = target;
  while (current) {
    if (current.id === id) return current;
    current = current.parent as Renderable | null;
  }
  return null;
}

export function resolveLogicalDiffLineIndex(event: MouseEvent): number | null {
  return resolveLogicalDiffPosition(event)?.lineIndex ?? null;
}

export function resolveLogicalDiffPosition(
  event: Pick<MouseEvent, "target" | "x" | "y">,
  root?: Renderable | null,
): LogicalDiffPosition | null {
  const lineInfoTarget =
    findLineInfoRenderableAtPoint(event, root) ?? findLineInfoRenderable(event.target);
  if (!lineInfoTarget) return null;

  const visualIndex = event.y - lineInfoTarget.screenY;
  if (visualIndex < 0) return null;

  const sourceIndex = lineInfoTarget.lineInfo?.lineSources?.[visualIndex];
  if (typeof sourceIndex !== "number") {
    return {
      lineIndex: visualIndex,
      anchorY: event.y,
      lineNumber: null,
      hasLineNumberMap: false,
    };
  }

  const lastVisualIndex = findLastSourceIndex(
    lineInfoTarget.lineInfo?.lineSources ?? [],
    sourceIndex,
  );
  const lineNumber = getLineNumberForSource(lineInfoTarget, sourceIndex);

  return {
    lineIndex: sourceIndex,
    anchorY:
      typeof lastVisualIndex === "number" && lastVisualIndex >= 0
        ? lineInfoTarget.screenY + lastVisualIndex
        : event.y,
    ...lineNumber,
  };
}

export function buildDisplayRows(hunk: StructuredPatchHunk): DiffDisplayRow[] {
  const rows: DiffDisplayRow[] = [];
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;

  for (const raw of hunk.lines) {
    const marker = raw[0];
    if (marker === "\\") continue;

    const row: DiffDisplayRow = {
      raw,
      marker,
      oldLine: marker === "+" ? null : oldLine,
      newLine: marker === "-" ? null : newLine,
      oldCursorBefore: oldLine,
      newCursorBefore: newLine,
    };
    rows.push(row);

    if (marker !== "+") oldLine++;
    if (marker !== "-") newLine++;
  }

  return rows;
}

export function findTargetDisplayIndex(
  target: Pick<ReviewComment, "side" | "oldLine" | "newLine" | "diffLineIndex">,
  rows: DiffDisplayRow[],
  fallbackIndex?: number,
): number | null {
  const exact = findExactTargetDisplayIndex(target, rows);
  if (exact >= 0) return exact;

  const idx = fallbackIndex ?? target.diffLineIndex;
  return typeof idx === "number" && idx >= 0 && idx < rows.length ? idx : null;
}

export function resolveReviewCommentAnchor(
  comment: ReviewComment,
  rows: DiffDisplayRow[],
): ReviewCommentAnchor {
  const exact = findExactTargetDisplayIndex(comment, rows);
  if (exact >= 0) {
    return {
      comment,
      anchor: exact,
      anchorStatus: commentMatchesRow(comment, rows[exact]!) ? "fresh" : "stale",
    };
  }

  const fallback = comment.diffLineIndex;
  if (typeof fallback !== "number" || fallback < 0 || fallback >= rows.length) {
    return { comment, anchor: null, anchorStatus: "stale" };
  }

  return {
    comment,
    anchor: fallback,
    anchorStatus: commentMatchesRow(comment, rows[fallback]!) ? "moved" : "stale",
  };
}

export function markReviewCommentOrphaned(comment: ReviewComment): ReviewCommentAnchor {
  return { comment, anchor: null, anchorStatus: "orphaned" };
}

export function buildHunkDiffSegment(originalHunkDiff: string, rows: DiffDisplayRow[]): string {
  const first = rows[0];
  if (!first) return originalHunkDiff;

  const header = extractHunkDiffHeader(originalHunkDiff);
  const oldStart = first.oldLine ?? first.oldCursorBefore;
  const newStart = first.newLine ?? first.newCursorBefore;
  const oldCount = rows.filter((row) => row.marker !== "+").length;
  const newCount = rows.filter((row) => row.marker !== "-").length;
  const label = header.label ? ` ${header.label}` : "";
  const hunkHeader = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${label}`;

  return `${header.prefix}${hunkHeader}\n${rows.map((row) => row.raw).join("\n")}\n`;
}

export function getUnifiedCommentTarget(
  hunk: StructuredPatchHunk,
  hunkIndex: number,
  diffLineIndex: number,
  file: string,
  oldFile: string | null,
): SelectedCommentTarget | null {
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  let displayIndex = 0;

  for (const line of hunk.lines) {
    const marker = line[0];
    const code = line.slice(1);

    if (marker === "+") {
      if (displayIndex === diffLineIndex) {
        return {
          file,
          oldFile,
          side: "new",
          oldLine: null,
          newLine,
          hunkIndex,
          diffLineIndex,
          code,
        };
      }
      newLine++;
      displayIndex++;
    } else if (marker === "-") {
      if (displayIndex === diffLineIndex) {
        return {
          file,
          oldFile,
          side: "old",
          oldLine,
          newLine: null,
          hunkIndex,
          diffLineIndex,
          code,
        };
      }
      oldLine++;
      displayIndex++;
    } else if (marker === " ") {
      if (displayIndex === diffLineIndex) {
        return {
          file,
          oldFile,
          side: "context",
          oldLine,
          newLine,
          hunkIndex,
          diffLineIndex,
          code,
        };
      }
      oldLine++;
      newLine++;
      displayIndex++;
    }
  }

  return null;
}

export function getSplitCommentTarget(
  hunk: StructuredPatchHunk,
  hunkIndex: number,
  diffLineIndex: number,
  preferredSide: "left" | "right",
  file: string,
  oldFile: string | null,
): SelectedCommentTarget | null {
  const rows = buildSplitCommentRows(hunk, hunkIndex, file, oldFile);
  const row = rows[diffLineIndex];
  if (!row) return null;
  const preferred = preferredSide === "right" ? row.right : row.left;
  return preferred ?? null;
}

export function getSplitCommentTargetForPosition(
  hunk: StructuredPatchHunk,
  hunkIndex: number,
  position: Pick<LogicalDiffPosition, "lineIndex" | "lineNumber" | "hasLineNumberMap">,
  preferredSide: "left" | "right",
  file: string,
  oldFile: string | null,
): SelectedCommentTarget | null {
  if (position.hasLineNumberMap) {
    if (position.lineNumber == null) return null;
    return getSplitCommentTargetByLineNumber(
      hunk,
      hunkIndex,
      position.lineNumber,
      preferredSide,
      file,
      oldFile,
    );
  }

  return getSplitCommentTarget(hunk, hunkIndex, position.lineIndex, preferredSide, file, oldFile);
}

function getSplitCommentTargetByLineNumber(
  hunk: StructuredPatchHunk,
  hunkIndex: number,
  lineNumber: number,
  preferredSide: "left" | "right",
  file: string,
  oldFile: string | null,
): SelectedCommentTarget | null {
  const rows = buildSplitCommentRows(hunk, hunkIndex, file, oldFile);
  const targetForSide = (row: {
    left: SelectedCommentTarget | null;
    right: SelectedCommentTarget | null;
  }) => (preferredSide === "right" ? row.right : row.left);
  const matchesLineNumber = (target: SelectedCommentTarget | null) => {
    if (!target) return false;
    return preferredSide === "right"
      ? target.newLine === lineNumber
      : target.oldLine === lineNumber;
  };

  return rows.map(targetForSide).find(matchesLineNumber) ?? null;
}

function buildSplitCommentRows(
  hunk: StructuredPatchHunk,
  hunkIndex: number,
  file: string,
  oldFile: string | null,
): Array<{ left: SelectedCommentTarget | null; right: SelectedCommentTarget | null }> {
  const rows: Array<{ left: SelectedCommentTarget | null; right: SelectedCommentTarget | null }> =
    [];
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  let i = 0;

  while (i < hunk.lines.length) {
    const line = hunk.lines[i]!;
    const marker = line[0];

    if (marker === " ") {
      const code = line.slice(1);
      const leftTarget: SelectedCommentTarget = {
        file,
        oldFile,
        side: "context",
        oldLine,
        newLine,
        displaySide: "left",
        hunkIndex,
        diffLineIndex: rows.length,
        code,
      };
      const rightTarget: SelectedCommentTarget = {
        ...leftTarget,
        displaySide: "right",
      };
      rows.push({ left: leftTarget, right: rightTarget });
      oldLine++;
      newLine++;
      i++;
      continue;
    }

    if (marker === "\\") {
      i++;
      continue;
    }

    const removes: SelectedCommentTarget[] = [];
    const adds: SelectedCommentTarget[] = [];
    while (i < hunk.lines.length) {
      const current = hunk.lines[i]!;
      const currentMarker = current[0];
      if (currentMarker === " " || currentMarker === "\\") break;

      const code = current.slice(1);
      if (currentMarker === "-") {
        removes.push({
          file,
          oldFile,
          side: "old",
          oldLine,
          newLine: null,
          displaySide: "left",
          hunkIndex,
          diffLineIndex: rows.length + removes.length,
          code,
        });
        oldLine++;
      } else if (currentMarker === "+") {
        adds.push({
          file,
          oldFile,
          side: "new",
          oldLine: null,
          newLine,
          displaySide: "right",
          hunkIndex,
          diffLineIndex: rows.length + adds.length,
          code,
        });
        newLine++;
      }
      i++;
    }

    const rowCount = Math.max(removes.length, adds.length);
    for (let row = 0; row < rowCount; row++) {
      const diffRow = rows.length;
      const left = removes[row] ? { ...removes[row]!, diffLineIndex: diffRow } : null;
      const right = adds[row] ? { ...adds[row]!, diffLineIndex: diffRow } : null;
      rows.push({ left, right });
    }
  }

  return rows;
}

function findExactTargetDisplayIndex(
  target: Pick<ReviewComment, "side" | "oldLine" | "newLine">,
  rows: DiffDisplayRow[],
): number {
  return rows.findIndex((row) => {
    if (target.side === "old") return target.oldLine != null && row.oldLine === target.oldLine;
    if (target.side === "new") return target.newLine != null && row.newLine === target.newLine;
    if (target.side === "context") {
      return (
        (target.oldLine != null && row.oldLine === target.oldLine) ||
        (target.newLine != null && row.newLine === target.newLine)
      );
    }
    return false;
  });
}

function commentMatchesRow(comment: ReviewComment, row: DiffDisplayRow): boolean {
  if (comment.code == null) return true;
  if (comment.side === "old" && row.marker !== "-") return false;
  if (comment.side === "new" && row.marker !== "+") return false;
  if (comment.side === "context" && row.marker !== " ") return false;
  return row.raw.slice(1) === comment.code;
}

function findLineInfoRenderable(target: Renderable | null): LineInfoRenderable | null {
  let current = target as LineInfoRenderable | null;
  while (current) {
    if (current.lineInfo?.lineSources) return current;
    if (current.target?.lineInfo?.lineSources) return current.target;
    current = current.parent as LineInfoRenderable | null;
  }
  return null;
}

function findLineInfoRenderableAtPoint(
  event: Pick<MouseEvent, "x" | "y">,
  root?: Renderable | null,
): LineInfoRenderable | null {
  if (!root) return null;

  const candidates = collectLineInfoRenderables(root);
  return (
    candidates.find((candidate) => {
      const bounds = getLineInfoBounds(candidate);
      return (
        event.x >= bounds.screenX &&
        event.x < bounds.screenX + bounds.width &&
        event.y >= bounds.screenY &&
        event.y < bounds.screenY + bounds.height
      );
    }) ?? null
  );
}

function collectLineInfoRenderables(
  root: Renderable,
  seen = new Set<LineInfoRenderable>(),
): LineInfoRenderable[] {
  const current = root as LineInfoRenderable;
  if (current.lineInfo?.lineSources) seen.add(current);
  if (current.target?.lineInfo?.lineSources) seen.add(current.target);

  const children =
    typeof (current as any).getChildren === "function" ? (current as any).getChildren() : [];
  for (const child of children) {
    collectLineInfoRenderables(child as Renderable, seen);
  }

  return [...seen];
}

function getLineInfoBounds(target: LineInfoRenderable): {
  screenX: number;
  screenY: number;
  width: number;
  height: number;
} {
  const parent = target.parent as LineInfoRenderable | null;
  if (parent?.target === target) {
    return parent;
  }
  return target;
}

function getLineNumberForSource(
  target: LineInfoRenderable,
  sourceIndex: number,
): { lineNumber: number | null; hasLineNumberMap: boolean } {
  const parent = target.parent as {
    target?: LineInfoRenderable;
    getLineNumbers?: () => Map<number, number>;
  } | null;

  if (parent?.target !== target || typeof parent.getLineNumbers !== "function") {
    return { lineNumber: null, hasLineNumberMap: false };
  }

  const value = parent.getLineNumbers().get(sourceIndex);
  return {
    lineNumber: typeof value === "number" ? value : null,
    hasLineNumberMap: true,
  };
}

function findLastSourceIndex(sources: number[], sourceIndex: number): number {
  for (let i = sources.length - 1; i >= 0; i--) {
    if (sources[i] === sourceIndex) return i;
  }
  return -1;
}

function extractHunkDiffHeader(diff: string): { prefix: string; label: string } {
  const lines = diff.split("\n");
  const hunkHeaderIndex = lines.findIndex((line) => line.startsWith("@@"));
  if (hunkHeaderIndex < 0) return { prefix: "", label: "" };

  const hunkHeader = lines[hunkHeaderIndex]!;
  const label = hunkHeader.match(/^@@\s[^@]+@@\s*(.*)$/)?.[1]?.trim() ?? "";
  const prefix = lines.slice(0, hunkHeaderIndex).join("\n");
  return { prefix: prefix ? `${prefix}\n` : "", label };
}
