/**
 * Degenerate cases of conic ∩ conic and conic ∩ circle (ADR-0043), spread into
 * degenerate.test.ts's `intersect` entry. Fixtures: K1 and K2, two conics through the common
 * points (0, 0), (4, 0), (0, 3), (3, 5) (their fifth points differ); ELL the ellipse
 * x²/4 + y² = 1 (degenerate-conics.ts); C32 the circle of radius 3/2 about the origin, which meets
 * ELL at (±√(5/3), ±√(7/12)).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr, type Selector } from '../../src/expr';
import { fourthPoint } from '../../src/tools/conic-conic';
import { FIELDS, ORDERED, plain, reason } from './degenerate';
import { ALONG_P, ORIENT_P, choose, other } from './degenerate-branch';
import { circ } from './degenerate-circles';
import { ELL, HYP, PAR } from './degenerate-conics';
import { contextOf, Builder, pt } from './doc';

const conic = (...ps: Expr[]): Expr => call('conic', ps);
const [P0, P1, P2, P3] = [pt(0, 0), pt(4, 0), pt(0, 3), pt(3, 5)];
export const K1 = conic(P0, P1, P2, P3, pt(-1, 2));
export const K2 = conic(P0, P1, P2, P3, pt(2, -2));
export const C32 = circ(pt(0, 0), pt('3/2', 0));
const near = (p: Expr): Selector => ({ kind: 'near', p });
const farFrom = (p: Expr): Selector => ({ kind: 'far_from', p });
export const other3 = (p: Expr, q: Expr, r: Expr): Selector => ({
  kind: 'other',
  p,
  rest: [q, r],
});

/** A float point's distance from (x, y). */
function off(v: ReturnType<typeof choose<number>>, x: number, y: number): number {
  if (v.kind !== 'point') throw new Error(`expected a point, got ${reason(v)}`);
  return Math.hypot(v.x - x, v.y - y);
}

/** The ellipse ELL through its point (6/5, 4/5) first (so that is its known point). */
const ELL_A = conic(pt('6/5', '4/5'), pt(2, 0), pt(0, 1), pt(-2, 0), pt(0, -1));

