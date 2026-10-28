/**
 * Run 16a (ADR-0040): the degenerate cases of points at infinity and projective maps, part of
 * degenerate.test.ts's table. `line` and `apply` repeat their earlier cases (the same functions)
 * with the new ones, since a spread replaces a tool's whole entry.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import type { Value } from '../../src/value';
import { REGISTRY, num, pt } from './doc';
import { FIELDS, ORDERED, at, coincidentTwoPoints, line, reason, seg } from './degenerate';
import { MOBIUS_CASES } from './degenerate-mobius';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);

/** The point at infinity of the horizontal lines (direction (1, 0)). */
export const H_INF: Expr = T('intersect', line(pt(0, 0), pt(1, 0)), line(pt(0, 1), pt(1, 1)));
/** The point at infinity of the vertical lines (direction (0, 1)). */
export const V_INF: Expr = T('intersect', line(pt(0, 0), pt(0, 1)), line(pt(1, 0), pt(1, 1)));
/** send_to_infinity of the x axis through (0, 0), (4, 0): (x, y) ↦ (4x/y, 16/y). */
export const SEND_X: Expr = T('send_to_infinity', line(pt(0, 0), pt(4, 0)));

/** A value as plain numbers: [kind, …numbers] (points, ideal points, lines with ranges). */
export function nums<X>(F: Field<X>, v: Value<X>): unknown {
  const n = (x: X) => F.toNumber(x) + 0;
  switch (v.kind) {
    case 'point':
      return ['point', n(v.x), n(v.y)];
    case 'ideal_point':
      return ['ideal', n(v.d.x), n(v.d.y), v.chiral];
    case 'line':
      return [
        'line',
        [n(v.p.x), n(v.p.y)],
        [n(v.d.x), n(v.d.y)],
        v.lo === null ? null : n(v.lo),
        v.hi === null ? null : n(v.hi),
        v.outside === true,
        v.chiral,
      ];
    case 'circle':
    case 'number':
    case 'polygon':
    case 'transform':
    case 'angle_mark':
    case 'segment_mark':
    case 'text':
    case 'string':
    case 'undefined':
    case 'inexact':
      return reason(v);
  }
}

/** Whether two directions are parallel (exact fields: exactly; floats: within 1e-12). */
function parallelDirs(x: unknown, y: readonly [number, number]): boolean {
  if (!Array.isArray(x)) return false;
  const [, dx, dy] = x as [string, number, number];
  return Math.abs(dx * y[1] - dy * y[0]) <= 1e-12 * Math.hypot(dx, dy) * Math.hypot(...y);
}

const LINE_CASES: Record<string, () => void> = {
  'line(A, A) → Undefined (coincident points)': coincidentTwoPoints('line'),
  "line(P, X) with X a point at infinity → the parallel through P (X's direction and flag)": () => {
    for (const F of FIELDS) {
      for (const v of [at(F, 'line', pt(0, 2), H_INF), at(F, 'line', H_INF, pt(0, 2))]) {
        expect(v.kind === 'line' && [v.lo, v.hi, v.chiral]).toEqual([null, null, false]);
        if (F !== ModPField)
          expect(nums(F, v)).toEqual(['line', [0, 2], [1, 0], null, null, false, false]);
      }
    }
    // The flag of a chiral direction (perp toggles it) is kept.
    const vChiral = T(
      'intersect',
      T('perp', pt(0, 0), line(pt(0, 0), pt(1, 0))),
      T('perp', pt(1, 0), line(pt(0, 0), pt(1, 0))),
    );
    const v = at(RationalField, 'line', pt(3, 3), vChiral);
    expect(v.kind === 'line' && v.chiral).toBe(true);
  },
  'line(X, Y) of two points at infinity → Undefined (the line at infinity is not an object)':
    () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'line', H_INF, V_INF))).toBe(
          'undefined: line(X, Y): two points at infinity span the line at infinity, which is not an object',
        );
        expect(reason(at(F, 'line', H_INF, H_INF))).toMatch(/line at infinity/);
      }
    },
};

