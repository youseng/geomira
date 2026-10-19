/**
 * The rest of degenerate.test.ts's Run 3a table: other, on, incenter, excenter, incircle,
 * excircle, bisector, ext_bisector.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import { A, B, FIELDS, ORDERED, at, line, plain, ray, reason, seg } from './degenerate';
import { C5, O0, P5, circ, shape } from './degenerate-circles';
import { num, pt } from './doc';

const M5 = pt(-5, 0);
const HERON = [pt(5, 12), pt(0, 0), pt(14, 0)] as const;

function triangleCases(tool: string, exact: string): Record<string, () => void> {
  return {
    'coincident vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, tool, A, A, B))).toBe(
          `undefined: coincident points: ${tool} needs three distinct vertices`,
        );
    },
    'collinear vertices → Undefined': () => {
      for (const F of ORDERED)
        expect(reason(at(F, tool, A, B, pt(7, 10)))).toBe(
          `undefined: collinear points: ${tool} needs a non-degenerate triangle`,
        );
      expect(at(FloatField, tool, A, B, pt(7, 10 + 1e-12)).kind).toBe('undefined');
    },
    'a side length not rational (over Q) → Inexact': () => {
      expect(reason(at(RationalField, tool, pt(0, 0), pt(4, 0), pt(1, 3)))).toMatch(
        /^inexact: √\(.*\) is not rational$/,
      );
      expect(at(ModPField, tool, ...HERON).kind).toBe('inexact');
      expect(at(RationalField, tool, ...HERON).kind).toBe(exact);
    },
  };
}

function bisectorCases(tool: string): Record<string, () => void> {
  return {
    'A = B or C = B → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, tool, A, A, B))).toBe(
          `undefined: coincident points: ${tool}(A, B, C) needs A ≠ B`,
        );
        expect(reason(at(F, tool, A, B, B))).toBe(
          `undefined: coincident points: ${tool}(A, B, C) needs C ≠ B`,
        );
      }
    },
    'within the band of a straight angle → Undefined (ambiguous)': () => {
      expect(reason(at(FloatField, tool, pt(-1, 0), O0, pt(1, 1e-8)))).toBe(
        `undefined: ambiguous: ${tool}: the angle is within the band of a straight angle`,
      );
      expect(at(FloatField, tool, pt(-1, 0), O0, pt(1, 1e-12)).kind).toBe('line');
    },
    'an arm length not rational (over Q) → Inexact': () => {
      expect(at(RationalField, tool, pt(1, 1), O0, pt(3, 0)).kind).toBe('inexact');
      expect(at(ModPField, tool, ...HERON).kind).toBe('inexact');
      expect(at(RationalField, tool, ...HERON).kind).toBe('line');
    },
  };
}

const straight = [pt(-1, 0), O0, pt(2, 0)] as const;
const zero = [pt(1, 0), O0, pt(3, 0)] as const;

export const GLIDER_CASES: Record<string, Record<string, () => void>> = {
  other: {
    'P not on both objects → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'other', line(pt(1, 1), pt(2, 3)), C5, pt(1, 1)))).toBe(
          'undefined: other(a, b, P) needs P on the circle',
        );
        expect(reason(at(F, 'other', line(pt(1, 1), pt(2, 3)), C5, P5))).toBe(
          'undefined: other(a, b, P) needs P on the line',
        );
        expect(reason(at(F, 'other', C5, circ(pt(1, 0), pt(2, 0)), P5))).toBe(
          'undefined: other(a, b, P) needs P on the second circle',
        );
        expect(reason(at(F, 'other', circ(pt(1, 0), pt(2, 0)), C5, P5))).toBe(
          'undefined: other(a, b, P) needs P on the first circle',
        );
      }
    },
    'P within the band of an object → Undefined (ambiguous)': () => {
      const near = pt(5 + 1e-8, 0);
      expect(reason(at(FloatField, 'other', line(near, pt(5, 1)), C5, near))).toMatch(
        /^undefined: ambiguous: within the band of incidence/,
      );
      expect(at(RationalField, 'other', line(near, pt(5, 1)), C5, near).kind).toBe('undefined');
      const close = pt(5 + 1e-12, 0);
      expect(plain(FloatField, at(FloatField, 'other', line(close, M5), C5, close))).toEqual([
        expect.closeTo(-5, 9),
        expect.closeTo(0, 9),
      ]);
    },
    'tangency at P → P (the double point)': () => {
      for (const F of FIELDS) {
        expect(at(F, 'other', call('tangent', [P5, C5]), C5, P5)).toEqual(
          at(F, 'point', num(5), num(0)),
        );
        expect(at(F, 'other', C5, circ(pt(8, 0), P5), P5)).toEqual(at(F, 'point', num(5), num(0)));
      }
    },
    'concentric circles → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'other', C5, C5, P5))).toBe('undefined: concentric circles');
        expect(reason(at(F, 'other', C5, circ(O0, pt(1, 1)), P5))).toBe(
          'undefined: concentric circles',
        );
      }
    },
    'the other point outside a segment or ray → Undefined': () => {
      for (const F of ORDERED) {
        expect(reason(at(F, 'other', seg(P5, O0), C5, P5))).toBe(
          'undefined: no other intersection: it lies outside the segment',
        );
        expect(reason(at(F, 'other', C5, ray(pt(6, 0), pt(7, 0)), P5))).toBe(
          'undefined: no other intersection: it lies outside the ray',
        );
        expect(plain(F, at(F, 'other', seg(P5, M5), C5, P5))).toEqual([-5, 0]);
        expect(plain(F, at(F, 'other', ray(P5, O0), C5, P5))).toEqual([-5, 0]);
        expect(reason(at(F, 'other', ray(O0, P5), C5, P5))).toBe(
          'undefined: no other intersection: it lies outside the ray',
        );
      }
    },
    'the other point within the band of a segment end → Undefined (ambiguous)': () => {
      const s = seg(P5, pt(-5 - 1e-7, 0));
      expect(reason(at(FloatField, 'other', s, C5, P5))).toBe(
        'undefined: ambiguous: the other intersection is within the band of an end of the segment',
      );
      expect(plain(RationalField, at(RationalField, 'other', s, C5, P5))).toEqual([-5, 0]);
    },
    'a segment or ray range mod p → Inexact': () => {
      expect(reason(at(ModPField, 'other', seg(P5, M5), C5, P5))).toBe(
        'inexact: whether the other intersection lies on the segment needs an order, which ModPField lacks',
      );
      expect(at(ModPField, 'other', line(P5, M5), C5, P5).kind).toBe('point');
    },
  },
  on: {
    'a glider on an Undefined object → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'on', circ(A, A), num(1), num(2)))).toBe(
          'undefined: coincident points: circle(O, A) needs O ≠ A',
        );
        expect(reason(at(F, 'on', line(A, A), num(1)))).toBe(
          'undefined: coincident points: line(A, B) needs A ≠ B',
        );
      }
    },
    'on(l, t) on a segment or ray clamps t to the range': () => {
      const [p, q] = [pt(0, 0), pt(4, 2)];
      for (const F of ORDERED) {
        const on = (l: Expr, t: string | number) => plain(F, at(F, 'on', l, num(t)));
        expect([on(seg(p, q), '3/2'), on(seg(p, q), -1), on(seg(p, q), '1/2')]).toEqual([
          [4, 2],
          [0, 0],
          [2, 1],
        ]);
        expect([on(ray(p, q), -1), on(ray(p, q), 5), on(line(p, q), -1)]).toEqual([
          [0, 0],
          [20, 10],
          [-4, -2],
        ]);
      }
    },
    'a segment or ray range mod p → Inexact': () => {
      expect(at(ModPField, 'on', seg(O0, P5), num('1/2')).kind).toBe('inexact');
      expect(at(ModPField, 'on', ray(O0, P5), num('1/2')).kind).toBe('inexact');
      expect(at(ModPField, 'on', line(O0, P5), num('1/2')).kind).toBe('point');
    },
    'on(c, u, v) on a circle without anchor → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'on', circ(O0, num(2)), num(1), num(1)))).toBe(
          'undefined: this circle has no anchor (circle(O, r)): use an angle parameter on(c, θ)',
        );
    },
    'on(c, 0, 0) → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'on', C5, num(0), num(0)))).toBe(
          'undefined: the glider parameter (0 : 0) is not a point',
        );
      expect(at(FloatField, 'on', C5, num(1e-12), num(0)).kind).toBe('undefined');
      expect(plain(RationalField, at(RationalField, 'on', C5, num(1e-12), num(0)))).toEqual([5, 0]);
    },
    'on(c, u, 0) → the anchor': () => {
      for (const F of FIELDS)
        expect(at(F, 'on', circ(A, B), num(3), num(0))).toEqual(at(F, 'point', num(4), num(6)));
      for (const F of [RationalField, ModPField] as Field<unknown>[])
        expect(at(F, 'on', circ(pt(0, 1), B, A), num(-1), num(0))).toEqual(
          at(F, 'point', num(0), num(1)),
        );
      const far = plain(FloatField, at(FloatField, 'on', circ(pt(0, 1), B, A), num(-1), num(0)));
      expect(far).toEqual([expect.closeTo(0, 12), expect.closeTo(1, 12)]);
    },
    'on(c, θ) over Q or mod p → Inexact unless r, cos θ and sin θ are representable': () => {
      expect(plain(RationalField, at(RationalField, 'on', C5, num(90)))).toEqual([0, 5]);
      expect(plain(FloatField, at(FloatField, 'on', C5, num(90)))).toEqual([0, 5]);
      expect(at(RationalField, 'on', C5, num(45)).kind).toBe('inexact');
      expect(at(RationalField, 'on', circ(O0, pt(1, 1)), num(90)).kind).toBe('inexact');
      expect(at(ModPField, 'on', C5, num(0)).kind).toBe('inexact');
    },
  },
  incenter: triangleCases('incenter', 'point'),
  excenter: triangleCases('excenter', 'point'),
  incircle: triangleCases('incircle', 'circle'),
  excircle: triangleCases('excircle', 'circle'),
  bisector: {
    ...bisectorCases('bisector'),
    'a straight angle → the perpendicular at B': () => {
      for (const F of ORDERED)
        expect(shape(F, at(F, 'bisector', ...straight))).toEqual({
          p: [0, 0],
          d: [0, -1],
          chiral: true,
        });
    },
    'a zero angle → the line BA': () => {
      for (const F of ORDERED)
        expect(shape(F, at(F, 'bisector', ...zero))).toEqual({
          p: [0, 0],
          d: [4, 0],
          chiral: false,
        });
    },
  },
  ext_bisector: {
    ...bisectorCases('ext_bisector'),
    'a straight angle → the line BA': () => {
      for (const F of ORDERED)
        expect(shape(F, at(F, 'ext_bisector', ...straight))).toEqual({
          p: [0, 0],
          d: [-1, 0],
          chiral: false,
        });
    },
    'a zero angle → the perpendicular at B': () => {
      for (const F of ORDERED)
        expect(shape(F, at(F, 'ext_bisector', ...zero))).toEqual({
          p: [0, 0],
          d: [0, 4],
          chiral: true,
        });
    },
  },
};
