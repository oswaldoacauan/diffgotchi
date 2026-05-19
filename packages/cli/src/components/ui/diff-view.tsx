import * as React from "react";
import { SyntaxStyle, type DiffRenderable, type MouseEvent } from "@opentui/core";
import { getSyntaxTheme, getResolvedTheme, rgbaToHex } from "@/lib/themes";
import type { Indicators } from "@/atoms/display";

export interface DiffViewProps {
  diff: string;
  view: "split" | "unified";
  filetype?: string;
  themeName: string;
  wrapMode?: "word" | "char" | "none";
  showLineNumbers?: boolean;
  backgrounds?: boolean;
  highlightInline?: boolean;
  indicators?: Indicators;
  selectedLineIndex?: number;
  selectedLineSide?: "left" | "right" | "both";
  selectedOldLine?: number | null;
  selectedNewLine?: number | null;
  selectedLineKind?: "add" | "remove" | "context";
  selectedLineBg?: string;
  onMouseDown?: (event: MouseEvent) => void;
}

export function DiffView({
  diff,
  view,
  filetype,
  themeName,
  wrapMode = "word",
  showLineNumbers = true,
  backgrounds = true,
  highlightInline = true,
  indicators = "classic",
  selectedLineIndex,
  selectedLineSide = "both",
  selectedOldLine,
  selectedNewLine,
  selectedLineKind,
  selectedLineBg = "#264F78",
  onMouseDown,
}: DiffViewProps) {
  const diffRef = React.useRef<DiffRenderable | null>(null);
  const previousSelectedLineRef = React.useRef<HighlightTarget[] | null>(null);
  const resolvedTheme = React.useMemo(() => getResolvedTheme(themeName), [themeName]);

  const syntaxStyle = React.useMemo(
    () => SyntaxStyle.fromStyles(getSyntaxTheme(themeName)),
    [themeName],
  );

  const colors = React.useMemo(() => {
    const bgPanel = rgbaToHex(resolvedTheme.backgroundPanel);
    const addedBg = rgbaToHex(resolvedTheme.diffAddedBg);
    const removedBg = rgbaToHex(resolvedTheme.diffRemovedBg);

    return {
      text: rgbaToHex(resolvedTheme.text),
      bgPanel,
      addedBg: backgrounds ? addedBg : bgPanel,
      removedBg: backgrounds ? removedBg : bgPanel,
      addedContentBg: backgrounds && highlightInline ? addedBg : bgPanel,
      removedContentBg: backgrounds && highlightInline ? removedBg : bgPanel,
      lineNumber: rgbaToHex(resolvedTheme.diffLineNumber),
      addedLineNumberBg: rgbaToHex(resolvedTheme.diffAddedLineNumberBg),
      removedLineNumberBg: rgbaToHex(resolvedTheme.diffRemovedLineNumberBg),
      addedSign: indicators === "classic" ? rgbaToHex(resolvedTheme.success) : bgPanel,
      removedSign: indicators === "classic" ? rgbaToHex(resolvedTheme.error) : bgPanel,
    };
  }, [resolvedTheme, backgrounds, highlightInline, indicators]);

  React.useEffect(() => {
    const diffNode = diffRef.current;
    if (!diffNode) return;

    if (previousSelectedLineRef.current != null) {
      for (const target of previousSelectedLineRef.current) {
        restoreHighlightTarget(diffNode, target, diff, colors);
      }
    }

    if (selectedLineIndex != null) {
      const targets = getHighlightTargets(diffNode, {
        diff,
        view,
        line: selectedLineIndex,
        side: selectedLineSide,
        oldLine: selectedOldLine,
        newLine: selectedNewLine,
        kind: selectedLineKind,
      });
      for (const target of targets) {
        highlightDiffLine(diffNode, target, selectedLineBg);
      }
      previousSelectedLineRef.current = targets;
    } else {
      previousSelectedLineRef.current = null;
    }
  }, [
    colors,
    diff,
    selectedLineBg,
    selectedLineIndex,
    selectedLineKind,
    selectedLineSide,
    selectedNewLine,
    selectedOldLine,
    view,
  ]);

  return (
    <box
      key={themeName}
      backgroundColor={colors.bgPanel}
      paddingLeft={showLineNumbers ? 0 : 1}
      onMouseDown={onMouseDown}
    >
      <diff
        ref={diffRef}
        diff={diff}
        view={view}
        fg={colors.text}
        filetype={filetype}
        syntaxStyle={syntaxStyle}
        showLineNumbers={showLineNumbers}
        wrapMode={wrapMode}
        addedBg={colors.addedBg}
        removedBg={colors.removedBg}
        contextBg={colors.bgPanel}
        addedContentBg={colors.addedContentBg}
        removedContentBg={colors.removedContentBg}
        contextContentBg={colors.bgPanel}
        lineNumberFg={colors.lineNumber}
        lineNumberBg={colors.bgPanel}
        addedLineNumberBg={colors.addedLineNumberBg}
        removedLineNumberBg={colors.removedLineNumberBg}
        addedSignColor={colors.addedSign}
        removedSignColor={colors.removedSign}
        selectionBg="#264F78"
        selectionFg="#FFFFFF"
      />
    </box>
  );
}

