import * as React from "react";
import {
  RGBA,
  RenderableEvents,
  TextAttributes,
  type MouseEvent,
  type ParsedKey,
  type TextareaRenderable,
} from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useAtomValue } from "jotai/react";
import { resolvedThemeAtom } from "@/atoms/derived";
import { rgbaToHex } from "@/lib/themes";
import type { ReviewComment } from "@/lib/review-comments";
import { DialogList, DialogListRow } from "@/components/ui/dialog-list";
import { HighlightedText } from "@/components/ui/highlighted-text";
import { KeybindHint } from "@/components/ui/keybind-hint";
import { useKeybind, type KeyCombo } from "@/providers/keybind";
import { fuzzyMatch } from "@/util/fuzzy-match";
import { formatMatchedPreview } from "@/util/matched-preview";
import { truncatePath } from "@/util/truncated-path";

export function InlineCommentEditor({
  initialBody = "",
  placeholder = "Add a comment...",
  onSubmit,
  onCancel,
  onBodyChange,
  onDelete,
}: {
  initialBody?: string;
  placeholder?: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
  onBodyChange?: (body: string) => void;
  onDelete?: () => void;
}) {
  const { theme } = useAtomValue(resolvedThemeAtom);
  const keybind = useKeybind();
  const textareaRef = React.useRef<TextareaRenderable | null>(null);
  const subscribedTextareaRef = React.useRef<TextareaRenderable | null>(null);
  const bodyRef = React.useRef(initialBody);
  const submittedRef = React.useRef(false);
  const [body, setBody] = React.useState(initialBody);
  const [discardArmed, setDiscardArmed] = React.useState(false);
  const discardArmedRef = React.useRef(false);

  const textMuted = rgbaToHex(theme.textMuted);
  const warning = rgbaToHex(theme.warning);
  const commentBg = blend(theme.backgroundPanel, theme.warning, 0.03);
  const hasBody = body.trim().length > 0;
  const escapeHelp = hasBody ? (discardArmed ? "again discard" : "twice discard") : "close";

  const clearDiscardArm = React.useCallback(() => {
    discardArmedRef.current = false;
    setDiscardArmed(false);
  }, []);

  const armDiscard = React.useCallback(() => {
    discardArmedRef.current = true;
    setDiscardArmed(true);
  }, []);

  React.useEffect(() => {
    if (discardArmedRef.current) clearDiscardArm();
  }, [body, clearDiscardArm]);

  const currentBody = React.useCallback(
    () => String(textareaRef.current?.plainText ?? bodyRef.current).trim(),
    [],
  );

  const submit = React.useCallback(() => {
    if (submittedRef.current) return;
    const next = currentBody();
    if (!next) return;
    submittedRef.current = true;
    onSubmit(next);
  }, [currentBody, onSubmit]);
  const submitKeyBindings = React.useMemo(
    () => textareaSubmitKeyBindings(keybind.bindings("comment_editor.submit")),
    [keybind],
  );

  useKeyboard((key) => {
    if (keybind.matchInContext("comment_editor", "submit", key)) {
      submit();
      return;
    }

    if (onDelete && keybind.matchInContext("comment_editor", "delete", key)) {
      onDelete();
      return;
    }

    if (!keybind.matchInContext("comment_editor", "cancel", key)) return;

    if (currentBody().length === 0) {
      clearDiscardArm();
      onCancel();
      return;
    }

    if (discardArmedRef.current) {
      clearDiscardArm();
      onCancel();
      return;
    }

    armDiscard();
  });

  return (
    <box
      flexDirection="column"
      gap={1}
      width="100%"
      paddingLeft={2}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      border={["left"]}
      borderStyle="heavy"
      borderColor={theme.warning}
      backgroundColor={commentBg}
      onMouseDown={(event: MouseEvent) => event.stopPropagation()}
    >
      <textarea
        height={5}
        width="100%"
        initialValue={initialBody}
        placeholder={placeholder}
        placeholderColor={theme.textMuted}
        backgroundColor={commentBg}
        focusedBackgroundColor={commentBg}
        textColor={theme.text}
        focusedTextColor={theme.text}
        cursorColor={theme.primary}
        selectionBg="#264F78"
        selectionFg="#FFFFFF"
        keyBindings={submitKeyBindings}
        onContentChange={(event: any) => {
          const next =
            typeof event === "string"
              ? event
              : typeof event?.plainText === "string"
                ? event.plainText
                : textareaRef.current?.plainText;
          if (typeof next === "string") {
            clearDiscardArm();
            bodyRef.current = next;
            setBody(next);
            submittedRef.current = false;
            onBodyChange?.(next);
          }
        }}
        onSubmit={submit}
        ref={(r) => {
          if (!r) return;
          textareaRef.current = r;
          if (subscribedTextareaRef.current !== r) {
            subscribedTextareaRef.current = r;
            r.on(RenderableEvents.BLURRED, () => {
              if (String(r.plainText ?? bodyRef.current).trim().length === 0) {
                onCancel();
              }
            });
          }
          setTimeout(() => {
            if (!r.isDestroyed) r.focus?.();
          }, 1);
        }}
      />
      <box flexDirection="row">
        <KeybindHint
          command="comment_editor.cancel"
          label={escapeHelp}
          fg={discardArmed ? warning : undefined}
          labelFg={discardArmed ? warning : undefined}
          attributes={discardArmed ? TextAttributes.BOLD : undefined}
          labelAttributes={discardArmed ? TextAttributes.BOLD : undefined}
        />
        <text
          fg={discardArmed ? warning : textMuted}
          attributes={discardArmed ? TextAttributes.BOLD : 0}
        >
          {" · "}
        </text>
        <KeybindHint command="comment_editor.submit" label="save" />
        {onDelete ? (
          <>
            <text fg={textMuted}> · </text>
            <KeybindHint command="comment_editor.delete" label="delete" />
          </>
        ) : null}
      </box>
    </box>
  );
}

