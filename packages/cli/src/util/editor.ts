import { spawn } from "child_process";

export function openInEditor(
  filePath: string,
  editor?: string,
): { success: boolean; error?: string } {
  const raw = editor || process.env["VISUAL"] || process.env["EDITOR"] || "vi";
  const parts = raw.split(/\s+/);
  const cmd = parts[0]!;
  const args = [...parts.slice(1), filePath];

  try {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Failed to open editor" };
  }
}
