import * as React from "react";
import type { ParsedKey } from "@opentui/core";
import { DEFAULT_KEYBINDS } from "@/lib/config";

export interface KeyCombo {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  leader?: boolean;
}

function parseCombo(str: string): KeyCombo {
  const parts = str.toLowerCase().split("+");
  const combo: KeyCombo = { key: parts[parts.length - 1]! };
  for (let i = 0; i < parts.length - 1; i++) {
    const mod = parts[i]!;
    if (mod === "ctrl") combo.ctrl = true;
    else if (mod === "shift") combo.shift = true;
    else if (mod === "meta" || mod === "alt") combo.meta = true;
  }
  return combo;
}

export function parseKeybindString(str: string): KeyCombo[][] {
  return str
    .split(",")
    .map((binding) => binding.trim())
    .filter(Boolean)
    .map((binding) => binding.split(/\s+/).map(parseCombo));
}

function comboSignature(combo: KeyCombo): string {
  return `${combo.ctrl ? "ctrl+" : ""}${combo.meta ? "meta+" : ""}${
    combo.shift ? "shift+" : ""
  }${combo.key.toLowerCase()}`;
}

function eventSignature(evt: ParsedKey): string {
  return `${evt.ctrl ? "ctrl+" : ""}${evt.option || evt.meta ? "meta+" : ""}${
    evt.shift ? "shift+" : ""
  }${(evt.name || "").toLowerCase()}`;
}

export function comboMatchesEvent(combo: KeyCombo, evt: ParsedKey): boolean {
  const evtName = (evt.name || "").toLowerCase();
  const comboKey = combo.key.toLowerCase();
  const comboWantsShift = !!combo.shift;
  const eventHasShift = !!evt.shift;

  if (combo.shift && comboKey.length === 1) {
    if (evtName !== comboKey) return false;
  } else {
    if (evtName !== comboKey) return false;
  }

  if (!!combo.ctrl !== !!evt.ctrl) return false;
  if (comboWantsShift !== eventHasShift) return false;
  if (!!combo.meta !== !!(evt.option || evt.meta)) return false;

  return true;
}

export interface KeybindContextValue {
  bindings(actionId: string): KeyCombo[][];
  list(): Array<{ action: string; context: string; name: string; raw: string; first: string }>;
  match(actionId: string, evt: ParsedKey): boolean;
  matchInContext(context: string, action: string, evt: ParsedKey): boolean;
  matchesAnyInContext(context: string, evt: ParsedKey): boolean;
  print(actionId: string): string;
  printInContext(context: string, action: string): string;
}

const SEQUENCE_TIMEOUT = 500;

const KeybindContext = React.createContext<KeybindContextValue | null>(null);

export function createKeybindResolver(rawBindings: Record<string, string>): KeybindContextValue {
  const parsed: Record<string, KeyCombo[][]> = {};
  for (const [action, str] of Object.entries(rawBindings)) {
    parsed[action] = parseKeybindString(str);
  }
  const sequencePrefixesByContext = new Map<string, Set<string>>();
  for (const [actionId, sequences] of Object.entries(parsed)) {
    const context = actionContext(actionId);
    let prefixes = sequencePrefixesByContext.get(context);
    if (!prefixes) {
      prefixes = new Set();
      sequencePrefixesByContext.set(context, prefixes);
    }
    for (const seq of sequences) {
      if (seq.length > 1) prefixes.add(comboSignature(seq[0]!));
    }
  }

  let pending: { context: string; keys: string[]; time: number } | null = null;

  function matchAction(actionId: string, evt: ParsedKey): boolean {
    const sequences = parsed[actionId];
    if (!sequences) return false;
    const context = actionContext(actionId);
    const prefixes = sequencePrefixesByContext.get(context) ?? new Set<string>();
    const now = Date.now();
    const event = eventSignature(evt);
    const activePending =
      pending && pending.context === context && now - pending.time < SEQUENCE_TIMEOUT
        ? pending
        : null;

    for (const seq of sequences) {
      if (seq.length === 1 && comboMatchesEvent(seq[0]!, evt)) {
        if (prefixes.has(event)) {
          pending = { context, keys: [event], time: now };
          return false;
        }
        pending = null;
        return true;
      }

      if (seq.length > 1) {
        const signatures = seq.map(comboSignature);
        const candidate = activePending ? [...activePending.keys, event] : [event];

        if (
          signatures.length === candidate.length &&
          signatures.every((key, i) => key === candidate[i])
        ) {
          pending = null;
          return true;
        }

        if (
          candidate.length < signatures.length &&
          candidate.every((key, i) => key === signatures[i])
        ) {
          pending = { context, keys: candidate, time: now };
        } else if (comboMatchesEvent(seq[0]!, evt)) {
          pending = { context, keys: [signatures[0]!], time: now };
        }
      }
    }

    return false;
  }

  function printAction(actionId: string): string {
    const raw = rawBindings[actionId];
    if (!raw) return "";
    const firstBinding = raw.split(",")[0]?.trim() || "";
    return firstBinding.split(/\s+/).filter(Boolean).map(formatKeybindToken).join(" ");
  }

  return {
    bindings(actionId: string): KeyCombo[][] {
      return parsed[actionId] ?? [];
    },
    list(): Array<{ action: string; context: string; name: string; raw: string; first: string }> {
      return Object.entries(rawBindings)
        .map(([action, raw]) => ({
          action,
          context: actionContext(action),
          name: actionName(action),
          raw,
          first: printAction(action),
        }))
        .filter((binding) => binding.raw.trim().length > 0 && binding.first.length > 0);
    },
    match(actionId: string, evt: ParsedKey): boolean {
      return matchAction(actionId, evt);
    },
    matchInContext(context: string, action: string, evt: ParsedKey): boolean {
      return matchAction(`${context}.${action}`, evt);
    },
    matchesAnyInContext(context: string, evt: ParsedKey): boolean {
      return Object.entries(parsed).some(
        ([actionId, sequences]) =>
          actionContext(actionId) === context &&
          sequences.some((seq) => seq.length === 1 && comboMatchesEvent(seq[0]!, evt)),
      );
    },
    print(actionId: string): string {
      return printAction(actionId);
    },
    printInContext(context: string, action: string): string {
      return printAction(`${context}.${action}`);
    },
  };
}

function actionContext(actionId: string): string {
  return actionId.split(".", 1)[0] || "";
}

function actionName(actionId: string): string {
  const dot = actionId.indexOf(".");
  return dot >= 0 ? actionId.slice(dot + 1) : actionId;
}

function formatKeybindToken(token: string): string {
  return token
    .replace("ctrl+", "^")
    .replace("shift+", "⇧")
    .replace("alt+", "⌥")
    .replace(/\bescape\b/g, "esc");
}

export function KeybindProvider({
  overrides,
  children,
}: {
  overrides?: Record<string, string>;
  children: React.ReactNode;
}) {
  const bindings = React.useMemo(() => {
    return createKeybindResolver({ ...DEFAULT_KEYBINDS, ...overrides });
  }, [overrides]);

  return <KeybindContext.Provider value={bindings}>{children}</KeybindContext.Provider>;
}

export function useKeybind(): KeybindContextValue {
  const ctx = React.useContext(KeybindContext);
  if (!ctx) throw new Error("useKeybind must be used within KeybindProvider");
  return ctx;
}

export function useOptionalKeybind(): KeybindContextValue | null {
  return React.useContext(KeybindContext);
}
