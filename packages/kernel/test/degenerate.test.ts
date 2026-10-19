/**
 * Every degenerate case a tool declares (ToolSpec.degenerate, SPEC §6.3) is a test here,
 * keyed by the exact text; a meta-test checks that this table and the registry list the
 * same cases, so a new case cannot be declared without a test.
 */
import { assertNever } from '@geomira/num/assert';
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../src/expr';
import type { Value } from '../src/value';
import { REGISTRY, evalCall, num, pt } from './helpers/doc';

const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];
const ORDERED = [FloatField, RationalField] as Field<unknown>[];

function at<T>(F: Field<T>, tool: string, ...args: Expr[]): Value<T> {
  return evalCall(F, tool, args);
}

/** The value as plain numbers (FloatField / RationalField results only). */
function plain<T>(F: Field<T>, v: Value<T>): unknown {
  switch (v.kind) {
    case 'point':
      return [F.toNumber(v.x), F.toNumber(v.y)];
    case 'number':
      return F.toNumber(v.v);
    case 'line':
    case 'circle':
    case 'polygon':
    case 'transform':
    case 'undefined':
    case 'inexact':
      return v.kind;
    default:
      return assertNever(v);
  }
}

function reason<T>(v: Value<T>): string {
  return v.kind === 'undefined' || v.kind === 'inexact' ? `${v.kind}: ${v.reason}` : v.kind;
}

const line = (a: Expr, b: Expr): Expr => call('line', [a, b]);
const seg = (a: Expr, b: Expr): Expr => call('segment', [a, b]);
const ray = (a: Expr, b: Expr): Expr => call('ray', [a, b]);
const A = pt(1, 2);
const B = pt(4, 6);
const C = pt(-2, 5);

function coincidentTwoPoints(tool: string): () => void {
  return () => {
    for (const F of FIELDS)
      expect(reason(at(F, tool, A, A))).toMatch(/^undefined: coincident points/);
    expect(at(FloatField, tool, pt(1, 2), pt(1 + 1e-12, 2)).kind).toBe('undefined');
    expect(at(RationalField, tool, pt(1, 2), pt(1 + 1e-12, 2)).kind).toBe('line');
  };
}

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
        expect(reason(at(F, 'foot', C, A, A))).toMatch(/^undefined: coincident points/);
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
  },
  circumcenter: {
    'coincident vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'circumcenter', A, B, A))).toMatch(/^undefined: coincident points/);
    },
    'collinear vertices → Undefined (use cline)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'circumcenter', A, B, pt(7, 10)))).toMatch(
          /^undefined: collinear points/,
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
        expect(reason(at(F, 'orthocenter', A, A, B))).toMatch(/^undefined: coincident points/);
    },
    'collinear vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'orthocenter', A, B, pt(7, 10)))).toMatch(
          /^undefined: collinear points/,
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
  dist: {
    'dist(A, A) = 0': () => {
      for (const F of ORDERED) expect(plain(F, at(F, 'dist', A, A))).toBe(0);
    },
    'P on l → 0': () => {
      for (const F of ORDERED) expect(plain(F, at(F, 'dist', pt(7, 10), line(A, B)))).toBe(0);
    },
    'a segment or ray is extended to its carrier line': () => {
      for (const F of ORDERED)
        expect(plain(F, at(F, 'dist', pt(9, 3), seg(pt(0, 0), pt(1, 0))))).toBe(3);
    },
  },
  ratio: {
    'C = D → Undefined (coincident points)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'ratio', A, B, C, C))).toMatch(/^undefined: coincident points/);
    },
    'A = B → 0': () => {
      for (const F of ORDERED) expect(plain(F, at(F, 'ratio', A, A, A, B))).toBe(0);
    },
  },
  angle: {
    'A = B or C = B → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'angle', A, A, B))).toMatch(/^undefined: coincident points/);
        expect(reason(at(F, 'angle', A, B, B))).toMatch(/^undefined: coincident points/);
      }
    },
    'collinear: 0° or 180°': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'angle', B, A, pt(7, 10)))).toBe(0);
        expect(plain(F, at(F, 'angle', A, B, pt(7, 10)))).toBe(180);
      }
    },
    'mod p → Inexact': () => {
      expect(at(ModPField, 'angle', B, A, C).kind).toBe('inexact');
    },
  },
  dangle: {
    'A = B or C = B → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'dangle', A, A, B))).toMatch(/^undefined: coincident points/);
        expect(reason(at(F, 'dangle', A, B, B))).toMatch(/^undefined: coincident points/);
      }
    },
    'collinear → 0': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'dangle', B, A, pt(7, 10)))).toBe(0);
        expect(plain(F, at(F, 'dangle', A, B, pt(7, 10)))).toBe(0);
      }
    },
    'within the band of collinear → Undefined (ambiguous)': () => {
      const v = at(FloatField, 'dangle', pt(1, 0), pt(0, 0), pt(1, 1e-8));
      expect(reason(v)).toMatch(/^undefined: ambiguous/);
      expect(at(RationalField, 'dangle', pt(1, 0), pt(0, 0), pt(1, 1e-8)).kind).toBe('inexact');
      expect(plain(FloatField, at(FloatField, 'dangle', pt(1, 0), pt(0, 0), pt(1, 1e-12)))).toBe(0);
    },
    'mod p → Inexact': () => {
      expect(at(ModPField, 'dangle', B, A, C).kind).toBe('inexact');
    },
  },
  area: {
    'collinear vertices → 0': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'area', A, B, pt(7, 10)))).toBe(0);
        expect(plain(F, at(F, 'area', call('polygon', [A, B, pt(7, 10)])))).toBe(0);
      }
    },
    'mod p → Inexact (unsigned area needs an order)': () => {
      expect(at(ModPField, 'area', A, B, C).kind).toBe('inexact');
    },
  },
  polygon: {
    'consecutive coincident vertices → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'polygon', A, A, B))).toMatch(/^undefined: coincident points/);
        expect(reason(at(F, 'polygon', A, B, C, A))).toMatch(/^undefined: coincident points/);
      }
      expect(at(FloatField, 'polygon', A, B, A, C).kind).toBe('polygon');
    },
    'collinear vertices → a flat polygon': () => {
      for (const F of FIELDS) expect(at(F, 'polygon', A, B, pt(7, 10)).kind).toBe('polygon');
    },
  },
  add: {},
  sub: {},
  mul: {},
  div: {
    'b = 0 → Undefined (division by zero)': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'div', num(1), num(0)))).toBe('undefined: division by zero');
        expect(reason(at(F, 'div', num(1), call('sub', [num('1/3'), num('1/3')])))).toBe(
          'undefined: division by zero',
        );
      }
      expect(reason(at(FloatField, 'div', num(1), num(1e-12)))).toBe('undefined: division by zero');
      expect(at(RationalField, 'div', num(1), num(1e-12)).kind).toBe('number');
      // Exactly zero although rounding makes the float value −1: (1e17 + 1) − 1e17 − 1.
      const zero = call('sub', [
        call('sub', [call('add', [num(1e17), num(1)]), num(1e17)]),
        num(1),
      ]);
      expect(plain(FloatField, at(FloatField, 'sub', zero, num(0)))).toBe(-1);
      expect(reason(at(FloatField, 'div', num(1), zero))).toBe('undefined: division by zero');
    },
  },
  neg: {},
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
