import * as React from "react";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useAtomValue } from "jotai/react";
import { appStore } from "@/atoms/store";
import { keybindContextAtom } from "@/atoms/ui";
import { resolvedThemeAtom } from "@/atoms/derived";
import { rgbaToHex } from "@/lib/themes";
import { DialogOverlay } from "@/components/ui/dialog-overlay";
import { useKeybind } from "@/providers/keybind";

export interface DialogOptions {
  onClose?: () => void;
  transparent?: boolean;
  keybindContext?: string;
}

export interface DialogEntry {
  element: React.ReactNode;
  onClose?: () => void;
  transparent?: boolean;
  keybindContext: string;
}

export interface DialogContextValue {
  replace(element: React.ReactNode, opts?: DialogOptions): void;
  clear(): void;
  stack: DialogEntry[];
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = React.useState<DialogEntry[]>([]);
  const renderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const { theme } = useAtomValue(resolvedThemeAtom);
  const keybind = useKeybind();
  const savedFocusRef = React.useRef<{
    focus?(): void;
    blur?(): void;
    isDestroyed?: boolean;
  } | null>(null);
  const focusTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => () => clearTimeout(focusTimerRef.current), []);

  const clear = React.useCallback(() => {
    setStack((prev) => {
      for (const entry of prev) {
        entry.onClose?.();
      }
      return [];
    });
    appStore.set(keybindContextAtom, "diff");
    const saved = savedFocusRef.current;
    if (saved && !saved.isDestroyed) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(() => saved.focus?.(), 1);
    }
    savedFocusRef.current = null;
  }, []);

  const replace = React.useCallback(
    (element: React.ReactNode, opts?: DialogOptions) => {
      const current = renderer.currentFocusedRenderable;
      if (current) {
        savedFocusRef.current = current;
        current.blur?.();
      }
      const keybindContext = opts?.keybindContext ?? "select";
      appStore.set(keybindContextAtom, keybindContext);
      setStack([
        { element, onClose: opts?.onClose, transparent: opts?.transparent, keybindContext },
      ]);
    },
    [renderer],
  );

  useKeyboard((key) => {
    if (stack.length === 0) return;
    if (keybind.matchInContext("select", "cancel", key)) {
      key.stopPropagation?.();
      clear();
    }
  });

  const value = React.useMemo<DialogContextValue>(
    () => ({ replace, clear, stack }),
    [replace, clear, stack],
  );

  const panelBg = rgbaToHex(theme.backgroundPanel);
  const topEntry = stack[stack.length - 1];

  return (
    <DialogContext.Provider value={value}>
      {children}
      {topEntry && (
        <DialogOverlay
          entry={topEntry}
          width={width}
          height={height}
          panelBg={panelBg}
          onDismiss={clear}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
