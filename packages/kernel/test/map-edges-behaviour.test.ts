/**
 * ADR-0054 (mutation shards kernel-k and kernel-a: transform/apply-map.ts, mobius.ts,
 * projective.ts): maps at the edges the earlier tests left open. localScale of a projective map
 * is √(|det m|/|W(x)|³) and of a composite the product along its factors; mapProblem of a
 * composite is its first invalid factor's problem, named by the tool; a projective map with
 * det 0 or beyond the double range is refused by name; the inverse of a composite undoes it,
 * factors in reverse order.
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { applyMap, localScale } from '../src/transform/apply-map';
import { inverseMap, mapProblem } from '../src/transform/mobius';
import type { Composite, Projective, Similarity, TransformData, Value } from '../src/value';
import { q } from './helpers/doc';

const F = FloatField;
type M9 = readonly [number, number, number, number, number, number, number, number, number];
const proj = (m: M9): Projective<number> => ({ type: 'projective', m });
const SENT: Projective<number> = proj([1, 0, 0, 0, 1, 0, 0, -1, 1]); // W = 1 − y
const DOUBLE: Similarity<number> = {
  type: 'similarity',
  anti: false,
  a: { re: 2, im: 0 },
  b: { re: 1, im: 0 },
};
const why = (v: { readonly reason: string } | undefined) => (v === undefined ? 'valid' : v.reason);

describe('localScale', () => {
  it('a projective map: √(|det m|/|W(x)|³)', () => {
    expect(localScale(SENT, { x: 0, y: 0 })).toBe(1);
    expect(localScale(SENT, { x: 3, y: 0.5 })).toBeCloseTo(Math.sqrt(8), 14);
    expect(localScale(SENT, { x: 0, y: -1 })).toBeCloseTo(Math.sqrt(1 / 8), 14);
    // det 2 (the first row doubled): √2 at W = 1.
    expect(localScale(proj([2, 0, 0, 0, 1, 0, 0, -1, 1]), { x: 0, y: 0 })).toBeCloseTo(
      Math.SQRT2,
      14,
    );
    // On the line sent to infinity: 1 (not scaled).
    expect(localScale(SENT, { x: 2, y: 1 })).toBe(1);
  });

  it('a composite: the product along its factors, each at the image so far', () => {
    // x ↦ 2x + 1 then SENT: at (0, 1/4) the first scale is 2 and the image is (1, 1/2), where
    // SENT scales by √8.
    const c: Composite<number> = { type: 'composite', maps: [DOUBLE, SENT] };
    expect(localScale(c, { x: 0, y: 0.25 })).toBeCloseTo(2 * Math.sqrt(8), 13);
    const back: Composite<number> = { type: 'composite', maps: [SENT, DOUBLE] };
    expect(localScale(back, { x: 0, y: 0.5 })).toBeCloseTo(Math.sqrt(8) * 2, 13);
  });
});

describe('mapProblem and the inverse of a composite', () => {
  it("a composite's problem is its first invalid factor's, named by the tool", () => {
    const flat = proj([1, 0, 0, 0, 0, 0, 0, 0, 1]);
    const c: Composite<number> = { type: 'composite', maps: [DOUBLE, flat, SENT] };
    expect(why(mapProblem(F, c, 'apply'))).toBe(
      'apply: the map is not invertible (its determinant is 0)',
    );
    expect(why(mapProblem(F, { type: 'composite', maps: [DOUBLE, SENT] }, 'apply'))).toBe('valid');
    const huge = proj([1e300, 0, 0, 0, 1e300, 0, 0, 0, 1e300]);
    expect(why(mapProblem(F, huge, 'compose'))).toBe('compose: the map is beyond the double range');
  });

  it('the inverse of a composite undoes it', () => {
    const c: Composite<number> = { type: 'composite', maps: [DOUBLE, SENT] };
    const inv: TransformData<number> = inverseMap(F, c);
    for (const [x, y] of [
      [0, 0],
      [3, 0.25],
      [-2, -1],
    ] as const) {
      const img: Value<number> = applyMap(F, c, { kind: 'point', x, y }, { scale: 4 });
      if (img.kind !== 'point') throw new Error(img.kind);
      const back = applyMap(F, inv, img, { scale: 4 });
      expect(back.kind === 'point' ? [back.x, back.y] : back.kind).toEqual([
        expect.closeTo(x, 12),
        expect.closeTo(y, 12),
      ]);
    }
    // Over Q too (exactly).
    const R = RationalField;
    const r = (x: number) => q(x);
    const cq: Composite<ReturnType<typeof q>> = {
      type: 'composite',
      maps: [
        { type: 'similarity', anti: false, a: { re: r(2), im: r(0) }, b: { re: r(1), im: r(0) } },
        { type: 'projective', m: [r(1), r(0), r(0), r(0), r(1), r(0), r(0), r(-1), r(1)] },
      ],
    };
    const P = applyMap(R, cq, { kind: 'point', x: r(3), y: r(0.25) }, { scale: 4 });
    if (P.kind !== 'point') throw new Error(P.kind);
    expect(applyMap(R, inverseMap(R, cq), P, { scale: 4 })).toEqual({
      kind: 'point',
      x: r(3),
      y: r(0.25),
    });
  });
});
