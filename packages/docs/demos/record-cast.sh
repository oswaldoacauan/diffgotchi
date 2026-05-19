#!/usr/bin/env bash
# Record asciicast files for the landing demos. Drives the local dev
# CLI (not the installed binary) against a fresh fixture repo using a
# python PTY recorder + JSON action scripts mirroring the e2e tests.
#
# Usage: bash demos/record-cast.sh [name ...]

set -eo pipefail

DEMOS_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$DEMOS_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/../.." && pwd)"
CLI_MAIN="$REPO_ROOT/packages/cli/src/main.tsx"
FIXTURE="$DEMOS_DIR/.fixture-repo"
STATE_DIR="$DEMOS_DIR/.fixture-state"
FAKE_HOME="$DEMOS_DIR/.fixture-home"
OUTPUT_DIR="$DOCS_DIR/public/demos"

for bin in bun python3; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "$bin not installed." >&2
    exit 1
  fi
done

if [ ! -f "$CLI_MAIN" ]; then
  echo "cli main.tsx not found at $CLI_MAIN" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

demos=("hero" "comments" "agent" "sessions")
if [ "$#" -gt 0 ]; then
  demos=("$@")
fi

for name in "${demos[@]}"; do
  cast="$OUTPUT_DIR/$name.cast"
  echo "==> Recording $name"

  rm -rf "$STATE_DIR" "$FAKE_HOME"
  mkdir -p "$STATE_DIR" "$FAKE_HOME"
  case "$name" in
    hero|comments|agent)
      DIFFGOTCHI_STATE_HOME="$STATE_DIR" \
        bash "$DEMOS_DIR/fixtures/setup.sh" "$FIXTURE" --seed-review >/dev/null
      ;;
    *)
      bash "$DEMOS_DIR/fixtures/setup.sh" "$FIXTURE" >/dev/null
      ;;
  esac

  pushd "$FIXTURE" >/dev/null
  rm -f "$cast"

  if [ "$name" = "agent" ]; then
    DIFFGOTCHI_MAIN="$CLI_MAIN" \
      DIFFGOTCHI_STATE_HOME="$STATE_DIR" \
      HOME="$FAKE_HOME" \
      python3 "$DEMOS_DIR/pty-rec.py" "$cast" 120 28 bash "$DEMOS_DIR/agent.sh"
  else
    case "$name" in
      hero|comments)
        session_flag=()
        ;;
      sessions)
        session_flag=("--session" "api-review")
        ;;
    esac

    DIFFGOTCHI_NO_UPDATE=1 \
      DIFFGOTCHI_STATE_HOME="$STATE_DIR" \
      HOME="$FAKE_HOME" \
      python3 "$DEMOS_DIR/drive.py" "$cast" 140 32 \
        "$DEMOS_DIR/scripts/$name.json" -- \
        bun run "$CLI_MAIN" --theme catppuccin-macchiato --context 3 "${session_flag[@]}"
  fi

  popd >/dev/null
  echo "    -> $cast"
done

rm -rf "$FIXTURE" "$STATE_DIR" "$FAKE_HOME"
echo "done"
