/**
 * Degenerate cases of the common-tangent overloads of tangent and tangent_point (ADR-0045),
 * spread into degenerate.test.ts. Fixtures: C7 = circle((0, 0), 7) and K1 = circle((10, 0), 1)
 * have four rational common tangents, touching C7 at (4.2, ±5.6) (external) and (5.6, ±4.2)
 * (internal); ELL x²/4 + y² = 1, E53 x²/25 + y²/9 = 1, HYP xy = 1, PAR y = x².
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr, type Selector } from '../../src/expr';
import type { Value } from '../../src/value';
import { FIELDS, ORDERED, plain, reason } from './degenerate';
import { ALONG_M, ALONG_P, ORIENT_M, ORIENT_P, choose, other } from './degenerate-branch';
import { circ, shape } from './degenerate-circles';
import { CONIC_CASES, ELL, HYP, PAR } from './degenerate-conics';
import { E53 } from './degenerate-foci';
import { Builder, REGISTRY, evalDoc, num, pt, valueOf } from './doc';

const C7 = circ(pt(0, 0), num(7));
const K1 = circ(pt(10, 0), num(1));
const near = (p: Expr): Selector => ({ kind: 'near', p });
const conic = (...ps: Expr[]): Expr => call('conic', ps);
/** The parabola x = y². */
const PAR_X = conic(pt(0, 0), pt(1, 1), pt(1, -1), pt(4, 2), pt(4, -2));

/** The candidates of tool(a, b) over F (the arguments evaluated in one document). */
function candidates<T>(F: Field<T>, tool: string, a: Expr, b: Expr): readonly Value<T>[] {
  const bd = new Builder();
  bd.add('a', a);
  bd.add('b', b);
  const ev = evalDoc(bd.doc, F);
  const args = [valueOf(bd.doc, ev, 'a'), valueOf(bd.doc, ev, 'b')];
  const spec = REGISTRY.get(tool);
  if (spec?.candidates === undefined) throw new Error(`${tool} has no candidates`);
  return spec.candidates(F, args, ev.ctx);
}

/** Points as rounded plain pairs (FloatField, 9 places), sorted. */
function rounded(vs: readonly Value<number>[]): number[][] {
  return vs
    .map((v) => {
      if (v.kind !== 'point') throw new Error(`expected a point, got ${v.kind}`);
      return [Math.round(v.x * 1e9) / 1e9 + 0, Math.round(v.y * 1e9) / 1e9 + 0];
    })
    .sort((p, q) => (p[0] ?? 0) - (q[0] ?? 0) || (p[1] ?? 0) - (q[1] ?? 0));
}

/** A point as [x, y]: exact over Q, rounded to 12 places in floats. */
function xy<T>(F: Field<T>, v: Value<T>): unknown {
  const p = plain(F, v);
  if (!Array.isArray(p) || F.kind !== 'float') return p;
  return p.map((c: number) => Math.round(c * 1e12) / 1e12 + 0);
}