export function CommentsDialog({
  comments,
  onSelect,
  onResolve,
  onDelete,
  onClose,
}: {
  comments: ReviewComment[];
  onSelect: (comment: ReviewComment) => void;
  onResolve: (comment: ReviewComment) => void;
  onDelete: (comment: ReviewComment) => void;
  onClose: () => void;
}) {
  const { theme } = useAtomValue(resolvedThemeAtom);
  const keybind = useKeybind();
  const [search, setSearch] = React.useState("");
  const openCount = comments.filter((comment) => comment.status === "open").length;
  const resolvedCount = comments.length - openCount;
  const searchNeedle = search.trim();
  const filtered = React.useMemo(() => {
    if (!searchNeedle) {
      return comments.map((comment) => ({ comment }));
    }

    return comments
      .map((comment) => {
        const path = formatCommentPath(comment);
        const body = comment.body.replace(/\s+/g, " ");
        const pathMatchIndices = fuzzyMatch(searchNeedle, path);
        const bodyMatchIndices = fuzzyMatch(searchNeedle, body);
        const hiddenSearchText = [
          comment.author,
          comment.status,
          comment.status === "resolved" ? "done" : "",
          comment.code ?? "",
          comment.side,
          comment.oldLine == null ? "" : String(comment.oldLine),
          comment.newLine == null ? "" : String(comment.newLine),
          ...(comment.replies ?? []).map((reply) => reply.body),
        ].join(" ");
        const hiddenMatch = fuzzyMatch(searchNeedle, hiddenSearchText);
        if (!pathMatchIndices && !bodyMatchIndices && !hiddenMatch) return null;

        return { comment };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [comments, searchNeedle]);

  const handleKey = React.useCallback(
    (key: ParsedKey, index: number) => {
      const comment = filtered[index]?.comment;
      if (!comment) return false;
      if (keybind.matchInContext("comments_list", "resolve", key)) {
        onResolve(comment);
        return true;
      }
      if (keybind.matchInContext("comments_list", "delete", key)) {
        onDelete(comment);
        return true;
      }
      return false;
    },
    [filtered, onDelete, onResolve],
  );

  return (
    <DialogList
      title="Comments"
      placeholder="Search comments..."
      count={filtered.length}
      onSelect={(i) => {
        const item = filtered[i];
        if (item) onSelect(item.comment);
      }}
      onEscape={onClose}
      onKey={handleKey}
      onSearchChange={setSearch}
      footer={
        <box flexDirection="row" justifyContent="space-between">
          <box flexDirection="row">
            <KeybindHint command="select.accept" label="jump" />
            <text fg={rgbaToHex(theme.textMuted)}> </text>
            <KeybindHint command="comments_list.resolve" label="done" />
            <text fg={rgbaToHex(theme.textMuted)}> </text>
            <KeybindHint command="comments_list.delete" label="delete" />
          </box>
          <text fg={rgbaToHex(theme.textMuted)}>
            {openCount} open · {resolvedCount} done
          </text>
        </box>
      }
    >
      {({ active, width, fg, muted }) =>
        filtered.map(({ comment }, i) => {
          const path = formatCommentPath(comment);
          const statusIcon = comment.status === "open" ? "●" : "✓";
          const authorIcon = comment.author === "agent" ? "A" : "U";
          const replyCount = comment.replies?.length ?? 0;
          const statusColor =
            i === active
              ? fg(i)
              : comment.status === "open"
                ? rgbaToHex(theme.warning)
                : rgbaToHex(theme.success);
          const pathMax = Math.max(18, Math.min(Math.floor(width * 0.46), width - 18));
          const pathPreview =
            searchNeedle && fuzzyMatch(searchNeedle, path)
              ? formatMatchedPreview(path, searchNeedle, pathMax)
              : { text: truncatePath(path, pathMax), matchIndices: [] };
          const body = [
            comment.body,
            ...(comment.replies ?? []).map((reply) => `reply: ${reply.body}`),
          ]
            .join(" ")
            .replace(/\s+/g, " ");
          const bodyMax = Math.max(12, width - pathPreview.text.length - 4);
          const bodyPreview = formatMatchedPreview(body, searchNeedle, bodyMax);

          return (
            <DialogListRow key={comment.id} index={i} active={active}>
              <text fg={statusColor} flexShrink={0}>
                {statusIcon}
              </text>
              <text fg={i === active ? fg(i) : rgbaToHex(theme.primary)} flexShrink={0}>
                {authorIcon}
              </text>
              {replyCount > 0 ? (
                <text fg={i === active ? fg(i) : rgbaToHex(theme.success)} flexShrink={0}>
                  {replyCount}
                </text>
              ) : null}
              <text fg={fg(i)} flexShrink={0} overflow="hidden" wrapMode="none">
                <HighlightedText
                  text={pathPreview.text}
                  indices={pathPreview.matchIndices}
                  fg={fg(i)}
                  highlightFg={i === active ? fg(i) : rgbaToHex(theme.primary)}
                />
              </text>
              <text
                fg={i === active ? fg(i) : muted(i)}
                flexGrow={1}
                overflow="hidden"
                wrapMode="none"
              >
                <HighlightedText
                  text={bodyPreview.text}
                  indices={bodyPreview.matchIndices}
                  fg={i === active ? fg(i) : muted(i)}
                  highlightFg={i === active ? fg(i) : rgbaToHex(theme.primary)}
                />
              </text>
            </DialogListRow>
          );
        })
      }
    </DialogList>
  );
}

function formatCommentPath(comment: ReviewComment): string {
  if (comment.newLine != null) return `${comment.file}:${comment.newLine}`;
  if (comment.oldLine != null) return `${comment.file}:-${comment.oldLine}`;
  return comment.file;
}

function textareaSubmitKeyBindings(bindings: KeyCombo[][]) {
  const result = bindings
    .filter((seq) => seq.length === 1)
    .flatMap((seq) => textareaSubmitKeyBinding(seq[0]!));

  return dedupeTextareaKeyBindings(result);
}

function textareaSubmitKeyBinding(combo: KeyCombo) {
  const key = combo.key.toLowerCase();
  const bindings = [
    {
      name: key,
      ctrl: !!combo.ctrl,
      shift: !!combo.shift,
      meta: !!combo.meta,
      action: "submit" as const,
    },
  ];

  if (key === "enter" || key === "return") {
    bindings.push(
      {
        name: key === "enter" ? "return" : "enter",
        ctrl: !!combo.ctrl,
        shift: !!combo.shift,
        meta: !!combo.meta,
        action: "submit" as const,
      },
      {
        name: "linefeed",
        ctrl: false,
        shift: !!combo.shift,
        meta: !!combo.meta,
        action: "submit" as const,
      },
    );
  }

  if (combo.ctrl && key === "j") {
    bindings.push({
      name: "linefeed",
      ctrl: false,
      shift: !!combo.shift,
      meta: !!combo.meta,
      action: "submit" as const,
    });
  }

  return bindings;
}

function dedupeTextareaKeyBindings(bindings: ReturnType<typeof textareaSubmitKeyBinding>) {
  const seen = new Set<string>();
  return bindings.filter((binding) => {
    const key = `${binding.name}:${!!binding.ctrl}:${!!binding.shift}:${!!binding.meta}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
