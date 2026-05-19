import { expect, test } from "bun:test";
import { existsSync } from "fs";
import {
  createCommittedRangeFixture,
  createFullFixture,
  createStagedFixture,
  pilottyBin,
  spawnDiffgotchi,
  textSnapshot,
  waitFor,
} from "./helpers";

test("cli modes: shows only staged changes with --staged", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createStagedFixture();
  const session = await spawnDiffgotchi(fixture, { args: ["--staged"] });

  await waitFor(session, "staged.ts");
  const screen = await textSnapshot(session);
  expect(screen).toContain("staged.ts");
  expect(screen).not.toContain("unstaged.ts");
}, 30_000);

test("cli modes: filters worktree diffs by file pattern", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createFullFixture();
  const session = await spawnDiffgotchi(fixture, { args: ["--filter", "d-long.ts"] });

  await waitFor(session, "d-long.ts");
  const screen = await textSnapshot(session);
  expect(screen).toContain("d-long.ts");
  expect(screen).not.toContain("README-renamed.md");
}, 30_000);

test("cli modes: renders explicit base/head comparisons", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createCommittedRangeFixture();
  const session = await spawnDiffgotchi(fixture, { args: ["HEAD~1", "HEAD"] });

  await waitFor(session, "range.ts");
  const screen = await textSnapshot(session);
  expect(screen).toContain("range.ts");
  expect(screen).toContain("after");
}, 30_000);

test("cli modes: respects explicit context lines", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createFullFixture();
  const session = await spawnDiffgotchi(fixture, { context: 0, args: ["--filter", "a-main.ts"] });

  await waitFor(session, "a-main.ts");
  const screen = await textSnapshot(session);
  expect(screen).toContain("a-main.ts");
  expect(screen).not.toContain("export function greet");
}, 30_000);
