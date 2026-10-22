/**
 * Verdicts (packages/claims Verdict.text, SPEC §10.5, ADR-0008 decision 14) character for
 * character, from collectors filled by `record` with every kind of outcome, and every branch of
 * the global verdict's flip summary. Run 10, note A: the mutation survivors of verdict.ts.
 */
import { describe, expect, it } from 'vitest';
import { emptyDocument, type Document } from '@geomira/kernel/document';
import type { SampleOutcome } from '../src/rungs';
import {
  globalVerdict,
  localVerdict,
  newCollector,
  record,
  type FlipSummary,
} from '../src/verdict';

const COMMON = { seed: 9, n: 10, tested: 10, attempts: 10, hardToSatisfy: false };
const doc = (title: string): Document => ({ ...emptyDocument(), meta: { title } });

function collect(outcomes: readonly SampleOutcome[]) {
  const c = newCollector();
  outcomes.forEach((o, i) => {
    record(c, o, () => doc(`sample ${String(i)}`));
  });
  return c;
}

const T = (rung: 'exact over Q' | 'exact mod p' | 'numeric' = 'exact over Q'): SampleOutcome => ({
  kind: 'true',
  rung,
});
const F = (rung: 'exact over Q' | 'exact mod p' | 'numeric' = 'exact over Q'): SampleOutcome => ({
  kind: 'false',
  rung,
});
const times = <X>(k: number, x: X): X[] => Array.from({ length: k }, () => x);
const NO_FLIPS: FlipSummary = { failing: 0, unrepaired: 0, k: 0 };

describe('record: the tally, rungs, reasons and documents', () => {
  it('every outcome kind is counted where it belongs', () => {
    const c = collect([
      T(),
      F('numeric'),
      { kind: 'rejected', reason: 'assume acute: not satisfied' },
      { kind: 'ill-conditioned', reason: 'ill-conditioned: x' },
      { kind: 'degenerate', reason: 'degenerate: A and B coincide' },
      { kind: 'undefined', reason: 'H is undefined (y)' },
      { kind: 'ambiguous', reason: 'ambiguous: z' },
      { kind: 'invalid', reason: 'invalid claim: w' },
      { kind: 'invalid', reason: 'invalid claim: w' },
    ]);
    expect(c.tally).toEqual({
      true: 1,
      false: 1,
      degenerate: 1,
      undefined: 1,
      ambiguous: 1,
      illConditioned: 1,
      invalid: 2,
      rejected: 1,
    });
    expect(c.rungs).toEqual({ 'exact over Q': 1, numeric: 1 });
    expect([...c.reasons]).toEqual([
      ['ill-conditioned: x', 1],
      ['degenerate: A and B coincide', 1],
      ['H is undefined (y)', 1],
      ['ambiguous: z', 1],
      ['invalid claim: w', 2],
    ]);
    expect(c.example?.meta.title).toBe('sample 0');
    expect(c.counterexample?.meta.title).toBe('sample 1');
  });
});

describe('local verdict texts', () => {
  it('HOLDS with mixed rungs listed in rung order with counts', () => {
    const c = collect([...times(6, T('numeric')), ...times(4, T())]);
    expect(localVerdict(c, COMMON, { value: 'true', rung: 'exact over Q' }).text).toBe(
      'HOLDS IN THIS CONFIGURATION (exact over Q 4, numeric 6, 10/10) · seed 9',
    );
  });

  it('FALSE, with and without "true in the current figure only"; MIXED', () => {
    const c = collect(times(10, F()));
    expect(localVerdict(c, COMMON, { value: 'true', rung: 'exact over Q' }).text).toBe(
      'FALSE (exact over Q, 10/10 false; true in the current figure only) · seed 9',
    );
    expect(localVerdict(c, COMMON, { value: 'false', rung: 'exact over Q' }).text).toBe(
      'FALSE (exact over Q, 10/10 false) · seed 9',
    );
    const m = collect([...times(7, T()), ...times(3, F())]);
    expect(localVerdict(m, COMMON, { value: 'true', rung: 'exact over Q' }).text).toBe(
      'MIXED (exact over Q, 7 true and 3 false of 10) · seed 9',
    );
  });

  it('INCONCLUSIVE lists the three most frequent reasons, ties by name', () => {
    const c = collect([
      T(),
      ...times(3, { kind: 'undefined', reason: 'b' } as const),
      ...times(3, { kind: 'undefined', reason: 'a' } as const),
      { kind: 'undefined', reason: 'c' },
      ...times(2, { kind: 'degenerate', reason: 'd' } as const),
    ]);
    const v = localVerdict(c, COMMON, { value: 'true', rung: 'exact over Q' });
    expect(v.text).toBe('INCONCLUSIVE (1 of 10 figures valid; a ×3; b ×3; d ×2) · seed 9');
    expect(v.reasons).toEqual([
      { reason: 'a', count: 3 },
      { reason: 'b', count: 3 },
      { reason: 'd', count: 2 },
    ]);
    // Without reasons (a shortfall of figures): no trailing list.
    const none = collect([T()]);
    expect(
      localVerdict(none, { ...COMMON, tested: 1 }, { value: 'true', rung: 'exact over Q' }).text,
    ).toBe(
      'INCONCLUSIVE (1 of 1 figures valid) · only 1 of 10 figures satisfied the hypotheses · seed 9',
    );
  });

  it('hard to satisfy is stated, and set on the verdict', () => {
    const c = collect(times(10, T()));
    const v = localVerdict(
      c,
      { ...COMMON, attempts: 500, hardToSatisfy: true },
      { value: 'true', rung: 'exact over Q' },
    );
    expect(v.text).toBe(
      'HOLDS IN THIS CONFIGURATION (exact over Q, 10/10) · hard to satisfy: few figures satisfy the hypotheses · seed 9',
    );
    expect(v.hardToSatisfy).toBe(true);
    expect(
      'hardToSatisfy' in localVerdict(c, COMMON, { value: 'true', rung: 'exact over Q' }),
    ).toBe(false);
  });
});

