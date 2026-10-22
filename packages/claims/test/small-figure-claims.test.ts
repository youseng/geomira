/**
 * The numeric rung judges a claim relative to the figure's size (pre-beta review, ADR-0027):
 * a figure and the same figure scaled by 1/100 or 1/10000 get the same verdict. Before, the
 * banded gap of `on` and `tangent` was absolute below size 1 (the clamped scale), so a
 * circle 2·10⁻⁶ of its radius away from tangency "held" in a figure of size 0.01.
 */
import { describe, expect, it } from 'vitest';
import { evalClaim } from '../src/eval-claim';
import { testClaim } from '../src/job';
import { c, Figure, n, REGISTRY } from './helpers/build';

/** The incircle w of A, B, C scaled by s, and w2 = w pushed 1 + 2·10⁻⁶ off its touch point. */
function nearlyTangent(s: number): { f: Figure; tangent: number; on: number } {
  const f = new Figure()
    .point('A', 1 * s, 3 * s)
    .point('B', 0, 0)
    .point('C', 4 * s, 0)
    .def('I', 'incenter', 'A', 'B', 'C')
    .def('w', 'incircle', 'A', 'B', 'C')
    .def('F', 'foot', 'I', c('line', 'B', 'C'))
    .def('G', 'homothety', 'F', 'I', n('1.000002'))
    .def('w2', 'homothety', 'w', 'G', n(2));
  const tangent = f.claim('tangent', 'w', 'w2');
  const on = f.claim('on', 'G', 'w');
  return { f, tangent, on };
}

describe('claims in small figures are judged relative to the figure', () => {
  for (const s of [1, 1 / 100, 1 / 10000]) {
    it(`a nearly tangent pair at size ${String(s)} is false, never true`, () => {
      const { f, tangent, on } = nearlyTangent(s);
      expect(evalClaim(f.doc, tangent, REGISTRY)).toMatchObject({ value: 'false' });
      expect(evalClaim(f.doc, on, REGISTRY)).toMatchObject({ value: 'false' });
    });
  }

  it('the local test at size 1/100 is FALSE, as at size 1', () => {
    for (const s of [1, 1 / 100]) {
      const { f, tangent } = nearlyTangent(s);
      const r = testClaim(
        { kind: 'testClaim', regime: 'local', doc: f.doc, claim: tangent, seed: 1, n: 20 },
        { registry: REGISTRY },
      );
      expect(r.kind === 'verdict' ? r.verdict.text : r.kind).toMatch(/^FALSE/);
    }
  });

  it('a true tangency stays true at every size', () => {
    for (const s of [1, 1 / 100, 1 / 10000]) {
      const f = new Figure()
        .point('A', 1 * s, 3 * s)
        .point('B', 0, 0)
        .point('C', 4 * s, 0)
        .def('w', 'incircle', 'A', 'B', 'C')
        .def('F', 'foot', c('incenter', 'A', 'B', 'C'), c('line', 'B', 'C'))
        .def('w2', 'homothety', 'w', 'F', n(2));
      const id = f.claim('tangent', 'w', 'w2');
      expect(evalClaim(f.doc, id, REGISTRY)).toMatchObject({ value: 'true' });
    }
  });
});
