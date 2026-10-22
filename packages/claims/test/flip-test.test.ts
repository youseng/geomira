/**
 * The global flip test (SPEC §10.5, ADR-0008 decision 15) on constructions where each part
 * of its logic decides the verdict: which selector it names when several are
 * orientation-dependent, flips that repair only together, failures no flip repairs (with
 * their counterexample), the advice for along(±) on a chiral line, and which half of an odd
 * number of figures is mirrored. Run 10, note A: the mutation survivors of job.ts.
 *
 * The circles have radius 5 and centres A, B 8 apart, meeting at (4, ±3); Y is the lower point
 * by a reflection-equivariant selector (Q is below AB), X the lower one by orient(+) in the
 * user's figure.
 */
import { describe, expect, it } from 'vitest';
import { testClaim, type TestClaimJob } from '../src/job';
import type { Verdict } from '../src/verdict';
import { along, c, Figure, n, orient, REGISTRY, sameSide } from './helpers/build';

function run(f: Figure, claim: number, nFigures = 60, seed = 11): Verdict {
  const job: TestClaimJob = {
    kind: 'testClaim',
    regime: 'global',
    doc: f.doc,
    claim,
    seed,
    n: nFigures,
  };
  const r = testClaim(job, { registry: REGISTRY });
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

function circles(): Figure {
  return new Figure()
    .point('A', 0, 0)
    .point('B', 8, 0)
    .point('Q', 4, -10)
    .def('c1', 'circle', 'A', n(5))
    .def('c2', 'circle', 'B', n(5))
    .def('ab', 'line', 'A', 'B')
    .def('Y', 'intersect', 'c1', 'c2', sameSide('Q', 'ab'));
}

describe('the flip test', () => {
  it('names the one selector whose flip repairs every failure, among three orientation-dependent ones', () => {
    // T and U are the two points by orient(±); their midpoint V lies on AB whichever is which,
    // so flipping them changes nothing. Only X's orient(+) decides.
    const f = circles()
      .def('X', 'intersect', 'c1', 'c2', orient(1))
      .def('T', 'intersect', 'c1', 'c2', orient(1))
      .def('U', 'intersect', 'c1', 'c2', orient(-1))
      .def('V', 'midpoint', 'T', 'U')
      .def('Z', 'intersect', 'c1', 'c2', sameSide('Q', c('line', 'A', 'V')));
    const v = run(f, f.claim('equal', 'X', 'Z'));
    expect(v.kind).toBe('orientation-dependent');
    expect(v.named).toEqual({
      object: 'X',
      selector: 'orient(+)',
      call: 'intersect(c1, c2, orient(+))',
      advice: 'use same_side(…) or on_arc(…), which keep their meaning when the figure is mirrored',
    });
    expect(v.text).toContain(
      "X's `orient(+)` encodes a side; use same_side(…) or on_arc(…), which keep their meaning when the figure is mirrored",
    );
  });

  it('two selectors that repair only together: ORIENTATION-DEPENDENT without a name', () => {
    const f = circles()
      .def('X1', 'intersect', 'c1', 'c2', orient(1))
      .def('X2', 'intersect', 'c1', 'c2', orient(1))
      .def('M', 'midpoint', 'X1', 'X2');
    const v = run(f, f.claim('equal', 'M', 'Y'));
    expect(v.kind).toBe('orientation-dependent');
    expect(v.named).toBeUndefined();
    expect(v.text).toContain(
      'flipping its 2 orientation-dependent selectors together repairs every failure',
    );
  });

  it('failures no flip repairs: CONFIGURATION-DEPENDENT with the first such figure', () => {
    // P is a free point at X's place in the user's figure only: every sample moves it away.
    const f = circles().def('X', 'intersect', 'c1', 'c2', orient(1)).point('P', 4, -3);
    const v = run(f, f.claim('equal', 'X', 'P'));
    expect(v.kind).toBe('configuration-dependent');
    expect(v.text).toContain('flipping the orientation-dependent selectors does not repair them');
    expect(v.counterexample).toBeDefined();
    expect(v.counterexample?.objects.some((o) => o.name.startsWith('#'))).toBe(false);
  });

  it('along(±) on a chiral line: the advice names the call', () => {
    // l ⟂ AB through the centre A is chiral and always meets c1; its direction is +y here, so
    // along(-) is the lower point.
    const f = circles()
      .def('l', 'perp', 'A', 'ab')
      .def('X', 'intersect', 'l', 'c1', along(-1))
      .def('W', 'intersect', 'l', 'c1', sameSide('Q', 'ab'));
    const v = run(f, f.claim('equal', 'X', 'W'));
    expect(v.kind).toBe('orientation-dependent');
    expect(v.named?.advice).toBe(
      'intersect(l, c1, along(-)) measures along a chiral line; use same_side(…), between(…) or on_arc(…) instead',
    );
  });

  it('an odd number of figures: the second, fourth, … are mirrored (⌊N/2⌋)', () => {
    const f = circles();
    const v = run(f, f.claim('on', 'Y', 'c1'), 7);
    expect(v.tested).toBe(7);
    expect(v.mirrored).toBe(3);
  });
});
