/**
 * The phrases a verdict adds to its counts (internal; shared by verdict.ts and verdict-line.ts):
 *   - the selector an ORIENTATION-DEPENDENT verdict names, as the user wrote it;
 *   - the samples the hypotheses rejected (ADR-0008 decision 14);
 * The words reserved for the Phase 2 prover never appear.
 */
import type { NamedSelector } from './verdict';

export function rejectedNote(rejected: number): string[] {
  return rejected === 0 ? [] : [`${String(rejected)} samples rejected by hypotheses`];
}

/** "X's `orient(+)`", or "the claim's `intersect(…, orient(+))`" for a selector in the claim. */
export function selectorPhrase(named: NamedSelector): string {
  return named.inClaim === true
    ? `the claim's \`${named.call}\``
    : `${named.object}'s \`${named.selector}\``;
}
