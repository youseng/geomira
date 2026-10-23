/**
 * Circle ∩ circle when the circles nearly coincide (pre-beta review, ADR-0027): centres
 * closer than the band and radii equal within it. The internal gap d − |r₁ − r₂| then lies in
 * the band, but the circles are not tangent: they meet in two points far apart (the half
 * chord h is about r). The tool used to call it a tangency and return the "double point" on
 * the line of centres, which lies on neither circle (here the common centre (0, 0)).
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../src/expr';
import type { Value } from '../src/value';
import { choose, other } from './helpers/degenerate-branch';
import { pt } from './helpers/doc';

const A = pt(-1, 0);
const B = pt(1, 0);
/** circle(A, B, C) and circle(A, B, D), D just above C = (0, 1): both pass through A and B. */
const pair = (dy: string): Expr[] => [
  call('circle', [A, B, pt(0, 1)]),
  call('circle', [A, B, pt(0, dy)]),
];
const near = (p: Expr) => ({ kind: 'near' as const, p });

function xy(v: Value<number>): [number, number] {
  if (v.kind !== 'point') throw new Error(`expected a point, got ${JSON.stringify(v)}`);
  return [v.x, v.y];
}

describe('circles that nearly coincide meet in two points, never at a fake double point', () => {
  for (const dy of ['1.000001', '1.0000001', '1.00000001']) {
    it(`circle(A, B, C) ∩ circle(A, B, (0, ${dy})): near(A) is A, near(B) is B`, () => {
      const [ax, ay] = xy(choose(FloatField, 'intersect', pair(dy), [near(A)]));
      const [bx, by] = xy(choose(FloatField, 'intersect', pair(dy), [near(B)]));
      expect(Math.hypot(ax + 1, ay)).toBeLessThan(1e-6);
      expect(Math.hypot(bx - 1, by)).toBeLessThan(1e-6);
      expect(xy(choose(FloatField, 'intersect', pair(dy), [other(A)]))[0]).toBeCloseTo(1, 6);
    });

    it(`without a selector it asks for one (two candidates), dy = ${dy}`, () => {
      const v = choose(FloatField, 'intersect', pair(dy));
      expect(v).toMatchObject({ kind: 'undefined' });
      expect(v.kind === 'undefined' ? v.reason : '').toMatch(/add a selector/);
    });
  }

  it('two unit circles 1e-8 apart meet at (5e-9, ±1), not at a centre', () => {
    const cs = [
      call('circle', [pt(0, 0), pt(1, 0)]),
      call('circle', [pt('1/100000000', 0), pt('100000001/100000000', 0)]),
    ];
    const [x, y] = xy(choose(FloatField, 'intersect', cs, [near(pt(0, 2))]));
    // The radical axis is only known to about ε·r²/d here (the radii are rounded), so x is
    // checked to 1e-7; the fake double point had y = 0.
    expect(Math.abs(x - 5e-9)).toBeLessThan(1e-7);
    expect(y).toBeCloseTo(1, 6);
  });

  it('a genuine internal tangency still gives the double point', () => {
    const cs = [call('circle', [pt(0, 0), pt(2, 0)]), call('circle', [pt(1, 0), pt(2, 0)])];
    const [x, y] = xy(choose(FloatField, 'intersect', cs));
    expect([x, y]).toEqual([2, 0]);
  });
});
