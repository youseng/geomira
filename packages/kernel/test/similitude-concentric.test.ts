/**
 * ADR-0045 (the maintainer's decision of 2026-11-01): two concentric circles of different radii
 * have both centres of similitude at their common centre O (the homotheties of ratio ±r₂/r₁
 * about O take one circle to the other); only identical circles are Undefined. The centre needs
 * no square root, so it is exact in every field, even when the radii are irrational.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Value } from '../src/value';
import { at, reason } from './helpers/degenerate';
import { circ } from './helpers/degenerate-circles';
import { num, pt } from './helpers/doc';

const FIELDS: readonly Field<unknown>[] = [
  FloatField,
  RationalField,
  ModPField,
] as Field<unknown>[];
const TOOLS = ['exsimilicenter', 'insimilicenter'] as const;

function xy<T>(F: Field<T>, v: Value<T>): unknown {
  return v.kind === 'point' ? [F.toNumber(v.x), F.toNumber(v.y)] : reason(v);
}

describe('centres of similitude of concentric circles (ADR-0045)', () => {
  it('different radii: both are the common centre, in every field, in either order', () => {
    const small = circ(pt(2, -3), num(1));
    const big = circ(pt(2, -3), num(5));
    for (const F of FIELDS)
      for (const tool of TOOLS) {
        expect(xy(F, at(F, tool, small, big)), `${F.name} ${tool}`).toEqual([2, -3]);
        expect(xy(F, at(F, tool, big, small)), `${F.name} ${tool}`).toEqual([2, -3]);
      }
  });

  it('irrational radii need no square root: the centre is exact over Q and mod p', () => {
    // r² = 2 and r² = 8: no rational radius, but the common centre is (1, 1) exactly.
    const a = circ(pt(1, 1), pt(2, 2));
    const b = circ(pt(1, 1), pt(3, 3));
    for (const F of FIELDS)
      for (const tool of TOOLS)
        expect(xy(F, at(F, tool, a, b)), `${F.name} ${tool}`).toEqual([1, 1]);
  });

  it('identical circles: Undefined, with the reason', () => {
    const c = circ(pt(0, 0), num(3));
    for (const F of FIELDS)
      for (const tool of TOOLS)
        expect(reason(at(F, tool, c, c)), `${F.name} ${tool}`).toBe(
          'undefined: identical circles: no centre of similitude',
        );
  });

  it('concentric with radii within the band of equal (floats): Undefined, ambiguous', () => {
    const a = circ(pt(0, 0), num(1));
    const b = circ(pt(0, 0), num(1 + 1e-8));
    for (const tool of TOOLS)
      expect(reason(at(FloatField, tool, a, b))).toMatch(/^undefined: ambiguous: /u);
  });

  it('continuous: a centre moved off by a little moves the centres of similitude by little', () => {
    const a = circ(pt(0, 0), num(1));
    const b = circ(pt(1e-6, 0), num(2));
    const E = at(FloatField, 'exsimilicenter', a, b);
    const I = at(FloatField, 'insimilicenter', a, b);
    for (const v of [E, I]) {
      expect(v.kind).toBe('point');
      if (v.kind !== 'point') continue;
      expect(Math.hypot(v.x, v.y)).toBeLessThan(1e-5);
    }
  });
});