export const CONIC_CONIC_CASES: Record<string, () => void> = {
  'conic ∩ conic: no selector → Undefined (ambiguous: add a selector), in every field and whatever the count':
    () => {
      for (const F of FIELDS) {
        expect(reason(choose(F, 'intersect', [K1, K2]))).toBe(
          'undefined: ambiguous: add a selector: conic ∩ conic has up to four intersections (for example other(P, Q, R), near(P), same_side(Q, l))',
        );
        // One common point only (a tangency): still a selector, so every field agrees.
        expect(reason(choose(F, 'intersect', [ELL, circ(pt(0, 2), pt(0, 1))]))).toMatch(
          /^undefined: ambiguous: add a selector: conic ∩ conic/,
        );
      }
    },
  'conic ∩ conic: the conics coincide → Undefined (within the band in floats: ambiguous)': () => {
    const same = conic(pt(0, 1), pt(2, 0), pt(0, -1), pt(-2, 0), pt('6/5', '4/5'));
    for (const F of FIELDS)
      expect(reason(choose(F, 'intersect', [ELL, same], [near(P0)]))).toBe(
        'undefined: the conics coincide',
      );
    const moved = (dx: number) =>
      conic(pt(2, 0), pt(0, 1), pt(-2, 0), pt(0, -1), pt(1.2 + dx, 0.8));
    expect(reason(choose(FloatField, 'intersect', [ELL, moved(1e-13)], [near(P0)]))).toBe(
      'undefined: the conics coincide',
    );
    expect(reason(choose(FloatField, 'intersect', [ELL, moved(2e-8)], [near(P0)]))).toBe(
      'undefined: ambiguous: the conics nearly coincide',
    );
    // Beyond the band: four common points of two distinct ellipses (two of them A, C).
    expect(choose(FloatField, 'intersect', [ELL, moved(1e-3)], [near(pt(2, 0))]).kind).toBe(
      'point',
    );
  },
  'conic ∩ conic: the conics do not meet → Undefined': () => {
    expect(
      reason(choose(FloatField, 'intersect', [ELL, circ(pt(10, 0), pt(11, 0))], [near(P0)])),
    ).toBe('undefined: no intersection: the conics do not meet');
    // Nested: one ellipse inside the other.
    const inner = conic(pt(1, 0), pt(0, '1/2'), pt(-1, 0), pt(0, '-1/2'), pt('3/5', '2/5'));
    expect(reason(choose(FloatField, 'intersect', [inner, ELL], [near(P0)]))).toBe(
      'undefined: no intersection: the conics do not meet',
    );
  },
  'conic ∩ conic: tangency (a chord gap within the band) → the double point': () => {
    // circle about (0, 2) of radius 1 touches ELL at (0, 1) and meets it nowhere else.
    const c = circ(pt(0, 2), pt(0, 1));
    expect(off(choose(FloatField, 'intersect', [ELL, c], [near(P0)]), 0, 1)).toBeLessThan(1e-12);
    // Within the band: the double point; beyond it two points.
    const near1 = (y: number) => circ(pt(0, 1 + y), pt(0, y));
    expect(
      off(choose(FloatField, 'intersect', [ELL, near1(1 + 1e-9)], [near(P0)]), 0, 1),
    ).toBeLessThan(1e-8);
    const two = choose(FloatField, 'intersect', [ELL, near1(0.99)], [near(pt(1, 1))]);
    expect(off(two, 0, 1)).toBeGreaterThan(1e-3);
  },
  'conic ∩ conic: three common points that merge (osculation, within ∛EPS) → one triple point':
    () => {
      // The image of ELL_A under conic_to_circle(ELL_A) is its osculating circle at (6/5, 4/5).
      const g = call('conic_to_circle', [ELL_A]);
      const osc = call('apply', [g, ELL_A]);
      const at = choose(FloatField, 'intersect', [ELL_A, osc], [near(pt(1, 1))]);
      expect(off(at, 1.2, 0.8)).toBeLessThan(1e-9);
      // The fourth point is a second candidate, on both curves, far from the triple point.
      const far = choose(FloatField, 'intersect', [ELL_A, osc], [farFrom(pt('6/5', '4/5'))]);
      expect(off(far, 1.2, 0.8)).toBeGreaterThan(0.5);
    },
  'conic ∩ conic: four common points that merge (a four-point contact) → one point': () => {
    // The circle of curvature at the vertex (2, 0): centre (3/2, 0), radius 1/2.
    const c = circ(pt('3/2', 0), pt(2, 0));
    for (const s of [near(P0), farFrom(P0)])
      expect(plain(FloatField, choose(FloatField, 'intersect', [ELL, c], [s]))).toEqual([2, 0]);
  },
  'conic ∩ conic: a common point at infinity is not a candidate (parallel parabolas, a shared asymptote)':
    () => {
      // y = x² and y = x² + x + 1 meet at (−1, 1) and twice at infinity.
      const par2 = conic(pt(0, 1), pt(1, 3), pt(-1, 1), pt(2, 7), pt(-2, 3));
      for (const s of [near(P0), farFrom(P0)])
        expect(off(choose(FloatField, 'intersect', [PAR, par2], [s]), -1, 1)).toBeLessThan(1e-12);
      // xy = 1 and xy = 1 + x share their asymptotic directions and meet only at infinity.
      const hyp2 = conic(pt(1, 2), pt(-1, 0), pt(2, '3/2'), pt('1/2', 3), pt(-2, '1/2'));
      expect(reason(choose(FloatField, 'intersect', [HYP, hyp2], [near(P0)]))).toBe(
        'undefined: no intersection: the conics do not meet',
      );
    },
  'conic ∩ conic: a common point near infinity → Undefined (ambiguous)': () => {
    // y = x² and its rotation by 10⁻⁴ about the origin: their other common point is near infinity
    // (the line through it is inside the band of the parabolas' axis direction).
    const t = 5e-5;
    const [c, s] = [(1 - t * t) / (1 + t * t), (2 * t) / (1 + t * t)];
    const rot = (x: number, y: number) => pt(c * x - s * y, s * x + c * y);
    const par2 = conic(rot(0, 0), rot(1, 1), rot(-1, 1), rot(2, 4), rot(-2, 4));
    expect(reason(choose(FloatField, 'intersect', [PAR, par2], [near(P0)]))).toBe(
      'undefined: ambiguous: a common point is near infinity',
    );
  },
  'conic ∩ conic: over Q and mod p the candidates are roots of a quartic → Inexact (other(P, Q, R) is exact)':
    () => {
      for (const F of [RationalField, ModPField] as Field<unknown>[])
        expect(reason(choose(F, 'intersect', [K1, K2], [near(pt(3, 4))]))).toBe(
          `inexact: the common points of two conics are roots of a quartic, not representable in ${F.name}: other(P, Q, R) gives the fourth point exactly`,
        );
      expect(off(choose(FloatField, 'intersect', [K1, K2], [near(pt(3, 4))]), 3, 5)).toBeLessThan(
        1e-12,
      );
    },
  'conic ∩ conic: other(P, Q, R) → the fourth common point, exact in every field': () => {
    for (const [x, y, z, w] of [
      [P0, P1, P2, [3, 5]],
      [P3, P2, P0, [4, 0]],
      [P1, P3, P2, [0, 0]],
    ] as const) {
      expect(
        plain(RationalField, choose(RationalField, 'intersect', [K1, K2], [other3(x, y, z)])),
      ).toEqual(w);
      expect(
        off(choose(FloatField, 'intersect', [K1, K2], [other3(x, y, z)]), w[0], w[1]),
      ).toBeLessThan(1e-12);
    }
    expect(choose(ModPField, 'intersect', [K2, K1], [other3(P0, P1, P2)])).toEqual({
      kind: 'point',
      x: 3n,
      y: 5n,
    });
    // A circle and a conic: the circle through three common points (2, 0), (0, 1), (−6/5, 4/5)
    // of ELL meets it a fourth time.
    const c = call('circle', [pt(2, 0), pt(0, 1), pt('-6/5', '4/5')]);
    const exact = choose(
      RationalField,
      'intersect',
      [ELL, c],
      [other3(pt(2, 0), pt(0, 1), pt('-6/5', '4/5'))],
    );
    const float = choose(
      FloatField,
      'intersect',
      [c, ELL],
      [other3(pt(0, 1), pt(2, 0), pt('-6/5', '4/5'))],
    );
    expect(exact.kind).toBe('point');
    const [ex, ey] = plain(RationalField, exact) as [number, number];
    expect(off(float, ex, ey)).toBeLessThan(1e-12);
  },
  'conic ∩ conic: other(P, Q, R) with two points coincident, collinear points, or a point off a curve → Undefined':
    () => {
      for (const F of FIELDS)
        expect(reason(choose(F, 'intersect', [K1, K2], [other3(P0, P0, P1)]))).toBe(
          'undefined: other(P, Q, R) needs three distinct points',
        );
      for (const F of ORDERED)
        expect(reason(choose(F, 'intersect', [K1, K2], [other3(P0, P1, pt(2, 0))]))).toBe(
          'undefined: other(point(0, 0), point(4, 0), point(2, 0)) needs the point on the first conic',
        );
      // Collinear points never lie on two conics: the computation itself refuses them.
      const b = new Builder();
      b.add('x', pt(0, 0));
      const ctx = contextOf(b.doc);
      const q = [1, 0, 1, 0, 0, -1] as const;
      const r = [1, 0, 2, 0, 0, -1] as const;
      const v = (x: number, y: number) => ({ x, y });
      expect(fourthPoint(FloatField, q, r, [v(0, 0), v(1, 0), v(2, 0)], ctx)).toEqual({
        kind: 'undefined',
        reason:
          'other(P, Q, R): the three points are collinear, so they are not three common points of two conics',
      });
    },
  'conic ∩ conic: other(P, Q, R) with the fourth point at infinity → Undefined': () => {
    // 2xy + x + 2y² − y − 4 = 0 meets xy = 1 at (1, 1), (2, 1/2), (−1, −1) and at infinity.
    const k = conic(pt(1, 1), pt(2, '1/2'), pt(-1, -1), pt(4, 0), pt('-2/5', 2));
    for (const F of FIELDS)
      expect(
        reason(choose(F, 'intersect', [HYP, k], [other3(pt(1, 1), pt(2, '1/2'), pt(-1, -1))])),
      ).toBe('undefined: the fourth common point is at infinity');
  },
  'conic ∩ conic: other(P) with one point, along(±) or orient(±) → Undefined (they do not apply)':
    () => {
      for (const F of FIELDS) {
        expect(reason(choose(F, 'intersect', [K1, K2], [other(P0)]))).toBe(
          'undefined: other(point(0, 0)) does not apply to conic ∩ conic: name its three other common points, other(P, Q, R)',
        );
        expect(reason(choose(F, 'intersect', [K1, K2], [ALONG_P]))).toBe(
          'undefined: along(+) does not apply to conic ∩ conic',
        );
        expect(reason(choose(F, 'intersect', [K1, K2], [ORIENT_P]))).toBe(
          'undefined: orient(+) does not apply to conic ∩ conic',
        );
      }
    },
  'conic ∩ conic: near(P) with the nearest candidates equally far (within the band) → Undefined (ambiguous)':
    () => {
      const tie =
        'undefined: ambiguous: near(point(0, 0)): the candidates are equally far from the point';
      expect(reason(choose(FloatField, 'intersect', [ELL, C32], [near(P0)]))).toBe(tie);
      const [x, y] = [Math.sqrt(5 / 3), Math.sqrt(7 / 12)];
      expect(off(choose(FloatField, 'intersect', [ELL, C32], [near(pt(1, 1))]), x, y)).toBeLessThan(
        1e-12,
      );
      expect(
        off(choose(FloatField, 'intersect', [ELL, C32], [farFrom(pt(1, 1))]), -x, -y),
      ).toBeLessThan(1e-12);
    },
  'conic ∩ circle: a candidate off an arc is not a candidate': () => {
    const upper = call('arc', [pt('3/2', 0), pt(0, '3/2'), pt('-3/2', 0)]);
    const [x, y] = [Math.sqrt(5 / 3), Math.sqrt(7 / 12)];
    expect(
      off(choose(FloatField, 'intersect', [ELL, upper], [near(pt(2, -5))]), x, y),
    ).toBeLessThan(1e-12);
    expect(off(choose(FloatField, 'intersect', [ELL, C32], [near(pt(2, -5))]), x, -y)).toBeLessThan(
      1e-12,
    );
    // On the lower arc only the two lower points are candidates.
    const lower = call('arc', [pt('-3/2', 0), pt(0, '-3/2'), pt('3/2', 0)]);
    expect(
      off(choose(FloatField, 'intersect', [lower, ELL], [near(pt(1, 5))]), x, -y),
    ).toBeLessThan(1e-12);
    // An arc that misses the conic: no candidate left.
    const small = call('arc', [pt('9/10', '6/5'), pt(0, '3/2'), pt('-9/10', '6/5')]);
    expect(reason(choose(FloatField, 'intersect', [ELL, small], [near(P0)]))).toBe(
      'undefined: no intersection: it lies outside the arc',
    );
  },
};
