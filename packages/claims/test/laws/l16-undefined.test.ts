/**
 * L16 (SPEC §17), second half, for figures that fail by becoming UNDEFINED: "scripts whose
 * only failures come from an orient/chiral along choice always" receive ORIENTATION-DEPENDENT.
 * Bug found in the pre-beta review (claims, item 4): the flip test ran on false figures only,
 * so a claim whose mirrored figures are undefined (the wrong candidate makes a later
 * construction empty) read HOLDS ACROSS "100/100", hiding 100 undefined figures. Undefined
 * figures are now flipped too; those that hold flipped are orientation failures.
 */
import { describe, expect, it } from 'vitest';
import { testClaim } from '../../src/job';
import type { Verdict } from '../../src/verdict';
import { verdictLine } from '../../src/verdict-line';
import { c, Figure, oppositeSide, orient, REGISTRY, type Sel } from '../helpers/build';

function globalVerdict(f: Figure, id: number, seed: number): Verdict {
  const r = testClaim(
    { kind: 'testClaim', regime: 'global', doc: f.doc, claim: id, seed, n: 200 },
    { registry: REGISTRY },
  );
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

/** D: apex of the equilateral triangle on AB (selector given); E: where segment CD meets AB. */
function apex(sel: Sel): { f: Figure; id: number } {
  const f = new Figure()
    .point('A', 0, 0)
    .point('B', 4, 0)
    .point('C', 1, 3)
    .def('D', 'intersect', c('circle', 'A', 'B'), c('circle', 'B', 'A'), sel)
    .def('E', 'intersect', c('segment', 'C', 'D'), c('line', 'A', 'B'));
  return { f, id: f.claim('collinear', 'A', 'B', 'E') };
}

describe('L16: undefined figures repaired by flipping the selectors', () => {
  for (const seed of [1, 2, 3]) {
    it(`orient(-): ORIENTATION-DEPENDENT naming D, the undefined figures stated (seed ${String(seed)})`, () => {
      const { f, id } = apex(orient(-1));
      const v = globalVerdict(f, id, seed);
      expect(v.kind, v.text).toBe('orientation-dependent');
      expect(v.tally.false).toBe(0);
      expect(v.undefinedRepaired).toBeGreaterThan(50);
      expect(v.named).toMatchObject({ object: 'D', selector: 'orient(-)' });
      expect(v.text).toMatch(
        /^ORIENTATION-DEPENDENT \(\d+ undefined figures hold with the selectors flipped; D's `orient\(-\)` encodes a side/u,
      );
      expect(v.text).toMatch(/; \d+ of 200 figures undefined\)/u);
      expect(verdictLine(v).text).toMatch(/\d+ undefined figures hold with the selectors flipped/u);
    });

    it(`opposite_side(C, line(A, B)): HOLDS ACROSS, every figure defined (seed ${String(seed)})`, () => {
      const { f, id } = apex(oppositeSide('C', c('line', 'A', 'B')));
      const v = globalVerdict(f, id, seed);
      expect(v.kind, v.text).toBe('holds-across');
      expect(v.tally.undefined).toBe(0);
    });
  }

  it('undefined figures in a script without orientation-dependent selectors: never ORIENTATION-DEPENDENT, and stated', () => {
    // D is a free point below AB; global noise sometimes puts it above, and E is undefined.
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 4, 0)
      .point('C', 1, 3)
      .point('D', 2, -2)
      .def('E', 'intersect', c('segment', 'C', 'D'), c('line', 'A', 'B'));
    const id = f.claim('collinear', 'A', 'B', 'E');
    for (const seed of [1, 2, 3]) {
      const v = globalVerdict(f, id, seed);
      expect(v.kind, v.text).toBe('holds-across');
      expect(v.tally.undefined).toBeGreaterThan(0);
      expect(v.text).toContain(` of 200 figures undefined`);
    }
  });
});
