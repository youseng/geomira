/**
 * Run 16c audit: conic ∩ circle where the conic has no known point and its centre is far away
 * (a hyperbola close to the parabola y = (x² − 1)/2, image of the unit circle under a projective
 * map, centre about (0, −500)). The pencil's frame was centred halfway to that centre, its triple
 * test then fired on a simple root and the two real common points were dropped: "the conics do
 * not meet". The frame now starts from points at the curves (known points, circle centres, an
 * anchorless conic's nearest vertex), so the result does not depend on how far the centre is.
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { call } from '../src/expr';
import { Builder, evalDoc, num, pt, valueOf } from './helpers/doc';

/** The image of the unit circle with parameter δ (δ → 0: the parabola y = (x² − 1)/2). */
function figure(delta: number, near: readonly [number, number]): Builder {
  const h = 1 - delta;
  const s = 1 - 0.5 / h;
  const b = new Builder();
  b.add('c0', call('circle', [pt(0, 0), num(1)]));
  const P = (x: number, y: number) => pt(String(x), String(y));
  b.add(
    'f',
    call('projective', [
      P(0, 0),
      P(1, 0),
      P(0, 0.5),
      P(1, 0.5),
      P(0, 0),
      P(1, 0),
      P(0, 0.5 / s),
      P(1 / s, 0.5 / s),
    ]),
  );
  b.add('k', call('apply', [b.ref('f'), b.ref('c0')]));
  b.add('w', call('circle', [P(0.2, -0.5), num('3/10')]));
  b.add('X', call('intersect', [b.ref('k'), b.ref('w')], [{ kind: 'near', p: P(...near) }]));
  return b;
}

describe('conic ∩ circle with the conic centre far away', () => {
  for (const delta of [1e-2, 1e-3, 1e-4, 1e-6, 1e-8])
    it(`δ = ${String(delta)}: both common points are found`, () => {
      for (const [near, want] of [
        [
          [0, -1],
          [-0.1, -0.495],
        ],
        [
          [1, 0],
          [0.477, -0.386],
        ],
      ] as const) {
        const b = figure(delta, near);
        const v = valueOf(b.doc, evalDoc(b.doc, FloatField), 'X');
        expect(v.kind === 'point' ? [v.x, v.y] : v, `near ${String(near)}`).toEqual([
          expect.closeTo(want[0], 1),
          expect.closeTo(want[1], 1),
        ]);
      }
    });
});
