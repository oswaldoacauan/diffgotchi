import * as React from "react";
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useAtomValue } from "jotai/react";
import { resolvedThemeAtom } from "@/atoms/derived";
import { BUILD_META } from "@/lib/update";
import { loadConfig } from "@/lib/config";

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { theme } = useAtomValue(resolvedThemeAtom);
  const config = React.useMemo(() => loadConfig(), []);
  const channel = config.upgrade.channel ?? BUILD_META.channel;

  useKeyboard((key) => {
    if (key.ctrl || key.meta || key.option) return;
    key.stopPropagation?.();
    onClose();
  });

  const rows: [string, string][] = [
    ["Version", BUILD_META.version],
    ["Channel", channel],
    ["Platform", `${process.platform}-${process.arch}`],
    ["Runtime", `Bun ${process.versions.bun ?? "N/A"}`],
    ["Auto-upgrade", config.upgrade.auto ? "on" : "off"],
    ["Repo", `github.com/${BUILD_META.repo}`],
  ];

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text} attributes={TextAttributes.BOLD}>
        diffgotchi
      </text>
      <box flexDirection="column">
        {rows.map(([label, value]) => (
          <box key={label} flexDirection="row" gap={1}>
            <text fg={theme.textMuted} width={14}>
              {label}
            </text>
            <text fg={theme.text}>{value}</text>
          </box>
        ))}
      </box>
      <text fg={theme.textMuted}>Press any key to close</text>
    </box>
  );
}
