/**
 * Regression (ADR-0042): conic_to_circle(k) of an eccentric conic in floats. With the frame
 * scaled by 1/|g|² the image circle of this conic was about 1e-3 across in a figure 40 wide,
 * the map's matrix was nearly rank one, and apply(g, k) came out as a = −0.0067, b = 0.0009,
 * c = −0.0059 instead of a circle (exactly: a = c ≈ −1.75·10⁶, b = 0). With the osculating
 * circle the float image agrees with the exact one.
 */
import { FloatField } from '@geomira/num/float-field';
import { fromNumber } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { expect, it } from 'vitest';
import { call, lit } from '../src/expr';
import { numbersOf } from '../src/value';
import { Builder, contextOf, evalDoc, valueOf } from './helpers/doc';

const POINTS: readonly (readonly [number, number])[] = [
  [1.4268614522602476, 15.031548435266153],
  [-3.5412945287540367, 14.048811921456085],
  [-21.637578599478644, 26.608957096628508],
  [16.3986017663973, -2.415968446463623],
  [-11.703467796529875, 21.433436042773117],
];

it('the float image of an eccentric conic is the exact one (relative 1e-6)', () => {
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
  expect(float).toHaveLength(8);
  const size = Math.max(...exact.slice(0, 6).map(Math.abs));
  float.slice(0, 6).forEach((x, i) => {
    expect(Math.abs(x - (exact[i] ?? NaN)) / size, `coefficient ${String(i)}`).toBeLessThan(1e-6);
  });
  const [a, bb, c] = float;
  expect(Math.abs((a ?? 0) - (c ?? 1)) / size).toBeLessThan(1e-6);
  expect(Math.abs(bb ?? 1) / size).toBeLessThan(1e-6);
});