const APPLY_PROJECTIVE: Record<string, () => void> = {
  'a point at infinity under a similarity → the point at infinity of the mapped direction': () => {
    for (const F of ORDERED)
      expect(nums(F, at(F, 'apply', T('rotate', pt(0, 0), num(90)), H_INF))).toEqual([
        'ideal',
        0,
        1,
        false,
      ]);
    expect(at(ModPField, 'apply', T('rotate', pt(0, 0), num(90)), H_INF).kind).toBe('ideal_point');
  },
  'a point at infinity under a Möbius map with a pole → Undefined': () => {
    for (const F of FIELDS)
      expect(reason(at(F, 'apply', T('inversion', pt(0, 0), num(1)), H_INF))).toMatch(
        /^undefined: apply: a Möbius map with a pole sends every point at infinity to one point/,
      );
    // With no pole (two inversions about one centre: a homothety) the direction is mapped.
    const h = T('compose', T('inversion', pt(0, 0), num(4)), T('inversion', pt(0, 0), num(1)));
    expect(nums(RationalField, at(RationalField, 'apply', h, H_INF))).toEqual([
      'ideal',
      4,
      0,
      false,
    ]);
  },
  'under a projective map: a point on the line sent to infinity → a point at infinity': () => {
    for (const F of ORDERED) {
      const v = nums(F, at(F, 'apply', SEND_X, pt(2, 0)));
      expect(Array.isArray(v) && v[0]).toBe('ideal');
      expect(parallelDirs(v, [1, 2])).toBe(true);
    }
    expect(at(ModPField, 'apply', SEND_X, pt(2, 0)).kind).toBe('ideal_point');
    // Off the line: (x, y) ↦ (4x/y, 16/y).
    for (const F of ORDERED)
      expect(nums(F, at(F, 'apply', SEND_X, pt(1, 2)))).toEqual(['point', 2, 8]);
  },
  'under a projective map: a point at infinity off its direction → a point': () => {
    for (const F of ORDERED) {
      expect(nums(F, at(F, 'apply', SEND_X, V_INF))).toEqual(['point', 0, 0]);
      const h = nums(F, at(F, 'apply', SEND_X, H_INF));
      expect(Array.isArray(h) && h[0]).toBe('ideal');
      expect(parallelDirs(h, [1, 0])).toBe(true);
    }
  },
  'under a projective map: a segment crossing the line sent to infinity → two rays': () => {
    for (const F of ORDERED) {
      const v = at(F, 'apply', SEND_X, seg(pt(1, -1), pt(1, 1)));
      expect(v.kind === 'line' && v.outside).toBe(true);
      if (v.kind !== 'line' || v.lo === null || v.hi === null) throw new Error(reason(v));
      const end = (t: unknown) => [
        F.toNumber(v.p.x) + F.toNumber(v.d.x) * (t as number),
        F.toNumber(v.p.y) + F.toNumber(v.d.y) * (t as number),
      ];
      const ends = [end(F.toNumber(v.lo)), end(F.toNumber(v.hi))].map((e) => e.map((x) => x + 0));
      expect(ends.sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))).toEqual([
        [-4, -16],
        [4, 16],
      ]);
    }
    // A segment with an end on it → a ray; a segment off it → a segment.
    const ray = at(RationalField, 'apply', SEND_X, seg(pt(1, 0), pt(1, 1)));
    expect(ray.kind === 'line' && [ray.lo === null, ray.hi === null, ray.outside]).toContain(true);
    const segment = at(RationalField, 'apply', SEND_X, seg(pt(1, 1), pt(2, 2)));
    expect(segment.kind === 'line' && [segment.lo !== null, segment.hi !== null]).toEqual([
      true,
      true,
    ]);
  },
  'under a projective map: the line sent to infinity → Undefined': () => {
    for (const F of FIELDS)
      expect(reason(at(F, 'apply', SEND_X, line(pt(1, 0), pt(3, 0))))).toBe(
        'undefined: apply: the line is sent to infinity (the line at infinity is not an object)',
      );
  },
  'under a projective map: a circle → Undefined (a conic)': () => {
    for (const F of FIELDS)
      expect(reason(at(F, 'apply', SEND_X, T('circle', pt(0, 3), pt(1, 3))))).toMatch(
        /^undefined: apply: a projective map sends a circle to a conic/,
      );
  },
  'under a projective map: a polygon with a side through infinity → Undefined': () => {
    for (const F of ORDERED) {
      const crossing = T('polygon', pt(1, 1), pt(2, -1), pt(3, 1));
      expect(reason(at(F, 'apply', SEND_X, crossing))).toBe(
        'undefined: apply: a side of the polygon passes through infinity, so it has no image',
      );
      const above = at(F, 'apply', SEND_X, T('polygon', pt(1, 1), pt(2, 2), pt(1, 4)));
      expect(above.kind).toBe('polygon');
    }
    expect(at(ModPField, 'apply', SEND_X, T('polygon', pt(1, 1), pt(2, 2), pt(1, 4))).kind).toBe(
      'inexact',
    );
  },
  'under a projective map: a segment mark → Undefined; an angle mark → not right': () => {
    for (const F of ORDERED) {
      expect(reason(at(F, 'apply', SEND_X, T('mark_segment', pt(1, 1), pt(2, 2))))).toMatch(
        /does not keep lengths/,
      );
      const m = at(F, 'apply', SEND_X, T('mark_right', pt(2, 2), pt(1, 2), pt(1, 3)));
      expect(m.kind === 'angle_mark' && [m.right, m.arcs]).toEqual([false, 1]);
    }
  },
  'under a projective map: a position within the band of the line sent to infinity → Undefined (ambiguous)':
    () => {
      expect(reason(at(FloatField, 'apply', SEND_X, pt(1, 1e-8)))).toBe(
        'undefined: ambiguous: within the band of the line sent to infinity',
      );
      expect(at(RationalField, 'apply', SEND_X, pt(1, 1e-8)).kind).toBe('point');
    },
  'mod p, a range through a projective map → Inexact (needs an order)': () => {
    expect(at(ModPField, 'apply', SEND_X, seg(pt(1, 1), pt(2, 2))).kind).toBe('inexact');
    expect(at(ModPField, 'apply', SEND_X, line(pt(1, 1), pt(2, 2))).kind).toBe('line');
  },
  'a composite of a Möbius map and a projective map → each map in turn': () => {
    const inv = T('inversion', pt(0, 0), num(1));
    const both = T('compose', inv, SEND_X);
    for (const F of ORDERED) {
      const once = at(F, 'apply', both, pt(1, 2));
      const steps = at(F, 'apply', inv, T('apply', SEND_X, pt(1, 2)));
      expect(nums(F, once)).toEqual(nums(F, steps));
      // (1, 2) ↦ (2, 8) ↦ (2, 8)/68.
      expect(nums(F, once)).toEqual(['point', 2 / 68, 8 / 68]);
    }
    // A point the projective map sends to infinity has no image under the inversion after it.
    expect(reason(at(RationalField, 'apply', both, pt(2, 0)))).toMatch(
      /^undefined: apply: a Möbius/,
    );
  },
};

