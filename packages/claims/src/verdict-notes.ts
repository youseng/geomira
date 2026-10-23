/**
 * The phrases a verdict adds to its counts (internal; shared by verdict.ts and verdict-line.ts):
 *   - the selector an ORIENTATION-DEPENDENT verdict names, as the user wrote it;
 *   - figures that were not valid (undefined, degenerate, ambiguous, ill-conditioned or an
 *     invalid claim), whenever there are any, so "100/100" never hides 100 undefined figures;
 *   - the samples the hypotheses rejected (ADR-0008 decision 14);
 *   - a shortfall that comes from MIRRORING rather than from the hypotheses: figures of one
 *     orientation rarely satisfy them because the construction fixes an orientation (a
 *     rotation by a literal angle, orient(±)), while the other orientation is easy;
 *   - the samplers' frame: no random similarity, or no mirroring, and why (frame.ts).
 * The words reserved for the Phase 2 prover never appear.
 */
import { HARD_ACCEPTANCE } from './constants';
import type { SamplerFrame } from './frame';
import type { Regime } from './sampler';

/** The not-valid outcome counts of a tally. */
export interface InvalidCounts {
  readonly degenerate: number;
  readonly undefined: number;
  readonly ambiguous: number;
  readonly illConditioned: number;
  readonly invalid: number;
}

/** Attempts and accepted (tested) figures of one orientation. */
export interface ParityCount {
  readonly attempts: number;
  readonly accepted: number;
}

/** The global regime's attempts per orientation (mirrored or not). */
export interface ParityStats {
  readonly unmirrored: ParityCount;
  readonly mirrored: ParityCount;
}

export type Parity = keyof ParityStats;

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

function rate(p: ParityCount): number {
  return p.attempts === 0 ? 1 : p.accepted / p.attempts;
}

/**
 * The orientation whose figures rarely satisfy the hypotheses while the other one's do, or
 * undefined (both easy, both hard, or no mirrored attempt).
 */
export function hardParity(stats: ParityStats | undefined): Parity | undefined {
  if (stats === undefined || stats.mirrored.attempts === 0) return undefined;
  const [m, u] = [rate(stats.mirrored) < HARD_ACCEPTANCE, rate(stats.unmirrored) < HARD_ACCEPTANCE];
  if (m === u) return undefined;
  return m ? 'mirrored' : 'unmirrored';
}

/** The note naming mirroring as the cause of a low acceptance. */
export function parityNote(stats: ParityStats, hard: Parity): string {
  const easy: Parity = hard === 'mirrored' ? 'unmirrored' : 'mirrored';
  const count = (p: Parity) =>
    `${String(stats[p].accepted)} of ${String(stats[p].attempts)} ${p} attempts`;
  const cause =
    hard === 'mirrored'
      ? 'a construction with a fixed orientation (rotate by a literal angle, orient(±)) makes mirrored figures fail the hypotheses'
      : 'a construction with a fixed orientation (rotate by a literal angle, orient(±)) satisfies the hypotheses mainly in its mirror image';
  return `${hard} figures rarely satisfy the hypotheses (${count(hard)}, ${count(easy)}): ${cause}`;
}

/** The shortfall of tested figures when one orientation is the cause. */
export function parityShortNote(tested: number, n: number): string {
  return `only ${String(tested)} of ${String(n)} figures tested: half of the tested figures are mirrored, as the global test requires`;
}

/** "no random similarity (C has …)" and, in the global regime, "no mirroring (…)". */
export function frameNotes(regime: Regime, frame: SamplerFrame | undefined): string[] {
  if (frame === undefined) return [];
  const out: string[] = [];
  const mirror = regime === 'global' && !frame.mirror;
  if (!frame.similarity && mirror && frame.noSimilarity === frame.noMirror)
    return [`no random similarity or mirroring (${frame.noSimilarity ?? ''})`];
  if (!frame.similarity) out.push(`no random similarity (${frame.noSimilarity ?? ''})`);
  if (mirror) out.push(`no mirroring (${frame.noMirror ?? ''})`);
  return out;
}

/** A selector named by an ORIENTATION-DEPENDENT verdict, with the equivariant alternative. */
export interface NamedSelector {
  readonly object: string;
  readonly selector: string;
  readonly call: string;
  readonly advice: string;
  /** The selector is written inside the claim itself (no user object holds it). */
  readonly inClaim?: boolean;
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
