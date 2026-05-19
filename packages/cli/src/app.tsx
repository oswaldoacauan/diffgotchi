import * as React from "react";
import { useAtomValue } from "jotai/react";
import { useKeyboard, useOnResize, useTerminalDimensions } from "@opentui/react";
import { ScrollBoxRenderable, RGBA, type MouseEvent } from "@opentui/core";
import { appStore } from "@/atoms/store";
import { parsedFilesAtom, branchAtom, errorAtom } from "@/atoms/core";
import {
  addReviewCommentAtom,
  addReviewCommentReplyAtom,
  deleteReviewCommentAtom,
  editReviewCommentAtom,
  reviewCommentsAtom,
  reviewSessionAtom,
  setReviewSessionAtom,
} from "@/atoms/review";
import {
  browsingAtom,
  terminalWidthAtom,
  startupToastsAtom,
  diffTruncatedAtom,
  diffTotalBytesAtom,
  forceExpandedFilesAtom,
  keybindContextAtom,
} from "@/atoms/ui";
import {
  viewModeAtom,
  showLineNumbersAtom,
  wrapModeAtom,
  highlightInlineAtom,
  backgroundsAtom,
  indicatorsAtom,
  showHunksAtom,
} from "@/atoms/display";
import {
  currentFileIndexAtom,
  doneCountAtom,
  totalsAtom,
  resolvedThemeAtom,
} from "@/atoms/derived";
import { drainToastsAtom } from "@/atoms/actions";
import { useKeybind } from "@/providers/keybind";
import { useDialog } from "@/providers/dialog";
import { useToast } from "@/providers/toast";
import { rgbaToHex } from "@/lib/themes";
import { Header } from "@/components/header";
import { StatusLine } from "@/components/status-line";
import { DiffView } from "@/components/ui/diff-view";
import { KeybindHint } from "@/components/ui/keybind-hint";
import { ReviewCommentsBlock, ReviewDiffHunk } from "@/components/ui/review-diff";
import { AllDoneScreen } from "@/components/done";
import { InlineCommentEditor } from "@/components/dialogs/review-comments";
import type { ReviewComment, SelectedCommentTarget } from "@/lib/review-comments";
import {
  getFileName,
  getOldFileName,
  countChanges,
  countDiffLines,
  getViewMode,
  detectFiletype,
} from "@/lib/git/parse";
import { loadConfig } from "@/lib/config";
import { diffHash } from "@/lib/review";
import { loadReviewSession } from "@/lib/review-comments";
import { ScrollAcceleration } from "@/util/scroll-acceleration";
import { getUnifiedCommentTarget, markReviewCommentOrphaned } from "@/util/review-comment-targets";
import { useAppCommands } from "@/hooks/use-commands";
import { useAppKeyboard } from "@/hooks/use-keyboard";