const ORIGIN = pt(0, 0);
const X6 = pt(6, 0);
const xAxis = line(pt(0, 0), pt(1, 0));
const HARMONIC_CASES: Record<string, () => void> = {
  'A = B → Undefined': () => {
    for (const F of FIELDS)
      expect(reason(at(F, 'harmonic_conjugate', ORIGIN, ORIGIN, pt(1, 0)))).toBe(
        'undefined: coincident points: harmonic_conjugate(A, B, C) needs A ≠ B',
      );
  },
  'C not on line AB → Undefined (within the band: ambiguous)': () => {
    for (const F of FIELDS)
      expect(reason(at(F, 'harmonic_conjugate', ORIGIN, X6, pt(2, 1)))).toMatch(
        /^undefined: harmonic_conjugate\(A, B, C\) needs C on line AB/,
      );
    expect(reason(at(FloatField, 'harmonic_conjugate', ORIGIN, X6, pt(2, 1e-8)))).toMatch(
      /^undefined: ambiguous/,
    );
  },
  'C = A or C = B → Undefined': () => {
    for (const F of FIELDS)
      for (const C of [ORIGIN, X6])
        expect(reason(at(F, 'harmonic_conjugate', ORIGIN, X6, C))).toBe(
          'undefined: harmonic_conjugate: C = A or C = B has no harmonic conjugate',
        );
  },
  'C the midpoint of AB → the point at infinity of AB': () => {
    for (const F of ORDERED)
      expect(nums(F, at(F, 'harmonic_conjugate', ORIGIN, X6, pt(3, 0)))).toEqual([
        'ideal',
        6,
        0,
        false,
      ]);
    expect(at(ModPField, 'harmonic_conjugate', ORIGIN, X6, pt(3, 0)).kind).toBe('ideal_point');
    // (0, 6; 2, D) = −1: MC·MD = MA² with M = 3, C = 2 → D = 3 − 9 = −6.
    for (const F of ORDERED)
      expect(nums(F, at(F, 'harmonic_conjugate', ORIGIN, X6, pt(2, 0)))).toEqual(['point', -6, 0]);
  },
  'C the point at infinity of AB → the midpoint; of another direction → Undefined': () => {
    for (const F of FIELDS) {
      const v = at(F, 'harmonic_conjugate', ORIGIN, X6, H_INF);
      expect(v.kind).toBe('point');
      if (F !== ModPField) expect(nums(F, v)).toEqual(['point', 3, 0]);
      expect(reason(at(F, 'harmonic_conjugate', ORIGIN, X6, V_INF))).toBe(
        'undefined: harmonic_conjugate: C is a point at infinity off line AB',
      );
    }
  },
  'lines: two of a, b, c the same line → Undefined': () => {
    for (const F of FIELDS)
      expect(
        reason(
          at(F, 'harmonic_conjugate', xAxis, line(pt(2, 0), pt(5, 0)), line(ORIGIN, pt(0, 1))),
        ),
      ).toBe('undefined: harmonic_conjugate: two of a, b, c are the same line');
  },
  'lines: a, b, c not concurrent → Undefined': () => {
    for (const F of FIELDS) {
      const c = line(pt(0, 1), pt(1, 2));
      expect(reason(at(F, 'harmonic_conjugate', xAxis, line(ORIGIN, pt(0, 1)), c))).toBe(
        'undefined: harmonic_conjugate(a, b, c) needs a, b and c concurrent',
      );
      const par = line(pt(0, 3), pt(1, 3));
      expect(reason(at(F, 'harmonic_conjugate', xAxis, par, line(ORIGIN, pt(0, 1))))).toBe(
        'undefined: harmonic_conjugate(a, b, c) needs a, b and c concurrent',
      );
    }
  },
  'lines: a parallel pencil → the parallel line; c midway → Undefined (the line at infinity)':
    () => {
      const y = (k: number) => line(pt(0, k), pt(1, k));
      for (const F of ORDERED) {
        // y = 0, y = 6, y = 2: the conjugate is y = −6.
        const v = at(F, 'harmonic_conjugate', y(0), y(6), y(2));
        expect(v.kind === 'line' && F.toNumber(v.p.y) + 0).toBe(-6);
        expect(v.kind === 'line' && F.toNumber(v.d.y) + 0).toBe(0);
        expect(reason(at(F, 'harmonic_conjugate', y(0), y(6), y(3)))).toMatch(/line at infinity/);
      }
    },
};

