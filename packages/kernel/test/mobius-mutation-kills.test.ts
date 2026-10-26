/**
 * Behaviour the Run 14 nightly's mutation reports showed untested (ADR-0032 decision 18): the
 * double-range verdicts of a Möbius map (overflow, underflow, non-finite entries; never for
 * exact fields), the local scale |f′| used by the editor's drag rounding, apply on values that
 * are not figures, the mod p cases (no order: the center itself, ranges and arcs), an arc whose
 * two ends are the center, the names in rangeStatus's reasons, and inversion_swap with A = B.
 */
import { complex, type Complex } from '@geomira/num/complex';
import { isInexact, type Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { similarity } from '../src/similarity';
import { rangeStatus } from '../src/tools/range';
import { applyMap, localScale } from '../src/transform/apply-map';
import { AT_POLE } from '../src/transform/j-core';
import { mobius, mobiusProblem } from '../src/transform/mobius';
import type { Circle, Line, Value, Vec } from '../src/value';
import { evalCall, pt } from './helpers/doc';
import { inversionMap } from './helpers/mobius-gen';

const CTX = { scale: 1 };
const C = (re: number, im = 0): Complex<number> => complex(re, im);
const diag = (a: number, d: number) => mobius(false, C(a), C(0), C(0), C(d));
const BEYOND = { kind: 'inexact', reason: 'x: the map is beyond the double range' };

/** The integer n in the field F. */
function n<T>(F: Field<T>, k: number | bigint): T {
  const v = F.fromRational(rational(BigInt(k), 1n));
  if (isInexact(v)) throw new Error('not representable');
  return v;
}
const v2 = <T>(F: Field<T>, x: number, y: number): Vec<T> => ({ x: n(F, x), y: n(F, y) });

describe('mobiusProblem: the double range (FloatField only)', () => {
  it('non-finite entries, an overflowing or underflowing determinant → Inexact', () => {
    const cases = [
      mobius(false, C(Infinity), C(0), C(0), C(1)),
      mobius(false, C(1), C(Infinity), C(0), C(1)),
      mobius(false, C(1), C(0), C(1), C(-Infinity)),
      diag(1e200, 1e200), // ad − bc overflows
      diag(1e100, 1e100), // |ad − bc|² overflows
      diag(1e-85, 1e-85), // |ad − bc|² underflows to 0
      diag(1e-78, 1e-78), // |ad − bc|² is subnormal: its reciprocal overflows
    ];
    for (const m of cases) expect(mobiusProblem(FloatField, m, 'x')).toEqual(BEYOND);
  });

  it('a valid map has no problem; ad − bc = 0 is not invertible', () => {
    expect(mobiusProblem(FloatField, diag(1e-50, 1e50), 'x')).toBeUndefined();
    expect(mobiusProblem(FloatField, mobius(true, C(1), C(2), C(2), C(4)), 'x')).toEqual({
      kind: 'undefined',
      reason: 'x: the map is not invertible (ad − bc = 0)',
    });
  });

  it('exact fields have no double range: huge entries are valid over Q and mod p', () => {
    const big = 10n ** 400n;
    for (const F of [RationalField, ModPField] as Field<unknown>[]) {
      const c = (k: bigint) => complex(n(F, k), F.zero);
      expect(mobiusProblem(F, mobius(false, c(big), c(0n), c(1n), c(big)), 'x')).toBeUndefined();
    }
  });
});

describe('localScale |f′(x)| (the editor’s drag rounding)', () => {
  it('a similarity: |a|; a degenerate scale falls back to 1', () => {
    expect(localScale(similarity(false, C(3, 4), C(7)), { x: 1, y: 1 })).toBe(5);
    expect(localScale(similarity(true, C(0), C(7)), { x: 1, y: 1 })).toBe(1);
  });

  it('an inversion: k / |x − O|², with the conjugate for an anti map; at the center → 1', () => {
    const J = inversionMap(FloatField, { x: 0, y: 0 }, 4);
    expect(localScale(J, { x: 1, y: 0 })).toBe(4);
    expect(localScale(J, { x: 2, y: 0 })).toBe(1);
    expect(localScale(J, { x: 0, y: 0 })).toBe(1);
    expect(localScale(J, { x: 1e-160, y: 0 })).toBe(1); // |f′| overflows
    const K = inversionMap(FloatField, { x: 0, y: 1 }, 1);
    expect(localScale(K, { x: 1, y: 1 })).toBe(1);
    expect(localScale(K, { x: 0, y: 3 })).toBeCloseTo(0.25, 12);
  });
});

describe('apply through a Möbius map: values that are not figures, and mod p', () => {
  const J = <T>(F: Field<T>) => inversionMap(F, v2(F, 0, 0), n(F, 4));

  it('a string or a number has no image', () => {
    const F = FloatField;
    expect(applyMap(F, J(F), { kind: 'string', s: 'a' }, CTX)).toEqual({
      kind: 'undefined',
      reason: 'apply does not map a string',
    });
    expect(applyMap(F, J(F), { kind: 'number', v: 2 }, CTX)).toEqual({
      kind: 'undefined',
      reason: 'apply does not map a number',
    });
  });

  it('mod p: the center has no image; ranges and arcs need an order', () => {
    const F = ModPField;
    const P = (x: number, y: number): Value<bigint> => ({ kind: 'point', ...v2(F, x, y) });
    expect(applyMap(F, J(F), P(0, 0), CTX)).toEqual({ kind: 'undefined', reason: AT_POLE });
    expect(applyMap(F, J(F), P(1, 0), CTX)).toEqual(P(4, 0));
    const seg = (p: Vec<bigint>): Line<bigint> => ({
      kind: 'line',
      p,
      d: v2(F, 1, 0),
      lo: n(F, -1),
      hi: n(F, 2),
      chiral: false,
    });
    const range = 'apply: a range through an inversion needs an order, which ModPField lacks';
    expect(applyMap(F, J(F), seg(v2(F, 0, 0)), CTX)).toEqual({ kind: 'inexact', reason: range });
    expect(applyMap(F, J(F), seg(v2(F, 0, 1)), CTX)).toEqual({ kind: 'inexact', reason: range });
    const arc: Circle<bigint> = {
      kind: 'circle',
      c: v2(F, 1, 0),
      r2: F.one,
      arc: { from: v2(F, 2, 0), to: v2(F, 1, 1) },
    };
    expect(applyMap(F, J(F), arc, CTX)).toEqual({
      kind: 'inexact',
      reason: 'apply: an arc through an inversion needs an order, which ModPField lacks',
    });
  });

  it('an arc whose two ends are the center → Undefined', () => {
    const F = RationalField;
    const O = v2(F, 0, 0);
    const arc: Circle<(typeof O)['x']> = {
      kind: 'circle',
      c: v2(F, 1, 0),
      r2: F.one,
      arc: { from: O, to: O },
    };
    expect(applyMap(F, J(F), arc, CTX)).toEqual({
      kind: 'undefined',
      reason: 'the arc has coincident ends',
    });
  });
});

describe('rangeStatus names the range in its reasons', () => {
  const line = <T>(F: Field<T>, lo: T | null, hi: T | null, outside: boolean): Line<T> => ({
    kind: 'line',
    p: v2(F, 0, 0),
    d: v2(F, 1, 0),
    lo,
    hi,
    chiral: false,
    ...(outside ? { outside: true as const } : {}),
  });

  it('a ray and a segment, within the band of an end (floats)', () => {
    const F = FloatField;
    expect(rangeStatus(F, line(F, 0, null, false), 1e-8, CTX, 'intersection')).toEqual({
      kind: 'undefined',
      reason: 'ambiguous: the intersection is within the band of an end of the ray',
    });
    expect(rangeStatus(F, line(F, 0, 1, false), 1e-8, CTX, 'intersection')).toEqual({
      kind: 'undefined',
      reason: 'ambiguous: the intersection is within the band of an end of the segment',
    });
  });

  it('the two rays mod p need an order', () => {
    const F = ModPField;
    expect(rangeStatus(F, line(F, n(F, -4), n(F, 2), true), F.one, CTX, 'intersection')).toEqual({
      kind: 'inexact',
      reason:
        'whether the intersection lies on the pair of rays needs an order, which ModPField lacks',
    });
  });
});

describe('inversion_swap(O, A, B) with A = B', () => {
  it('is Undefined for the coincident points, not for O off line AB', () => {
    const reason = (v: Value<unknown>): string => (v.kind === 'undefined' ? v.reason : v.kind);
    for (const F of [FloatField, RationalField] as Field<unknown>[]) {
      const circle = reason(evalCall(F, 'diameter_circle', [pt(1, 0), pt(1, 0)]));
      expect(circle).toMatch(/coincident/u);
      expect(reason(evalCall(F, 'inversion_swap', [pt(0, 0), pt(1, 0), pt(1, 0)]))).toBe(circle);
    }
  });
});
