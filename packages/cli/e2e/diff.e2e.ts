import { expect, test } from "bun:test";
import { existsSync } from "fs";
import {
  createFullFixture,
  key,
  pilottyBin,
  resize,
  spawnDiffgotchi,
  textSnapshot,
  waitFor,
} from "./helpers";

test("diff: renders files, navigates hunks, scrolls, and survives resize", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createFullFixture();
  const session = await spawnDiffgotchi(fixture);

  await waitFor(session, "README-renamed.md");
  let screen = await textSnapshot(session);
  expect(screen).toContain("README-renamed.md");
  expect(screen).toContain("files");

  await key(session, "l");
  await waitFor(session, "a-main.ts");

  await key(session, "]");
  screen = await textSnapshot(session);
  expect(screen).toMatch(/@@|function footer/);

  await key(session, "[");
  await key(session, "j");
  await key(session, "k");
  await key(session, "PageDown");
  await key(session, "PageUp");
  await key(session, "End");
  await key(session, "Home");

  await resize(session, 72, 20);
  screen = await textSnapshot(session);
  expect(screen).toContain("a-main.ts");
}, 45_000);