type HighlightTarget = {
  view: "split" | "unified";
  line: number;
  side: "left" | "right" | "both";
  kind: SplitLineKind | null;
};

function getHighlightTargets(
  diffNode: DiffRenderable,
  {
    diff,
    view,
    line,
    side,
    oldLine,
    newLine,
    kind,
  }: {
    diff: string;
    view: "split" | "unified";
    line: number;
    side: "left" | "right" | "both";
    oldLine?: number | null;
    newLine?: number | null;
    kind?: SplitLineKind;
  },
): HighlightTarget[] {
  if (view !== "split") return [{ view, line, side: "both", kind: null }];

  const rowKinds = getSplitLineKinds(diff, line);
  if (side !== "both") {
    return [
      {
        view,
        line: getRenderedSplitLineIndex(diffNode, side, side === "left" ? oldLine : newLine, line),
        side,
        kind: kind ?? rowKinds?.[side] ?? null,
      },
    ];
  }

  return [
    {
      view,
      line: getRenderedSplitLineIndex(diffNode, "left", oldLine, line),
      side: "left",
      kind: kind ?? rowKinds?.left ?? null,
    },
    {
      view,
      line: getRenderedSplitLineIndex(diffNode, "right", newLine, line),
      side: "right",
      kind: kind ?? rowKinds?.right ?? null,
    },
  ];
}

function highlightDiffLine(diffNode: DiffRenderable, target: HighlightTarget, color: string) {
  if (target.view === "split" && target.side !== "both") {
    const splitSide =
      target.side === "left" ? (diffNode as any).leftSide : (diffNode as any).rightSide;
    splitSide?.setLineColor?.(target.line, { gutter: color, content: color });
    return;
  }

  diffNode.highlightLines(target.line, target.line, color);
}

function restoreHighlightTarget(
  diffNode: DiffRenderable,
  target: HighlightTarget,
  diff: string,
  colors: DiffLineColors,
) {
  if (target.view === "split" && target.side !== "both") {
    const splitSide =
      target.side === "left" ? (diffNode as any).leftSide : (diffNode as any).rightSide;
    restoreSideLineColor(splitSide, target.line, target.kind ?? "empty", colors);
    return;
  }

  restoreDiffLineColor(diffNode, {
    diff,
    view: target.view,
    line: target.line,
    colors,
  });
}

function getRenderedSplitLineIndex(
  diffNode: DiffRenderable,
  side: "left" | "right",
  lineNumber: number | null | undefined,
  fallback: number,
): number {
  if (lineNumber == null) return fallback;

  const splitSide = side === "left" ? (diffNode as any).leftSide : (diffNode as any).rightSide;
  const lineNumbers =
    typeof splitSide?.getLineNumbers === "function"
      ? (splitSide.getLineNumbers() as Map<number, number>)
      : null;
  if (!lineNumbers) return fallback;

  for (const [line, value] of lineNumbers) {
    if (value === lineNumber) return line;
  }
  return fallback;
}

