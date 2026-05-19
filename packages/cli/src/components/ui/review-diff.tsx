import * as React from "react";
import { RGBA, TextAttributes, type MouseEvent } from "@opentui/core";
import { useAtomValue } from "jotai/react";
import type { StructuredPatchHunk } from "diff";
import { resolvedThemeAtom } from "@/atoms/derived";
import { InlineCommentEditor } from "@/components/dialogs/review-comments";
import { DiffView } from "@/components/ui/diff-view";
import { rgbaToHex } from "@/lib/themes";
import type { HunkInfo } from "@/lib/git/parse";
import type { ReviewComment, SelectedCommentTarget } from "@/lib/review-comments";
import { formatReviewCommentTime } from "@/util/review-comment-time";
import {
  buildDisplayRows,
  buildHunkDiffSegment,
  findRenderableById,
  findTargetDisplayIndex,
  getSplitCommentTargetForPosition,
  getUnifiedCommentTarget,
  resolveLogicalDiffPosition,
  resolveReviewCommentAnchor,
  type ReviewCommentAnchor,
  type ReviewCommentAnchorStatus,
} from "@/util/review-comment-targets";
import type { Indicators } from "@/atoms/display";

export interface ReviewDiffHunkProps {
  hunkInfo: HunkInfo;
  hunk: StructuredPatchHunk;
  hunkIndex: number;
  currentHunkIndex: number;
  comments: ReviewComment[];
  selectedTarget: SelectedCommentTarget | null;
  fileName: string;
  oldFileName: string | null;
  viewMode: "split" | "unified";
  filetype: string;
  themeName: string;
  wrapMode: "word" | "char" | "none";
  showLineNumbers: boolean;
  backgrounds: boolean;
  highlightInline: boolean;
  indicators: Indicators;
  commentTimeNow: number;
  mutedColor: string;
  onTargetSelected: (target: SelectedCommentTarget, anchorX?: number, anchorY?: number) => void;
  editingCommentId?: string | null;
  replyingCommentId?: string | null;
  onCommentSelected?: (comment: ReviewComment) => void;
  onCommentDelete?: (comment: ReviewComment) => void;
  onCommentEditCancel?: () => void;
  onCommentEditSubmit?: (comment: ReviewComment, body: string) => void;
  onCommentReplyCancel?: () => void;
  onCommentReplySubmit?: (comment: ReviewComment, body: string) => void;
  isCommentComposerOpen: boolean;
}

