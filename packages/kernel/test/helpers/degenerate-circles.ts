/**
 * The circle part of degenerate.test.ts's table (Run 3a): circle, circumcircle, cline,
 * diameter_circle, ninepoint_circle, center, tangent, polar, radical_axis. Every declared
 * case is a test; the meta-test in degenerate.test.ts checks the names against the registry.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import type { Value } from '../../src/value';
import { A, B, C, FIELDS, ORDERED, at, reason } from './degenerate';
import { num, pt } from './doc';

export const circ = (...args: Expr[]): Expr => call('circle', args);
export const O0 = pt(0, 0);
export const P5 = pt(5, 0);
/** The circle of radius 5 about the origin, anchored at (5, 0). */
export const C5 = circ(O0, P5);

/** A line or circle as plain numbers (FloatField / RationalField values). */
export function shape<T>(F: Field<T>, v: Value<T>): unknown {
  // + 0 turns −0 into 0: the sign of a zero component carries no geometric meaning.
  const n = (x: T) => F.toNumber(x) + 0;
  if (v.kind === 'line')
    return { p: [n(v.p.x), n(v.p.y)], d: [n(v.d.x), n(v.d.y)], chiral: v.chiral };
  if (v.kind === 'circle') {
    const anchor = v.anchor === undefined ? null : [n(v.anchor.x), n(v.anchor.y)];
    return { c: [n(v.c.x), n(v.c.y)], r2: n(v.r2), anchor };
  }
  return reason(v);
}

function triangleCases(tool: string): Record<string, () => void> {
  return {
    [tool === 'circle'
      ? 'circle(A, B, C) with coincident points → Undefined'
      : 'coincident vertices → Undefined']: () => {
      for (const F of FIELDS)
        expect(reason(at(F, tool, A, B, A))).toBe(
          `undefined: coincident points: ${tool} needs three distinct vertices`,
        );
    },
  };
}

function collinearCase(tool: string, name: string): Record<string, () => void> {
  return {
    [name]: () => {
      for (const F of FIELDS)
        expect(reason(at(F, tool, A, B, pt(7, 10)))).toBe(
          `undefined: collinear points: ${tool} needs a non-degenerate triangle`,
        );
      expect(at(FloatField, tool, A, B, pt(7, 10 + 1e-12)).kind).toBe('undefined');
      expect(at(RationalField, tool, A, B, pt(7, 10 + 1e-12)).kind).toBe('circle');
    },
  };
}

