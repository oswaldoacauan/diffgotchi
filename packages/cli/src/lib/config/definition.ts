export const CONFIG_SCHEMA_URL = "https://diffgotchi.dev/schemas/config.json";

export type UpgradeChannel = "stable" | "edge";
export type ViewMode = "split" | "unified" | "auto";
export type WrapMode = "word" | "char" | "none";
export type Indicators = "classic" | "none";

export interface GeneralConfig {
  theme: string;
  editor: string;
  mouse: boolean;
}

export interface DisplayConfig {
  view: ViewMode;
  line_numbers: boolean;
  wrap: WrapMode;
  inline_highlights: boolean;
  backgrounds: boolean;
  indicators: Indicators;
  hunk_headers: boolean;
}

export interface DiffConfig {
  context_lines: number;
  refresh_debounce_ms: number;
  max_bytes: number;
  max_file_lines: number;
  filetypes: Record<string, string>;
  ignored_files: string[];
}

export interface UpgradeConfig {
  auto: boolean;
  channel: UpgradeChannel;
}

export interface StorageConfig {
  cleanup_stale_days: number;
}

export type KeybindsConfig = Record<string, string>;

export interface DiffgotchiConfig {
  general: GeneralConfig;
  display: DisplayConfig;
  diff: DiffConfig;
  upgrade: UpgradeConfig;
  storage: StorageConfig;
  keybinds: KeybindsConfig;
}

export const DEFAULT_KEYBINDS = {
  "global.command_palette": "ctrl+p",
  "global.quit": "ctrl+c, ctrl+d",
  "global.help_keybinds": "",
  "global.help_about": "",
  "global.help_docs": "",
  "global.open_config": "",

  "diff.next_file": "right, l",
  "diff.prev_file": "left, h",
  "diff.pick_file": "/, ctrl+k f",
  "diff.edit_file": "ctrl+g, ctrl+k e",
  "diff.scroll_down": "down, j",
  "diff.scroll_up": "up, k",
  "diff.scroll_half_down": "ctrl+down, pagedown",
  "diff.scroll_half_up": "ctrl+up, pageup",
  "diff.scroll_top": "home",
  "diff.scroll_bottom": "ctrl+alt+g, end",
  "diff.next_hunk": "shift+down, shift+j, ]",
  "diff.prev_hunk": "shift+up, shift+k, [",
  "diff.mark_done": "d",
  "diff.add_comment": "c",
  "diff.list_comments": "ctrl+k r",
  "diff.pick_theme": "",
  "diff.force_expand": "",
  "diff.display_view": "",
  "diff.display_line_numbers": "",
  "diff.display_wrap": "",
  "diff.display_inline_highlights": "",
  "diff.display_backgrounds": "",
  "diff.display_indicators": "",
  "diff.display_hunk_headers": "",
  "diff.context_lines": "",
  "diff.toggle_mouse": "",

  "select.next": "down, j",
  "select.prev": "up, k",
  "select.accept": "return",
  "select.cancel": "escape",

  "file_picker.toggle_done": "ctrl+d",

  "comments_list.resolve": "ctrl+r",
  "comments_list.delete": "ctrl+x",

  "comment_editor.submit": "ctrl+return, ctrl+enter, ctrl+j",
  "comment_editor.delete": "ctrl+x",
  "comment_editor.cancel": "escape",

  "error.retry": "r",
  "error.copy": "c",
  "error.quit": "ctrl+c, ctrl+d",
} satisfies KeybindsConfig;

export type KeybindAction = keyof typeof DEFAULT_KEYBINDS;

export const DEFAULT_CONFIG: DiffgotchiConfig = {
  general: {
    theme: "github",
    editor: "",
    mouse: true,
  },
  display: {
    view: "auto",
    line_numbers: true,
    wrap: "word",
    inline_highlights: true,
    backgrounds: true,
    indicators: "classic",
    hunk_headers: true,
  },
  diff: {
    context_lines: 6,
    refresh_debounce_ms: 200,
    max_bytes: 20 * 1024 * 1024,
    max_file_lines: 5000,
    filetypes: {},
    ignored_files: ["\\.lock$", "lock\\.json$", "lock\\.yaml$", "lock\\.toml$", "\\.sum$"],
  },
  upgrade: {
    auto: true,
    channel: "stable",
  },
  storage: {
    cleanup_stale_days: 30,
  },
  keybinds: DEFAULT_KEYBINDS,
};

export const CONFIG_DESCRIPTIONS = {
  general: {
    theme: "Theme name to use.",
    editor:
      "Editor command to use when opening files. Falls back to $VISUAL, then $EDITOR, then vi.",
    mouse: "Enable mouse support for scrolling and clicking.",
  },
  display: {
    view: "Diff layout mode.",
    line_numbers: "Show line numbers.",
    wrap: "How to wrap long lines.",
    inline_highlights: "Highlight changed content within added and removed lines.",
    backgrounds: "Show added and removed line backgrounds.",
    indicators: "Line indicator style.",
    hunk_headers: "Show diff hunk headers.",
  },
  diff: {
    context_lines: "Number of context lines around changes.",
    refresh_debounce_ms: "Debounce interval in milliseconds for refreshing watched diffs.",
    max_bytes: "Maximum total bytes of git diff output before truncation. Set to 0 to disable.",
    max_file_lines:
      "Maximum diff lines per file before showing a placeholder. Set to 0 to disable.",
    filetypes:
      "Custom extension/filename to tree-sitter language mappings. Keys are extensions or filenames.",
    ignored_files: "Regex patterns for files to ignore in diff view.",
  },
  upgrade: {
    auto: "Automatically check for and install upgrades on startup.",
    channel: "Which release channel to check for upgrades.",
  },
  storage: {
    cleanup_stale_days:
      "Delete stale review/session state older than this many days. Set to 0 to disable cleanup.",
  },
  keybinds: "Keyboard shortcuts. Empty string means the action is intentionally unbound.",
} as const;
