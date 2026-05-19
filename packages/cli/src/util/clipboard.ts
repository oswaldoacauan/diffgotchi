import { execSync } from "child_process";
import { platform } from "os";

function writeOsc52(text: string): void {
  if (!process.stdout.isTTY) return;
  const base64 = Buffer.from(text).toString("base64");
  const osc52 = `\x1b]52;c;${base64}\x07`;
  const passthrough = process.env["TMUX"] || process.env["STY"];
  const sequence = passthrough ? `\x1bPtmux;\x1b${osc52}\x1b\\` : osc52;
  process.stdout.write(sequence);
}

function writeNative(text: string): void {
  const os = platform();

  if (os === "darwin") {
    try {
      execSync("pbcopy", { input: text, stdio: ["pipe", "ignore", "ignore"] });
      return;
    } catch {}
  }

  if (os === "linux") {
    for (const cmd of ["wl-copy", "xclip -selection clipboard", "xsel --clipboard --input"]) {
      try {
        execSync(cmd.split(" ")[0]! + " --version", { stdio: "ignore" });
        execSync(cmd, { input: text, stdio: ["pipe", "ignore", "ignore"] });
        return;
      } catch {}
    }
  }
}

export function copy(text: string): void {
  writeOsc52(text);
  writeNative(text);
}
