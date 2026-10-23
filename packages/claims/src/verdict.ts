/**
 * Verdicts (SPEC §10.5), built from the outcomes of the samples of one job.
 *   LOCAL: HOLDS IN THIS CONFIGURATION (every valid sample true) · FALSE (every valid
 *   sample false; "true in the current figure only" when it holds there) · MIXED (both,
 *   with an example and a counterexample document) · INCONCLUSIVE (fewer than half of the N
 *   figures valid: undefined, degenerate, ambiguous or ill-conditioned, with reasons).
 *   GLOBAL: HOLDS ACROSS THE DECLARED CONFIGURATION · ORIENTATION-DEPENDENT (every failing
 *   sample holds once the orientation-dependent selectors are flipped; one selector is
 *   named when flipping it alone repairs every failure) · CONFIGURATION-DEPENDENT (some
 *   failing sample does not hold even flipped; with an example document) · INCONCLUSIVE.
 * Verdicts state what was checked (rungs and counts) and carry the seed; they never use
 * the words reserved for the Phase 2 prover.
 */
import type { Seed } from '@geomira/num/rng';
import type { Document } from '@geomira/kernel/document';
import { MIN_VALID_FRACTION } from './constants';
import type { ClaimValue } from './eval-claim';
import { RUNG_NAMES, type RungName, type SampleOutcome } from './rungs';
import type { Regime } from './sampler';
import { selectorPhrase } from './verdict-notes';

export type LocalKind = 'holds' | 'false' | 'mixed' | 'inconclusive';
export type GlobalKind =
  'holds-across' | 'orientation-dependent' | 'configuration-dependent' | 'inconclusive';

