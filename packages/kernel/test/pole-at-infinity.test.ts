/**
 * pole(l, c) with l through the centre is the point at infinity perpendicular to l (Run 16a's
 * queue, ADR-0042): over Q, mod p and in floats; it is the limit of the finite pole as l moves
 * onto the centre (the pole runs off to infinity along that direction); for a conic it is the
 * direction conjugate to l (dᵀM₂·l.d = 0).
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { vCross, vDot } from '../src/geom';
import type { Value } from '../src/value';
import { at, FIELDS, line } from './helpers/degenerate';
import { C5 } from './helpers/degenerate-circles';
import { ELL, HYP } from './helpers/degenerate-conics';
import { pt } from './helpers/doc';

function ideal<T>(v: Value<T>): { readonly x: T; readonly y: T } {
  if (v.kind !== 'ideal_point') throw new Error(`expected a point at infinity, got ${v.kind}`);
  return v.d;
}

describe('pole(l, c) with l through the centre', () => {
  it('is the point at infinity perpendicular to l, in every field', () => {
    for (const F of FIELDS) {
      const d = ideal(at(F, 'pole', line(pt(-1, -1), pt(2, 2)), C5));
      const u = { x: F.sub(F.one, F.zero), y: F.one };
      expect(F.isZero(vDot(F, d, u), 'area', { scale: 1 })).toBe(true);
      expect(F.isZero(vCross(F, d, u), 'area', { scale: 1 })).toBe(false);
    }
  });

  it('is the limit of the finite pole as l moves onto the centre', () => {
    for (const h of [1e-1, 1e-3, 1e-5]) {
      const v = at(FloatField, 'pole', line(pt(-1, -1 + h), pt(2, 2 + h)), C5);
      if (v.kind !== 'point') throw new Error(v.kind);
      const r = Math.hypot(v.x, v.y);
      // |P − O| = r²/dist(O, l) grows like 1/h, along the normal (−1, 1)/√2.
      expect(r).toBeGreaterThan(10 / h);
      expect(Math.abs(v.x + v.y) / r).toBeLessThan(1e-9);
    }
    const d = ideal(at(FloatField, 'pole', line(pt(-1, -1), pt(2, 2)), C5));
    expect(Math.abs(d.x + d.y)).toBeLessThan(1e-12);
  });

  it('for a conic: the direction conjugate to l (an ellipse and a hyperbola through their centre)', () => {
    // x²/4 + y² = 1: the diameter of direction (2, 1) has the conjugate direction (−2, 1).
    for (const F of FIELDS) {
      const d = ideal(at(F, 'pole', line(pt(-2, -1), pt(2, 1)), ELL));
      expect(
        F.isZero(vCross(F, d, { x: F.neg(F.add(F.one, F.one)), y: F.one }), 'area', { scale: 1 }),
      ).toBe(true);
    }
    // xy = 1: the diameter y = 2x has the conjugate direction (1, −2).
    for (const F of FIELDS) {
      const d = ideal(at(F, 'pole', line(pt(0, 0), pt(1, 2)), HYP));
      expect(
        F.isZero(vCross(F, d, { x: F.one, y: F.neg(F.add(F.one, F.one)) }), 'area', { scale: 1 }),
      ).toBe(true);
    }
  });
});
