import { describe, expect, it } from 'vitest';
import { testClaim } from '../src/job';
import { prepare } from '../src/prepare';
import type { Verdict } from '../src/verdict';
import { verdictLine } from '../src/verdict-line';
import { c, Figure, orient, REGISTRY, sameSide } from './helpers/build';

/**
 * Bug found in the pre-beta review (claims, item 2): when the orient/along selector sits in an
 * expression written inside the claim, the selector's object is an internal probe, and the
 * ORIENTATION-DEPENDENT verdict named it: "#probe0's `orient(+)` encodes a side". The verdict
 * now names it as part of the claim: "the claim's `intersect(c1, c2, orient(+))`".
 */
function figure(): { f: Figure; id: number } {
  const f = new Figure()
    .point('A', 0, 0)
    .point('B', 8, 0)
    .point('Q', 4, -10)
    .def('c1', 'circle', 'A', 'B')
    .def('c2', 'circle', 'B', 'A')
    .def('ab', 'line', 'A', 'B')
    .def('Y', 'intersect', 'c1', 'c2', sameSide('Q', 'ab'));
  const id = f.claim('equal', c('intersect', 'c1', 'c2', orient(1)), 'Y');
  return { f, id };
}

function global(f: Figure, id: number, seed: number): Verdict {
  const r = testClaim(
    { kind: 'testClaim', regime: 'global', doc: f.doc, claim: id, seed, n: 60 },
    { registry: REGISTRY },
  );
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

describe('no internal probe name reaches a verdict (review item 2)', () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${String(seed)}: the claim's own selector is named as part of the claim`, () => {
      const { f, id } = figure();
      const v = global(f, id, seed);
      expect(v.kind).toBe('orientation-dependent');
      expect(v.text).not.toContain('#');
      expect(v.text).toContain("the claim's `intersect(c1, c2, orient(+))` encodes a side");
      expect(v.named).toMatchObject({ object: 'the claim', inClaim: true });
      const line = verdictLine(v);
      expect(line.text).not.toContain('#');
      expect(line.text).toContain("the claim's `intersect(c1, c2, orient(+))` encodes a side");
    });
  }

  it("a user object's selector is still named by the object", () => {
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 8, 0)
      .point('Q', 4, -10)
      .def('c1', 'circle', 'A', 'B')
      .def('c2', 'circle', 'B', 'A')
      .def('ab', 'line', 'A', 'B')
      .def('X', 'intersect', 'c1', 'c2', orient(1))
      .def('Y', 'intersect', 'c1', 'c2', sameSide('Q', 'ab'));
    const v = global(f, f.claim('equal', 'X', 'Y'), 1);
    expect(v.text).toContain("X's `orient(+)` encodes a side");
    expect(v.named?.inClaim).toBeUndefined();
  });

  it('the mod-p exclusions name the claim, not a probe', () => {
    const { f, id } = figure();
    const p = prepare(f.doc, id, REGISTRY);
    if (!p.ok) throw new Error(p.reason);
    const ex = p.prepared.analysis.modpExclusions;
    expect(ex.length).toBeGreaterThan(0);
    for (const e of ex) expect(e).not.toContain('#');
    expect(ex).toContain(
      'the claim: intersect(c1, c2, orient(+)) uses the sign-based selector orient(+)',
    );
    expect(p.prepared.analysis.sites.map((s) => [s.objectName, s.inClaim])).toEqual([
      ['the claim', true],
    ]);
  });
});
