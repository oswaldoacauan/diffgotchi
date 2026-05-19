#!/usr/bin/env python3
"""Drive a TUI in a PTY and record its output as asciicast v2.

Usage:
    drive.py <out.cast> <cols> <rows> <script.json> -- <cmd> [args...]

Script JSON is a list of actions. Each action is one of:

    {"wait": ms}                 # pause for N milliseconds
    {"wait_for": "text"}         # block until "text" appears (max 8s)
    {"type": "hello"}            # type a string
    {"key": "Ctrl+J"}            # send a named key

Recognized keys: Up, Down, Left, Right, Enter, Return, Escape, Tab,
Backspace, Home, End, PageUp, PageDown, F1..F12, Space, plus any
`Ctrl+<x>`, `Alt+<x>`, `Shift+<Up|Down|Left|Right>` combinations.
A raw single character is sent as-is.
"""
import json
import os
import pty
import re
import select
import sys
import time

ANSI_ESCAPES = re.compile(rb"\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[NOPGM=>78()]?")

if "--" not in sys.argv:
    print("expected -- separator before command", file=sys.stderr)
    sys.exit(2)

dash_at = sys.argv.index("--")
flags, cmd = sys.argv[1:dash_at], sys.argv[dash_at + 1 :]
if len(flags) != 4 or not cmd:
    print(__doc__, file=sys.stderr)
    sys.exit(2)

out_path, cols, rows, script_path = flags[0], int(flags[1]), int(flags[2]), flags[3]
with open(script_path) as f:
    actions = json.load(f)

KEY_TABLE = {
    "up": "\x1b[A",
    "down": "\x1b[B",
    "right": "\x1b[C",
    "left": "\x1b[D",
    "shift+up": "\x1b[1;2A",
    "shift+down": "\x1b[1;2B",
    "shift+right": "\x1b[1;2C",
    "shift+left": "\x1b[1;2D",
    "enter": "\r",
    "return": "\r",
    "escape": "\x1b",
    "esc": "\x1b",
    "tab": "\t",
    "backspace": "\x7f",
    "home": "\x1b[H",
    "end": "\x1b[F",
    "pageup": "\x1b[5~",
    "pagedown": "\x1b[6~",
    "space": " ",
}


def key_to_bytes(key: str) -> bytes:
    k = key.strip().lower()
    if k in KEY_TABLE:
        return KEY_TABLE[k].encode()
    if k.startswith("ctrl+"):
        ch = k[5:]
        if len(ch) == 1 and "a" <= ch <= "z":
            return bytes([ord(ch) - 96])
    if len(key) == 1:
        return key.encode()
    raise ValueError(f"unknown key: {key}")


pid, fd = pty.fork()
if pid == 0:
    os.environ["TERM"] = os.environ.get("TERM", "xterm-256color")
    os.environ["COLUMNS"] = str(cols)
    os.environ["LINES"] = str(rows)
    import fcntl
    import struct
    import termios

    fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    os.execvp(cmd[0], cmd)


start = time.time()
buf = bytearray()
out = open(out_path, "w")
header = {
    "version": 2,
    "width": cols,
    "height": rows,
    "timestamp": int(start),
    "command": " ".join(cmd),
    "env": {"SHELL": os.environ.get("SHELL", "/bin/bash"), "TERM": os.environ["TERM"]},
}
out.write(json.dumps(header) + "\n")
out.flush()


def drain_output(deadline: float) -> None:
    """Read all available PTY output until deadline; record each chunk."""
    while time.time() < deadline:
        remaining = max(0.0, deadline - time.time())
        r, _, _ = select.select([fd], [], [], remaining)
        if fd not in r:
            return
        try:
            data = os.read(fd, 65536)
        except OSError:
            return
        if not data:
            return
        t = time.time() - start
        text = data.decode("utf-8", errors="replace")
        buf.extend(data)
        out.write(json.dumps([t, "o", text]) + "\n")
        out.flush()


def wait_for(pattern: str, max_ms: int = 8000) -> None:
    needle = pattern.encode()
    deadline = time.time() + max_ms / 1000
    while time.time() < deadline:
        drain_output(time.time() + 0.2)
        stripped = ANSI_ESCAPES.sub(b"", bytes(buf))
        if needle in stripped:
            return
    stripped = ANSI_ESCAPES.sub(b"", bytes(buf))
    tail = stripped[-500:].decode("utf-8", errors="replace")
    raise TimeoutError(f"wait_for timed out on: {pattern}\nrecent screen tail: {tail!r}")


def write_keys(payload: bytes, pace_ms: int = 0) -> None:
    """Write keystrokes to the PTY; record any concurrent output."""
    if pace_ms <= 0:
        os.write(fd, payload)
        drain_output(time.time() + 0.05)
        return
    for byte in payload:
        os.write(fd, bytes([byte]))
        drain_output(time.time() + pace_ms / 1000)


try:
    for action in actions:
        if "wait" in action:
            drain_output(time.time() + action["wait"] / 1000)
        elif "wait_for" in action:
            wait_for(action["wait_for"])
        elif "type" in action:
            pace = int(action.get("pace_ms", 30))
            write_keys(action["type"].encode(), pace_ms=pace)
        elif "key" in action:
            write_keys(key_to_bytes(action["key"]))
        else:
            raise ValueError(f"unknown action: {action}")
finally:
    drain_output(time.time() + 0.5)
    try:
        os.close(fd)
    except OSError:
        pass
    out.close()