const CASES: Record<string, () => void> = {
  'two curves: no selector → Undefined (ambiguous: add a selector), in every field and whatever the count':
    () => {
      for (const F of FIELDS) {
        expect(reason(choose(F, 'tangent', [C7, K1]))).toBe(
          'undefined: ambiguous: add a selector: tangent(c1, c2) has up to four common tangents (for example near(P), same_side(Q, l) or along(±), orient(±))',
        );
        expect(reason(choose(F, 'tangent_point', [ELL, C7]))).toBe(
          'undefined: ambiguous: add a selector: tangent_point(k1, k2) has up to four touch points (for example near(P), same_side(Q, l))',
        );
        // Internally tangent circles have one common tangent: a selector is still needed.
        expect(
          reason(choose(F, 'tangent', [circ(pt(0, 0), num(5)), circ(pt(2, 0), num(3))])),
        ).toMatch(/^undefined: ambiguous: add a selector/);
      }
      expect(rounded(candidates(FloatField, 'tangent_point', C7, K1))).toEqual([
        [4.2, -5.6],
        [4.2, 5.6],
        [5.6, -4.2],
        [5.6, 4.2],
      ]);
      for (const F of ORDERED)
        expect(xy(F, choose(F, 'tangent_point', [C7, K1], [near(pt(0, 10))]))).toEqual([4.2, 5.6]);
    },
  'two circles: equal circles or concentric circles → Undefined': () => {
    for (const F of FIELDS) {
      expect(reason(choose(F, 'tangent', [C7, C7], [near(pt(0, 0))]))).toBe(
        'undefined: the circles coincide: every tangent is common',
      );
      expect(reason(choose(F, 'tangent', [C7, circ(pt(0, 0), num(2))], [near(pt(0, 0))]))).toBe(
        'undefined: concentric circles: no common tangent',
      );
    }
  },
  'two circles: one inside the other → Undefined (no common tangent)': () => {
    for (const F of ORDERED)
      expect(reason(choose(F, 'tangent', [C7, circ(pt(1, 0), num(2))], [near(pt(0, 0))]))).toBe(
        'undefined: no common tangent: one circle lies inside the other',
      );
    expect(choose(ModPField, 'tangent', [C7, circ(pt(1, 0), num(2))], [near(pt(0, 0))]).kind).toBe(
      'inexact',
    );
  },
  'two circles: tangent circles → the common tangent at the touch point, one double candidate':
    () => {
      // Internally tangent at (5, 0): the one (double) external tangent x = 5, exact over Q.
      const [a, b] = [circ(pt(0, 0), num(5)), circ(pt(2, 0), num(3))];
      for (const F of ORDERED) {
        expect(shape(F, choose(F, 'tangent', [a, b], [near(pt(0, 0))]))).toEqual({
          p: [5, 0],
          d: [0, 5],
          chiral: true,
        });
        expect(candidates(F, 'tangent', a, b)).toHaveLength(1);
      }
      // Externally tangent at (3, 0): two external tangents and the double internal one, x = 3.
      const [c, d] = [circ(pt(0, 0), num(3)), circ(pt(5, 0), num(2))];
      expect(candidates(FloatField, 'tangent', c, d)).toHaveLength(3);
      expect(shape(FloatField, choose(FloatField, 'tangent', [c, d], [near(pt(3, 0))]))).toEqual({
        p: [3, 0],
        d: [0, 3],
        chiral: true,
      });
    },
  'two circles: intersecting circles → the two external tangents only': () => {
    const [a, b] = [circ(pt(0, 0), num(5)), circ(pt(6, 0), num(5))];
    for (const F of ORDERED) {
      expect(candidates(F, 'tangent_point', a, b).map((v) => plain(F, v))).toEqual([
        [0, -5],
        [0, 5],
      ]);
      expect(plain(F, choose(F, 'tangent_point', [a, b], [ORIENT_P]))).toEqual([0, 5]);
    }
  },
  'two circles: nearly coincident circles → Undefined (ambiguous) unless the external touch points are apart beyond the band':
    () => {
      const a = circ(pt(0, 0), num(5));
      // Nearly internally tangent and nearly equal: the external touch points merge.
      const b = circ(pt(3e-8, 0), num(5 - 3e-8));
      expect(reason(choose(FloatField, 'tangent', [a, b], [ORIENT_P]))).toBe(
        'undefined: ambiguous: the circles nearly coincide',
      );
      // Equal radii, centres 3·10⁻⁸ apart: the two parallel tangents y = ±5 are well apart.
      const v = choose(FloatField, 'tangent_point', [a, circ(pt(3e-8, 0), num(5))], [ORIENT_P]);
      expect(v.kind === 'point' && Math.hypot(v.x, v.y - 5)).toBeLessThan(1e-9);
    },
  'two circles: square roots not representable → Inexact over Q; always Inexact mod p': () => {
    const [a, b] = [circ(pt(0, 0), num(3)), circ(pt(10, 0), num(1))];
    expect(choose(RationalField, 'tangent', [a, b], [near(pt(0, 5))]).kind).toBe('inexact');
    expect(choose(FloatField, 'tangent', [a, b], [near(pt(0, 5))]).kind).toBe('line');
    expect(choose(ModPField, 'tangent', [C7, K1], [near(pt(0, 5))]).kind).toBe('inexact');
    expect(candidates(ModPField, 'tangent', C7, K1)).toEqual([]);
  },
  'two curves: a touch point off an arc is not a candidate': () => {
    // The upper half of C7, counter-clockwise from (7, 0) to (−7, 0): (4.2, 5.6), (5.6, 4.2).
    const upper = call('arc', [pt(7, 0), pt(0, 7), pt(-7, 0)]);
    for (const F of ORDERED) {
      expect(xy(F, choose(F, 'tangent_point', [upper, K1], [near(pt(4.2, -5.6))]))).toEqual([
        5.6, 4.2,
      ]);
      // An arc of K1: its upper half keeps the tangents touching it above the axis.
      const k1Upper = call('arc', [pt(11, 0), pt(10, 1), pt(9, 0)]);
      expect(candidates(F, 'tangent_point', C7, k1Upper).map((v) => xy(F, v))).toEqual([
        [4.2, 5.6],
        [5.6, -4.2],
      ]);
      const left = call('arc', [pt(0, 7), pt(-7, 0), pt(0, -7)]);
      expect(reason(choose(F, 'tangent', [left, K1], [near(pt(0, 0))]))).toBe(
        'undefined: no common tangent touches the arcs',
      );
    }
  },
  'two curves: other(P) → Undefined (it does not apply); along(±) or orient(±) with a conic → Undefined':
    () => {
      for (const F of FIELDS) {
        expect(reason(choose(F, 'tangent', [C7, K1], [other(pt(7, 0))]))).toBe(
          'undefined: other(point(7, 0)) does not apply to tangent(c1, c2)',
        );
        expect(reason(choose(F, 'tangent', [ELL, K1], [ORIENT_P]))).toBe(
          'undefined: orient(+) does not apply to tangent(k1, k2)',
        );
        expect(reason(choose(F, 'tangent', [K1, ELL], [ALONG_P]))).toBe(
          'undefined: along(+) does not apply to tangent(k1, k2)',
        );
      }
    },
  'two circles: along(−) keeps the external tangents, along(+) the internal ones; orient(±) the side of O₁O₂ where T lies (structural labels; a vanished branch is never replaced)':
    () => {
      for (const F of ORDERED) {
        const at = (sels: Selector[]) => xy(F, choose(F, 'tangent_point', [C7, K1], sels));
        expect(at([ALONG_M, ORIENT_P])).toEqual([4.2, 5.6]);
        expect(at([ALONG_M, ORIENT_M])).toEqual([4.2, -5.6]);
        expect(at([ALONG_P, ORIENT_P])).toEqual([5.6, 4.2]);
        expect(at([ORIENT_M, ALONG_P])).toEqual([5.6, -4.2]);
        expect(reason(choose(F, 'tangent', [C7, K1], [ALONG_P]))).toBe(
          'undefined: ambiguous: add a selector: both common tangents satisfy along(+)',
        );
        // Intersecting circles: no internal tangent, and along(+) never takes an external one.
        const [a, b] = [circ(pt(0, 0), num(5)), circ(pt(6, 0), num(5))];
        expect(reason(choose(F, 'tangent', [a, b], [ALONG_P, ORIENT_P]))).toBe(
          'undefined: no common tangent satisfies along(+), orient(+)',
        );
      }
      // Externally tangent: the double internal tangent alone satisfies along(+) (over Q the
      // external pair is irrational: Inexact).
      const [c, d] = [circ(pt(0, 0), num(3)), circ(pt(5, 0), num(2))];
      expect(shape(FloatField, choose(FloatField, 'tangent', [c, d], [ALONG_P]))).toEqual({
        p: [3, 0],
        d: [0, 3],
        chiral: true,
      });
    },
  'a conic: the curves coincide → Undefined (within the band: ambiguous)': () => {
    // The conic through five points of C7 is C7 itself.
    const same = conic(pt(7, 0), pt(0, 7), pt(-7, 0), pt(0, -7), pt('21/5', '28/5'));
    expect(reason(choose(FloatField, 'tangent', [same, C7], [near(pt(0, 0))]))).toBe(
      'undefined: the curves coincide: every tangent is common',
    );
    expect(reason(choose(FloatField, 'tangent', [ELL, ELL], [near(pt(0, 0))]))).toBe(
      'undefined: the curves coincide: every tangent is common',
    );
  },
  'a conic: no common tangent → Undefined': () => {
    expect(reason(choose(FloatField, 'tangent', [E53, ELL], [near(pt(0, 0))]))).toBe(
      'undefined: no common tangent',
    );
    expect(
      reason(choose(FloatField, 'tangent', [circ(pt(0, 0), num(10)), ELL], [near(pt(0, 0))])),
    ).toBe('undefined: no common tangent');
  },
  'a conic: the line at infinity (two parabolas) and an asymptote of the first curve are not candidates':
    () => {
      // y = x² and x = y²: one finite real common tangent, y = −x − 1/4, touching y = x² at
      // (−1/2, 1/4); the line at infinity is common to every two parabolas.
      expect(rounded(candidates(FloatField, 'tangent_point', PAR, PAR_X))).toEqual([[-0.5, 0.25]]);
      // xy = 1 and the circle about (5, 2) of radius 2 share the asymptote y = 0, which touches
      // the hyperbola at infinity (no candidate) and the circle at (5, 0) (a candidate).
      const c = circ(pt(5, 2), num(2));
      const onHyp = rounded(candidates(FloatField, 'tangent_point', HYP, c));
      expect(onHyp.every((p) => Math.abs((p[0] ?? 0) * (p[1] ?? 0) - 1) < 1e-6)).toBe(true);
      const onCircle = rounded(candidates(FloatField, 'tangent_point', c, HYP));
      expect(onCircle).toContainEqual([5, 0]);
      expect(onCircle).toHaveLength(onHyp.length + 1);
    },
  'a conic: over Q and mod p the common tangents are roots of a quartic → Inexact': () => {
    for (const F of [RationalField, ModPField] as Field<unknown>[]) {
      expect(reason(choose(F, 'tangent', [ELL, C7], [near(pt(0, 0))]))).toMatch(
        /^inexact: the common tangents of two conics are roots of a quartic/,
      );
      expect(candidates(F, 'tangent', ELL, C7)).toEqual([]);
    }
  },
};

const AT_POINT: Record<string, () => void> = {
  'tangent(P, c) with a selector → Undefined (the tangent at P is unique)': () => {
    for (const F of FIELDS)
      expect(reason(choose(F, 'tangent', [pt(7, 0), C7], [near(pt(0, 0))]))).toBe(
        'undefined: tangent(P, c): the tangent at P is unique: it takes no selector',
      );
  },
};

export const COMMON_TANGENT_CASES: Record<string, Record<string, () => void>> = {
  tangent: { ...CONIC_CASES['tangent'], ...AT_POINT, ...CASES },
  tangent_point: { ...CONIC_CASES['tangent_point'], ...CASES },
};
