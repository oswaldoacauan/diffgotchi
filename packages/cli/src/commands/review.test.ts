import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import {
  buildReviewTarget,
  loadOrCreateReviewSession,
  loadReviewSession,
  saveActiveReviewSessionId,
} from "@/lib/review-comments";

const originalCwd = process.cwd();
const originalStateHome = process.env.DIFFGOTCHI_STATE_HOME;
const originalHome = process.env.HOME;
let tempDir: string | null = null;

afterEach(() => {
  process.chdir(originalCwd);
  if (originalStateHome === undefined) delete process.env.DIFFGOTCHI_STATE_HOME;
  else process.env.DIFFGOTCHI_STATE_HOME = originalStateHome;
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("review comments add", () => {
  test("creates an agent-authored comment anchored to the current diff", () => {
    const repo = enterTempGitRepo();
    writeFileSync(join(repo, "only.ts"), "export const value = 1;\n", "utf-8");
    git(repo, ["add", "."]);
    git(repo, [
      "-c",
      "user.email=test@example.com",
      "-c",
      "user.name=Test",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "initial",
    ]);
    writeFileSync(join(repo, "only.ts"), "export const value = 2;\n", "utf-8");

    const session = loadOrCreateReviewSession({
      branch: "main",
      target: buildReviewTarget({}),
      headSha: "abc123",
    });
    saveActiveReviewSessionId(session.id);

    const output = runDiffgotchi(repo, [
      "--json",
      "review",
      "comments",
      "add",
      "--file",
      "only.ts",
      "--new-line",
      "1",
      "--body",
      "Agent asks about the new value.",
    ]);

    const parsed = JSON.parse(output.stdout) as {
      ok: true;
      command: string;
      comment_id: string;
      comment: { author: string; location: { file: string; line: number } };
    };
    expect(parsed).toMatchObject({
      ok: true,
      command: "review.comments.add",
      comment: {
        author: "agent",
        location: { file: "only.ts", line: 1 },
      },
    });

    const saved = loadReviewSession(session.id);
    expect(saved?.comments).toHaveLength(1);
    expect(saved?.comments[0]).toMatchObject({
      id: parsed.comment_id,
      author: "agent",
      file: "only.ts",
      side: "new",
      newLine: 1,
      code: "export const value = 2;",
      body: "Agent asks about the new value.",
      status: "open",
    });
  });
});

function enterTempGitRepo(): string {
  tempDir = mkdtempSync(join(tmpdir(), "diffgotchi-review-cli-"));
  const repo = join(tempDir, "repo");
  process.env.DIFFGOTCHI_STATE_HOME = join(tempDir, "state");
  process.env.HOME = join(tempDir, "home");
  mkdirGitRepo(repo);
  process.chdir(repo);
  return repo;
}

function mkdirGitRepo(repo: string): void {
  const init = spawnSync("git", ["init", "-b", "main", repo], { stdio: "ignore" });
  if (init.status !== 0) throw new Error("failed to init temp git repo");
}

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd, stdio: "pipe" });
  if (result.status !== 0) {
    throw new Error(result.stderr.toString() || `git ${args.join(" ")} failed`);
  }
}

function runDiffgotchi(
  cwd: string,
  args: string[],
): {
  stdout: string;
  stderr: string;
} {
  const result = spawnSync("bun", [resolve(import.meta.dir, "../main.tsx"), ...args], {
    cwd,
    env: {
      ...process.env,
      DIFFGOTCHI_NO_UPDATE: "1",
      DIFFGOTCHI_STATE_HOME: process.env.DIFFGOTCHI_STATE_HOME,
      HOME: process.env.HOME,
    },
    stdio: "pipe",
  });
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  if (result.status !== 0) {
    throw new Error(
      [`diffgotchi exited ${result.status}`, stdout, stderr].filter(Boolean).join("\n"),
    );
  }
  return { stdout, stderr };
}
