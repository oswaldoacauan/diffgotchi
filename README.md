# Diffgotchi

A terminal diff reviewer for the code your agent writes.

Review your agent's diff where the work already is. Scroll the changes, drop
comments on lines that need a second look, mark files done, then hand the loop
back to your agent. Come back to a green panel.

![Diffgotchi TUI diff view](packages/docs/public/demos/diff-view.png)

## Install

```bash
brew install oswaldoacauan/diffgotchi/diffgotchi
```

## Quick start

```bash
cd your-repo
diffgotchi                   # review unstaged changes (default)
diffgotchi --staged          # review staged changes
diffgotchi main              # diff vs main (base...HEAD)
diffgotchi main feat         # diff between two refs (base...head)
diffgotchi --commit abc123   # diff for a single commit
diffgotchi --filter "*.tsx"  # filter by glob
diffgotchi --session api-review   # named review session
diffgotchi --theme dracula
```

Watch mode is always on. The diff refreshes the instant files change on disk.

## How it fits the agent loop

Diffgotchi persists comments and done state under `.git/diffgotchi/`, so the
review survives restarts, branch switches, and rebases.

1. Run `diffgotchi` after your agent changes code.
2. Add comments where the diff needs work.
3. Ask your agent to read the open comments with `diffgotchi --json`.
4. Let the agent address and resolve them.

## Agent loop (`--json`)

All `review` subcommands emit a stable JSON envelope on `--json`:

```json
{ "ok": true, "command": "review.comments.list", "comments": [ ... ] }
```

Errors:

```json
{ "ok": false, "error": { "code": "...", "message": "...", "details": {} } }
```

Available commands:

| Command                                                                          | Purpose                                   |
| -------------------------------------------------------------------------------- | ----------------------------------------- |
| `review doctor`                                                                  | Storage state, git status, session counts |
| `review sessions list [--limit N]`                                               | List review sessions                      |
| `review sessions current`                                                        | Show the active session id                |
| `review sessions get <id>`                                                       | Full session payload (incl. comments)     |
| `review comments list [--session id] [--status open\|resolved\|all] [--limit N]` | List comments                             |
| `review comments add --file path [--new-line N\|--old-line N] --body text`       | Add an agent comment                      |
| `review comments get <id> [--session id]`                                        | Fetch one comment                         |
| `review comments resolve <id> [--session id]`                                    | Mark `open` → `resolved`                  |
| `review comments reopen <id> [--session id]`                                     | Mark `resolved` → `open`                  |

Example agent prompt:

```bash
diffgotchi --json review comments list --status open
# → feed JSON to the agent: "address every open comment, then resolve it"
diffgotchi --json review comments resolve cmt_123

# agent asks the user about a changed line; the user replies in the TUI
diffgotchi --json review comments add --file src/api.ts --new-line 42 --body "Should this handle null?"
```

Without `--json`, the same commands print terse text for humans.

## Sessions

State lives under `.git/diffgotchi/`:

- `reviews/<session-id>.json`: per-session comments + done state
- `current-review-session.json`: pointer to the active session

Session ids are auto-derived from `{kind}-{branch}-{hash}`. Pass `--session
my-name` to use a sticky, human-readable id.

## Comments

| Key        | Action               |
| ---------- | -------------------- |
| `c`        | Open comment editor  |
| `Ctrl+⏎`   | Submit comment       |
| `Esc`      | Discard (×2 if body) |
| `Ctrl+K R` | List all comments    |

Comments persist across runs and carry an `author` (`user` | `agent`) plus a
`status` (`open` | `resolved`) that agents can read and update. Selecting an
agent-authored comment in the TUI opens a reply editor for the user.

## Keybinds

| Key                            | Action               |
| ------------------------------ | -------------------- |
| `←→` / `hl`                    | Prev / next file     |
| `↑↓` / `jk`                    | Scroll               |
| `Ctrl+↑↓` / `PageUp/Down`      | Half page            |
| `Home`                         | Top                  |
| `Ctrl+Alt+G` / `End`           | Bottom               |
| `Shift+↑↓` / `Shift+JK` / `[]` | Prev / next hunk     |
| `d`                            | Mark file done       |
| `c`                            | Add comment          |
| `Ctrl+K R`                     | Review comments      |
| `/` / `Ctrl+K F`               | File picker          |
| `Ctrl+G` / `Ctrl+K E`          | Open file in $EDITOR |
| unbound                        | Theme picker         |
| unbound                        | Force-expand file    |
| `Ctrl+P`                       | Command palette      |
| `Ctrl+C` / `Ctrl+D`            | Quit                 |

All keybinds are remappable in config with dot-key context actions.
The same key can be bound differently in different contexts.

Keybind strings use commas for alternatives and spaces for chords. For example,
`ctrl+g, ctrl+k e` means either `Ctrl+G` or the two-step chord
`Ctrl+K` then `E`; `ctrl+k, e` means either `Ctrl+K` or `E`.

Common contexts are `global`, `diff`, `select`, `file_picker`, `comments_list`,
`comment_editor`, and `error`. `global.*` bindings are reserved and work across
focused dialogs and editors.

## Config

`~/.config/diffgotchi/config.json`

```json
{
  "$schema": "https://diffgotchi.dev/schemas/config.json",
  "general": {
    "theme": "catppuccin",
    "mouse": true
  },
  "display": {
    "wrap": "word"
  },
  "diff": {
    "context_lines": 6,
    "refresh_debounce_ms": 200
  },
  "keybinds": {
    "diff.mark_done": "space",
    "diff.scroll_top": "g g",
    "file_picker.toggle_done": "ctrl+d",
    "global.quit": "ctrl+c"
  }
}
```

## Themes

30 built-in themes. Use the command palette to preview and switch live. Custom themes go in
`~/.config/diffgotchi/themes/*.json`.

## License

MIT
