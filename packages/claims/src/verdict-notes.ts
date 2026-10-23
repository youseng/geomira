/**
 * The phrases a verdict adds to its counts (internal; shared by verdict.ts and verdict-line.ts):
 *   - the selector an ORIENTATION-DEPENDENT verdict names, as the user wrote it;
 *   - figures that were not valid (undefined, degenerate, ambiguous, ill-conditioned or an
 *     invalid claim), whenever there are any, so "100/100" never hides 100 undefined figures;
 *   - the samples the hypotheses rejected (ADR-0008 decision 14);
 * The words reserved for the Phase 2 prover never appear.
 */
import type { NamedSelector } from './verdict';

/** The not-valid outcome counts of a tally. */
export interface InvalidCounts {
  readonly degenerate: number;
  readonly undefined: number;
  readonly ambiguous: number;
  readonly illConditioned: number;
  readonly invalid: number;
}

const WORDS: readonly (readonly [keyof InvalidCounts, string])[] = [
  ['undefined', 'undefined'],
  ['degenerate', 'degenerate'],
  ['ambiguous', 'ambiguous'],
  ['illConditioned', 'ill-conditioned'],
  ['invalid', 'invalid'],
];

function invalidTotal(t: InvalidCounts): number {
  return t.degenerate + t.undefined + t.ambiguous + t.illConditioned + t.invalid;
}

/** "100 of 200 figures undefined or ambiguous", or nothing when every figure was valid. */
export function invalidNote(t: InvalidCounts, tested: number): string[] {
  const total = invalidTotal(t);
  if (total === 0) return [];
  const words = WORDS.filter(([k]) => t[k] > 0).map(([, w]) => w);
  const last = words.pop() ?? 'not valid';
  const what = words.length === 0 ? last : `${words.join(', ')} or ${last}`;
  return [`${String(total)} of ${String(tested)} figures ${what}`];
}

export function rejectedNote(rejected: number): string[] {
  return rejected === 0 ? [] : [`${String(rejected)} samples rejected by hypotheses`];
}

/** "X's `orient(+)`", or "the claim's `intersect(…, orient(+))`" for a selector in the claim. */
export function selectorPhrase(named: NamedSelector): string {
  return named.inClaim === true
    ? `the claim's \`${named.call}\``
    : `${named.object}'s \`${named.selector}\``;
}

/** What failed and holds once flipped: false figures, and undefined ones (law L16). */
export function repairedText(f: number, valid: number, u: number): string {
  const parts = [
    ...(f > 0 ? [`${String(f)} of ${String(valid)} fail and hold with the selectors flipped`] : []),
    ...(u > 0 ? [`${String(u)} undefined figures hold with the selectors flipped`] : []),
  ];
  return parts.join('; ');
}
