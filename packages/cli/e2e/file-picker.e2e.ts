import { expect, test } from "bun:test";
import { existsSync } from "fs";
import {
  createFullFixture,
  key,
  pilottyBin,
  spawnDiffgotchi,
  textSnapshot,
  typeText,
  waitFor,
} from "./helpers";

test("file picker: searches files, toggles done, and selects a result", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createFullFixture();
  const session = await spawnDiffgotchi(fixture);

  await waitFor(session, "README-renamed.md");

  await key(session, "/");
  await waitFor(session, "Search files...");
  await typeText(session, "new");
  await waitFor(session, "b-new.ts");
  await key(session, "Ctrl+D");
  await waitFor(session, "1/4 done");
  await key(session, "Escape");

  await key(session, "/");
  await waitFor(session, "Search files...");
  await typeText(session, "long");
  await waitFor(session, "d-long.ts");
  await key(session, "Enter");
  await waitFor(session, "d-long.ts");

  const screen = await textSnapshot(session);
  expect(screen).toContain("d-long.ts");
  expect(screen).toContain("✓1/4");
}, 45_000);
