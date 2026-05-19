---
name: diffgotchi
description: Read and write review comments via the diffgotchi CLI — list open comments from a human reviewer, reply, resolve, mark done, or add agent comments on a file/line. Use whenever the user mentions review comments, addresses review feedback, or invokes any `diffgotchi review` subcommand. Skip for launching the TUI or generic git diff operations.
---

# diffgotchi review CLI

Diffgotchi is a TUI diff reviewer. The `review` subcommand tree is a headless, agent-friendly API for the same review sessions the TUI manages. You use it to inspect human-authored comments and to add machine-authored ones in response.

## Invoking the CLI

The `diffgotchi` binary is installed globally on the user's machine. Run it from the git repo the user is currently working in — diffgotchi resolves the repo and active session from the current working directory, so your `cwd` selects which session you act on. If you're not inside the relevant repo, `cd` into it first.

## Always pass `--json`

Default output is human-formatted. Agents parse JSON. Put `--json` anywhere — before or after the subcommand — but **always include it**. Without it you'll waste tokens regex-parsing prose.

```bash
diffgotchi --json review doctor          # global position
diffgotchi review doctor --json          # also works
```

Success → stdout, exit 0, shape `{"ok": true, "command": "...", ...}`.
Error → stderr, exit 1, shape `{"ok": false, "error": {"code": "...", "message": "...", "details": {...}}}`.

Always check `.ok` before reading the rest — a non-zero exit with valid JSON on stderr is the contract.

## The session model

A **review session** is one human's review of one diff against one branch. Sessions live in the user's state directory (`$XDG_STATE_HOME/diffgotchi/` or `~/.local/state/diffgotchi/`), namespaced by repo — _not_ under `.git/`. Each session has an id like `worktree-<branch>-<hash>` or `staged-<branch>-<hash>`. The "active" session pointer is what the TUI most recently opened in this repo — that's almost always the session the user wants you to act on.

When a command takes `--session <id>`, omit it (or pass `current`) to use the active session. Pass an explicit id only when the user names a different session or when you've listed sessions and the active one isn't right.

If no session exists at all, you'll get `no_active_session`. That means the human hasn't opened the TUI yet — tell them so, don't try to create one (the CLI deliberately doesn't expose session creation; that's the TUI's job).

## The commands

Run `diffgotchi --json review doctor` first if you want a quick health check (in a git repo? active session id? open-comment count?). Otherwise jump straight to what you need:

### Reading

```bash
diffgotchi --json review sessions list                    # all sessions for this repo
diffgotchi --json review sessions list --all              # across every repo
diffgotchi --json review sessions current                 # active pointer
diffgotchi --json review sessions get <session-id>        # full session w/ comments inlined

diffgotchi --json review comments list                    # open comments on active session
diffgotchi --json review comments list --status all       # include resolved + done
diffgotchi --json review comments list --status resolved
diffgotchi --json review comments get <comment-id>        # single comment, includes `code` snippet
```

`list` returns comments with truncated bodies in the human form but full bodies in JSON. `get` additionally includes the `code` field (the diff line text) when the comment is line-anchored.

### Writing

```bash
# Add a comment anchored to a specific added/changed line
diffgotchi --json review comments add \
  --file packages/cli/src/lib/git/parse.ts \
  --line 42 \
  --body "This branch swallows the parse error. At minimum log it."

# Same, but anchored to a removed line
diffgotchi --json review comments add --file foo.ts --old-line 17 --body "..."

# File-level comment (no line)
diffgotchi --json review comments add --file foo.ts --body "..."

# Reply, resolve, done (resolve + reply in one shot), reopen
diffgotchi --json review comments reply   <comment-id> --body "Pushed fix in abc1234"
diffgotchi --json review comments resolve <comment-id>
diffgotchi --json review comments done    <comment-id> --reply "Fixed"
diffgotchi --json review comments reopen  <comment-id>
```

`--line` and `--new-line` are aliases (the new-file side is the default). Pass `--old-line` to anchor on a removed line. If you pass both `--line` and `--new-line` they must match. Omit all three for a file-level comment.

## Lines, hunks, and context

Comments anchor to a _diff line_, not to a raw file line. A line you can anchor on must be inside some hunk of the file's diff. Diffgotchi loads the diff with `context_lines` from the user's config (default **6**), which is wider than `git diff`'s default of 3 — so lines near a change that wouldn't appear in a normal `git diff` _can_ still be valid anchors here.

If a user says "comment on the changed line for X", verify which line that actually is rather than trusting a number they eyeballed. Quick check: `diffgotchi --json review sessions get <id>` returns the comments already in the session, each with a `code` snippet showing the exact text of its anchor line — useful for finding the right line by content.

`line_type` in the response tells you what side the anchor landed on:

- `"added"` — only in new file (a `+` line). Anchored via `--line` / `--new-line`.
- `"removed"` — only in old file (a `-` line). Anchored via `--old-line`.
- `"context"` — unchanged line present in both. Anchored via either.
- `"file"` — file-level, no line.

If you anchor on a line that's inside a hunk but it turns out to be a context line rather than an added line, that's not an error — the comment sticks — but the human probably expected the change-line. Re-check before submitting.

## Constraints when adding comments

These fail with specific error codes — handle them, don't retry blindly:

| Code                | Meaning                                        | What to do                                                                                               |
| ------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `file_not_in_diff`  | The path isn't in the session's diff           | List comments first to see paths actually in the diff; check for typo; the file may be ignored by config |
| `line_not_in_diff`  | That line isn't in any hunk of that file       | Read the file's hunks first; only lines inside hunks can be anchored                                     |
| `no_active_session` | No session pointer                             | Ask the user to open the TUI once to create a session                                                    |
| `session_not_found` | Explicit `--session <id>` doesn't exist        | Run `review sessions list`                                                                               |
| `comment_not_found` | The comment id doesn't exist in that session   | Run `review comments list --status all`                                                                  |
| `invalid_option`    | Bad/missing required flag (`--body`, `--file`) | Re-read your command                                                                                     |
| `not_git_repo`      | `cwd` isn't a git repo                         | `cd` into one                                                                                            |

The path you pass to `--file` must match a file _as it appears in the diff_. For renames, both the old and new path resolve. Glob patterns are not supported — exact paths only.

## Typical agent workflows

### "Address the review comments"

1. `review comments list` to see what's open.
2. For each comment, `review comments get <id>` to read the body + `code` snippet + location.
3. Fix the issue in the code.
4. `review comments done <id> --reply "<what you did, ideally with commit sha>"` once committed.

Prefer `done --reply` over a separate `resolve` + `reply` pair — `done` resolves the comment _and_ records the reply atomically in one call. Two-step variants only exist for when you want to reply now and decide later, or resolve without replying.

### "Leave review comments on this branch"

1. `review sessions current` to confirm there's a session (and that its `target` / `branch` match what you intend to review).
2. `review comments add --file <path> --line <n> --body <text>` per finding.
3. Keep bodies tight — humans read these in the TUI side panel.

### "Catch up on what's resolved"

```bash
diffgotchi --json review comments list --status all
```

Filter the JSON on `status` and `replies` client-side.
