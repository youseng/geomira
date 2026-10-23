import { describe, expect, it } from 'vitest';
import { emptyDocument } from '@geomira/kernel/document';
import type { SampleOutcome } from '../src/rungs';
import { globalVerdict, localVerdict, newCollector, record } from '../src/verdict';

/**
 * Bug found in the pre-beta review (claims, item 4, first half): HOLDS and HOLDS ACROSS need
 * only t ≥ N/2 valid figures and no false one, and the text printed t/valid, so 100 true and
 * 100 undefined figures read "100/100". The main text now states the figures that were not
 * valid whenever there are any.
 */
const COMMON = { seed: 2, n: 200, tested: 200, attempts: 200, hardToSatisfy: false };
const CURRENT = { value: 'true', rung: 'exact over Q' } as const;
const NO_FLIPS = { failing: 0, unrepaired: 0, k: 0 };

function collect(groups: readonly (readonly [number, SampleOutcome])[]) {
  const c = newCollector();
  for (const [k, o] of groups) for (let i = 0; i < k; i++) record(c, o, () => emptyDocument());
  return c;
}

const T: SampleOutcome = { kind: 'true', rung: 'exact over Q' };
const F: SampleOutcome = { kind: 'false', rung: 'exact over Q' };
const U: SampleOutcome = { kind: 'undefined', reason: 'E is undefined (x)' };
const D: SampleOutcome = { kind: 'degenerate', reason: 'degenerate: A and B coincide' };
const A: SampleOutcome = { kind: 'ambiguous', reason: 'ambiguous: y' };
const I: SampleOutcome = { kind: 'ill-conditioned', reason: 'ill-conditioned: z' };

describe('the main verdict text states the figures that were not valid (review item 4)', () => {
  it('local HOLDS: 100 true and 100 undefined is not "100/100" alone', () => {
    const v = localVerdict(
      collect([
        [100, T],
        [100, U],
      ]),
      COMMON,
      CURRENT,
    );
    expect(v.kind).toBe('holds');
    expect(v.text).toBe(
      'HOLDS IN THIS CONFIGURATION (exact over Q, 100/100; 100 of 200 figures undefined) · seed 2',
    );
  });

  it('several kinds are named; FALSE and MIXED too', () => {
    const mixedKinds = collect([
      [150, T],
      [20, U],
      [20, A],
      [10, D],
    ]);
    expect(localVerdict(mixedKinds, COMMON, CURRENT).text).toBe(
      'HOLDS IN THIS CONFIGURATION (exact over Q, 150/150; 50 of 200 figures undefined, degenerate or ambiguous) · seed 2',
    );
    const fal = collect([
      [190, F],
      [10, I],
    ]);
    expect(localVerdict(fal, COMMON, { value: 'false', rung: 'exact over Q' }).text).toBe(
      'FALSE (exact over Q, 190/190 false; 10 of 200 figures ill-conditioned) · seed 2',
    );
    const mixed = collect([
      [100, T],
      [90, F],
      [10, U],
    ]);
    expect(localVerdict(mixed, COMMON, CURRENT).text).toBe(
      'MIXED (exact over Q, 100 true and 90 false of 190; 10 of 200 figures undefined) · seed 2',
    );
  });

  it('global HOLDS ACROSS and CONFIGURATION-DEPENDENT', () => {
    const c = collect([
      [100, T],
      [100, U],
    ]);
    c.mirrored = 100;
    expect(globalVerdict(c, COMMON, NO_FLIPS).text).toBe(
      'HOLDS ACROSS THE DECLARED CONFIGURATION (exact over Q, 100/100; 100 of 200 figures undefined; 100 mirrored) · seed 2',
    );
    const conf = collect([
      [100, T],
      [60, F],
      [40, U],
    ]);
    expect(globalVerdict(conf, COMMON, { failing: 60, unrepaired: 60, k: 0 }).text).toBe(
      'CONFIGURATION-DEPENDENT (60 of 160 fail; no orientation-dependent selector; 40 of 200 figures undefined) · seed 2',
    );
  });

  it('every figure valid: no note', () => {
    expect(localVerdict(collect([[200, T]]), COMMON, CURRENT).text).toBe(
      'HOLDS IN THIS CONFIGURATION (exact over Q, 200/200) · seed 2',
    );
  });
});

describe('undefined figures repaired by the flip test make the verdict ORIENTATION-DEPENDENT (L16)', () => {
  it('no false figure, 100 undefined ones that hold flipped', () => {
    const c = collect([
      [100, T],
      [100, U],
    ]);
    const named = {
      object: 'D',
      selector: 'orient(-)',
      call: 'intersect(circle(A, B), circle(B, A), orient(-))',
      advice: 'use same_side(…) or on_arc(…)',
    };
    const v = globalVerdict(c, COMMON, {
      failing: 100,
      unrepaired: 0,
      k: 1,
      undefinedRepaired: 100,
      named,
    });
    expect(v.kind).toBe('orientation-dependent');
    expect(v.undefinedRepaired).toBe(100);
    expect(v.text).toBe(
      "ORIENTATION-DEPENDENT (100 undefined figures hold with the selectors flipped; D's `orient(-)` encodes a side; use same_side(…) or on_arc(…); 100 of 200 figures undefined) · seed 2",
    );
  });

  it('enough figures counting the repaired ones: 60 true, 140 repaired undefined', () => {
    const c = collect([
      [60, T],
      [140, U],
    ]);
    const v = globalVerdict(c, COMMON, {
      failing: 140,
      unrepaired: 0,
      k: 1,
      undefinedRepaired: 140,
    });
    expect(v.kind).toBe('orientation-dependent');
  });

  it('a false figure the flips do not repair keeps CONFIGURATION-DEPENDENT', () => {
    const c = collect([
      [100, T],
      [10, F],
      [90, U],
    ]);
    const v = globalVerdict(c, COMMON, {
      failing: 100,
      unrepaired: 1,
      k: 1,
      undefinedRepaired: 90,
    });
    expect(v.kind).toBe('configuration-dependent');
  });
});
