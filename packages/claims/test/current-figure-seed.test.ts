import { describe, expect, it } from 'vitest';
import { evalClaim } from '../src/eval-claim';
import { testClaim } from '../src/job';
import { c, Figure, n, REGISTRY } from './helpers/build';

/**
 * Bug found in the pre-beta review (claims, item 6): the local test judged the CURRENT figure
 * ("true in the current figure only", `verdict.current`) with the job's seed for the
 * noise-floor perturbations, while the live badge (evalClaim) uses seed 0. For a claim at
 * the edge of the noise floor the two disagreed: the badge said ambiguous and the test's
 * current value said true. The local test now judges the current figure as the badge does.
 */
function edgeFigure(): { f: Figure; id: number } {
  // P is 1e-8·√2 off the line AB: with seed 0 the residual is "ambiguous" against the floor,
  // with most other seeds it is "true".
  const f = new Figure()
    .point('A', 0, 0)
    .point('B', 4, 0)
    .def('P', 'point', n(2), c('mul', n('0.00000001'), c('sqrt', n(2))));
  return { f, id: f.claim('collinear', 'A', 'B', 'P') };
}

describe('the local test judges the current figure as the badge does (review item 6)', () => {
  it('the edge case: the badge differs between noise-floor seeds (the premise)', () => {
    const { f, id } = edgeFigure();
    const values = [0, 1, 2, 3, 4, 5].map((seed) => evalClaim(f.doc, id, REGISTRY, { seed }).value);
    expect(new Set(values).size).toBeGreaterThan(1);
  });

  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`job seed ${String(seed)}: verdict.current equals the badge`, () => {
      const { f, id } = edgeFigure();
      const r = testClaim(
        { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed, n: 20 },
        { registry: REGISTRY },
      );
      if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
      expect(r.verdict.current).toEqual(evalClaim(f.doc, id, REGISTRY));
    });
  }
});
