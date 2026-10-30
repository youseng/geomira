/**
 * Degenerate cases of exsimilicenter and insimilicenter (ADR-0045), spread into
 * degenerate.test.ts. Fixtures: U = circle((0, 0), 1), V = circle((6, 0), 2): E = (−6, 0),
 * I = (2, 0); W = circle((0, 0), (1, 1)) has r² = 2 (an irrational radius).
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import type { Value } from '../../src/value';
import { FIELDS, ORDERED, at, plain, reason } from './degenerate';
import { circ } from './degenerate-circles';
import { num, pt } from './doc';

const U = circ(pt(0, 0), num(1));
const V = circ(pt(6, 0), num(2));
const W = circ(pt(0, 0), pt(1, 1));

/** An ideal point's direction as plain numbers, or the value's kind / reason. */
function direction<T>(F: { toNumber(x: T): number }, v: Value<T>): unknown {
  return v.kind === 'ideal_point' ? [F.toNumber(v.d.x), F.toNumber(v.d.y)] : reason(v);
}

const common = (tool: string): Record<string, () => void> => ({
  'concentric circles (equal ones included) → Undefined': () => {
    for (const F of FIELDS) {
      expect(reason(at(F, tool, U, circ(pt(0, 0), num(3))))).toBe('undefined: concentric circles');
      expect(reason(at(F, tool, U, U))).toBe('undefined: concentric circles');
    }
  },
  'radii not rational → Inexact over Q; always Inexact mod p (equal radii need no root)': () => {
    const X = circ(pt(5, 1), num(3));
    expect(at(RationalField, tool, W, X).kind).toBe('inexact');
    expect(at(FloatField, tool, W, X).kind).toBe('point');
    expect(at(ModPField, tool, U, V).kind).toBe('inexact');
    // Rational radii: exact over Q.
    expect(at(RationalField, tool, U, V).kind).toBe('point');
    // r² = 2 for both: no root is needed.
    const W2 = circ(pt(4, 0), pt(5, 1));
    for (const F of FIELDS) expect(at(F, tool, W, W2).kind).not.toBe('inexact');
  },
  'a circle with no positive radius → Undefined': () => {
    for (const F of FIELDS)
      expect(reason(at(F, tool, circ(pt(0, 0), num(0)), V))).toMatch(/^undefined: /);
  },
});

export const SIMILITUDE_CASES: Record<string, Record<string, () => void>> = {
  exsimilicenter: {
    ...common('exsimilicenter'),
    'equal radii → the point at infinity of the direction O₁O₂ (ADR-0040)': () => {
      const U2 = circ(pt(3, 4), num(1));
      for (const F of FIELDS) {
        const v = at(F, 'exsimilicenter', U, U2);
        expect(v.kind).toBe('ideal_point');
      }
      for (const F of ORDERED) expect(direction(F, at(F, 'exsimilicenter', U, U2))).toEqual([3, 4]);
      for (const F of ORDERED) expect(plain(F, at(F, 'exsimilicenter', U, V))).toEqual([-6, 0]);
    },
    'radii within the band of equal → Undefined (ambiguous: near infinity)': () => {
      const near = circ(pt(6, 0), num(1 + 1e-8));
      expect(reason(at(FloatField, 'exsimilicenter', U, near))).toBe(
        'undefined: ambiguous: the radii are within the band of equal (the exsimilicenter is near infinity)',
      );
      // Over Q the radii differ: a finite point, 6·10⁸ away.
      const q = at(RationalField, 'exsimilicenter', U, near);
      expect(q.kind).toBe('point');
      // Within EPS: equal radii in floats.
      const same = circ(pt(6, 0), num(1 + 1e-12));
      expect(at(FloatField, 'exsimilicenter', U, same).kind).toBe('ideal_point');
    },
  },
  insimilicenter: {
    ...common('insimilicenter'),
    'equal radii → the midpoint of O₁O₂, exact in every field': () => {
      const U2 = circ(pt(3, 4), num(1));
      for (const F of ORDERED) expect(plain(F, at(F, 'insimilicenter', U, U2))).toEqual([1.5, 2]);
      expect(at(ModPField, 'insimilicenter', W, circ(pt(4, 0), pt(5, 1)))).toEqual({
        kind: 'point',
        x: 2n,
        y: 0n,
      });
      for (const F of ORDERED) expect(plain(F, at(F, 'insimilicenter', U, V))).toEqual([2, 0]);
    },
  },
};
