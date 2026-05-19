"use client";

import { AsciinemaPlayer } from "@/components/asciinema-player";
import { TerminalChrome } from "@/components/landing";

const FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

export function DemoTerminal({
  cast,
  label,
  fontSize = "1rem",
  className,
}: {
  cast: string;
  label: string;
  fontSize?: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-ctp-surface0 bg-ctp-mantle shadow-xl shadow-landing-text/10 ${className ?? ""}`}
    >
      <TerminalChrome label={label} />
      <AsciinemaPlayer
        src={cast}
        autoPlay
        loop
        preload
        controls={false}
        fit="width"
        terminalFontFamily={FONT_FAMILY}
        terminalFontSize={fontSize}
        idleTimeLimit={2}
      />
    </div>
  );
}
