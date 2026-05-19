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

test("commands: opens palette actions and help dialogs", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createFullFixture();
  const session = await spawnDiffgotchi(fixture);

  await waitFor(session, "README-renamed.md");

  await key(session, "Ctrl+P");
  await waitFor(session, "Commands");
  await typeText(session, "line numbers");
  await waitFor(session, "Line numbers");
  await key(session, "Enter");

  await key(session, "?");
  await waitFor(session, "Keybinds");
  await key(session, "Escape");

  await key(session, "Ctrl+P");
  await waitFor(session, "Commands");
  await typeText(session, "about");
  await waitFor(session, "About");
  await key(session, "Enter");
  await waitFor(session, "Version");

  const screen = await textSnapshot(session);
  expect(screen).toContain("Version");
}, 45_000);
