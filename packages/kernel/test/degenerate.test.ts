/**
 * Every degenerate case a tool declares (ToolSpec.degenerate, SPEC §6.3) is a test here,
 * keyed by the exact text; a meta-test checks that this table and the registry list the
 * same cases, so a new case cannot be declared without a test.
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Expr } from '../src/expr';
import { REGISTRY, num, pt } from './helpers/doc';
import {
  A,
  B,
  C,
  FIELDS,
  MEASURE_CASES,
  ORDERED,
  at,
  coincidentTwoPoints,
  line,
  plain,
  ray,
  reason,
  seg,
} from './helpers/degenerate';
import { CIRCLE_CASES } from './helpers/degenerate-circles';
import { GLIDER_CASES } from './helpers/degenerate-gliders';
import { FUNCTION_CASES } from './helpers/degenerate-functions';
import { GAP_CASES } from './helpers/degenerate-gaps';
import { INTERSECT_CURVE_CASES, TANGENT_CASES } from './helpers/degenerate-branch';
import { TRANSFORM_CASES } from './helpers/degenerate-transforms';
import { APPLY_DISPLAY_CASES, DISPLAY_CASES } from './helpers/degenerate-display';

const CASES: Record<string, Record<string, () => void>> = {
  point: {},
  param: {
    'min ≥ max → Undefined': () => {
      for (const F of ORDERED) {
        expect(reason(at(F, 'param', num(1), num(1), num(1)))).toBe(
          'undefined: param: min must be less than max',
        );
        expect(at(F, 'param', num(2), num(1), num('3/2')).kind).toBe('undefined');
      }
    },
    'v outside [min, max] → Undefined': () => {
      for (const F of ORDERED) {
        expect(reason(at(F, 'param', num(0), num(1), num(2)))).toBe(
          'undefined: param: the value is above max',
        );
        expect(reason(at(F, 'param', num(0), num(1), num(-1)))).toBe(
          'undefined: param: the value is below min',
        );
        expect(plain(F, at(F, 'param', num(0), num(1), num(1)))).toBe(1);
        expect(plain(F, at(F, 'param', num(0), num(1), num(0)))).toBe(0);
      }
    },
    'a range decision inside the band → Undefined (ambiguous)': () => {
      expect(reason(at(FloatField, 'param', num(0), num(1), num(1 + 1e-8)))).toMatch(
        /^undefined: ambiguous/,
      );
      expect(reason(at(RationalField, 'param', num(0), num(1), num(1 + 1e-8)))).toBe(
        'undefined: param: the value is above max',
      );
    },
    'mod p the range is not checked': () => {
      const v = at(ModPField, 'param', num(2), num(1), num(5));
      expect(v).toEqual({ kind: 'number', v: 5n, exact: { num: 5n, den: 1n } });
    },
  },
  midpoint: {
    'midpoint(A, A) = A': () => {
      for (const F of ORDERED) expect(plain(F, at(F, 'midpoint', A, A))).toEqual([1, 2]);
    },
  },
  divide: {
    'divide(A, A, t) = A': () => {
      for (const F of ORDERED) expect(plain(F, at(F, 'divide', A, A, num(7)))).toEqual([1, 2]);
    },
  },
  foot: {
    'foot(P, A, A) → Undefined (coincident points)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'foot', C, A, A))).toBe(
          'undefined: coincident points: foot(P, A, B) needs A ≠ B',
        );
    },
    'P on the line → P': () => {
      for (const F of ORDERED)
        expect(plain(F, at(F, 'foot', pt(7, 10), line(A, B)))).toEqual([7, 10]);
    },
    'a segment or ray is extended to its carrier line': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'foot', pt(5, 1), seg(pt(0, 0), pt(1, 0))))).toEqual([5, 0]);
        expect(plain(F, at(F, 'foot', pt(-5, 1), ray(pt(0, 0), pt(1, 0))))).toEqual([-5, 0]);
      }
    },
  },
  intersect: {
    'parallel lines → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'intersect', line(pt(0, 0), pt(1, 0)), line(pt(0, 1), pt(3, 1))))).toBe(
          'undefined: parallel lines',
        );
      }
      // Nearly parallel: sin θ ≈ 1e-12 is a zero angle in FloatField, not over Q.
      const near = [line(pt(0, 0), pt(1, 0)), line(pt(0, 1), pt(1, 1 + 1e-12))];
      expect(reason(at(FloatField, 'intersect', ...near))).toBe('undefined: parallel lines');
      expect(at(RationalField, 'intersect', ...near).kind).toBe('point');
      // Short but perpendicular segments are never called parallel.
      const short = [seg(pt(0, 0), pt(1e-5, 0)), seg(pt(0, -1e-5), pt(0, 1e-5))];
      expect(plain(FloatField, at(FloatField, 'intersect', ...short))).toEqual([0, 0]);
    },
    'coincident lines → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'intersect', line(pt(0, 0), pt(1, 0)), line(pt(2, 0), pt(5, 0))))).toBe(
          'undefined: coincident lines',
        );
        expect(reason(at(F, 'intersect', line(A, B), line(A, B)))).toBe(
          'undefined: coincident lines',
        );
      }
    },
    'the intersection outside a segment or ray → Undefined': () => {
      const vertical = (x: number): Expr => line(pt(x, -1), pt(x, 1));
      for (const F of ORDERED) {
        expect(reason(at(F, 'intersect', seg(pt(0, 0), pt(1, 0)), vertical(2)))).toBe(
          'undefined: no intersection: it lies outside the segment',
        );
        expect(reason(at(F, 'intersect', ray(pt(0, 0), pt(1, 0)), vertical(-2)))).toBe(
          'undefined: no intersection: it lies outside the ray',
        );
        expect(plain(F, at(F, 'intersect', ray(pt(0, 0), pt(1, 0)), vertical(2)))).toEqual([2, 0]);
        expect(plain(F, at(F, 'intersect', vertical(2), seg(pt(0, 0), pt(1, 0))))).toBe(
          'undefined',
        );
      }
    },
    'the intersection within the band of a segment end → Undefined (ambiguous)': () => {
      const s = seg(pt(0, 0), pt(1, 0));
      const x = 1 + 1e-8;
      expect(reason(at(FloatField, 'intersect', s, line(pt(x, -1), pt(x, 1))))).toMatch(
        /^undefined: ambiguous/,
      );
      expect(reason(at(RationalField, 'intersect', s, line(pt(x, -1), pt(x, 1))))).toMatch(
        /outside the segment/,
      );
      for (const F of ORDERED)
        expect(plain(F, at(F, 'intersect', s, line(pt(1, -1), pt(1, 1))))).toEqual([1, 0]);
    },
    'a segment or ray range mod p → Inexact': () => {
      expect(
        at(ModPField, 'intersect', seg(pt(0, 0), pt(1, 0)), line(pt(2, -1), pt(2, 1))).kind,
      ).toBe('inexact');
      expect(
        at(ModPField, 'intersect', line(pt(0, 0), pt(1, 0)), line(pt(2, -1), pt(2, 1))).kind,
      ).toBe('point');
    },
    ...INTERSECT_CURVE_CASES,
  },
  circumcenter: {
    'coincident vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'circumcenter', A, B, A))).toBe(
          'undefined: coincident points: circumcenter needs three distinct vertices',
        );
    },
    'collinear vertices → Undefined (use cline)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'circumcenter', A, B, pt(7, 10)))).toBe(
          'undefined: collinear points: circumcenter needs a non-degenerate triangle',
        );
      expect(at(FloatField, 'circumcenter', A, B, pt(7, 10 + 1e-12)).kind).toBe('undefined');
      expect(at(RationalField, 'circumcenter', A, B, pt(7, 10 + 1e-12)).kind).toBe('point');
    },
  },
  centroid: {
    'collinear or coincident vertices → the mean of the vertices': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'centroid', A, B, pt(7, 10)))).toEqual([4, 6]);
        expect(plain(F, at(F, 'centroid', A, A, A))).toEqual([1, 2]);
      }
    },
  },
  orthocenter: {
    'coincident vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'orthocenter', A, A, B))).toBe(
          'undefined: coincident points: orthocenter needs three distinct vertices',
        );
    },
    'collinear vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'orthocenter', A, B, pt(7, 10)))).toBe(
          'undefined: collinear points: orthocenter needs a non-degenerate triangle',
        );
    },
  },
  line: { 'line(A, A) → Undefined (coincident points)': coincidentTwoPoints('line') },
  segment: { 'segment(A, A) → Undefined (coincident points)': coincidentTwoPoints('segment') },
  ray: { 'ray(A, A) → Undefined (coincident points)': coincidentTwoPoints('ray') },
  perp_bisector: {
    'perp_bisector(A, A) → Undefined (coincident points)': coincidentTwoPoints('perp_bisector'),
  },
  parallel: {
    'P on l → the carrier line of l': () => {
      for (const F of ORDERED) {
        const v = at(F, 'parallel', A, line(A, B));
        expect(
          v.kind === 'line' && [
            F.toNumber(v.p.x),
            F.toNumber(v.p.y),
            F.toNumber(v.d.x),
            F.toNumber(v.d.y),
          ],
        ).toEqual([1, 2, 3, 4]);
      }
    },
    'a segment or ray gives a full line': () => {
      for (const F of FIELDS) {
        const v = at(F, 'parallel', C, ray(A, B));
        expect(v.kind === 'line' && [v.lo, v.hi]).toEqual([null, null]);
      }
    },
  },
  perp: {
    'P on l → the perpendicular at P': () => {
      for (const F of ORDERED) {
        const v = at(F, 'perp', A, line(A, B));
        expect(
          v.kind === 'line' && [
            F.toNumber(v.p.x),
            F.toNumber(v.p.y),
            F.toNumber(v.d.x),
            F.toNumber(v.d.y),
          ],
        ).toEqual([1, 2, -4, 3]);
      }
    },
    'a segment or ray gives a full line': () => {
      for (const F of FIELDS) {
        const v = at(F, 'perp', C, seg(A, B));
        expect(v.kind === 'line' && [v.lo, v.hi]).toEqual([null, null]);
      }
    },
  },
  ...MEASURE_CASES,
  ...CIRCLE_CASES,
  ...GLIDER_CASES,
  ...FUNCTION_CASES,
  ...GAP_CASES,
  ...TANGENT_CASES,
  ...TRANSFORM_CASES,
  ...DISPLAY_CASES,
  apply: { ...TRANSFORM_CASES.apply, ...APPLY_DISPLAY_CASES },
};

describe('degenerate cases (ToolSpec.degenerate), each a test', () => {
  it('this table lists exactly the cases the registry declares', () => {
    const declared = Object.fromEntries(
      REGISTRY.tools.map((t) => [t.name, [...t.degenerate].sort()]),
    );
    const tested = Object.fromEntries(
      Object.entries(CASES).map(([k, v]) => [k, Object.keys(v).sort()]),
    );
    expect(tested).toEqual(declared);
  });

  for (const [tool, cases] of Object.entries(CASES)) {
    for (const [name, test] of Object.entries(cases)) it(`${tool}: ${name}`, test);
  }
});
