import { parseColor, RGBA } from "@opentui/core";
import { readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import aura from "../themes/aura.json";
import ayu from "../themes/ayu.json";
import carbonfox from "../themes/carbonfox.json";
import catppuccin from "../themes/catppuccin.json";
import catppuccinFrappe from "../themes/catppuccin-frappe.json";
import catppuccinMacchiato from "../themes/catppuccin-macchiato.json";
import cobalt2 from "../themes/cobalt2.json";
import cursor from "../themes/cursor.json";
import dracula from "../themes/dracula.json";
import everforest from "../themes/everforest.json";
import flexoki from "../themes/flexoki.json";
import github from "../themes/github.json";
import gruvbox from "../themes/gruvbox.json";
import kanagawa from "../themes/kanagawa.json";
import material from "../themes/material.json";
import matrix from "../themes/matrix.json";
import mercury from "../themes/mercury.json";
import monokai from "../themes/monokai.json";
import nightowl from "../themes/nightowl.json";
import nord from "../themes/nord.json";
import oneDark from "../themes/one-dark.json";
import osakaJade from "../themes/osaka-jade.json";
import palenight from "../themes/palenight.json";
import rosepine from "../themes/rosepine.json";
import solarized from "../themes/solarized.json";
import synthwave84 from "../themes/synthwave84.json";
import tokyonight from "../themes/tokyonight.json";
import vercel from "../themes/vercel.json";
import vesper from "../themes/vesper.json";
import zenburn from "../themes/zenburn.json";

type HexColor = `#${string}`;
type ColorValue = HexColor | string | { dark: string; light: string };

interface ThemeJson {
  defs?: Record<string, string>;
  theme: Record<string, ColorValue>;
}

export interface ResolvedTheme {
  primary: RGBA;
  success: RGBA;
  error: RGBA;
  warning: RGBA;
  info: RGBA;
  syntaxComment: RGBA;
  syntaxKeyword: RGBA;
  syntaxFunction: RGBA;
  syntaxVariable: RGBA;
  syntaxString: RGBA;
  syntaxNumber: RGBA;
  syntaxType: RGBA;
  syntaxOperator: RGBA;
  syntaxPunctuation: RGBA;
  text: RGBA;
  textMuted: RGBA;
  conceal: RGBA;
  diffAdded: RGBA;
  diffRemoved: RGBA;
  diffAddedBg: RGBA;
  diffRemovedBg: RGBA;
  diffContextBg: RGBA;
  diffAddedLineNumberBg: RGBA;
  diffRemovedLineNumberBg: RGBA;
  diffLineNumber: RGBA;
  background: RGBA;
  backgroundPanel: RGBA;
}

export interface SyntaxTheme {
  [scope: string]: { fg: RGBA; bold?: boolean; italic?: boolean; underline?: boolean };
}

const BUILTIN_THEME_FILES: Record<string, ThemeJson> = {
  aura,
  ayu,
  carbonfox,
  catppuccin,
  "catppuccin-frappe": catppuccinFrappe,
  "catppuccin-macchiato": catppuccinMacchiato,
  cobalt2,
  cursor,
  dracula,
  everforest,
  flexoki,
  github,
  gruvbox,
  kanagawa,
  material,
  matrix,
  mercury,
  monokai,
  nightowl,
  nord,
  "one-dark": oneDark,
  "osaka-jade": osakaJade,
  palenight,
  rosepine,
  solarized,
  synthwave84,
  tokyonight,
  vercel,
  vesper,
  zenburn,
};

const CUSTOM_THEMES_DIR = join(homedir(), ".config", "diffgotchi", "themes");

let _themeCache: Record<string, ThemeJson> | null = null;
let _overriddenThemes: Set<string> | null = null;

function ensureThemeCacheLoaded(): {
  themes: Record<string, ThemeJson>;
  overridden: Set<string>;
} {
  if (_themeCache !== null && _overriddenThemes !== null) {
    return { themes: _themeCache, overridden: _overriddenThemes };
  }

  _themeCache = { ...BUILTIN_THEME_FILES };
  _overriddenThemes = new Set<string>();

  let files: string[];
  try {
    files = readdirSync(CUSTOM_THEMES_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    // Directory doesn't exist or isn't readable — no custom themes
    return { themes: _themeCache, overridden: _overriddenThemes };
  }

  for (const file of files) {
    const name = file.replace(/\.json$/, "");
    try {
      const raw = readFileSync(join(CUSTOM_THEMES_DIR, file), "utf-8");
      const parsed = JSON.parse(raw) as ThemeJson;
      if (parsed.theme) {
        if (BUILTIN_THEME_FILES[name] !== undefined) {
          _overriddenThemes.add(name);
        }
        _themeCache[name] = parsed;
      }
    } catch {
      // Skip malformed theme files
    }
  }

  return { themes: _themeCache, overridden: _overriddenThemes };
}

function getThemeFiles(): Record<string, ThemeJson> {
  return ensureThemeCacheLoaded().themes;
}

export function getThemeDisplayName(name: string): string {
  const { overridden } = ensureThemeCacheLoaded();
  return overridden.has(name) ? `${name} (local)` : name;
}

function resolveTheme(themeJson: ThemeJson, mode: "dark" | "light"): ResolvedTheme {
  const defs = themeJson.defs ?? {};

  function resolveColor(c: ColorValue, seen = new Set<string>()): RGBA {
    if (typeof c === "string") {
      if (c === "transparent" || c === "none") return RGBA.fromInts(0, 0, 0, 0);
      if (c.startsWith("#")) return parseColor(c);
      if (seen.has(c)) return RGBA.fromInts(128, 128, 128, 255);
      seen.add(c);
      if (defs[c] != null) return resolveColor(defs[c] as ColorValue, seen);
      if (themeJson.theme[c] !== undefined)
        return resolveColor(themeJson.theme[c] as ColorValue, seen);
      return RGBA.fromInts(128, 128, 128, 255);
    }
    return resolveColor(c[mode], seen);
  }

  const t = themeJson.theme;
  const fallbackGray: ColorValue = "#808080";
  const fallbackBg: ColorValue = "#1e1e1e";
  const fallbackText: ColorValue = "#d4d4d4";
  const fallbackGreen: ColorValue = "#3fb950";
  const fallbackRed: ColorValue = "#f85149";
  const fallbackYellow: ColorValue = "#e3b341";
  const fallbackOrange: ColorValue = "#d29922";

  return {
    primary: resolveColor(t.primary ?? t.syntaxFunction ?? fallbackGray),
    success: resolveColor(t.success ?? fallbackGreen),
    error: resolveColor(t.error ?? fallbackRed),
    warning: resolveColor(t.warning ?? fallbackYellow),
    info: resolveColor(t.info ?? fallbackOrange),
    syntaxComment: resolveColor(t.syntaxComment ?? fallbackGray),
    syntaxKeyword: resolveColor(t.syntaxKeyword ?? fallbackGray),
    syntaxFunction: resolveColor(t.syntaxFunction ?? fallbackGray),
    syntaxVariable: resolveColor(t.syntaxVariable ?? fallbackGray),
    syntaxString: resolveColor(t.syntaxString ?? fallbackGray),
    syntaxNumber: resolveColor(t.syntaxNumber ?? fallbackGray),
    syntaxType: resolveColor(t.syntaxType ?? fallbackGray),
    syntaxOperator: resolveColor(t.syntaxOperator ?? fallbackGray),
    syntaxPunctuation: resolveColor(t.syntaxPunctuation ?? fallbackGray),
    text: resolveColor(t.text ?? fallbackText),
    textMuted: resolveColor(t.textMuted ?? fallbackGray),
    conceal: resolveColor(t.conceal ?? t.textMuted ?? fallbackGray),
    diffAdded: resolveColor(t.diffAdded ?? t.success ?? fallbackGreen),
    diffRemoved: resolveColor(t.diffRemoved ?? t.error ?? fallbackRed),
    diffAddedBg: resolveColor(t.diffAddedBg ?? "#1e3a1e"),
    diffRemovedBg: resolveColor(t.diffRemovedBg ?? "#3a1e1e"),
    diffContextBg: resolveColor(t.diffContextBg ?? fallbackBg),
    diffAddedLineNumberBg: resolveColor(t.diffAddedLineNumberBg ?? "#1e3a1e"),
    diffRemovedLineNumberBg: resolveColor(t.diffRemovedLineNumberBg ?? "#3a1e1e"),
    diffLineNumber: resolveColor(t.diffLineNumber ?? fallbackGray),
    background: resolveColor(t.background ?? fallbackBg),
    backgroundPanel: resolveColor(t.backgroundPanel ?? fallbackBg),
  };
}

export function getResolvedTheme(name: string, mode: "dark" | "light" = "dark"): ResolvedTheme {
  const themes = getThemeFiles();
  const themeJson = themes[name] ?? themes.github!;
  return resolveTheme(themeJson, mode);
}

export function getSyntaxTheme(name: string, mode: "dark" | "light" = "dark"): SyntaxTheme {
  const resolved = getResolvedTheme(name, mode);

  return {
    default: { fg: resolved.text },

    keyword: { fg: resolved.syntaxKeyword, italic: true },
    "keyword.import": { fg: resolved.syntaxKeyword },
    "keyword.return": { fg: resolved.syntaxKeyword, italic: true },
    "keyword.conditional": { fg: resolved.syntaxKeyword, italic: true },
    "keyword.repeat": { fg: resolved.syntaxKeyword, italic: true },
    "keyword.type": { fg: resolved.syntaxType, bold: true, italic: true },
    "keyword.function": { fg: resolved.syntaxFunction },
    "keyword.operator": { fg: resolved.syntaxOperator },
    "keyword.modifier": { fg: resolved.syntaxKeyword, italic: true },
    "keyword.exception": { fg: resolved.syntaxKeyword, italic: true },

    string: { fg: resolved.syntaxString },
    symbol: { fg: resolved.syntaxString },

    comment: { fg: resolved.syntaxComment, italic: true },
    "comment.documentation": { fg: resolved.syntaxComment, italic: true },

    number: { fg: resolved.syntaxNumber },
    boolean: { fg: resolved.syntaxNumber },
    constant: { fg: resolved.syntaxNumber },

    function: { fg: resolved.syntaxFunction },
    "function.call": { fg: resolved.syntaxFunction },
    "function.method": { fg: resolved.syntaxFunction },
    "function.method.call": { fg: resolved.syntaxVariable },
    constructor: { fg: resolved.syntaxFunction },

    type: { fg: resolved.syntaxType },
    module: { fg: resolved.syntaxType },
    class: { fg: resolved.syntaxType },

    operator: { fg: resolved.syntaxOperator },

    variable: { fg: resolved.syntaxVariable },
    "variable.parameter": { fg: resolved.syntaxVariable },
    "variable.member": { fg: resolved.syntaxFunction },
    property: { fg: resolved.syntaxVariable },
    parameter: { fg: resolved.syntaxVariable },

    bracket: { fg: resolved.syntaxPunctuation },
    punctuation: { fg: resolved.syntaxPunctuation },
    "punctuation.bracket": { fg: resolved.syntaxPunctuation },
    "punctuation.delimiter": { fg: resolved.syntaxOperator },
    "punctuation.special": { fg: resolved.syntaxOperator },

    "markup.heading": { fg: resolved.primary, bold: true },
    "markup.heading.1": { fg: resolved.primary, bold: true },
    "markup.heading.2": { fg: resolved.primary, bold: true },
    "markup.heading.3": { fg: resolved.primary, bold: true },
    "markup.heading.4": { fg: resolved.primary, bold: true },
    "markup.heading.5": { fg: resolved.primary, bold: true },
    "markup.heading.6": { fg: resolved.primary, bold: true },
    "markup.bold": { fg: resolved.text, bold: true },
    "markup.strong": { fg: resolved.text, bold: true },
    "markup.italic": { fg: resolved.text, italic: true },
    "markup.list": { fg: resolved.syntaxKeyword },
    "markup.quote": { fg: resolved.syntaxComment, italic: true },
    "markup.raw": { fg: resolved.syntaxString },
    "markup.raw.block": { fg: resolved.syntaxString },
    "markup.raw.inline": { fg: resolved.syntaxString },
    "markup.link": { fg: resolved.primary, underline: true },
    "markup.link.label": { fg: resolved.info, underline: true },
    "markup.link.url": { fg: resolved.primary, underline: true },

    label: { fg: resolved.info },
    spell: { fg: resolved.text },
    nospell: { fg: resolved.text },
    conceal: { fg: resolved.conceal },
    "string.special": { fg: resolved.primary, underline: true },
    "string.special.url": { fg: resolved.primary, underline: true },
  };
}

export function contrastFg(rgba: RGBA): string {
  const luminance = 0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export function rgbaToHex(rgba: RGBA): string {
  const r = Math.round(rgba.r * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(rgba.g * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(rgba.b * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`;
}

export const defaultThemeName = "github";

export function themeNames(): string[] {
  return Object.keys(getThemeFiles()).sort();
}
