/** "Did you mean …?" suggestions: the closest candidate within a small edit distance. */

/** Levenshtein distance (insert, delete, substitute), by code units. */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur.push(Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost));
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/**
 * The candidate closest to `word` (ties: the first), if it is within distance 1 for words
 * of three or four characters and 2 for longer ones; undefined when nothing is that close
 * (and always for one- or two-character words, where any name is "close").
 */
export function suggest(word: string, candidates: readonly string[]): string | undefined {
  if (word.length <= 2) return undefined;
  const limit = word.length <= 4 ? 1 : 2;
  let best: string | undefined;
  let bestD = limit + 1;
  for (const c of candidates) {
    const d = editDistance(word, c);
    if (d < bestD && c !== word) {
      best = c;
      bestD = d;
    }
  }
  return best;
}
