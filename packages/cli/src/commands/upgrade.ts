import { goke } from "goke";
import { BUILD_META } from "@/lib/update";

export function createUpgradeCommands() {
  const cli = goke();

  cli
    .command("upgrade", "Update diffgotchi to the latest version")
    .option("--channel <channel>", "Update channel: stable or edge")
    .action(async (options: { channel?: string }) => {
      const { loadConfig } = await import("@/lib/config");
      const { checkForUpdate } = await import("@/lib/update");
      const { performUpgrade } = await import("@/lib/update");

      const config = loadConfig();
      const channel =
        (options.channel as "stable" | "edge") ?? config.upgrade.channel ?? BUILD_META.channel;

      console.log(`Checking for updates on ${channel} channel...`);
      const info = await checkForUpdate(BUILD_META.version, { channel, force: true });

      if (!info?.available) {
        console.log(`Already on latest: ${BUILD_META.version}`);
        process.exit(0);
      }

      console.log(`Upgrading: ${info.current} -> ${info.latest}`);
      await performUpgrade(info);
      console.log("Done. Restart diffgotchi to use the new version.");
    });

  return cli;
}
