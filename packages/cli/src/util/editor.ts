import { spawn, type ChildProcess } from "child_process";

const EDITOR_STARTUP_TIMEOUT_MS = 500;

export interface OpenEditorResult {
  success: boolean;
  error?: string;
}

export async function openInEditor(filePath: string, editor?: string): Promise<OpenEditorResult> {
  const parts = parseEditorCommand(resolveEditorCommand(editor));
  const cmd = parts[0];
  if (!cmd) {
    return { success: false, error: "Editor command is empty" };
  }
  const args = [...parts.slice(1), filePath];

  let child: ChildProcess;
  try {
    child = spawn(cmd, args, {
      detached: true,
      stdio: "ignore",
    });
  } catch (err: unknown) {
    return { success: false, error: formatEditorError(cmd, err) };
  }

  child.unref();
  return waitForEditorStartup(child, cmd);
}

export function editorCommandName(editor?: string): string {
  return parseEditorCommand(resolveEditorCommand(editor))[0] ?? "vi";
}

export function parseEditorCommand(raw: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  const input = raw.trim();
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    const next = input[i + 1];

    if (char === "\\" && shouldEscapeNext(quote, next)) {
      current += next;
      i++;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) parts.push(current);
  return parts;
}

function resolveEditorCommand(editor?: string): string {
  return editor || process.env["VISUAL"] || process.env["EDITOR"] || "vi";
}

function shouldEscapeNext(quote: '"' | "'" | null, next: string | undefined): next is string {
  if (!next) return false;
  if (quote === "'") return false;
  if (quote === '"') return next === '"' || next === "\\";
  return /\s/.test(next) || next === '"' || next === "'" || next === "\\";
}

function waitForEditorStartup(child: ChildProcess, cmd: string): Promise<OpenEditorResult> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: OpenEditorResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("error", onError);
      child.off("exit", onExit);
      resolve(result);
    };

    const onError = (err: Error) => {
      finish({ success: false, error: formatEditorError(cmd, err) });
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (code === 0) {
        finish({ success: true });
        return;
      }

      const detail = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      finish({ success: false, error: `Failed to open editor '${cmd}' (${detail})` });
    };

    const timer = setTimeout(() => finish({ success: true }), EDITOR_STARTUP_TIMEOUT_MS);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

function formatEditorError(cmd: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `Failed to open editor '${cmd}': ${message}`;
}
