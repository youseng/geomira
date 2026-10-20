/**
 * Degenerate cases of the display tools of Run 8a (ADR-0011): mark_angle, mark_right,
 * mark_segment, text, and apply's new case (an anti-similarity reverses an angle mark).
 * Spread into degenerate.test.ts's table, whose meta-test checks that every declared case
 * has a test.
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import type { Value } from '../../src/value';
import { FIELDS, ORDERED, at, line, reason } from './degenerate';
import { num, pt } from './doc';

const str = (value: string): Expr => ({ kind: 'str', value });
const O = pt(0, 0);
const X = pt(4, 0);
const Y = pt(1, 3);

/** The arm points of an angle mark as plain numbers ([from, to]), or its kind. */
function arms<T>(F: { toNumber(x: T): number }, v: Value<T>): unknown {
  if (v.kind !== 'angle_mark') return v.kind;
  const p = (q: { x: T; y: T }) => [F.toNumber(q.x), F.toNumber(q.y)];
  return [p(v.from), p(v.to), v.arcs, v.right];
}

function coincidentArms(tool: string): () => void {
  return () => {
    for (const F of FIELDS) {
      expect(reason(at(F, tool, O, O, Y))).toBe(
        `undefined: coincident points: ${tool}(A, B, C) needs A ≠ B`,
      );
      expect(reason(at(F, tool, X, O, O))).toBe(
        `undefined: coincident points: ${tool}(A, B, C) needs C ≠ B`,
      );
    }
    expect(at(FloatField, tool, pt(1e-12, 0), O, pt(0, 1)).kind).toBe('undefined');
  };
}

const ORDERLESS = (tool: string) => () => {
  expect(reason(at(ModPField, tool, X, O, pt(0, 3)))).toBe(
    `inexact: ${tool} needs the inner side of the angle, an order ${ModPField.name} lacks`,
  );
};

