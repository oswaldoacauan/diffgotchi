import * as React from "react";
import { useKeyboard } from "@opentui/react";
import { useAtomValue } from "jotai/react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { appStore } from "@/atoms/store";
import { parsedFilesAtom } from "@/atoms/core";
import { showHunksAtom } from "@/atoms/display";
import { currentFileIndexAtom } from "@/atoms/derived";
import { forceExpandCurrentAtom, navigateFileAtom } from "@/atoms/actions";
import { useKeybind } from "@/providers/keybind";
import { useDialog } from "@/providers/dialog";
import type { ScrollAcceleration } from "@/util/scroll-acceleration";

export interface UseAppKeyboardRefs {
  scrollboxRef: React.RefObject<ScrollBoxRenderable | null>;
  currentHunkIndex: number;
  setCurrentHunkIndex: (n: number) => void;
  scrollToHunk: (scrollbox: ScrollBoxRenderable, idx: number) => void;
  scrollAcceleration: ScrollAcceleration;
  commentComposerOpen?: boolean;
}

export function navigateHunk(
  scrollbox: ScrollBoxRenderable | null,
  hunkCount: number,
  currentHunkIndex: number,
  setCurrentHunkIndex: (n: number) => void,
  scrollToHunk: (scrollbox: ScrollBoxRenderable, idx: number) => void,
  direction: 1 | -1,
) {
  if (!scrollbox || hunkCount === 0) return;
  const next =
    direction === 1
      ? Math.min(currentHunkIndex + 1, hunkCount - 1)
      : Math.max(currentHunkIndex - 1, 0);
  setCurrentHunkIndex(next);
  scrollToHunk(scrollbox, next);
}

export function useAppKeyboard(refs: UseAppKeyboardRefs) {
  const { scrollboxRef, scrollAcceleration } = refs;
  const keybind = useKeybind();
  const dialog = useDialog();
  const currentFileIndex = useAtomValue(currentFileIndexAtom);

  const refsRef = React.useRef(refs);
  refsRef.current = refs;

  useKeyboard((key) => {
    if (dialog.stack.length > 0) return;
    if (refsRef.current.commentComposerOpen) return;

    if (keybind.matchInContext("diff", "force_expand", key)) {
      appStore.set(forceExpandCurrentAtom);
      return;
    }
    if (keybind.matchInContext("diff", "next_file", key)) {
      appStore.set(navigateFileAtom, 1);
      return;
    }
    if (keybind.matchInContext("diff", "prev_file", key)) {
      appStore.set(navigateFileAtom, -1);
      return;
    }
  });

  useKeyboard((key) => {
    if (dialog.stack.length > 0) return;
    if (refsRef.current.commentComposerOpen) return;
    const scrollbox = scrollboxRef.current;
    if (!scrollbox) return;

    if (keybind.matchInContext("diff", "scroll_down", key)) {
      scrollbox.scrollBy(1);
      return;
    }
    if (keybind.matchInContext("diff", "scroll_up", key)) {
      scrollbox.scrollBy(-1);
      return;
    }
    if (keybind.matchInContext("diff", "scroll_top", key)) {
      scrollbox.scrollTo(0);
      return;
    }
    if (keybind.matchInContext("diff", "scroll_bottom", key)) {
      scrollbox.scrollBy(1, "content");
      return;
    }
    if (keybind.matchInContext("diff", "scroll_half_down", key)) {
      scrollbox.scrollBy(0.5, "viewport");
      return;
    }
    if (keybind.matchInContext("diff", "scroll_half_up", key)) {
      scrollbox.scrollBy(-0.5, "viewport");
      return;
    }
  });

  useKeyboard((key) => {
    if (dialog.stack.length > 0) return;
    if (refsRef.current.commentComposerOpen) return;
    if (!appStore.get(showHunksAtom)) return;
    const scrollbox = scrollboxRef.current;
    if (!scrollbox) return;
    const r = refsRef.current;
    const parsedFiles = appStore.get(parsedFilesAtom);
    const f = parsedFiles[currentFileIndex];
    const hunkCount = f?.hunkInfos?.length ?? 0;

    if (keybind.matchInContext("diff", "next_hunk", key)) {
      navigateHunk(
        scrollbox,
        hunkCount,
        r.currentHunkIndex,
        r.setCurrentHunkIndex,
        r.scrollToHunk,
        1,
      );
      return;
    }
    if (keybind.matchInContext("diff", "prev_hunk", key)) {
      navigateHunk(
        scrollbox,
        hunkCount,
        r.currentHunkIndex,
        r.setCurrentHunkIndex,
        r.scrollToHunk,
        -1,
      );
      return;
    }
  });

  useKeyboard((key) => {
    if (key.option) {
      scrollAcceleration.multiplier = key.eventType === "release" ? 1 : 10;
    }
  });
}
