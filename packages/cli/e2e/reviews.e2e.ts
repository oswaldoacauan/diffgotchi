import { expect, test } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import {
  createSingleFileFixture,
  clickText,
  key,
  pilottyBin,
  repoRoot,
  spawnDiffgotchi,
  textSnapshot,
  typeText,
  waitFor,
} from "./helpers";

test("reviews: creates, lists, resolves, and completes a one-file review", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createSingleFileFixture();
  const session = await spawnDiffgotchi(fixture);

  await waitFor(session, "only.ts");
  let screen = await textSnapshot(session);
  expect(screen).toContain("only.ts");

  await key(session, "c");
  await waitFor(session, "Add a comment...");
  await typeText(session, "Discard me");
  await key(session, "Escape");
  await waitFor(session, "again discard");
  await key(session, "Escape");

  await key(session, "c");
  await waitFor(session, "Add a comment...");
  await typeText(session, "Review comment survives list");
  await key(session, "Ctrl+J");
  await waitFor(session, "Review comment survives list");

  await clickText(session, "Review comment survives list");
  await waitFor(session, "delete");
  await key(session, "End");
  await typeText(session, " updated");
  await key(session, "Ctrl+J");
  await waitFor(session, "updated");

  await key(session, "Ctrl+K r");
  await waitFor(session, "Comments");
  screen = await textSnapshot(session);
  expect(screen).toContain("updated");

  await key(session, "Ctrl+R");
  await key(session, "Ctrl+K r");
  await waitFor(session, "0 open");
  await key(session, "Escape");

  await key(session, "d");
  await waitFor(session, "1 file reviewed");
  screen = await textSnapshot(session);
  expect(screen).toContain("1 file reviewed");
}, 30_000);

test("reviews: deletes a comment from the comments list", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createSingleFileFixture();
  const session = await spawnDiffgotchi(fixture);

  await waitFor(session, "only.ts");

  await key(session, "c");
  await waitFor(session, "Add a comment...");
  await typeText(session, "Delete this review comment");
  await key(session, "Ctrl+J");
  await waitFor(session, "Delete this review comment");

  await key(session, "Ctrl+K r");
  await waitFor(session, "Comments");
  await key(session, "Ctrl+X");
  await key(session, "Ctrl+K r");
  await waitFor(session, "0 open");
}, 30_000);

test("reviews: TUI auto-updates when external agent resolves and adds comments", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createSingleFileFixture();
  const session = await spawnDiffgotchi(fixture);

  await waitFor(session, "only.ts");

  await key(session, "c");
  await waitFor(session, "Add a comment...");
  await typeText(session, "User flagged this line");
  await key(session, "Ctrl+J");
  await waitFor(session, "User flagged this line");

  const initial = JSON.parse(
    runDiffgotchi(fixture, [
      "--json",
      "review",
      "comments",
      "list",
      "--session",
      session,
      "--status",
      "all",
    ]).stdout,
  ) as { comments: Array<{ id: string; author: string }> };
  const userComment = initial.comments.find((comment) => comment.author === "user");
  expect(userComment, "user comment should be persisted to disk").toBeDefined();

  runDiffgotchi(fixture, [
    "--json",
    "review",
    "comments",
    "done",
    userComment!.id,
    "--session",
    session,
    "--reply",
    "Agent acknowledges and resolves",
  ]);

  runDiffgotchi(fixture, [
    "--json",
    "review",
    "comments",
    "add",
    "--session",
    session,
    "--file",
    "only.ts",
    "--new-line",
    "1",
    "--body",
    "Agent raises a follow-up concern",
  ]);

  await waitFor(session, "Agent raises a follow-up concern");
  await waitFor(session, "agent · open");

  await key(session, "Ctrl+K r");
  await waitFor(session, "Comments");
  await waitFor(session, "1 open · 1 done");
  await waitFor(session, "reply: Agent acknowledges");
  await key(session, "Escape");

  const final = JSON.parse(
    runDiffgotchi(fixture, [
      "--json",
      "review",
      "comments",
      "list",
      "--session",
      session,
      "--status",
      "all",
    ]).stdout,
  ) as {
    comments: Array<{
      author: string;
      status: string;
      body: string;
      replies?: Array<{ author: string; body: string }>;
    }>;
  };

  expect(final.comments).toHaveLength(2);
  expect(final.comments[0]).toMatchObject({
    author: "user",
    status: "resolved",
    body: "User flagged this line",
    replies: [{ author: "agent", body: "Agent acknowledges and resolves" }],
  });
  expect(final.comments[1]).toMatchObject({
    author: "agent",
    status: "open",
    body: "Agent raises a follow-up concern",
  });
}, 30_000);

test("reviews: shows agent CLI comments and lets the user reply", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createSingleFileFixture();
  const session = await spawnDiffgotchi(fixture);

  await waitFor(session, "only.ts");
  runDiffgotchi(fixture, [
    "--json",
    "review",
    "comments",
    "add",
    "--session",
    session,
    "--file",
    "only.ts",
    "--new-line",
    "1",
    "--body",
    "Agent asks from CLI",
  ]);

  await waitFor(session, "Agent asks from CLI");
  await clickText(session, "Agent asks from CLI");
  await waitFor(session, "Reply to agent...");
  await typeText(session, "User answers in TUI");
  await key(session, "Ctrl+J");
  await waitFor(session, "User answers in TUI");

  const list = JSON.parse(
    runDiffgotchi(fixture, [
      "--json",
      "review",
      "comments",
      "list",
      "--session",
      session,
      "--status",
      "all",
    ]).stdout,
  ) as { comments: Array<{ author: string; replies?: Array<{ author: string; body: string }> }> };

  expect(list.comments[0]).toMatchObject({
    author: "agent",
    replies: [{ author: "user", body: "User answers in TUI" }],
  });
}, 30_000);

function runDiffgotchi(
  fixture: { repo: string; home: string; state: string },
  args: string[],
): { stdout: string; stderr: string } {
  const result = Bun.spawnSync({
    cmd: ["bun", join(repoRoot, "packages", "cli", "src", "main.tsx"), ...args],
    cwd: fixture.repo,
    env: {
      ...process.env,
      HOME: fixture.home,
      DIFFGOTCHI_STATE_HOME: fixture.state,
      DIFFGOTCHI_NO_UPDATE: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(result.stdout);
  const stderr = new TextDecoder().decode(result.stderr);
  if (result.exitCode !== 0) {
    throw new Error(
      [`diffgotchi failed with ${result.exitCode}`, stdout.trim(), stderr.trim()]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return { stdout, stderr };
}