type DiffLineColors = {
  bgPanel: string;
  addedContentBg: string;
  removedContentBg: string;
  addedLineNumberBg: string;
  removedLineNumberBg: string;
};

type LineColorConfig = { gutter: string; content: string };
type SplitLineKind = "add" | "remove" | "context" | "empty";

function restoreDiffLineColor(
  diffNode: DiffRenderable,
  {
    diff,
    view,
    line,
    colors,
  }: {
    diff: string;
    view: "split" | "unified";
    line: number;
    colors: DiffLineColors;
  },
) {
  if (view === "split") {
    const row = getSplitLineKinds(diff, line);
    restoreSideLineColor((diffNode as any).leftSide, line, row?.left ?? "empty", colors);
    restoreSideLineColor((diffNode as any).rightSide, line, row?.right ?? "empty", colors);
    return;
  }

  const marker = getUnifiedLineMarker(diff, line);
  const color = getLineColorConfig(markerToLineKind(marker), colors);
  if (color) {
    diffNode.setLineColor(line, color);
  } else {
    diffNode.clearLineColor(line);
  }
}

function restoreSideLineColor(
  side:
    | {
        setLineColor?: (line: number, color: LineColorConfig) => void;
        clearLineColor?: (line: number) => void;
      }
    | null
    | undefined,
  line: number,
  kind: SplitLineKind,
  colors: DiffLineColors,
) {
  const color = getLineColorConfig(kind, colors);
  if (color) {
    side?.setLineColor?.(line, color);
  } else {
    side?.clearLineColor?.(line);
  }
}

function getLineColorConfig(
  kind: SplitLineKind | null,
  colors: DiffLineColors,
): LineColorConfig | null {
  if (kind === "add") {
    return { gutter: colors.addedLineNumberBg, content: colors.addedContentBg };
  }
  if (kind === "remove") {
    return { gutter: colors.removedLineNumberBg, content: colors.removedContentBg };
  }
  if (kind === "context") {
    return { gutter: colors.bgPanel, content: colors.bgPanel };
  }
  return null;
}

function markerToLineKind(marker: string | null): SplitLineKind | null {
  if (marker === "+") return "add";
  if (marker === "-") return "remove";
  if (marker === " ") return "context";
  return null;
}

function getUnifiedLineMarker(diff: string, line: number): string | null {
  return getDiffBodyLines(diff)[line]?.[0] ?? null;
}

function getSplitLineKinds(
  diff: string,
  line: number,
): { left: SplitLineKind; right: SplitLineKind } | null {
  const rows: Array<{ left: SplitLineKind; right: SplitLineKind }> = [];
  const lines = getDiffBodyLines(diff);
  let i = 0;

  while (i < lines.length) {
    const marker = lines[i]?.[0];

    if (marker === " ") {
      rows.push({ left: "context", right: "context" });
      i++;
      continue;
    }

    if (marker === "\\") {
      i++;
      continue;
    }

    const removes: string[] = [];
    const adds: string[] = [];
    while (i < lines.length) {
      const currentMarker = lines[i]?.[0];
      if (currentMarker === " " || currentMarker === "\\") break;
      if (currentMarker === "-") removes.push(lines[i]!);
      if (currentMarker === "+") adds.push(lines[i]!);
      i++;
    }

    const rowCount = Math.max(removes.length, adds.length);
    for (let row = 0; row < rowCount; row++) {
      rows.push({
        left: removes[row] ? "remove" : "empty",
        right: adds[row] ? "add" : "empty",
      });
    }
  }

  return rows[line] ?? null;
}

function getDiffBodyLines(diff: string): string[] {
  return diff.split("\n").filter((line) => {
    if (!line) return false;
    if (line.startsWith("@@")) return false;
    if (line.startsWith("diff --git ")) return false;
    if (line.startsWith("index ")) return false;
    if (line.startsWith("--- ")) return false;
    if (line.startsWith("+++ ")) return false;
    return ["+", "-", " ", "\\"].includes(line[0]!);
  });
}