export function ReviewDiffHunk({
  hunkInfo,
  hunk,
  hunkIndex,
  currentHunkIndex,
  comments,
  selectedTarget,
  fileName,
  oldFileName,
  viewMode,
  filetype,
  themeName,
  wrapMode,
  showLineNumbers,
  backgrounds,
  highlightInline,
  indicators,
  commentTimeNow,
  mutedColor,
  onTargetSelected,
  editingCommentId,
  replyingCommentId,
  onCommentSelected,
  onCommentDelete,
  onCommentEditCancel,
  onCommentEditSubmit,
  onCommentReplyCancel,
  onCommentReplySubmit,
  isCommentComposerOpen,
}: ReviewDiffHunkProps) {
  const { theme } = useAtomValue(resolvedThemeAtom);
  const isActive = hunkIndex === currentHunkIndex;
  const shouldShowHeader = hunkIndex > 0 || comments.length > 0 || isActive;

  const handleMouseDown = React.useCallback(
    (event: MouseEvent, diffLineOffset: number) => {
      if (event.button !== 0 || isCommentComposerOpen) return;

      const hunkNode = findRenderableById(event.target, `hunk-${hunkIndex}`);
      if (!hunkNode) return;

      const position = resolveLogicalDiffPosition(event, hunkNode);
      if (!position || position.lineIndex < 0) return;
      const diffLineIndex = diffLineOffset + position.lineIndex;
      const preferredSide =
        event.x >= hunkNode.screenX + Math.floor(hunkNode.width / 2) ? "right" : "left";

      const target =
        viewMode === "split"
          ? getSplitCommentTargetForPosition(
              hunk,
              hunkIndex,
              position.hasLineNumberMap ? position : { ...position, lineIndex: diffLineIndex },
              preferredSide,
              fileName,
              oldFileName,
            )
          : getUnifiedCommentTarget(hunk, hunkIndex, diffLineIndex, fileName, oldFileName);

      if (!target) return;
      onTargetSelected(target, event.x, position.anchorY);
      event.stopPropagation();
    },
    [fileName, hunk, hunkIndex, isCommentComposerOpen, oldFileName, onTargetSelected, viewMode],
  );

  return (
    <box id={`hunk-${hunkIndex}`} flexDirection="column">
      {shouldShowHeader && (
        <box
          justifyContent="center"
          flexDirection="row"
          backgroundColor={brighten(theme.backgroundPanel, 20)}
        >
          <text fg={mutedColor}>
            {isActive ? "● " : ""}
            {hunkIndex > 0 ? "↕ " : ""}
            {hunkInfo.hiddenLines > 0 ? `${hunkInfo.hiddenLines} lines hidden` : ""}
            {hunkInfo.hiddenLines > 0 && hunkInfo.label ? " · " : ""}
            {hunkInfo.label || ""}
            {comments.length > 0
              ? `${hunkInfo.hiddenLines > 0 || hunkInfo.label ? " · " : ""}${comments.length} comment${comments.length === 1 ? "" : "s"}`
              : ""}
            {isActive
              ? `${hunkInfo.hiddenLines > 0 || hunkInfo.label || comments.length > 0 ? " · " : ""}click line for comment`
              : ""}
          </text>
        </box>
      )}
      <HunkDiffWithComments
        hunkDiff={hunkInfo.diff}
        hunk={hunk}
        hunkIndex={hunkIndex}
        comments={comments}
        selectedTarget={selectedTarget}
        viewMode={viewMode}
        filetype={filetype}
        themeName={themeName}
        wrapMode={wrapMode}
        showLineNumbers={showLineNumbers}
        backgrounds={backgrounds}
        highlightInline={highlightInline}
        indicators={indicators}
        commentTimeNow={commentTimeNow}
        editingCommentId={editingCommentId}
        replyingCommentId={replyingCommentId}
        onCommentSelected={onCommentSelected}
        onCommentDelete={onCommentDelete}
        onCommentEditCancel={onCommentEditCancel}
        onCommentEditSubmit={onCommentEditSubmit}
        onCommentReplyCancel={onCommentReplyCancel}
        onCommentReplySubmit={onCommentReplySubmit}
        onDiffMouseDown={handleMouseDown}
      />
    </box>
  );
}

