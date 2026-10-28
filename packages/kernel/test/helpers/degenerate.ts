/** Shared helpers and the measure/display/arithmetic part of degenerate.test.ts's table. */
import { assertNever } from '@geomira/num/assert';
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import type { Value } from '../../src/value';
import { evalCall, num, pt } from './doc';

export const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];
export const ORDERED = [FloatField, RationalField] as Field<unknown>[];

export function at<T>(F: Field<T>, tool: string, ...args: Expr[]): Value<T> {
  return evalCall(F, tool, args);
}

/** The value as plain numbers (FloatField / RationalField results only). */
export function plain<T>(F: Field<T>, v: Value<T>): unknown {
  switch (v.kind) {
    case 'point':
      return [F.toNumber(v.x), F.toNumber(v.y)];
    case 'number':
      return F.toNumber(v.v);
    case 'line':
    case 'circle':
    case 'polygon':
    case 'transform':
    case 'ideal_point':
    case 'angle_mark':
    case 'segment_mark':
    case 'text':
    case 'string':
    case 'undefined':
    case 'inexact':
      return v.kind;
    default:
      return assertNever(v);
  }
}

export function reason<T>(v: Value<T>): string {
  return v.kind === 'undefined' || v.kind === 'inexact' ? `${v.kind}: ${v.reason}` : v.kind;
}

export const line = (a: Expr, b: Expr): Expr => call('line', [a, b]);
export const seg = (a: Expr, b: Expr): Expr => call('segment', [a, b]);
export const ray = (a: Expr, b: Expr): Expr => call('ray', [a, b]);
export const A = pt(1, 2);
export const B = pt(4, 6);
export const C = pt(-2, 5);

export function coincidentTwoPoints(tool: string): () => void {
  return () => {
    for (const F of FIELDS)
      expect(reason(at(F, tool, A, A))).toBe(
        `undefined: coincident points: ${tool}(A, B) needs A ≠ B`,
      );
    expect(at(FloatField, tool, pt(1, 2), pt(1 + 1e-12, 2)).kind).toBe('undefined');
    expect(at(RationalField, tool, pt(1, 2), pt(1 + 1e-12, 2)).kind).toBe('line');
  };
}

export const MEASURE_CASES: Record<string, Record<string, () => void>> = {
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
        expect(reason(at(F, 'ratio', A, B, C, C))).toBe(
          'undefined: coincident points: ratio(A, B, C, D) needs C ≠ D',
        );
    },
    'A = B → 0': () => {
      for (const F of ORDERED) expect(plain(F, at(F, 'ratio', A, A, A, B))).toBe(0);
    },
  },
  angle: {
    'A = B or C = B → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'angle', A, A, B))).toBe(
          'undefined: coincident points: angle(A, B, C) needs A ≠ B',
        );
        expect(reason(at(F, 'angle', A, B, B))).toBe(
          'undefined: coincident points: angle(A, B, C) needs C ≠ B',
        );
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
        expect(reason(at(F, 'dangle', A, A, B))).toBe(
          'undefined: coincident points: dangle(A, B, C) needs A ≠ B',
        );
        expect(reason(at(F, 'dangle', A, B, B))).toBe(
          'undefined: coincident points: dangle(A, B, C) needs C ≠ B',
        );
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
      expect(reason(at(ModPField, 'dangle', B, A, C))).toBe(
        'inexact: directed angles need an order, which ModPField lacks',
      );
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
        expect(reason(at(F, 'polygon', A, A, B))).toBe(
          'undefined: coincident points: polygon vertices 1 and 2 coincide',
        );
        expect(reason(at(F, 'polygon', A, B, C, A))).toBe(
          'undefined: coincident points: polygon vertices 4 and 1 coincide',
        );
      }
      expect(reason(at(FloatField, 'polygon', B, A, A))).toBe(
        'undefined: coincident points: polygon vertices 2 and 3 coincide',
      );
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
