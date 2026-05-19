#!/usr/bin/env python3
"""Wrap a command in a PTY and record its output as asciicast v2.

Used to record shell-based demo flows (agent.sh) with progressive
real-time timestamps even when invoked from a non-interactive shell.
"""
import json
import os
import pty
import select
import sys
import time

if len(sys.argv) < 5:
    print("Usage: pty-rec.py <output.cast> <cols> <rows> <cmd> [args...]", file=sys.stderr)
    sys.exit(2)

out_path = sys.argv[1]
cols = int(sys.argv[2])
rows = int(sys.argv[3])
cmd = sys.argv[4:]

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
with open(out_path, "w") as f:
    header = {
        "version": 2,
        "width": cols,
        "height": rows,
        "timestamp": int(start),
        "command": " ".join(cmd),
        "env": {"SHELL": os.environ.get("SHELL", "/bin/bash"), "TERM": os.environ["TERM"]},
    }
    f.write(json.dumps(header) + "\n")
    f.flush()
    try:
        while True:
            r, _, _ = select.select([fd], [], [], 0.1)
            if fd in r:
                try:
                    data = os.read(fd, 65536)
                except OSError:
                    break
                if not data:
                    break
                t = time.time() - start
                f.write(json.dumps([t, "o", data.decode("utf-8", errors="replace")]) + "\n")
                f.flush()
            try:
                wpid, _ = os.waitpid(pid, os.WNOHANG)
                if wpid == pid:
                    break
            except ChildProcessError:
                break
    finally:
        try:
            os.close(fd)
        except OSError:
            pass
