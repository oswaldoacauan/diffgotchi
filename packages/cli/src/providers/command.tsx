import * as React from "react";
import type { ParsedKey } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useKeybind, type KeybindContextValue } from "./keybind";
import { useDialog, type DialogContextValue } from "./dialog";
import { appStore } from "@/atoms/store";
import { keybindContextAtom } from "@/atoms/ui";
import { CommandPalette } from "@/components/dialogs/commands";

export interface CommandOption {
  title: string;
  value: string;
  description?: string;
  options?: Array<{ label: string; active?: boolean }>;
  keybind?: string;
  category?: string;
  suggested?: boolean;
  hidden?: boolean;
  onSelect: (dialog: DialogContextValue) => void;
}

export interface CommandContextValue {
  register(cb: () => CommandOption[]): () => void;
  trigger(value: string): void;
  show(): void;
}

const CommandContext = React.createContext<CommandContextValue | null>(null);

export function shouldDeferGlobalShortcut({
  dialogOpen,
  activeContext,
  keybind,
  key,
}: {
  dialogOpen: boolean;
  activeContext: string;
  keybind: KeybindContextValue;
  key: ParsedKey;
}): boolean {
  return (
    dialogOpen &&
    (keybind.matchesAnyInContext(activeContext, key) || keybind.matchesAnyInContext("select", key))
  );
}

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const callbacksRef = React.useRef<Array<() => CommandOption[]>>([]);
  const dialog = useDialog();
  const keybind = useKeybind();

  const getAllCommands = React.useCallback(() => {
    const all: CommandOption[] = [];
    for (const cb of callbacksRef.current) {
      all.push(...cb());
    }
    return all;
  }, []);

  const show = React.useCallback(() => {
    const commands = getAllCommands();
    dialog.replace(<CommandPalette commands={commands} dialog={dialog} />, {
      keybindContext: "select",
    });
  }, [getAllCommands, dialog]);

  const trigger = React.useCallback(
    (value: string) => {
      const commands = getAllCommands();
      const cmd = commands.find((c) => c.value === value);
      cmd?.onSelect(dialog);
    },
    [getAllCommands, dialog],
  );

  const register = React.useCallback((cb: () => CommandOption[]) => {
    callbacksRef.current.push(cb);
    return () => {
      callbacksRef.current = callbacksRef.current.filter((c) => c !== cb);
    };
  }, []);

  useKeyboard((key) => {
    const activeContext = appStore.get(keybindContextAtom);

    if (
      shouldDeferGlobalShortcut({
        dialogOpen: dialog.stack.length > 0,
        activeContext,
        keybind,
        key,
      })
    ) {
      return;
    }

    if (keybind.matchInContext("global", "command_palette", key)) {
      show();
      return;
    }

    const commands = getAllCommands();
    for (const cmd of commands) {
      if (cmd.keybind?.startsWith("global.") && keybind.match(cmd.keybind, key)) {
        cmd.onSelect(dialog);
        return;
      }
    }

    if (dialog.stack.length > 0) return;
    if (activeContext !== "diff") return;

    for (const cmd of commands) {
      if (cmd.keybind && !cmd.keybind.startsWith("global.") && keybind.match(cmd.keybind, key)) {
        cmd.onSelect(dialog);
        return;
      }
    }
  });

  const value = React.useMemo<CommandContextValue>(
    () => ({ register, trigger, show }),
    [register, trigger, show],
  );

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

export function useCommand(): CommandContextValue {
  const ctx = React.useContext(CommandContext);
  if (!ctx) throw new Error("useCommand must be used within CommandProvider");
  return ctx;
}
