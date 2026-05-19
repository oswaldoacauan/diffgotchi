#!/usr/bin/env bash
# Agent skill demo: pure shell session showing the comment loop.
# Invoked by the python pty recorder so timing stays real.
set -u

# Make `diffgotchi` resolve to the local CLI.
DIFFGOTCHI_MAIN="${DIFFGOTCHI_MAIN:-/Users/oacauan/workspace/playground/diffgotchi/packages/cli/src/main.tsx}"
diffgotchi() { bun run "$DIFFGOTCHI_MAIN" "$@"; }

# Slow-print helper so the recording reads at a comfortable pace.
say() { printf '\033[2m%s\033[0m\n' "$1"; sleep 0.9; }
prompt() { printf '\033[32m$\033[0m %s\n' "$1"; sleep 0.4; }

clear

prompt "diffgotchi review comments list"
diffgotchi review comments list
sleep 2.5

say "# agent reads the comment, writes the fix..."
sleep 1

ID=$(diffgotchi --json review comments list 2>/dev/null | tr ',' '\n' | grep -oE 'cmt_[a-z0-9]+' | head -1)

prompt "diffgotchi review comments done $ID --reply '...'"
diffgotchi review comments done "$ID" --reply "parameterized — pushed in 4f1c2ab"
sleep 2

prompt "diffgotchi review comments list --status all"
diffgotchi review comments list --status all
sleep 3