export const DISPLAY_CASES: Record<string, Record<string, () => void>> = {
  mark_angle: {
    'A = B or C = B → Undefined (coincident points)': coincidentArms('mark_angle'),
    'a zero angle (A and C on one ray from B) → Undefined': () => {
      for (const F of ORDERED)
        expect(reason(at(F, 'mark_angle', X, O, pt(2, 0)))).toBe(
          'undefined: mark_angle: the angle ABC is 0° (A and C lie on one ray from B)',
        );
    },
    'a straight angle → Undefined (its inner side is not determined)': () => {
      for (const F of ORDERED)
        expect(reason(at(F, 'mark_angle', X, O, pt(-1, 0)))).toBe(
          'undefined: mark_angle: the angle ABC is straight (180°): its inner side is not determined',
        );
      // Just outside the band the side is decided, and over Q any non-zero offset is.
      expect(arms(FloatField, at(FloatField, 'mark_angle', X, O, pt(-1, 1e-6)))).toEqual([
        [4, 0],
        [-1, 1e-6],
        1,
        false,
      ]);
    },
    'an angle within the band of 0° or 180° → Undefined (ambiguous)': () => {
      expect(reason(at(FloatField, 'mark_angle', X, O, pt(-1, 3e-8)))).toBe(
        'undefined: ambiguous: mark_angle: the angle ABC is within the band of 180°',
      );
      expect(reason(at(FloatField, 'mark_angle', X, O, pt(1, -3e-8)))).toBe(
        'undefined: ambiguous: mark_angle: the angle ABC is within the band of 0°',
      );
      expect(at(RationalField, 'mark_angle', X, O, pt(-1, 3e-8)).kind).toBe('angle_mark');
    },
    'an arc count that is not an exact 1, 2 or 3 → Undefined': () => {
      for (const F of FIELDS) {
        for (const n of [num(0), num(4), num('3/2'), num(-1)])
          expect(reason(at(F, 'mark_angle', X, O, Y, n))).toBe(
            'undefined: mark_angle: the arc count must be an exact 1, 2 or 3',
          );
        // A measured number has no exact value, even when it is 2.
        expect(reason(at(F, 'mark_angle', X, O, Y, call('dist', [O, pt(2, 0)])))).toMatch(
          /^(undefined: mark_angle: the arc count must be an exact 1, 2 or 3|inexact)/,
        );
      }
      for (const F of ORDERED)
        expect(arms(F, at(F, 'mark_angle', X, O, Y, num(3)))).toEqual([[4, 0], [1, 3], 3, false]);
    },
    'mod p → Inexact (the inner side needs an order)': ORDERLESS('mark_angle'),
  },
  mark_right: {
    'A = B or C = B → Undefined (coincident points)': coincidentArms('mark_right'),
    'an angle that is not right → Undefined': () => {
      for (const F of ORDERED) {
        expect(reason(at(F, 'mark_right', X, O, Y))).toBe(
          'undefined: mark_right(A, B, C): the angle ABC is not a right angle',
        );
        expect(arms(F, at(F, 'mark_right', pt(0, 3), O, X))).toEqual([[4, 0], [0, 3], 1, true]);
      }
    },
    'an angle within the band of 90° → Undefined (ambiguous)': () => {
      expect(reason(at(FloatField, 'mark_right', X, O, pt(3e-8, 1)))).toBe(
        'undefined: ambiguous: mark_right: the angle ABC is within the band of 90°',
      );
      // Within EPS it is right (a constructed right angle with rounding).
      expect(at(FloatField, 'mark_right', X, O, pt(1e-12, 1)).kind).toBe('angle_mark');
      expect(reason(at(RationalField, 'mark_right', X, O, pt(1e-12, 1)))).toBe(
        'undefined: mark_right(A, B, C): the angle ABC is not a right angle',
      );
    },
    'mod p → Inexact (the inner side needs an order)': ORDERLESS('mark_right'),
  },
  mark_segment: {
    'A = B → Undefined (coincident points)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'mark_segment', X, X))).toBe(
          'undefined: coincident points: mark_segment(A, B) needs A ≠ B',
        );
      const v = at(ModPField, 'mark_segment', O, X, num(2));
      expect(v.kind === 'segment_mark' && v.ticks).toBe(2);
    },
    'a tick count that is not an exact 1, 2 or 3 → Undefined': () => {
      for (const F of FIELDS)
        for (const n of [num(0), num(4), num('1/2')])
          expect(reason(at(F, 'mark_segment', O, X, n))).toBe(
            'undefined: mark_segment: the tick count must be an exact 1, 2 or 3',
          );
    },
  },
  text: {
    'an empty string → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'text', O, str('')))).toBe('undefined: text: the string is empty');
        const v = at(F, 'text', X, str('M_a'));
        expect(v.kind === 'text' && v.text).toBe('M_a');
      }
    },
  },
};

/** apply's case of Run 8a, merged into its entry of the table. */
export const APPLY_DISPLAY_CASES: Record<string, () => void> = {
  'an anti-similarity reverses an angle mark (its arms swap)': () => {
    for (const F of ORDERED) {
      const mark = call('mark_angle', [X, O, Y]);
      const mirror = at(F, 'apply', call('reflect', [line(O, pt(0, 1))]), mark);
      // The mirror image of the arms (4, 0), (1, 3) is (−4, 0), (−1, 3), counter-clockwise
      // from (−1, 3) to (−4, 0): the order is reversed, and the image is again a mark of
      // its convex angle, equal to mark_angle of the images.
      expect(arms(F, mirror)).toEqual([[-1, 3], [-4, 0], 1, false]);
      expect(arms(F, at(F, 'mark_angle', pt(-4, 0), O, pt(-1, 3)))).toEqual(arms(F, mirror));
      const turned = at(F, 'apply', call('rotate', [O, num(90)]), mark);
      expect(arms(F, turned)).toEqual([[0, 4], [-3, 1], 1, false]);
    }
  },
};