describe('global verdict texts and the flip summary', () => {
  it('HOLDS ACROSS with rejected and mirrored counts', () => {
    const c = collect([...times(10, T()), ...times(4, { kind: 'rejected', reason: 'r' } as const)]);
    c.mirrored = 5;
    expect(globalVerdict(c, COMMON, NO_FLIPS).text).toBe(
      'HOLDS ACROSS THE DECLARED CONFIGURATION (exact over Q, 10/10; 4 samples rejected by hypotheses; 5 mirrored) · seed 9',
    );
    const plain = collect(times(10, T()));
    expect(globalVerdict(plain, COMMON, NO_FLIPS).text).toBe(
      'HOLDS ACROSS THE DECLARED CONFIGURATION (exact over Q, 10/10; 0 mirrored) · seed 9',
    );
    expect(globalVerdict(plain, COMMON, NO_FLIPS).mirrored).toBe(0);
  });

  it('failures without orientation-dependent selectors are CONFIGURATION-DEPENDENT', () => {
    const c = collect([...times(6, T()), ...times(4, F())]);
    const v = globalVerdict(c, COMMON, { failing: 4, unrepaired: 0, k: 0 });
    expect(v.kind).toBe('configuration-dependent');
    expect(v.text).toBe(
      'CONFIGURATION-DEPENDENT (4 of 10 fail; no orientation-dependent selector) · seed 9',
    );
    expect(v.counterexample?.meta.title).toBe('sample 6');
  });

  it('selectors flipped but some failure unrepaired: CONFIGURATION-DEPENDENT with that figure', () => {
    const c = collect([...times(6, T()), ...times(4, F())]);
    const v = globalVerdict(c, COMMON, {
      failing: 4,
      unrepaired: 1,
      k: 2,
      unrepairedDoc: doc('u'),
    });
    expect(v.text).toBe(
      'CONFIGURATION-DEPENDENT (4 of 10 fail; flipping the orientation-dependent selectors does not repair them) · seed 9',
    );
    expect(v.counterexample?.meta.title).toBe('u');
    expect(v.named).toBeUndefined();
  });

  it('every failure repaired: ORIENTATION-DEPENDENT, with or without a named selector', () => {
    const c = collect([...times(6, T()), ...times(4, F())]);
    const unnamed = globalVerdict(c, COMMON, { failing: 4, unrepaired: 0, k: 3 });
    expect(unnamed.text).toBe(
      'ORIENTATION-DEPENDENT (4 of 10 fail and hold with the selectors flipped; flipping its 3 orientation-dependent selectors together repairs every failure) · seed 9',
    );
    expect('named' in unnamed).toBe(false);
    const named = {
      object: 'X',
      selector: 'orient(+)',
      call: 'intersect(a, b, orient(+))',
      advice: 'do this',
    };
    const v = globalVerdict(c, COMMON, { failing: 4, unrepaired: 0, k: 1, named });
    expect(v.text).toBe(
      "ORIENTATION-DEPENDENT (4 of 10 fail and hold with the selectors flipped; X's `orient(+)` encodes a side; do this) · seed 9",
    );
    expect(v.named).toEqual(named);
  });
});