export function ReviewCommentsBlock({
  comments,
  commentTimeNow,
  editingCommentId,
  replyingCommentId,
  onCommentSelected,
  onCommentDelete,
  onCommentEditCancel,
  onCommentEditSubmit,
  onCommentReplyCancel,
  onCommentReplySubmit,
}: {
  comments: ReviewCommentAnchor[];
  commentTimeNow: number;
  editingCommentId?: string | null;
  replyingCommentId?: string | null;
  onCommentSelected?: (comment: ReviewComment) => void;
  onCommentDelete?: (comment: ReviewComment) => void;
  onCommentEditCancel?: () => void;
  onCommentEditSubmit?: (comment: ReviewComment, body: string) => void;
  onCommentReplyCancel?: () => void;
  onCommentReplySubmit?: (comment: ReviewComment, body: string) => void;
}) {
  const { theme, textColor } = useAtomValue(resolvedThemeAtom);
  if (comments.length === 0) return null;

  const commentMuted = rgbaToHex(theme.textMuted);

  return (
    <box
      flexDirection="column"
      gap={1}
      width="100%"
      flexShrink={1}
      onMouseDown={(event: MouseEvent) => event.stopPropagation()}
    >
      {comments.map((comment) => {
        const relativeTime = formatReviewCommentTime(comment.comment, commentTimeNow);
        const done = comment.comment.status === "resolved";
        const accent = done ? theme.success : theme.warning;
        const commentBg = blend(theme.backgroundPanel, accent, done ? 0.02 : 0.03);
        const commentBorder = rgbaToHex(accent);
        const author = comment.comment.author;
        const statusText = `${author} · ${done ? "done" : "open"}`;
        const replies = comment.comment.replies ?? [];
        const anchorStatus = getVisibleAnchorStatus(comment.anchorStatus);
        if (editingCommentId === comment.comment.id) {
          return (
            <InlineCommentEditor
              key={comment.comment.id}
              initialBody={comment.comment.body}
              placeholder="Edit comment..."
              onCancel={() => onCommentEditCancel?.()}
              onDelete={() => onCommentDelete?.(comment.comment)}
              onSubmit={(body) => onCommentEditSubmit?.(comment.comment, body)}
            />
          );
        }

        return (
          <box
            key={comment.comment.id}
            flexDirection="column"
            border={["left"]}
            borderStyle="heavy"
            borderColor={commentBorder}
            backgroundColor={commentBg}
            width="100%"
            flexShrink={1}
            paddingLeft={2}
            paddingRight={1}
            paddingTop={1}
            paddingBottom={1}
            gap={1}
            onMouseDown={(event: MouseEvent) => {
              onCommentSelected?.(comment.comment);
              event.stopPropagation();
            }}
          >
            <box flexDirection="row" flexWrap="wrap">
              <text fg={commentBorder} attributes={done ? TextAttributes.BOLD : 0}>
                {statusText}
              </text>
              {anchorStatus ? (
                <text fg={rgbaToHex(getAnchorStatusColor(anchorStatus, theme))}>
                  {" "}
                  · {anchorStatus}
                </text>
              ) : null}
              {relativeTime ? <text fg={commentMuted}> · {relativeTime}</text> : null}
              {anchorStatus ? (
                <text fg={commentMuted}> · was {formatOriginalLocation(comment.comment)}</text>
              ) : null}
            </box>
            {anchorStatus === "stale" || anchorStatus === "orphaned" ? (
              <OriginalCodeSnippet comment={comment.comment} />
            ) : null}
            <text fg={textColor} width="100%" flexShrink={1}>
              {comment.comment.body}
            </text>
            {replies.map((reply) => (
              <box
                key={reply.id}
                flexDirection="column"
                border={["left"]}
                borderColor={theme.success}
                paddingLeft={1}
              >
                <text fg={rgbaToHex(theme.success)} attributes={TextAttributes.BOLD}>
                  {reply.author} reply
                </text>
                <text fg={textColor} width="100%" flexShrink={1}>
                  {reply.body}
                </text>
              </box>
            ))}
            {replyingCommentId === comment.comment.id ? (
              <InlineCommentEditor
                key={`${comment.comment.id}-reply`}
                placeholder="Reply to agent..."
                onCancel={() => onCommentReplyCancel?.()}
                onSubmit={(body) => onCommentReplySubmit?.(comment.comment, body)}
              />
            ) : null}
          </box>
        );
      })}
    </box>
  );
}

function OriginalCodeSnippet({ comment }: { comment: ReviewComment }) {
  const { theme } = useAtomValue(resolvedThemeAtom);
  if (!comment.code) return null;

  return (
    <box
      flexDirection="column"
      border={["left"]}
      borderColor={theme.textMuted}
      paddingLeft={1}
      width="100%"
    >
      <text fg={rgbaToHex(theme.textMuted)}>original</text>
      <text fg={rgbaToHex(theme.textMuted)} width="100%" flexShrink={1}>
        {comment.code}
      </text>
    </box>
  );
}