export interface Tally {
  readonly true: number;
  readonly false: number;
  readonly degenerate: number;
  readonly undefined: number;
  readonly ambiguous: number;
  readonly illConditioned: number;
  readonly invalid: number;
  readonly rejected: number;
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

export interface Verdict {
  readonly regime: Regime;
  readonly kind: LocalKind | GlobalKind;
  /** The one-line verdict shown to the user. */
  readonly text: string;
  readonly seed: Seed;
  readonly n: number;
  /** Figures tested (accepted by the hypotheses) and attempts made. */
  readonly tested: number;
  readonly attempts: number;
  readonly tally: Tally;
  readonly rungs: Readonly<Partial<Record<RungName, number>>>;
  /** The most frequent reasons of invalid samples, with counts. */
  readonly reasons: readonly { readonly reason: string; readonly count: number }[];
  readonly example?: Document;
  readonly counterexample?: Document;
  /** LOCAL: the claim in the current figure. */
  readonly current?: ClaimValue;
  /** GLOBAL: mirrored samples among the tested ones. */
  readonly mirrored?: number;
  /** Fewer than HARD_ACCEPTANCE of the attempts satisfied the hypotheses. */
  readonly hardToSatisfy?: boolean;
  readonly named?: NamedSelector;
}

/** Collected while a job runs. */
export interface Collector {
  tally: { -readonly [K in keyof Tally]: number };
  rungs: Partial<Record<RungName, number>>;
  reasons: Map<string, number>;
  example?: Document;
  counterexample?: Document;
  mirrored: number;
}

export function newCollector(): Collector {
  return {
    tally: {
      true: 0,
      false: 0,
      degenerate: 0,
      undefined: 0,
      ambiguous: 0,
      illConditioned: 0,
      invalid: 0,
      rejected: 0,
    },
    rungs: {},
    reasons: new Map(),
    mirrored: 0,
  };
}

/** Records one sample's outcome (and its document as an example or counterexample). */
export function record(c: Collector, o: SampleOutcome, doc: () => Document): void {
  switch (o.kind) {
    case 'true':
    case 'false':
      c.tally[o.kind]++;
      c.rungs[o.rung] = (c.rungs[o.rung] ?? 0) + 1;
      if (o.kind === 'true') c.example ??= doc();
      else c.counterexample ??= doc();
      return;
    case 'rejected':
      c.tally.rejected++;
      return;
    case 'ill-conditioned':
      c.tally.illConditioned++;
      break;
    case 'degenerate':
    case 'undefined':
    case 'ambiguous':
    case 'invalid':
      c.tally[o.kind]++;
      break;
  }
  c.reasons.set(o.reason, (c.reasons.get(o.reason) ?? 0) + 1);
}

function rungText(rungs: Partial<Record<RungName, number>>): string {
  const used = RUNG_NAMES.filter((r) => (rungs[r] ?? 0) > 0);
  if (used.length === 1 && used[0] !== undefined) return used[0];
  return used.map((r) => `${r} ${String(rungs[r] ?? 0)}`).join(', ');
}

function topReasons(c: Collector): { reason: string; count: number }[] {
  return [...c.reasons.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || (a.reason < b.reason ? -1 : 1))
    .slice(0, 3);
}

function enoughValid(c: Collector, n: number): boolean {
  return (
    c.tally.true + c.tally.false >= Math.ceil(MIN_VALID_FRACTION * n) &&
    c.tally.true + c.tally.false > 0
  );
}

function inconclusiveText(c: Collector, tested: number): string {
  const valid = c.tally.true + c.tally.false;
  const why = topReasons(c)
    .map((r) => `${r.reason} ×${String(r.count)}`)
    .join('; ');
  return `INCONCLUSIVE (${String(valid)} of ${String(tested)} figures valid${why === '' ? '' : `; ${why}`})`;
}

export interface Common {
  readonly seed: Seed;
  readonly n: number;
  readonly tested: number;
  readonly attempts: number;
  readonly hardToSatisfy: boolean;
}

function base(
  regime: Regime,
  kind: LocalKind | GlobalKind,
  text: string,
  c: Collector,
  k: Common,
): Verdict {
  const hard = k.hardToSatisfy ? ' · hard to satisfy: few figures satisfy the hypotheses' : '';
  const short =
    k.tested < k.n
      ? ` · only ${String(k.tested)} of ${String(k.n)} figures satisfied the hypotheses`
      : '';
  return {
    regime,
    kind,
    text: `${text}${hard}${short} · seed ${String(k.seed)}`,
    seed: k.seed,
    n: k.n,
    tested: k.tested,
    attempts: k.attempts,
    tally: { ...c.tally },
    rungs: { ...c.rungs },
    reasons: topReasons(c),
    ...(c.example === undefined ? {} : { example: c.example }),
    ...(c.counterexample === undefined ? {} : { counterexample: c.counterexample }),
    ...(k.hardToSatisfy ? { hardToSatisfy: true } : {}),
  };
}

/** The LOCAL verdict. */
export function localVerdict(c: Collector, k: Common, current: ClaimValue): Verdict {
  const { true: t, false: f } = c.tally;
  const valid = t + f;
  let kind: LocalKind;
  let text: string;
  if (!enoughValid(c, k.n)) {
    [kind, text] = ['inconclusive', inconclusiveText(c, k.tested)];
  } else if (f === 0) {
    [kind, text] = [
      'holds',
      `HOLDS IN THIS CONFIGURATION (${rungText(c.rungs)}, ${String(t)}/${String(valid)})`,
    ];
  } else if (t === 0) {
    const only = current.value === 'true' ? '; true in the current figure only' : '';
    [kind, text] = [
      'false',
      `FALSE (${rungText(c.rungs)}, ${String(f)}/${String(valid)} false${only})`,
    ];
  } else {
    [kind, text] = [
      'mixed',
      `MIXED (${rungText(c.rungs)}, ${String(t)} true and ${String(f)} false of ${String(valid)})`,
    ];
  }
  return { ...base('local', kind, text, c, k), current };
}

/** What the flip test found over the failing samples of a global job. */
export interface FlipSummary {
  /** Failing samples whose failure the flips did not repair (the first one's document). */
  readonly unrepaired: number;
  readonly unrepairedDoc?: Document;
  readonly failing: number;
  /** The selector whose flip alone repaired every failing sample, if any. */
  readonly named?: NamedSelector;
  /** Orientation-dependent selectors met (k). */
  readonly k: number;
}

/** The GLOBAL verdict. */
export function globalVerdict(c: Collector, k: Common, flips: FlipSummary): Verdict {
  const { true: t, false: f } = c.tally;
  const valid = t + f;
  const rejected =
    c.tally.rejected === 0 ? '' : `; ${String(c.tally.rejected)} samples rejected by hypotheses`;
  const counts = `${rungText(c.rungs)}, ${String(t)}/${String(valid)}${rejected}; ${String(c.mirrored)} mirrored`;
  let v: Verdict;
  if (!enoughValid(c, k.n)) {
    v = base('global', 'inconclusive', inconclusiveText(c, k.tested), c, k);
  } else if (f === 0) {
    v = base('global', 'holds-across', `HOLDS ACROSS THE DECLARED CONFIGURATION (${counts})`, c, k);
  } else if (flips.k > 0 && flips.unrepaired === 0) {
    const what =
      flips.named === undefined
        ? `flipping its ${String(flips.k)} orientation-dependent selectors together repairs every failure`
        : `${selectorPhrase(flips.named)} encodes a side; ${flips.named.advice}`;
    v = {
      ...base(
        'global',
        'orientation-dependent',
        `ORIENTATION-DEPENDENT (${String(f)} of ${String(valid)} fail and hold with the selectors flipped; ${what})`,
        c,
        k,
      ),
      ...(flips.named === undefined ? {} : { named: flips.named }),
    };
  } else {
    const why =
      flips.k === 0
        ? 'no orientation-dependent selector'
        : 'flipping the orientation-dependent selectors does not repair them';
    v = base(
      'global',
      'configuration-dependent',
      `CONFIGURATION-DEPENDENT (${String(f)} of ${String(valid)} fail; ${why})`,
      c,
      k,
    );
    if (flips.unrepairedDoc !== undefined) v = { ...v, counterexample: flips.unrepairedDoc };
  }
  return { ...v, mirrored: c.mirrored };
}
