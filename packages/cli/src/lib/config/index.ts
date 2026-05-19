import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import {
  CONFIG_SCHEMA_URL,
  DEFAULT_CONFIG,
  DEFAULT_KEYBINDS,
  type DiffConfig,
  type DiffgotchiConfig,
  type DisplayConfig,
  type GeneralConfig,
  type KeybindsConfig,
  type StorageConfig,
  type UpgradeConfig,
} from "./definition";

export {
  CONFIG_SCHEMA_URL,
  DEFAULT_CONFIG,
  DEFAULT_KEYBINDS,
  type DiffgotchiConfig,
  type DisplayConfig,
  type GeneralConfig,
  type DiffConfig,
  type UpgradeConfig,
  type StorageConfig,
  type KeybindsConfig,
};

export const CONFIG_PATH = join(homedir(), ".config", "diffgotchi", "config.json");

export function loadConfig(): DiffgotchiConfig {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_PATH, "utf-8");
  } catch {
    return cloneDefaultConfig();
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeConfig(parsed);
  } catch {
    return cloneDefaultConfig();
  }
}

export function saveConfig(config: DiffgotchiConfig): void {
  const dir = dirname(CONFIG_PATH);
  mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, createConfigFileContent(config), "utf-8");
}

export function createConfigFileContent(config: DiffgotchiConfig): string {
  const output = {
    $schema: CONFIG_SCHEMA_URL,
    ...normalizeConfig(config as unknown as Record<string, unknown>),
  };
  return JSON.stringify(output, null, 2) + "\n";
}

export function normalizeConfig(parsed: Record<string, unknown>): DiffgotchiConfig {
  const d = DEFAULT_CONFIG;
  const general = isRecord(parsed.general) ? parsed.general : {};
  const display = isRecord(parsed.display) ? parsed.display : {};
  const diff = isRecord(parsed.diff) ? parsed.diff : {};
  const upgrade = isRecord(parsed.upgrade) ? parsed.upgrade : {};
  const storage = isRecord(parsed.storage) ? parsed.storage : {};

  return {
    general: {
      theme: typeof general.theme === "string" ? general.theme : d.general.theme,
      editor: typeof general.editor === "string" ? general.editor : d.general.editor,
      mouse: typeof general.mouse === "boolean" ? general.mouse : d.general.mouse,
    },
    display: {
      view:
        display.view === "split" || display.view === "unified" || display.view === "auto"
          ? display.view
          : d.display.view,
      line_numbers:
        typeof display.line_numbers === "boolean" ? display.line_numbers : d.display.line_numbers,
      wrap:
        display.wrap === "word" || display.wrap === "char" || display.wrap === "none"
          ? display.wrap
          : d.display.wrap,
      inline_highlights:
        typeof display.inline_highlights === "boolean"
          ? display.inline_highlights
          : d.display.inline_highlights,
      backgrounds:
        typeof display.backgrounds === "boolean" ? display.backgrounds : d.display.backgrounds,
      indicators:
        display.indicators === "classic" || display.indicators === "none"
          ? display.indicators
          : d.display.indicators,
      hunk_headers:
        typeof display.hunk_headers === "boolean" ? display.hunk_headers : d.display.hunk_headers,
    },
    diff: {
      context_lines: isPositiveInt(diff.context_lines) ? diff.context_lines : d.diff.context_lines,
      refresh_debounce_ms: isPositiveInt(diff.refresh_debounce_ms)
        ? diff.refresh_debounce_ms
        : d.diff.refresh_debounce_ms,
      max_bytes: isPositiveInt(diff.max_bytes) ? diff.max_bytes : d.diff.max_bytes,
      max_file_lines: isPositiveInt(diff.max_file_lines)
        ? diff.max_file_lines
        : d.diff.max_file_lines,
      filetypes: isStringRecord(diff.filetypes) ? diff.filetypes : { ...d.diff.filetypes },
      ignored_files: isStringArray(diff.ignored_files)
        ? diff.ignored_files
        : [...d.diff.ignored_files],
    },
    upgrade: {
      auto: typeof upgrade.auto === "boolean" ? upgrade.auto : d.upgrade.auto,
      channel:
        upgrade.channel === "stable" || upgrade.channel === "canary"
          ? upgrade.channel
          : d.upgrade.channel,
    },
    storage: {
      cleanup_stale_days: isPositiveInt(storage.cleanup_stale_days)
        ? storage.cleanup_stale_days
        : d.storage.cleanup_stale_days,
    },
    keybinds: isStringRecord(parsed.keybinds)
      ? { ...DEFAULT_KEYBINDS, ...dotKeybinds(parsed.keybinds) }
      : { ...DEFAULT_KEYBINDS },
  };
}

function cloneDefaultConfig(): DiffgotchiConfig {
  return {
    general: { ...DEFAULT_CONFIG.general },
    display: { ...DEFAULT_CONFIG.display },
    diff: {
      ...DEFAULT_CONFIG.diff,
      filetypes: { ...DEFAULT_CONFIG.diff.filetypes },
      ignored_files: [...DEFAULT_CONFIG.diff.ignored_files],
    },
    upgrade: { ...DEFAULT_CONFIG.upgrade },
    storage: { ...DEFAULT_CONFIG.storage },
    keybinds: { ...DEFAULT_CONFIG.keybinds },
  };
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringRecord(v: unknown): v is Record<string, string> {
  if (!isRecord(v)) return false;
  return Object.values(v).every((val) => typeof val === "string");
}

function dotKeybinds(v: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(v).filter(([key]) => key.includes(".")));
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}
