import { describe, expect, it } from 'vitest';
import { evalClaim } from '../src/eval-claim';
import { c, Figure, n, REGISTRY } from './helpers/build';

/**
 * Bug found in the pre-beta review (claims, item 7): the noise floor moved a glider's (u : v)
 * by FLOOR_DELTA in absolute terms, although (u : v) is homogeneous. For a small parameter,
 * (0 : 0.000005), a step of 1e-10 turned the point by about 4e-5 rad, the floor exceeded
 * FLOOR_MAX and a true claim was "ill-conditioned"; for a large one the step was negligible.
 * The step is now relative to |(u, v)|, so (0 : v) is the same point, judged the same, for every v.
 */
function figure(u: string, v: string): { f: Figure; id: number } {
  const f = new Figure()
    .point('O', 0, 0)
    .point('A', 5, 0)
    // A rotated circle: its anchor needs cos 60°, so no exact rung decides the claim.
    .def('c', 'rotate', c('circle', 'O', 'A'), 'O', n(60))
    .def('A2', 'rotate', 'A', 'O', n(60))
    .def('P', 'on', 'c', n(u), n(v));
  // (0 : v) is the antipode of c's anchor A2: O, P, A2 are collinear for every v.
  return { f, id: f.claim('collinear', 'O', 'P', 'A2') };
}

describe('the noise floor moves (u : v) relative to |(u, v)| (review item 7)', () => {
  for (const v of ['0.000005', '0.001', '1', '5000000']) {
    it(`(0 : ${v}): the antipode is collinear, numerically TRUE for every seed`, () => {
      const { f, id } = figure('0', v);
      for (const seed of [0, 1, 2, 3])
        expect(evalClaim(f.doc, id, REGISTRY, { seed })).toEqual({
          value: 'true',
          rung: 'numeric',
        });
    });
  }

  it('(0.000003 : 0.000004) is not the antipode: FALSE, not ill-conditioned', () => {
    const { f, id } = figure('0.000003', '0.000004');
    for (const seed of [0, 1, 2])
      expect(evalClaim(f.doc, id, REGISTRY, { seed })).toEqual({
        value: 'false',
        rung: 'numeric',
      });
  });
});
