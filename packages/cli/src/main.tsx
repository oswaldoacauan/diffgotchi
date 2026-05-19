#!/usr/bin/env bun

import { goke } from "goke";
import { createReviewCommands } from "@/commands/review";
import { createTuiCommands } from "@/commands/tui";
import { createUpgradeCommands } from "@/commands/upgrade";
import { BUILD_META } from "@/lib/update";

const cli = goke("diffgotchi").option("--json", "Emit JSON output for agent commands");

function getVersion(): string {
  return BUILD_META.version;
}

cli.use(createTuiCommands());
cli.use(createReviewCommands());
cli.use(createUpgradeCommands());

if (import.meta.main) {
  cli.help();
  cli.version(getVersion());
  cli.parse();
}
