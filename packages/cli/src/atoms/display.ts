import { atom, type WritableAtom } from "jotai";
import { loadConfig, saveConfig, type DiffgotchiConfig } from "@/lib/config";
import type { appStore as AppStore } from "./store";

export type ViewMode = "split" | "unified" | "auto";
export type WrapMode = "word" | "char" | "none";
export type Indicators = "classic" | "none";

type PersistedToggleAtom = WritableAtom<boolean, [boolean?], void>;
type PersistedCycleAtom<T> = WritableAtom<T, [T?], void>;
type DisplayConfigKey = keyof DiffgotchiConfig["display"] | "context_lines";

function saveDisplayValue<T>(configKey: DisplayConfigKey, next: T) {
  const config = loadConfig();
  if (configKey === "context_lines") {
    saveConfig({ ...config, diff: { ...config.diff, context_lines: next as number } });
    return;
  }
  saveConfig({ ...config, display: { ...config.display, [configKey]: next } });
}

function persistedToggleAtom(initial: boolean, configKey: DisplayConfigKey): PersistedToggleAtom {
  const base = atom(initial);
  return atom(
    (get) => get(base),
    (get, set, nextValue?: boolean) => {
      if (nextValue !== undefined) {
        set(base, nextValue);
        return;
      }
      const next = !get(base);
      set(base, next);
      saveDisplayValue(configKey, next);
    },
  );
}

function persistedCycleAtom<T>(
  initial: T,
  order: T[],
  configKey: DisplayConfigKey,
): PersistedCycleAtom<T> {
  const base = atom(initial);
  return atom(
    (get) => get(base),
    (get, set, nextValue?: T) => {
      if (nextValue !== undefined) {
        set(base, nextValue);
        return;
      }
      const next = order[(order.indexOf(get(base)) + 1) % order.length]!;
      set(base, next);
      saveDisplayValue(configKey, next);
    },
  );
}

export const showLineNumbersAtom = persistedToggleAtom(true, "line_numbers");
export const highlightInlineAtom = persistedToggleAtom(true, "inline_highlights");
export const backgroundsAtom = persistedToggleAtom(true, "backgrounds");
export const showHunksAtom = persistedToggleAtom(true, "hunk_headers");

export const viewModeAtom = persistedCycleAtom<ViewMode>(
  "auto",
  ["auto", "split", "unified"],
  "view",
);
export const wrapModeAtom = persistedCycleAtom<WrapMode>("word", ["word", "char", "none"], "wrap");
export const indicatorsAtom = persistedCycleAtom<Indicators>(
  "classic",
  ["classic", "none"],
  "indicators",
);
export const contextLinesAtom = persistedCycleAtom(6, [3, 6, 10, 20, 0], "context_lines");

export function initDisplay(store: typeof AppStore, config: DiffgotchiConfig) {
  store.set(viewModeAtom, config.display.view);
  store.set(showLineNumbersAtom, config.display.line_numbers);
  store.set(wrapModeAtom, config.display.wrap);
  store.set(highlightInlineAtom, config.display.inline_highlights);
  store.set(backgroundsAtom, config.display.backgrounds);
  store.set(indicatorsAtom, config.display.indicators);
  store.set(showHunksAtom, config.display.hunk_headers);
  store.set(contextLinesAtom, config.diff.context_lines);
}
