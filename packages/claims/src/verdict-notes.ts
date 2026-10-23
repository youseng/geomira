/**
 * The phrases a verdict adds to its counts (internal; shared by verdict.ts and verdict-line.ts):
 *   - the selector an ORIENTATION-DEPENDENT verdict names, as the user wrote it;
 * The words reserved for the Phase 2 prover never appear.
 */
import type { NamedSelector } from './verdict';

/** "X's `orient(+)`", or "the claim's `intersect(…, orient(+))`" for a selector in the claim. */
export function selectorPhrase(named: NamedSelector): string {
  return named.inClaim === true
    ? `the claim's \`${named.call}\``
    : `${named.object}'s \`${named.selector}\``;
}
