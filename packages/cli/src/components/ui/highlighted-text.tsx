import * as React from "react";
import { TextAttributes } from "@opentui/core";

export function HighlightedText({
  text: content,
  indices,
  fg,
  highlightFg,
}: {
  text: string;
  indices: number[];
  fg: string;
  highlightFg: string;
}) {
  if (indices.length === 0) return <span style={{ fg }}>{content}</span>;

  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const idx of indices) {
    if (idx > last) parts.push(<span style={{ fg }}>{content.slice(last, idx)}</span>);
    parts.push(
      <span style={{ fg: highlightFg }} attributes={TextAttributes.BOLD}>
        {content[idx]}
      </span>,
    );
    last = idx + 1;
  }
  if (last < content.length) parts.push(<span style={{ fg }}>{content.slice(last)}</span>);
  return <>{parts}</>;
}