export function App() {
  const { width: initialWidth, height } = useTerminalDimensions();
  const [scrollAcceleration] = React.useState(() => new ScrollAcceleration());
  React.useEffect(() => {
    appStore.set(terminalWidthAtom, initialWidth);
  }, [initialWidth]);
  useOnResize(React.useCallback((w: number) => appStore.set(terminalWidthAtom, w), []));
  const width = useAtomValue(terminalWidthAtom);
  const { theme, themeName, mutedColor, successColor } = useAtomValue(resolvedThemeAtom);
  const keybind = useKeybind();
  const dialog = useDialog();
  const toast = useToast();

  const parsedFiles = useAtomValue(parsedFilesAtom);
  const reviewSession = useAtomValue(reviewSessionAtom);
  const reviewComments = useAtomValue(reviewCommentsAtom);
  const branch = useAtomValue(branchAtom);
  const error = useAtomValue(errorAtom);
  const browsing = useAtomValue(browsingAtom);
  const currentFileIndex = useAtomValue(currentFileIndexAtom);
  const doneCount = useAtomValue(doneCountAtom);
  const { totalAdded, totalRemoved } = useAtomValue(totalsAtom);

  const viewModeSetting = useAtomValue(viewModeAtom);
  const showLineNumbers = useAtomValue(showLineNumbersAtom);
  const wrapMode = useAtomValue(wrapModeAtom);
  const highlightInline = useAtomValue(highlightInlineAtom);
  const backgrounds = useAtomValue(backgroundsAtom);
  const indicators = useAtomValue(indicatorsAtom);
  const showHunks = useAtomValue(showHunksAtom);
  const diffTruncated = useAtomValue(diffTruncatedAtom);
  const diffTotalBytes = useAtomValue(diffTotalBytesAtom);
  const forceExpandedFiles = useAtomValue(forceExpandedFilesAtom);
  const cachedConfig = React.useMemo(() => loadConfig(), []);
  const maxFileLines = cachedConfig.diff.max_file_lines;

  React.useEffect(() => {
    const pending = appStore.set(drainToastsAtom);
    if (pending) {
      for (const t of pending) toast.show(t.message, t.variant);
    }

    return appStore.sub(startupToastsAtom, () => {
      const toasts = appStore.get(startupToastsAtom);
      if (toasts.length === 0) return;
      const drained = appStore.set(drainToastsAtom);
      if (drained) {
        for (const t of drained) toast.show(t.message, t.variant);
      }
    });
  }, [toast]);

  React.useEffect(() => {
    if (diffTruncated) {
      const capMB = (loadConfig().diff.max_bytes / (1024 * 1024)).toFixed(0);
      const totalMB = (diffTotalBytes / (1024 * 1024)).toFixed(1);
      toast.show(`Diff truncated (${capMB}MB cap, ${totalMB}MB total). Use --force.`, "warning");
    }
  }, [diffTruncated, diffTotalBytes, toast]);

  React.useEffect(() => {
    if (!reviewSession) return;
    const timer = setInterval(() => {
      const current = appStore.get(reviewSessionAtom);
      if (!current) return;
      const latest = loadReviewSession(current.id);
      if (!latest || latest.updatedAt === current.updatedAt) return;
      appStore.set(setReviewSessionAtom, latest);
    }, 1000);
    return () => clearInterval(timer);
  }, [reviewSession?.id]);

  const scrollboxRef = React.useRef<ScrollBoxRenderable | null>(null);
  const [currentHunkIndex, setCurrentHunkIndex] = React.useState(0);
  const [selectedCommentTarget, setSelectedCommentTarget] =
    React.useState<SelectedCommentTarget | null>(null);
  const [commentPopover, setCommentPopover] = React.useState<CommentPopoverState | null>(null);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [replyingCommentId, setReplyingCommentId] = React.useState<string | null>(null);
  const [commentTimeNow, setCommentTimeNow] = React.useState(() => Date.now());
  const inlineCommentTarget = commentPopover?.target ?? null;
  const commentInputOpen =
    commentPopover !== null || editingCommentId !== null || replyingCommentId !== null;
  const allDone = doneCount === parsedFiles.length && !error;

  React.useEffect(() => {
    appStore.set(keybindContextAtom, commentInputOpen ? "comment_editor" : "diff");
  }, [commentInputOpen]);

  useKeyboard((key) => {
    if (dialog.stack.length > 0) return;
    if (inlineCommentTarget) return;
    if (editingCommentId) return;
    if (replyingCommentId) return;
    if (key.name === "escape" && selectedCommentTarget) {
      setSelectedCommentTarget(null);
    }
  });

  const scrollToHunk = React.useCallback((scrollbox: ScrollBoxRenderable, idx: number) => {
    const children = scrollbox.getChildren();
    let offset = 0;
    for (let i = 0; i < children.length; i++) {
      if (children[i]!.id === `hunk-${idx}`) {
        scrollbox.scrollTo(offset);
        return;
      }
      offset += (children[i] as any).height ?? 0;
    }
  }, []);

  const bgColor = theme.background;

  React.useEffect(() => {
    if (!allDone && browsing) appStore.set(browsingAtom, false);
  }, [allDone, browsing]);

  const file = parsedFiles[currentFileIndex] ?? null;
  const fileName = file ? getFileName(file) : null;
  const oldFileName = file ? getOldFileName(file) : null;

  const fileComments = React.useMemo(
    () => (fileName ? reviewComments.filter((comment) => comment.file === fileName) : []),
    [fileName, reviewComments],
  );
  const openFileComments = React.useMemo(
    () => fileComments.filter((comment) => comment.status === "open"),
    [fileComments],
  );

  React.useEffect(() => {
    if (reviewComments.length === 0) return;

    setCommentTimeNow(Date.now());
    const timer = setInterval(() => setCommentTimeNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [reviewComments.length]);

  const commentsByHunk = React.useMemo(() => {
    const grouped = new Map<number, ReviewComment[]>();
    for (const comment of openFileComments) {
      const idx = comment.hunkIndex ?? 0;
      if (!file || idx < 0 || idx >= file.hunks.length) continue;
      const list = grouped.get(idx) ?? [];
      list.push(comment);
      grouped.set(idx, list);
    }
    return grouped;
  }, [file, openFileComments]);

  const fileUnanchoredComments = React.useMemo(() => {
    if (!file) return [];
    return openFileComments
      .filter((comment) => {
        const idx = comment.hunkIndex ?? 0;
        return idx < 0 || idx >= file.hunks.length;
      })
      .map(markReviewCommentOrphaned);
  }, [file, openFileComments]);

  React.useEffect(() => {
    if (fileName) {
      setCurrentHunkIndex(0);
      setSelectedCommentTarget(null);
      setCommentPopover(null);
      setEditingCommentId(null);
      setReplyingCommentId(null);
    }
  }, [fileName]);

  const filetype = file ? detectFiletype(fileName!, cachedConfig.diff.filetypes) : "text";
  const { additions, deletions } = file ? countChanges(file.hunks) : { additions: 0, deletions: 0 };
  const fileLineCount = file ? countDiffLines(file) : 0;
  const isForceExpanded = fileName ? !!forceExpandedFiles[fileName] : false;
  const isFileTooLarge = maxFileLines > 0 && fileLineCount > maxFileLines && !isForceExpanded;
  const viewMode =
    viewModeSetting === "auto" ? getViewMode(additions, deletions, width) : viewModeSetting;

  function openCommentPopover(target: SelectedCommentTarget, anchorX?: number, anchorY?: number) {
    if (typeof target.hunkIndex === "number") setCurrentHunkIndex(target.hunkIndex);
    setSelectedCommentTarget(target);
    setCommentPopover({ target, anchorX, anchorY, body: "" });
  }

  function startEditingComment(comment: ReviewComment) {
    const target: SelectedCommentTarget = {
      file: comment.file,
      oldFile: comment.oldFile ?? null,
      side: comment.side,
      oldLine: comment.oldLine ?? null,
      newLine: comment.newLine ?? null,
      displaySide: comment.displaySide,
      hunkIndex: comment.hunkIndex,
      diffLineIndex: comment.diffLineIndex,
      code: comment.code,
    };

    if (typeof target.hunkIndex === "number") setCurrentHunkIndex(target.hunkIndex);
    setSelectedCommentTarget(target);
    setCommentPopover(null);
    setReplyingCommentId(null);
    setEditingCommentId(comment.id);
  }

  function startReplyingToComment(comment: ReviewComment) {
    const target: SelectedCommentTarget = {
      file: comment.file,
      oldFile: comment.oldFile ?? null,
      side: comment.side,
      oldLine: comment.oldLine ?? null,
      newLine: comment.newLine ?? null,
      displaySide: comment.displaySide,
      hunkIndex: comment.hunkIndex,
      diffLineIndex: comment.diffLineIndex,
      code: comment.code,
    };

    if (typeof target.hunkIndex === "number") setCurrentHunkIndex(target.hunkIndex);
    setSelectedCommentTarget(target);
    setCommentPopover(null);
    setEditingCommentId(null);
    setReplyingCommentId(comment.id);
  }

  function handleCommentSelected(comment: ReviewComment) {
    if (comment.author === "agent") {
      startReplyingToComment(comment);
      return;
    }

    startEditingComment(comment);
  }

  function closeCommentPopover() {
    setCommentPopover(null);
    setSelectedCommentTarget(null);
  }

  function closeCommentPopoverIfEmpty() {
    if ((commentPopover?.body ?? "").trim().length === 0) {
      closeCommentPopover();
    }
  }

  function getDefaultCommentTarget(): SelectedCommentTarget | null {
    if (!file || !fileName) return null;
    if (selectedCommentTarget?.file === fileName) return selectedCommentTarget;

    const hunkIndex =
      file.hunks.length > 0
        ? Math.min(Math.max(0, currentHunkIndex), file.hunks.length - 1)
        : undefined;
    if (hunkIndex === undefined) return null;

    return getUnifiedCommentTarget(file.hunks[hunkIndex]!, hunkIndex, 0, fileName, oldFileName);
  }

  function startInlineComment() {
    const target = getDefaultCommentTarget();
    if (!target) return;

    openCommentPopover(target);
  }

  function submitInlineComment(target: SelectedCommentTarget, body: string) {
    if (!file) return;

    appStore.set(addReviewCommentAtom, {
      file: target.file,
      oldFile: target.oldFile,
      side: target.side,
      oldLine: target.oldLine,
      newLine: target.newLine,
      displaySide: target.displaySide,
      hunkIndex: target.hunkIndex,
      diffLineIndex: target.diffLineIndex,
      code: target.code,
      author: "user",
      body,
      diffHashAtCreate: diffHash(file.rawDiff || ""),
    });
    setCommentPopover(null);
    setSelectedCommentTarget(null);
  }

  function submitEditedComment(comment: ReviewComment, body: string) {
    appStore.set(editReviewCommentAtom, {
      commentId: comment.id,
      body,
    });
    setEditingCommentId(null);
    setSelectedCommentTarget(null);
  }

  function submitCommentReply(comment: ReviewComment, body: string) {
    appStore.set(addReviewCommentReplyAtom, {
      commentId: comment.id,
      body,
    });
    setReplyingCommentId(null);
    setSelectedCommentTarget(null);
  }

  function deleteComment(comment: ReviewComment) {
    appStore.set(deleteReviewCommentAtom, comment.id);
    setEditingCommentId(null);
    setReplyingCommentId(null);
    setSelectedCommentTarget(null);
    setCommentPopover(null);
  }

  function cancelEditingComment() {
    setEditingCommentId(null);
    setSelectedCommentTarget(null);
  }

  function cancelReplyingToComment() {
    setReplyingCommentId(null);
    setSelectedCommentTarget(null);
  }

  function getCommentPopoverPlacement(
    target: SelectedCommentTarget,
    anchorX?: number,
    anchorY?: number,
  ) {
    const bounds = getCommentPopoverHorizontalBounds(target);
    const popoverWidth = Math.max(1, Math.min(72, bounds.max - bounds.min + 1));
    const popoverHeight = 9;
    const maxLeft = Math.max(bounds.min, bounds.max - popoverWidth + 1);
    const fallbackLeft = clamp(
      Math.floor(bounds.min + (bounds.max - bounds.min - popoverWidth) / 2),
      bounds.min,
      maxLeft,
    );
    const left =
      anchorX == null
        ? fallbackLeft
        : clamp(anchorX + 2, bounds.min, Math.max(bounds.min, maxLeft));

    const fallbackTop = Math.max(1, Math.floor(height * 0.2));
    const maxTop = Math.max(1, height - popoverHeight - 2);
    if (anchorY == null) {
      return { left, top: clamp(fallbackTop, 1, maxTop), width: popoverWidth };
    }

    const below = anchorY + 1;
    const above = anchorY - popoverHeight;
    const top = below <= maxTop || above < 1 ? clamp(below, 1, maxTop) : above;
    return { left, top, width: popoverWidth };
  }

  function getCommentPopoverHorizontalBounds(target: SelectedCommentTarget) {
    const full = { min: 1, max: Math.max(1, width - 2) };
    if (viewMode !== "split") return full;

    const midpoint = Math.floor(width / 2);
    const side = target.displaySide ?? target.side;
    if (side === "left" || side === "old") {
      return { min: full.min, max: Math.max(full.min, midpoint - 1) };
    }
    if (side === "right" || side === "new") {
      const min = Math.min(full.max, midpoint + 1);
      return { min, max: Math.max(min, full.max) };
    }
    return full;
  }

  function renderCommentPopover() {
    if (!commentPopover) return null;
    const { target, anchorX, anchorY } = commentPopover;
    const placement = getCommentPopoverPlacement(target, anchorX, anchorY);

    return (
      <>
        <box
          position="absolute"
          left={0}
          top={0}
          width={width}
          height={height}
          zIndex={2400}
          onMouseDown={(event: MouseEvent) => {
            closeCommentPopoverIfEmpty();
            event.stopPropagation();
          }}
        />
        <box
          position="absolute"
          left={placement.left}
          top={placement.top}
          width={placement.width}
          zIndex={2500}
          onMouseDown={(event: MouseEvent) => event.stopPropagation()}
        >
          <InlineCommentEditor
            key={`${target.hunkIndex ?? "file"}-${target.diffLineIndex ?? "line"}`}
            initialBody={commentPopover.body}
            onCancel={closeCommentPopover}
            onBodyChange={(body) => setCommentPopover((prev) => (prev ? { ...prev, body } : prev))}
            onSubmit={(body) => submitInlineComment(target, body)}
          />
        </box>
      </>
    );
  }

  useAppCommands({
    scrollboxRef,
    currentHunkIndex,
    setCurrentHunkIndex,
    scrollToHunk,
    startInlineComment,
    commentComposerOpen: commentInputOpen,
    commentUiOpen: commentInputOpen || selectedCommentTarget !== null,
  });
  useAppKeyboard({
    scrollboxRef,
    currentHunkIndex,
    setCurrentHunkIndex,
    scrollToHunk,
    scrollAcceleration,
    commentComposerOpen: commentInputOpen,
  });

  if (error) {
    return (
      <box
        style={{
          flexDirection: "column",
          height: "100%",
          backgroundColor: bgColor,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <text fg={rgbaToHex(theme.error)} attributes={1}>
          Error loading diff
        </text>
        <box style={{ paddingTop: 1 }} />
        <text fg={mutedColor}>{error}</text>
        <box style={{ paddingTop: 1 }} />
        <text fg={mutedColor}>Watching for changes…</text>
      </box>
    );
  }

  if (allDone && !browsing) {
    return (
      <box style={{ flexDirection: "column", height: "100%", backgroundColor: bgColor }}>
        <AllDoneScreen
          fileCount={parsedFiles.length}
          totalAdded={totalAdded}
          totalRemoved={totalRemoved}
          branch={branch}
          successColor={successColor}
          errorColor={rgbaToHex(theme.error)}
          mutedColor={mutedColor}
          bgColor={bgColor}
        />
      </box>
    );
  }

  if (!file || !fileName) return null;
  const forceExpandKey = keybind.printInContext("diff", "force_expand");

  return (
    <box
      position="relative"
      style={{ flexDirection: "column", height: "100%", padding: 1, backgroundColor: bgColor }}
    >
      <Header />

      <box style={{ flexDirection: "row", flexGrow: 1, flexShrink: 1 }}>
        {isFileTooLarge ? (
          <box
            flexGrow={1}
            flexShrink={1}
            justifyContent="center"
            alignItems="center"
            backgroundColor={rgbaToHex(theme.backgroundPanel)}
          >
            <box flexDirection="column" alignItems="center">
              <text fg={rgbaToHex(theme.warning)} attributes={1}>
                ⚠ File too large to display
              </text>
              <text />
              <text fg={mutedColor}>
                {fileLineCount.toLocaleString()} diff lines ({maxFileLines.toLocaleString()} limit)
              </text>
              <text />
              {forceExpandKey ? (
                <box flexDirection="row" justifyContent="center">
                  <text fg={mutedColor}>Press </text>
                  <KeybindHint command="diff.force_expand" />
                  <text fg={mutedColor}> to expand</text>
                </box>
              ) : (
                <text fg={mutedColor}>Force expand is unbound</text>
              )}
            </box>
          </box>
        ) : (
          <scrollbox
            key={fileName}
            ref={scrollboxRef}
            scrollY
            scrollAcceleration={scrollAcceleration}
            style={{
              flexGrow: 1,
              flexShrink: 1,
              rootOptions: { backgroundColor: rgbaToHex(theme.backgroundPanel), border: false },
              contentOptions: { minHeight: 0 },
              scrollbarOptions: {
                showArrows: false,
                trackOptions: { foregroundColor: mutedColor, backgroundColor: bgColor },
              },
            }}
            focused={dialog.stack.length === 0 && !commentInputOpen}
          >
            {showHunks && file.hunkInfos && file.hunkInfos.length > 0 ? (
              file.hunkInfos.map((hunk, i) => {
                const hunkComments = commentsByHunk.get(i) ?? [];
                const selectedTarget =
                  selectedCommentTarget?.file === fileName && selectedCommentTarget.hunkIndex === i
                    ? selectedCommentTarget
                    : null;
                return (
                  <ReviewDiffHunk
                    key={i}
                    hunkInfo={hunk}
                    hunk={file.hunks[i]!}
                    hunkIndex={i}
                    currentHunkIndex={currentHunkIndex}
                    comments={hunkComments}
                    selectedTarget={selectedTarget}
                    fileName={fileName}
                    oldFileName={oldFileName}
                    viewMode={viewMode}
                    filetype={filetype}
                    themeName={themeName}
                    wrapMode={wrapMode}
                    showLineNumbers={showLineNumbers}
                    backgrounds={backgrounds}
                    highlightInline={highlightInline}
                    indicators={indicators}
                    commentTimeNow={commentTimeNow}
                    mutedColor={mutedColor}
                    onTargetSelected={openCommentPopover}
                    editingCommentId={editingCommentId}
                    replyingCommentId={replyingCommentId}
                    onCommentSelected={handleCommentSelected}
                    onCommentDelete={deleteComment}
                    onCommentEditCancel={cancelEditingComment}
                    onCommentEditSubmit={submitEditedComment}
                    onCommentReplyCancel={cancelReplyingToComment}
                    onCommentReplySubmit={submitCommentReply}
                    isCommentComposerOpen={commentInputOpen}
                  />
                );
              })
            ) : (
              <>
                <DiffView
                  diff={file.rawDiff || ""}
                  view={viewMode}
                  filetype={filetype}
                  themeName={themeName}
                  wrapMode={wrapMode}
                  showLineNumbers={showLineNumbers}
                  backgrounds={backgrounds}
                  highlightInline={highlightInline}
                  indicators={indicators}
                />
                <ReviewCommentsBlock
                  comments={openFileComments.map(markReviewCommentOrphaned)}
                  commentTimeNow={commentTimeNow}
                />
              </>
            )}
            {fileUnanchoredComments.length > 0 ? (
              <box flexDirection="column" width="100%" paddingTop={1}>
                <box flexDirection="row" paddingLeft={2}>
                  <text fg={rgbaToHex(theme.warning)} attributes={1}>
                    Unanchored comments
                  </text>
                  <text fg={mutedColor}>
                    {" "}
                    · {fileUnanchoredComments.length} no longer map to a displayed hunk
                  </text>
                </box>
                <ReviewCommentsBlock
                  comments={fileUnanchoredComments}
                  commentTimeNow={commentTimeNow}
                  editingCommentId={editingCommentId}
                  replyingCommentId={replyingCommentId}
                  onCommentSelected={handleCommentSelected}
                  onCommentDelete={deleteComment}
                  onCommentEditCancel={cancelEditingComment}
                  onCommentEditSubmit={submitEditedComment}
                  onCommentReplyCancel={cancelReplyingToComment}
                  onCommentReplySubmit={submitCommentReply}
                />
              </box>
            ) : null}
            <box
              justifyContent="center"
              flexDirection="row"
              backgroundColor={(() => {
                const [r, g, b] = theme.backgroundPanel.toInts();
                return RGBA.fromInts(
                  Math.min(255, r + 20),
                  Math.min(255, g + 20),
                  Math.min(255, b + 20),
                );
              })()}
            >
              <text fg={mutedColor}>— end of file —</text>
            </box>
          </scrollbox>
        )}
      </box>

      <StatusLine />
      {renderCommentPopover()}
    </box>
  );
}

interface CommentPopoverState {
  target: SelectedCommentTarget;
  anchorX?: number;
  anchorY?: number;
  body: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
