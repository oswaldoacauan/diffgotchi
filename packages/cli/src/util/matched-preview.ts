import { fuzzyMatch } from "@/util/fuzzy-match";

export function formatMatchedPreview(
  text: string,
  needle: string,
  maxWidth: number,
): { text: string; matchIndices: number[] } {
  if (maxWidth <= 0) return { text: "", matchIndices: [] };
  if (!needle) return { text: truncateTextEnd(text, maxWidth), matchIndices: [] };

  const exactFullMatch = exactMatch(needle, text);
  const fullMatch = exactFullMatch ?? fuzzyMatch(needle, text);
  if (!fullMatch) return { text: truncateTextEnd(text, maxWidth), matchIndices: [] };

  const head = truncateTextEnd(text, maxWidth);
  const headMatch = exactFullMatch ? exactMatch(needle, head) : fuzzyMatch(needle, head);
  if (headMatch) return { text: head, matchIndices: headMatch };

  const firstMatch = fullMatch[0] ?? 0;
  const lastMatch = fullMatch[fullMatch.length - 1] ?? firstMatch;
  const needsPrefix = firstMatch > 0;
  const needsSuffix = lastMatch < text.length - 1;
  const markerWidth = (needsPrefix ? 1 : 0) + (needsSuffix ? 1 : 0);
  const sliceWidth = Math.max(1, maxWidth - markerWidth);
  const matchWidth = lastMatch - firstMatch + 1;
  const leadingContext = Math.max(0, Math.floor((sliceWidth - matchWidth) / 2));
  const start = Math.max(0, Math.min(firstMatch - leadingContext, text.length - sliceWidth));
  const end = Math.min(text.length, start + sliceWidth);
  const preview = `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;

  return {
    text: preview,
    matchIndices: exactMatch(needle, preview) ?? fuzzyMatch(needle, preview) ?? [],
  };
}

function exactMatch(needle: string, text: string): number[] | null {
  const normalizedNeedle = needle.trim().toLowerCase();
  if (!normalizedNeedle) return [];

  const start = text.toLowerCase().indexOf(normalizedNeedle);
  if (start < 0) return null;

  return Array.from({ length: normalizedNeedle.length }, (_, i) => start + i);
}

function truncateTextEnd(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  if (maxWidth <= 1) return text.slice(0, maxWidth);
  return `${text.slice(0, maxWidth - 1)}…`;
}