export const CIRCLE_CASES: Record<string, Record<string, () => void>> = {
  circle: {
    'circle(O, O) → Undefined (coincident points)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'circle', A, A))).toBe(
          'undefined: coincident points: circle(O, A) needs O ≠ A',
        );
      expect(at(FloatField, 'circle', pt(1, 2), pt(1 + 1e-12, 2)).kind).toBe('undefined');
      expect(at(RationalField, 'circle', pt(1, 2), pt(1 + 1e-12, 2)).kind).toBe('circle');
    },
    'circle(O, r) with r ≤ 0 → Undefined': () => {
      for (const F of ORDERED) {
        expect(reason(at(F, 'circle', A, num(-2)))).toBe(
          'undefined: negative radius: circle(O, r) needs r > 0',
        );
        expect(shape(F, at(F, 'circle', A, num(2)))).toEqual({ c: [1, 2], r2: 4, anchor: null });
      }
      for (const F of FIELDS) {
        expect(reason(at(F, 'circle', A, num(0)))).toBe(
          'undefined: zero radius: circle(O, r) needs r > 0',
        );
        // Exactly zero although it is computed: 1/3 − 1/3.
        const zero = call('sub', [num('1/3'), num('1/3')]);
        expect(reason(at(F, 'circle', A, zero))).toBe(
          'undefined: zero radius: circle(O, r) needs r > 0',
        );
      }
    },
    'circle(O, r) with r within the band of 0 → Undefined (ambiguous)': () => {
      expect(reason(at(FloatField, 'circle', A, num(1e-8)))).toBe(
        'undefined: ambiguous: the radius is within the band of zero',
      );
      expect(reason(at(FloatField, 'circle', A, num(1e-12)))).toBe(
        'undefined: zero radius: circle(O, r) needs r > 0',
      );
      expect(at(RationalField, 'circle', A, num(1e-8)).kind).toBe('circle');
    },
    'circle(O, r) mod p: the sign of r is not checked': () => {
      const v = at(ModPField, 'circle', A, num(-2));
      expect(v.kind === 'circle' && v.r2).toBe(4n);
    },
    ...triangleCases('circle'),
    ...collinearCase('circle', 'circle(A, B, C) with collinear points → Undefined (use cline)'),
  },
  circumcircle: {
    ...triangleCases('circumcircle'),
    ...collinearCase('circumcircle', 'collinear vertices → Undefined (use cline)'),
  },
  cline: {
    'coincident points → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'cline', A, B, B))).toBe(
          'undefined: coincident points: cline needs three distinct points',
        );
    },
    'collinear points → the line through them': () => {
      const line = { p: [1, 2], d: [3, 4], chiral: false };
      for (const F of ORDERED) expect(shape(F, at(F, 'cline', A, B, pt(7, 10)))).toEqual(line);
      expect(at(ModPField, 'cline', A, B, pt(7, 10)).kind).toBe('line');
      expect(shape(FloatField, at(FloatField, 'cline', A, B, pt(7, 10 + 1e-12)))).toEqual(line);
      expect(at(RationalField, 'cline', A, B, pt(7, 10 + 1e-12)).kind).toBe('circle');
      expect(shape(RationalField, at(RationalField, 'cline', A, B, C))).toMatchObject({
        anchor: [1, 2],
      });
    },
  },
  diameter_circle: {
    'diameter_circle(A, A) → Undefined (coincident points)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'diameter_circle', A, A))).toBe(
          'undefined: coincident points: diameter_circle(A, B) needs A ≠ B',
        );
    },
  },
  ninepoint_circle: {
    ...triangleCases('ninepoint_circle'),
    ...collinearCase('ninepoint_circle', 'collinear vertices → Undefined'),
  },
  center: {},
  tangent: {
    'P not on c → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'tangent', pt(1, 1), C5))).toBe(
          'undefined: tangent(P, c) needs P on c',
        );
      expect(shape(RationalField, at(RationalField, 'tangent', pt(3, -4), C5))).toEqual({
        p: [3, -4],
        d: [4, 3],
        chiral: true,
      });
    },
    'P within the band of c → Undefined (ambiguous)': () => {
      expect(reason(at(FloatField, 'tangent', pt(5 + 1e-8, 0), C5))).toBe(
        'undefined: ambiguous: within the band of incidence (tangent(P, c) needs P on c)',
      );
      expect(at(FloatField, 'tangent', pt(5 + 1e-12, 0), C5).kind).toBe('line');
      expect(reason(at(RationalField, 'tangent', pt(5 + 1e-8, 0), C5))).toBe(
        'undefined: tangent(P, c) needs P on c',
      );
    },
  },
  polar: {
    'P = the centre → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'polar', O0, C5))).toBe(
          'undefined: P is the centre: its polar is the line at infinity',
        );
    },
    'P on c → the tangent at P': () => {
      for (const F of FIELDS)
        expect(at(F, 'polar', pt(3, 4), C5)).toEqual(at(F, 'tangent', pt(3, 4), C5));
      expect(shape(RationalField, at(RationalField, 'polar', pt(10, 0), C5))).toEqual({
        p: [5 / 2, 0],
        d: [0, 10],
        chiral: true,
      });
    },
  },
  radical_axis: {
    'concentric circles → Undefined (equal circles included)': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'radical_axis', C5, circ(O0, pt(1, 1))))).toBe(
          'undefined: concentric circles',
        );
        expect(reason(at(F, 'radical_axis', C5, C5))).toBe('undefined: concentric circles');
      }
    },
    'tangent circles → the common tangent at the touch point': () => {
      const c2 = circ(pt(8, 0), P5);
      for (const F of ORDERED) {
        expect(shape(F, at(F, 'radical_axis', C5, c2))).toEqual({
          p: [5, 0],
          d: [0, 8],
          chiral: true,
        });
        const t = shape(F, at(F, 'tangent', P5, C5));
        expect(t).toEqual({ p: [5, 0], d: [0, 5], chiral: true });
      }
    },
  },
};
