export function fuzzyMatchSingle(needle: string, haystack: string, start: number): number[] | null {
  const indices: number[] = [];
  let ni = 0;
  for (let hi = start; hi < haystack.length && ni < needle.length; hi++) {
    if (haystack[hi] === needle[ni]) {
      indices.push(hi);
      ni++;
    }
  }
  return ni === needle.length ? indices : null;
}

export function fuzzyMatch(needle: string, haystack: string): number[] | null {
  const hLower = haystack.toLowerCase();
  const words = needle.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const allIndices: number[] = [];
  let pos = 0;
  for (const word of words) {
    const indices = fuzzyMatchSingle(word, hLower, pos);
    if (!indices) return null;
    allIndices.push(...indices);
    pos = indices[indices.length - 1]! + 1;
  }
  return allIndices;
}
