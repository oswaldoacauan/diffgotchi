import { describe, expect, test } from "bun:test";
import { editorCommandName, openInEditor, parseEditorCommand } from "./editor";

describe("editor command parsing", () => {
  test("splits editor commands with quoted and escaped arguments", () => {
    expect(parseEditorCommand(`"/Applications/Code App/code" --goto some\\ arg`)).toEqual([
      "/Applications/Code App/code",
      "--goto",
      "some arg",
    ]);
  });

  test("preserves backslashes in quoted editor paths", () => {
    expect(parseEditorCommand(`"C:\\Program Files\\Editor\\editor.exe" --wait`)).toEqual([
      "C:\\Program Files\\Editor\\editor.exe",
      "--wait",
    ]);
  });

  test("shows the resolved executable name", () => {
    expect(editorCommandName(`"code insiders" --reuse-window`)).toBe("code insiders");
  });
});

describe("openInEditor", () => {
  test("reports missing editor executables", async () => {
    const result = await openInEditor("file.ts", "diffgotchi-missing-editor-command");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to open editor 'diffgotchi-missing-editor-command'");
  });

  test("reports immediate editor startup failures", async () => {
    const result = await openInEditor(
      "file.ts",
      `${quoteArg(process.execPath)} -e "process.exit(7)"`,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("exit code 7");
  });
});

function quoteArg(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
