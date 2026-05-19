import { expect, test } from "bun:test";
import { existsSync } from "fs";
import {
  createSingleFileFixture,
  pilottyBin,
  spawnDiffgotchi,
  textSnapshot,
  waitFor,
} from "./helpers";

test("states: renders an error screen for an invalid commit ref", async () => {
  expect(existsSync(pilottyBin), "Run `bun install` before `bun run test:e2e`.").toBe(true);

  const fixture = createSingleFileFixture();
  const session = await spawnDiffgotchi(fixture, { args: ["--commit", "definitely-missing-ref"] });

  await waitFor(session, "Error loading diff");
  const screen = await textSnapshot(session);
  expect(screen).toContain("Error loading diff");
  expect(screen).toContain("definitely-missing-ref");
}, 30_000);