const PROJECTIVE_CASES_OWN: Record<string, Record<string, () => void>> = {
  harmonic_conjugate: HARMONIC_CASES,
  projective: {
    'three of A, B, C, D collinear (or coincident) → Undefined': () => {
      const sq = [pt(0, 0), pt(4, 0), pt(4, 4), pt(0, 4)];
      for (const F of FIELDS) {
        expect(reason(at(F, 'projective', pt(0, 0), pt(2, 0), pt(4, 0), pt(0, 4), ...sq))).toBe(
          'undefined: projective: A, B, C are collinear: no three of the four points may be',
        );
        expect(reason(at(F, 'projective', pt(0, 0), pt(0, 0), pt(4, 4), pt(0, 4), ...sq))).toMatch(
          /collinear/,
        );
      }
    },
    "three of A', B', C', D' collinear (or coincident) → Undefined": () => {
      const sq = [pt(0, 0), pt(4, 0), pt(4, 4), pt(0, 4)];
      for (const F of FIELDS)
        expect(reason(at(F, 'projective', ...sq, pt(0, 0), pt(4, 0), pt(4, 4), pt(2, 2)))).toBe(
          'undefined: projective: A′, C′, D′ are collinear: no three of the four points may be',
        );
    },
    'points at infinity among the eight → the map through them': () => {
      // A unit square to a quadrilateral with D′ at infinity (direction (1, 2)): D goes there.
      const d2 = T('intersect', line(pt(0, 0), pt(1, 2)), line(pt(1, 0), pt(2, 2)));
      const sq = [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)];
      const f = T('projective', ...sq, pt(0, 0), pt(1, 0), pt(1, 1), d2);
      for (const F of ORDERED) {
        expect(nums(F, at(F, 'apply', f, pt(1, 1)))).toEqual(['point', 1, 1]);
        expect(nums(F, at(F, 'apply', f, pt(1, 0)))).toEqual(['point', 1, 0]);
        const d = nums(F, at(F, 'apply', f, pt(0, 1)));
        expect(parallelDirs(d, [1, 2])).toBe(true);
      }
    },
  },
  send_to_infinity: {
    'a line without direction → Undefined': () => {
      for (const F of FIELDS) {
        const o = { x: F.zero, y: F.zero };
        const bad: Value<unknown> = { kind: 'line', p: o, d: o, lo: null, hi: null, chiral: false };
        const tool = 'send_to_infinity';
        expect(reason(directCompute(F, tool, [bad]))).toBe('undefined: the line has no direction');
      }
    },
    'a segment or ray → the map of its carrier line': () => {
      for (const F of ORDERED) {
        const a = at(F, 'apply', T('send_to_infinity', seg(pt(0, 0), pt(4, 0))), pt(1, 2));
        expect(nums(F, a)).toEqual(['point', 2, 8]);
      }
    },
    'l itself → Undefined under the map (sent to infinity)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'apply', SEND_X, line(pt(0, 0), pt(4, 0))))).toMatch(
          /sent to infinity/,
        );
    },
    'applied twice → the identity (an involution)': () => {
      const twice = (F: Field<unknown>) => at(F, 'apply', SEND_X, T('apply', SEND_X, pt(3, 5)));
      expect(nums(RationalField, twice(RationalField))).toEqual(['point', 3, 5]);
      const v = twice(FloatField);
      expect(v.kind === 'point' && [v.x, v.y].map((x) => Number(x))).toEqual([
        expect.closeTo(3, 12),
        expect.closeTo(5, 12),
      ]);
    },
  },
};

function directCompute<X>(F: Field<X>, tool: string, args: readonly Value<X>[]): Value<X> {
  const spec = REGISTRY.get(tool);
  if (spec === undefined) throw new Error(tool);
  return spec.compute(F, args, { scale: 1 });
}

/** The entries to spread at the end of the table. */
export const PROJECTIVE_CASES: Record<string, Record<string, () => void>> = {
  line: LINE_CASES,
  apply: { ...MOBIUS_CASES['apply'], ...APPLY_PROJECTIVE },
  ...PROJECTIVE_CASES_OWN,
};
