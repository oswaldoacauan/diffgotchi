import * as React from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { appStore } from "@/atoms/store";
import { parsedFilesAtom } from "@/atoms/core";
import { currentFileIndexAtom } from "@/atoms/derived";
import {
  deleteReviewCommentAtom,
  reviewCommentsAtom,
  reviewOpenCommentCountAtom,
  setReviewCommentStatusAtom,
} from "@/atoms/review";
import { themeNameAtom } from "@/atoms/ui";
import {
  viewModeAtom,
  showLineNumbersAtom,
  wrapModeAtom,
  highlightInlineAtom,
  backgroundsAtom,
  indicatorsAtom,
  showHunksAtom,
  contextLinesAtom,
} from "@/atoms/display";
import { selectFileFromPickerAtom, toggleDoneCurrentAtom } from "@/atoms/actions";
import { useDialog } from "@/providers/dialog";
import { useCommand } from "@/providers/command";
import { useKeybind } from "@/providers/keybind";
import { useToast } from "@/providers/toast";
import { getFileName } from "@/lib/git/parse";
import { loadConfig, saveConfig, CONFIG_PATH } from "@/lib/config";
import { openInEditor } from "@/util/editor";
import { FilePickerDialog } from "@/components/dialogs/file-picker";
import { ThemePickerDialog } from "@/components/dialogs/theme-picker";
import { AboutDialog } from "@/components/dialogs/about";
import { KeybindsDialog } from "@/components/dialogs/keybinds";
import { CommentsDialog } from "@/components/dialogs/review-comments";

export interface UseAppCommandsRefs {
  scrollboxRef: React.RefObject<ScrollBoxRenderable | null>;
  currentHunkIndex: number;
  setCurrentHunkIndex: (n: number) => void;
  scrollToHunk: (scrollbox: ScrollBoxRenderable, idx: number) => void;
  startInlineComment: () => void;
  commentComposerOpen: boolean;
  commentUiOpen: boolean;
}

