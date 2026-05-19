export function truncatePath(path: string, maxWidth: number): string {
  if (path.length <= maxWidth) return path;
  const ellipsis = "…";
  const available = maxWidth - ellipsis.length;
  if (available <= 0) return path.slice(-maxWidth);

  const tail = path.slice(-available);
  const slashIdx = tail.indexOf("/");
  if (slashIdx >= 0 && slashIdx < tail.length - 1) {
    return ellipsis + tail.slice(slashIdx);
  }
  return ellipsis + tail;
}
