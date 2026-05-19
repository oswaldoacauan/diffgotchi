import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createFullFixture, key, pilottyBin, spawnDiffgotchi, typeText, waitFor } from "./helpers";

test("config: switches theme and exercises display setting keybinds", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createFullFixture();
  const session = await spawnDiffgotchi(fixture);

  await waitFor(session, "README-renamed.md");

  await key(session, "Ctrl+K t");
  await waitFor(session, "Search themes...");
  await typeText(session, "monokai");
  await waitFor(session, "monokai");
  await key(session, "Enter");
  expect(
    readFileSync(join(fixture.home, ".config", "diffgotchi", "config.json"), "utf-8"),
  ).toContain('"theme": "monokai"');

  await key(session, "m");
  await key(session, "b");
  await key(session, "i");
  await key(session, "u");
  await key(session, "g");
  await key(session, "w");
  await key(session, "x");
  await key(session, "v");

  await waitFor(session, "README-renamed.md");
}, 45_000);