export function useAppCommands(refs: UseAppCommandsRefs) {
  const dialog = useDialog();
  const command = useCommand();
  const keybind = useKeybind();
  const toast = useToast();
  const renderer = useRenderer();

  const refsRef = React.useRef(refs);
  refsRef.current = refs;

  const openFilePicker = React.useCallback(() => {
    const idx = appStore.get(currentFileIndexAtom);
    dialog.replace(
      <FilePickerDialog
        currentIndex={idx}
        onSelect={(i) => {
          appStore.set(selectFileFromPickerAtom, i);
          dialog.clear();
        }}
        onClose={() => dialog.clear()}
      />,
      { keybindContext: "file_picker" },
    );
  }, [dialog]);

  const openEditor = React.useCallback(() => {
    const idx = appStore.get(currentFileIndexAtom);
    const parsedFiles = appStore.get(parsedFilesAtom);
    const f = parsedFiles[idx];
    if (!f) return;
    const config = loadConfig();
    const result = openInEditor(getFileName(f), config.general.editor || undefined);
    if (!result.success && result.error) {
      toast.show(result.error, "error");
    }
  }, [toast]);

  const openCommentsDialog = React.useCallback(() => {
    const comments = appStore.get(reviewCommentsAtom);
    dialog.replace(
      <CommentsDialog
        comments={comments}
        onClose={() => dialog.clear()}
        onSelect={(comment) => {
          const parsedFiles = appStore.get(parsedFilesAtom);
          const idx = parsedFiles.findIndex((f) => getFileName(f) === comment.file);
          if (idx >= 0) {
            appStore.set(selectFileFromPickerAtom, idx);
            if (typeof comment.hunkIndex === "number") {
              refsRef.current.setCurrentHunkIndex(comment.hunkIndex);
              setTimeout(() => {
                const scrollbox = refsRef.current.scrollboxRef.current;
                if (scrollbox) refsRef.current.scrollToHunk(scrollbox, comment.hunkIndex!);
              }, 1);
            }
          }
          dialog.clear();
        }}
        onResolve={(comment) => {
          const nextStatus = comment.status === "open" ? "resolved" : "open";
          appStore.set(setReviewCommentStatusAtom, {
            commentId: comment.id,
            status: nextStatus,
          });
          dialog.clear();
        }}
        onDelete={(comment) => {
          appStore.set(deleteReviewCommentAtom, comment.id);
          dialog.clear();
        }}
      />,
      { keybindContext: "comments_list" },
    );
  }, [dialog, toast]);

  const openThemePicker = React.useCallback(() => {
    const originalTheme = appStore.get(themeNameAtom);
    let committed = false;
    dialog.replace(
      <ThemePickerDialog
        currentTheme={originalTheme}
        onPreview={(name) => appStore.set(themeNameAtom, name)}
        onSelect={(name) => {
          committed = true;
          appStore.set(themeNameAtom, name);
          const config = loadConfig();
          saveConfig({ ...config, general: { ...config.general, theme: name } });
          dialog.clear();
        }}
        onClose={() => dialog.clear()}
      />,
      {
        transparent: true,
        onClose: () => {
          if (!committed) appStore.set(themeNameAtom, originalTheme);
        },
      },
    );
  }, [dialog]);

  const openConfigFile = React.useCallback(() => {
    const config = loadConfig();
    const result = openInEditor(CONFIG_PATH, config.general.editor || undefined);
    if (!result.success && result.error) {
      toast.show(result.error, "error");
    }
  }, [toast]);

  const toggleMouse = React.useCallback(() => {
    const config = loadConfig();
    const next = !config.general.mouse;
    saveConfig({ ...config, general: { ...config.general, mouse: next } });
    toast.show(`Mouse ${next ? "on" : "off"}. Restart.`, "info");
  }, [toast]);

  useKeyboard((key) => {
    if (dialog.stack.length > 0) return;
    if (refsRef.current.commentComposerOpen) return;

    if (keybind.matchInContext("diff", "add_comment", key)) {
      refsRef.current.startInlineComment();
      return;
    }

    if (keybind.matchInContext("diff", "list_comments", key)) {
      openCommentsDialog();
      return;
    }
  });

  React.useEffect(() => {
    function boolOpts(on: boolean) {
      return [
        { label: "on", active: on },
        { label: "off", active: !on },
      ];
    }

    const unreg = command.register(() => {
      const viewMode = appStore.get(viewModeAtom);
      const showLineNumbers = appStore.get(showLineNumbersAtom);
      const wrapMode = appStore.get(wrapModeAtom);
      const highlightInline = appStore.get(highlightInlineAtom);
      const backgrounds = appStore.get(backgroundsAtom);
      const indicators = appStore.get(indicatorsAtom);
      const showHunks = appStore.get(showHunksAtom);
      const contextLines = appStore.get(contextLinesAtom);
      return [
        {
          title: "Edit file",
          description:
            "open in " +
            (
              loadConfig().general.editor ||
              process.env["VISUAL"] ||
              process.env["EDITOR"] ||
              "vi"
            ).split(/\s+/)[0],
          value: "file.edit",
          keybind: "diff.edit_file",
          category: "Actions",
          onSelect: () => openEditor(),
        },
        {
          title: "Mark done",
          value: "review.done",
          keybind: "diff.mark_done",
          category: "Actions",
          onSelect: () => appStore.set(toggleDoneCurrentAtom),
        },
        {
          title: "Add comment",
          value: "review.comment",
          keybind: "diff.add_comment",
          category: "Actions",
          onSelect: () => refsRef.current.startInlineComment(),
        },
        {
          title: "Review comments",
          description: `${appStore.get(reviewOpenCommentCountAtom)} open`,
          value: "review.comments",
          keybind: "diff.list_comments",
          category: "Actions",
          onSelect: () => openCommentsDialog(),
        },
        {
          title: "Theme",
          value: "theme.switch",
          keybind: "diff.pick_theme",
          category: "Actions",
          onSelect: () => openThemePicker(),
        },
        {
          title: "Layout",
          value: "display.viewMode",
          keybind: "diff.display_view",
          category: "Settings",
          options: [
            { label: "auto", active: viewMode === "auto" },
            { label: "split", active: viewMode === "split" },
            { label: "unified", active: viewMode === "unified" },
          ],
          onSelect: () => appStore.set(viewModeAtom),
        },
        {
          title: "Line numbers",
          value: "display.lineNumbers",
          keybind: "diff.display_line_numbers",
          category: "Settings",
          options: boolOpts(showLineNumbers),
          onSelect: () => appStore.set(showLineNumbersAtom),
        },
        {
          title: "Wrap",
          value: "display.wrapMode",
          keybind: "diff.display_wrap",
          category: "Settings",
          options: [
            { label: "word", active: wrapMode === "word" },
            { label: "char", active: wrapMode === "char" },
            { label: "none", active: wrapMode === "none" },
          ],
          onSelect: () => appStore.set(wrapModeAtom),
        },
        {
          title: "Inline highlights",
          value: "display.highlightInline",
          keybind: "diff.display_inline_highlights",
          category: "Settings",
          options: boolOpts(highlightInline),
          onSelect: () => appStore.set(highlightInlineAtom),
        },
        {
          title: "Backgrounds",
          value: "display.backgrounds",
          keybind: "diff.display_backgrounds",
          category: "Settings",
          options: boolOpts(backgrounds),
          onSelect: () => appStore.set(backgroundsAtom),
        },
        {
          title: "Indicators",
          value: "display.indicators",
          keybind: "diff.display_indicators",
          category: "Settings",
          options: [
            { label: "on", active: indicators === "classic" },
            { label: "off", active: indicators === "none" },
          ],
          onSelect: () => appStore.set(indicatorsAtom),
        },
        {
          title: "Hunk headers",
          value: "display.hunks",
          keybind: "diff.display_hunk_headers",
          category: "Settings",
          options: boolOpts(showHunks),
          onSelect: () => appStore.set(showHunksAtom),
        },
        {
          title: "Context lines",
          value: "display.contextLines",
          keybind: "diff.context_lines",
          category: "Settings",
          options: [3, 6, 10, 20, 0].map((n) => ({
            label: String(n),
            active: contextLines === n,
          })),
          onSelect: () => appStore.set(contextLinesAtom),
        },
        {
          title: "Mouse",
          value: "config.mouse",
          keybind: "diff.toggle_mouse",
          category: "Settings",
          options: boolOpts(loadConfig().general.mouse),
          onSelect: () => toggleMouse(),
        },
        {
          title: "Open config",
          description: CONFIG_PATH.replace(/.*\/\.config\//, "~/.config/"),
          value: "config.open",
          keybind: "global.open_config",
          category: "Settings",
          onSelect: () => openConfigFile(),
        },
        {
          title: "Documentation",
          description: "open in browser",
          value: "help.docs",
          keybind: "global.help_docs",
          category: "Help",
          onSelect: () => {
            try {
              const { execSync } = require("child_process");
              const cmd = process.platform === "darwin" ? "open" : "xdg-open";
              execSync(`${cmd} https://github.com/oswaldoacauan/diffgotchi`, { stdio: "ignore" });
            } catch {
              toast.show("Browser open failed", "error");
            }
          },
        },
        {
          title: "Keybinds",
          value: "help.keys",
          keybind: "global.help_keybinds",
          category: "Help",
          onSelect: () => {
            dialog.replace(<KeybindsDialog onClose={() => dialog.clear()} />);
          },
        },
        {
          title: "About",
          value: "help.about",
          keybind: "global.help_about",
          category: "Help",
          onSelect: () => dialog.replace(<AboutDialog onClose={() => dialog.clear()} />),
        },
        {
          title: "Quit",
          value: "app.quit",
          keybind: "global.quit",
          category: "Help",
          onSelect: () => renderer.destroy(),
        },
        {
          title: "Select file",
          value: "file.pick",
          keybind: "diff.pick_file",
          hidden: true,
          onSelect: () => openFilePicker(),
        },
      ];
    });
    return unreg;
  }, [
    openFilePicker,
    openEditor,
    openCommentsDialog,
    openThemePicker,
    openConfigFile,
    toggleMouse,
    command,
    keybind,
    renderer,
    dialog,
    toast,
  ]);
}
