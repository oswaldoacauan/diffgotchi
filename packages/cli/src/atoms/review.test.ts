import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createStore } from "jotai";
import { addReviewCommentAtom, reviewSessionAtom } from "@/atoms/review";
import { loadReviewSession, saveReviewSession, type ReviewSession } from "@/lib/review-comments";

const originalCwd = process.cwd();
const originalStateHome = process.env.DIFFGOTCHI_STATE_HOME;
let tempDir: string | null = null;

afterEach(() => {
  process.chdir(originalCwd);
  if (originalStateHome === undefined) delete process.env.DIFFGOTCHI_STATE_HOME;
  else process.env.DIFFGOTCHI_STATE_HOME = originalStateHome;
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

function enterTempGitRepo(): void {
  tempDir = mkdtempSync(join(tmpdir(), "diffgotchi-review-"));
  process.env.DIFFGOTCHI_STATE_HOME = join(tempDir, "state");
  const init = spawnSync("git", ["init"], { cwd: tempDir, stdio: "ignore" });
  if (init.status !== 0) throw new Error("failed to init temp git repo");
  process.chdir(tempDir);
}

function session(input: Partial<ReviewSession> = {}): ReviewSession {
  return {
    schemaVersion: 1,
    id: "worktree-main-test",
    createdAt: "2026-05-10T09:00:00.000Z",
    updatedAt: "2026-05-10T10:00:00.000Z",
    branch: "main",
    target: { kind: "worktree" },
    headSha: "abc123",
    comments: [],
    ...input,
  };
}

describe("review atoms", () => {
  test("applies TUI mutations to the latest saved session", () => {
    enterTempGitRepo();

    const stale = session({
      comments: [
        {
          id: "cmt_existing",
          author: "user",
          file: "src/app.tsx",
          oldFile: null,
          side: "new",
          oldLine: null,
          newLine: 10,
          body: "Existing",
          status: "open",
          createdAt: "2026-05-10T09:30:00.000Z",
          updatedAt: "2026-05-10T09:30:00.000Z",
          diffHashAtCreate: 123,
        },
      ],
    });
    const latest = session({
      comments: [{ ...stale.comments[0]!, status: "resolved" }],
    });

    expect(saveReviewSession(latest).ok).toBe(true);

    const store = createStore();
    store.set(reviewSessionAtom, stale);
    store.set(addReviewCommentAtom, {
      id: "cmt_new",
      author: "user",
      file: "src/app.tsx",
      oldFile: null,
      side: "new",
      oldLine: null,
      newLine: 20,
      body: "New",
      diffHashAtCreate: 456,
    });

    const saved = loadReviewSession(stale.id);
    expect(saved?.comments).toHaveLength(2);
    expect(saved?.comments.find((comment) => comment.id === "cmt_existing")?.status).toBe(
      "resolved",
    );
    expect(saved?.comments.find((comment) => comment.id === "cmt_new")?.body).toBe("New");
  });
});