function SplitReviewCommentsBlock({
  comments,
  commentTimeNow,
  viewMode,
  editingCommentId,
  replyingCommentId,
  onCommentSelected,
  onCommentDelete,
  onCommentEditCancel,
  onCommentEditSubmit,
  onCommentReplyCancel,
  onCommentReplySubmit,
}: {
  comments: ReviewCommentAnchor[];
  commentTimeNow: number;
  viewMode: "split" | "unified";
  editingCommentId?: string | null;
  replyingCommentId?: string | null;
  onCommentSelected?: (comment: ReviewComment) => void;
  onCommentDelete?: (comment: ReviewComment) => void;
  onCommentEditCancel?: () => void;
  onCommentEditSubmit?: (comment: ReviewComment, body: string) => void;
  onCommentReplyCancel?: () => void;
  onCommentReplySubmit?: (comment: ReviewComment, body: string) => void;
}) {
  if (viewMode !== "split") {
    return (
      <ReviewCommentsBlock
        comments={comments}
        commentTimeNow={commentTimeNow}
        editingCommentId={editingCommentId}
        replyingCommentId={replyingCommentId}
        onCommentSelected={onCommentSelected}
        onCommentDelete={onCommentDelete}
        onCommentEditCancel={onCommentEditCancel}
        onCommentEditSubmit={onCommentEditSubmit}
        onCommentReplyCancel={onCommentReplyCancel}
        onCommentReplySubmit={onCommentReplySubmit}
      />
    );
  }

  const full = comments.filter((comment) => getCommentDisplaySide(comment) === "both");
  const left = comments.filter((comment) => getCommentDisplaySide(comment) === "left");
  const right = comments.filter((comment) => getCommentDisplaySide(comment) === "right");

  if (left.length === 0 && right.length === 0) {
    return (
      <ReviewCommentsBlock
        comments={full}
        commentTimeNow={commentTimeNow}
        editingCommentId={editingCommentId}
        replyingCommentId={replyingCommentId}
        onCommentSelected={onCommentSelected}
        onCommentDelete={onCommentDelete}
        onCommentEditCancel={onCommentEditCancel}
        onCommentEditSubmit={onCommentEditSubmit}
        onCommentReplyCancel={onCommentReplyCancel}
        onCommentReplySubmit={onCommentReplySubmit}
      />
    );
  }

  return (
    <box flexDirection="column" width="100%">
      <ReviewCommentsBlock
        comments={full}
        commentTimeNow={commentTimeNow}
        editingCommentId={editingCommentId}
        replyingCommentId={replyingCommentId}
        onCommentSelected={onCommentSelected}
        onCommentDelete={onCommentDelete}
        onCommentEditCancel={onCommentEditCancel}
        onCommentEditSubmit={onCommentEditSubmit}
        onCommentReplyCancel={onCommentReplyCancel}
        onCommentReplySubmit={onCommentReplySubmit}
      />
      <box flexDirection="row" width="100%">
        <box width="50%" flexGrow={0} flexShrink={0}>
          <ReviewCommentsBlock
            comments={left}
            commentTimeNow={commentTimeNow}
            editingCommentId={editingCommentId}
            replyingCommentId={replyingCommentId}
            onCommentSelected={onCommentSelected}
            onCommentDelete={onCommentDelete}
            onCommentEditCancel={onCommentEditCancel}
            onCommentEditSubmit={onCommentEditSubmit}
            onCommentReplyCancel={onCommentReplyCancel}
            onCommentReplySubmit={onCommentReplySubmit}
          />
        </box>
        <box width="50%" flexGrow={0} flexShrink={0}>
          <ReviewCommentsBlock
            comments={right}
            commentTimeNow={commentTimeNow}
            editingCommentId={editingCommentId}
            replyingCommentId={replyingCommentId}
            onCommentSelected={onCommentSelected}
            onCommentDelete={onCommentDelete}
            onCommentEditCancel={onCommentEditCancel}
            onCommentEditSubmit={onCommentEditSubmit}
            onCommentReplyCancel={onCommentReplyCancel}
            onCommentReplySubmit={onCommentReplySubmit}
          />
        </box>
      </box>
    </box>
  );
}

