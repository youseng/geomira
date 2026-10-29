/**
 * Regression (Run 16b, Known bugs; fixed in Run 16c's audit): conic_to_circle(k) of a very
 * eccentric conic in floats. On figure 80 of seed 1617 of the conic theorem test (osculating
 * radius about 4·10⁴ in a figure 60 wide) the float image of k had a and c 1.3 % apart instead of
 * equal: the image coefficients adj(m)ᵀ·M·adj(m) cancel by about fourteen digits in world
 * coordinates. The map itself is accurate (1e-13); computed around the known point and its image
 * the float image is a circle to 2·10⁻⁵ (the map's own rounding, amplified by its conditioning,
 * is what is left: the exact image of the float map is no better). Also the conic_to_circle
 * theorem in FloatField on the figures of the conic theorem test (helpers/theorem-runner.ts, seed 1617).
 */
import { FloatField } from '@geomira/num/float-field';
import { fromNumber } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, lit } from '../src/expr';
import { numbersOf } from '../src/value';
import { asConic, onConic } from './helpers/conic-properties';
import { Builder, contextOf, evalDoc, valueOf } from './helpers/doc';
import { samePoints, type Figure } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import { theoremTests, type Theorem } from './helpers/theorem-runner';

const POINTS: readonly (readonly [number, number])[] = [
  [24.584908445041854, 24.444961998979878],
  [29.303435492766532, -23.699926608908193],
  [4.253120835119134, -18.504104241013295],
  [19.10555607610975, 12.866495192709749],
  [24.55799740160748, 0.3241971769552734],
];

it('figure 80 of seed 1617: the float image of k under conic_to_circle(k) is the exact circle', () => {
  const b = new Builder();
  const ps = POINTS.map(([x, y], i) =>
    b.add('ABCDE'[i] ?? 'Z', call('point', [lit(fromNumber(x)), lit(fromNumber(y))])),
  );
  const k = b.call('k', 'conic', ...ps);
  b.call('k_1', 'apply', b.call('g', 'conic_to_circle', k), k);
  const ctx = contextOf(b.doc);
  const float = numbersOf(valueOf(b.doc, evalDoc(b.doc, FloatField, ctx), 'k_1'));
  const exact = numbersOf(valueOf(b.doc, evalDoc(b.doc, RationalField, ctx), 'k_1')).map((x) =>
    RationalField.toNumber(x),
  );
  const [a, bb, c] = float;
  const size = Math.max(Math.abs(a ?? 0), Math.abs(c ?? 0));
  // 1.3·10⁻² before the fix; the bound leaves room for the map's own rounding (about 2·10⁻⁵).
  expect(Math.abs((a ?? 0) - (c ?? 1)) / size).toBeLessThan(1e-4);
  expect(Math.abs(bb ?? 1) / size).toBeLessThan(1e-4);
  for (const i of [0, 2, 3, 4, 5])
    expect(Math.abs((float[i] ?? 0) - (exact[i] ?? 1)) / Math.abs(exact[i] ?? 1)).toBeLessThan(
      1e-4,
    );
});

/** A conic value is a circle relative to its quadratic part: a = c and b = 0. */
function isCircle<T>(f: Figure<T>, k: string): boolean {
  const K = asConic<T>(f.get(k));
  const F = f.F;
  const n = F.add(F.mul(K.a, K.a), F.mul(K.c, K.c));
  const rel = (x: T) => F.isZero(F.div(F.mul(x, x), n), 'dimensionless', f.ctx);
  return rel(F.sub(K.a, K.c)) && rel(K.b);
}

const THEOREM: Theorem = {
  name: 'conic_to_circle(k) sends k to a circle through the images of its points (floats)',
  modes: ['float'],
  build: (b, [A, B, C, D, E]) => {
    const k = b.call('k', 'conic', A, B, C, D, E);
    const g = b.call('g', 'conic_to_circle', k);
    b.call('k_1', 'apply', g, k);
    for (const [n, X] of [
      ['A_1', A],
      ['B_1', B],
      ['C_1', C],
    ] as const)
      b.call(n, 'apply', g, X);
  },
  required: ['k', 'g', 'k_1', 'A_1', 'B_1', 'C_1'],
  check: (f) =>
    isCircle(f, 'k_1') &&
    ['A_1', 'B_1', 'C_1'].every((x) => onConic(f, x, 'k_1')) &&
    samePoints(f, 'A_1', 'A'),
};

describe('conic_to_circle in floats (Run 16c audit)', { timeout: LAW_TIMEOUT }, () => {
  theoremTests([THEOREM], 1617);
});
