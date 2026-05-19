import * as React from "react";
import { useTerminalDimensions } from "@opentui/react";
import type { RGBA } from "@opentui/core";
import { KeybindHint } from "@/components/ui/keybind-hint";

const SPARKLE_CHARS = "✦✧·⋆˚";

function sparkleLine(width: number, frame: number, seed: number): string {
  const line = Array(width).fill(" ");
  for (let i = 0; i < 3; i++) {
    const speed = 1 + (i % 2);
    const offset = seed + i * Math.floor(width / 3);
    const pos = Math.abs((offset + frame * speed) % width);
    line[pos] = SPARKLE_CHARS[(frame + i + seed) % SPARKLE_CHARS.length]!;
  }
  return line.join("");
}

export interface AllDoneScreenProps {
  fileCount: number;
  totalAdded: number;
  totalRemoved: number;
  branch?: string;
  successColor: string;
  errorColor: string;
  mutedColor: string;
  bgColor: RGBA;
}

export function AllDoneScreen({
  fileCount,
  totalAdded,
  totalRemoved,
  branch,
  successColor,
  errorColor,
  mutedColor,
  bgColor,
}: AllDoneScreenProps) {
  const [frame, setFrame] = React.useState(0);
  const { width } = useTerminalDimensions();
  const sparkleWidth = Math.min(width - 4, 36);

  React.useEffect(() => {
    const timer = setInterval(() => setFrame((f) => f + 1), 350);
    return () => clearInterval(timer);
  }, []);

  return (
    <box
      style={{
        flexDirection: "column",
        height: "100%",
        backgroundColor: bgColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <box style={{ flexDirection: "column", alignItems: "center" }}>
        <text fg={mutedColor}>{sparkleLine(sparkleWidth, frame, 0)}</text>
        <text fg={mutedColor}>{sparkleLine(sparkleWidth, frame, 7)}</text>
        <text> </text>
        <text fg={successColor} attributes={1}>
          ✓ All clear
        </text>
        <text> </text>
        <text fg={mutedColor}>
          {fileCount} file{fileCount === 1 ? "" : "s"} reviewed
        </text>
        <box style={{ flexDirection: "row" }}>
          <text fg={successColor}>+{totalAdded}</text>
          <text fg={mutedColor}> </text>
          <text fg={errorColor}>-{totalRemoved}</text>
          {branch ? <text fg={mutedColor}> {branch}</text> : null}
        </box>
        <text> </text>
        <text fg={mutedColor}>{sparkleLine(sparkleWidth, frame, 19)}</text>
        <text fg={mutedColor}>{sparkleLine(sparkleWidth, frame, 31)}</text>
        <text> </text>
        <box flexDirection="row">
          <KeybindHint command="diff.pick_file" />
          <text fg={mutedColor}> </text>
          <KeybindHint command="global.quit" />
        </box>
      </box>
    </box>
  );
}