function HunkDiffWithComments({
  hunkDiff,
  hunk,
  hunkIndex,
  comments,
  selectedTarget,
  viewMode,
  filetype,
  themeName,
  wrapMode,
  showLineNumbers,
  backgrounds,
  highlightInline,
  indicators,
  commentTimeNow,
  editingCommentId,
  replyingCommentId,
  onCommentSelected,
  onCommentDelete,
  onCommentEditCancel,
  onCommentEditSubmit,
  onCommentReplyCancel,
  onCommentReplySubmit,
  onDiffMouseDown,
}: {
  hunkDiff: string;
  hunk: StructuredPatchHunk;
  hunkIndex: number;
  comments: ReviewComment[];
  selectedTarget: SelectedCommentTarget | null;
  viewMode: "split" | "unified";
  filetype: string;
  themeName: string;
  wrapMode: "word" | "char" | "none";
  showLineNumbers: boolean;
  backgrounds: boolean;
  highlightInline: boolean;
  indicators: Indicators;
  commentTimeNow: number;
  editingCommentId?: string | null;
  replyingCommentId?: string | null;
  onCommentSelected?: (comment: ReviewComment) => void;
  onCommentDelete?: (comment: ReviewComment) => void;
  onCommentEditCancel?: () => void;
  onCommentEditSubmit?: (comment: ReviewComment, body: string) => void;
  onCommentReplyCancel?: () => void;
  onCommentReplySubmit?: (comment: ReviewComment, body: string) => void;
  onDiffMouseDown: (event: MouseEvent, diffLineOffset: number) => void;
}) {
  const { theme } = useAtomValue(resolvedThemeAtom);
  const rows = buildDisplayRows(hunk);
  const anchoredComments = new Map<number, ReviewCommentAnchor[]>();
  const floatingComments: ReviewCommentAnchor[] = [];

  for (const comment of comments) {
    const resolved = resolveReviewCommentAnchor(comment, rows);
    if (resolved.anchor == null) {
      floatingComments.push(resolved);
      continue;
    }

    const list = anchoredComments.get(resolved.anchor) ?? [];
    list.push(resolved);
    anchoredComments.set(resolved.anchor, list);
  }

  const selectedAnchor = selectedTarget ? findTargetDisplayIndex(selectedTarget, rows) : null;
  const uniqueAnchors = [...new Set(anchoredComments.keys())].sort((a, b) => a - b);

  if (uniqueAnchors.length === 0) {
    return (
      <>
        <DiffView
          diff={hunkDiff}
          view={viewMode}
          filetype={filetype}
          themeName={themeName}
          wrapMode={wrapMode}
          showLineNumbers={showLineNumbers}
          backgrounds={backgrounds}
          highlightInline={highlightInline}
          indicators={indicators}
          selectedLineIndex={selectedAnchor ?? undefined}
          selectedLineSide={getSelectedLineSide(viewMode, selectedTarget)}
          selectedOldLine={selectedTarget?.oldLine}
          selectedNewLine={selectedTarget?.newLine}
          selectedLineKind={getSelectedLineKind(selectedTarget)}
          selectedLineBg={rgbaToHex(theme.primary)}
          onMouseDown={(event) => onDiffMouseDown(event, 0)}
        />
        <ReviewCommentsBlock
          comments={floatingComments}
          commentTimeNow={commentTimeNow}
          editingCommentId={editingCommentId}
          replyingCommentId={replyingCommentId}
          onCommentSelected={onCommentSelected}
          onCommentDelete={onCommentDelete}
          onCommentEditCancel={onCommentEditCancel}
          onCommentEditSubmit={onCommentEditSubmit}
          onCommentReplyCancel={onCommentReplyCancel}
          onCommentReplySubmit={onCommentReplySubmit}
        />
      </>
    );
  }

  const nodes: React.ReactNode[] = [];
  let start = 0;

  for (const anchor of uniqueAnchors) {
    if (anchor >= start) {
      const segmentStart = start;
      const selectedLineIndex =
        selectedAnchor != null && selectedAnchor >= segmentStart && selectedAnchor <= anchor
          ? selectedAnchor - segmentStart
          : undefined;
      nodes.push(
        <DiffView
          key={`diff-${segmentStart}-${anchor}`}
          diff={buildHunkDiffSegment(hunkDiff, rows.slice(segmentStart, anchor + 1))}
          view={viewMode}
          filetype={filetype}
          themeName={themeName}
          wrapMode={wrapMode}
          showLineNumbers={showLineNumbers}
          backgrounds={backgrounds}
          highlightInline={highlightInline}
          indicators={indicators}
          selectedLineIndex={selectedLineIndex}
          selectedLineSide={getSelectedLineSide(viewMode, selectedTarget)}
          selectedOldLine={selectedTarget?.oldLine}
          selectedNewLine={selectedTarget?.newLine}
          selectedLineKind={getSelectedLineKind(selectedTarget)}
          selectedLineBg={rgbaToHex(theme.primary)}
          onMouseDown={(event) => onDiffMouseDown(event, segmentStart)}
        />,
      );
      start = anchor + 1;
    }

    const lineComments = anchoredComments.get(anchor);
    if (lineComments) {
      nodes.push(
        <SplitReviewCommentsBlock
          key={`comments-${anchor}`}
          comments={lineComments}
          commentTimeNow={commentTimeNow}
          viewMode={viewMode}
          editingCommentId={editingCommentId}
          replyingCommentId={replyingCommentId}
          onCommentSelected={onCommentSelected}
          onCommentDelete={onCommentDelete}
          onCommentEditCancel={onCommentEditCancel}
          onCommentEditSubmit={onCommentEditSubmit}
          onCommentReplyCancel={onCommentReplyCancel}
          onCommentReplySubmit={onCommentReplySubmit}
        />,
      );
    }
  }

  if (start < rows.length) {
    const segmentStart = start;
    const selectedLineIndex =
      selectedAnchor != null && selectedAnchor >= segmentStart
        ? selectedAnchor - segmentStart
        : undefined;
    nodes.push(
      <DiffView
        key={`diff-${segmentStart}-end`}
        diff={buildHunkDiffSegment(hunkDiff, rows.slice(segmentStart))}
        view={viewMode}
        filetype={filetype}
        themeName={themeName}
        wrapMode={wrapMode}
        showLineNumbers={showLineNumbers}
        backgrounds={backgrounds}
        highlightInline={highlightInline}
        indicators={indicators}
        selectedLineIndex={selectedLineIndex}
        selectedLineSide={getSelectedLineSide(viewMode, selectedTarget)}
        selectedOldLine={selectedTarget?.oldLine}
        selectedNewLine={selectedTarget?.newLine}
        selectedLineKind={getSelectedLineKind(selectedTarget)}
        selectedLineBg={rgbaToHex(theme.primary)}
        onMouseDown={(event) => onDiffMouseDown(event, segmentStart)}
      />,
    );
  }

  if (floatingComments.length > 0) {
    nodes.push(
      <ReviewCommentsBlock
        key={`floating-comments-${hunkIndex}`}
        comments={floatingComments}
        commentTimeNow={commentTimeNow}
        editingCommentId={editingCommentId}
        replyingCommentId={replyingCommentId}
        onCommentSelected={onCommentSelected}
        onCommentDelete={onCommentDelete}
        onCommentEditCancel={onCommentEditCancel}
        onCommentEditSubmit={onCommentEditSubmit}
        onCommentReplyCancel={onCommentReplyCancel}
        onCommentReplySubmit={onCommentReplySubmit}
      />,
    );
  }

  return <>{nodes}</>;
}

function getSelectedLineSide(
  viewMode: "split" | "unified",
  selectedTarget: SelectedCommentTarget | null,
): "left" | "right" | "both" {
  if (viewMode !== "split") return "both";
  if (selectedTarget?.displaySide === "left" || selectedTarget?.displaySide === "right") {
    return selectedTarget.displaySide;
  }
  if (selectedTarget?.side === "old") return "left";
  if (selectedTarget?.side === "new") return "right";
  return "both";
}

function getSelectedLineKind(
  selectedTarget: SelectedCommentTarget | null,
): "add" | "remove" | "context" | undefined {
  if (selectedTarget?.side === "old") return "remove";
  if (selectedTarget?.side === "new") return "add";
  if (selectedTarget?.side === "context") return "context";
  return undefined;
}

function getCommentDisplaySide(comment: ReviewCommentAnchor): "left" | "right" | "both" {
  if (comment.comment.displaySide === "left" || comment.comment.displaySide === "right") {
    return comment.comment.displaySide;
  }
  if (comment.comment.side === "old") return "left";
  if (comment.comment.side === "new") return "right";
  if (comment.comment.side === "context") return "right";
  return "both";
}

function getVisibleAnchorStatus(
  status: ReviewCommentAnchorStatus,
): Exclude<ReviewCommentAnchorStatus, "fresh"> | null {
  return status === "fresh" ? null : status;
}

function formatOriginalLocation(comment: ReviewComment): string {
  if (comment.side === "old" && comment.oldLine != null) return `-${comment.oldLine}`;
  if (comment.side === "new" && comment.newLine != null) return `+${comment.newLine}`;
  if (comment.oldLine != null && comment.newLine != null) {
    return `${comment.oldLine}/${comment.newLine}`;
  }
  if (comment.oldLine != null) return `-${comment.oldLine}`;
  if (comment.newLine != null) return `+${comment.newLine}`;
  return comment.file;
}

interface CommentThemeColors {
  primary: RGBA;
  error: RGBA;
  warning: RGBA;
}

function getAnchorStatusColor(
  status: Exclude<ReviewCommentAnchorStatus, "fresh">,
  theme: CommentThemeColors,
): RGBA {
  if (status === "moved") return theme.primary;
  if (status === "orphaned") return theme.error;
  return theme.warning;
}

function blend(base: RGBA, overlay: RGBA, amount: number): RGBA {
  const [baseR, baseG, baseB] = base.toInts();
  const [overlayR, overlayG, overlayB] = overlay.toInts();
  return RGBA.fromInts(
    Math.round(baseR * (1 - amount) + overlayR * amount),
    Math.round(baseG * (1 - amount) + overlayG * amount),
    Math.round(baseB * (1 - amount) + overlayB * amount),
  );
}

function brighten(color: RGBA, amount: number): RGBA {
  const [r, g, b] = color.toInts();
  return RGBA.fromInts(
    Math.min(255, r + amount),
    Math.min(255, g + amount),
    Math.min(255, b + amount),
  );
}
