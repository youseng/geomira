/**
 * sqrt, sin, cos and tan (ADR-0005) on tables of arguments:
 *   - exactness over Q is exactly where the value is rational: √ of squares of rationals;
 *     sin/cos at the multiples of 30° in num's tables; tan at the multiples of 45° (Niven),
 *     and the exact value is carried (Num.exact) in every field;
 *   - FloatField agrees with the exact values, and with Math elsewhere;
 *   - num is never called outside its domain: through withSqrtLog / withDivisorLog no
 *     square root of a negative and no division by zero is ever requested.
 */
import { isInexact, withDivisorLog, withSqrtLog, type Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { fromNumber, rational, toNumber, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { lit } from '../src/expr';
import { numOf, type Value } from '../src/value';
import { REGISTRY, evalCall, must } from './helpers/doc';

const DEG = Math.PI / 180;

function at<T>(F: Field<T>, tool: string, x: Rational): Value<T> {
  return evalCall(F, tool, [lit(x)]);
}

function exactOf<T>(v: Value<T>): number | undefined {
  return v.kind === 'number' && v.exact !== undefined ? toNumber(v.exact) : undefined;
}

const RATIONAL_SIN: Readonly<Record<number, number>> = {
  0: 0,
  30: 0.5,
  90: 1,
  150: 0.5,
  180: 0,
  210: -0.5,
  270: -1,
  330: -0.5,
};

function isSquare(n: bigint): boolean {
  const r = BigInt(Math.round(Math.sqrt(Number(n))));
  return r * r === n;
}

function mod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

describe('sqrt, sin, cos, tan on tables of arguments', () => {
  it('sin and cos are exact exactly at the multiples of 30° where they are rational', () => {
    for (let k = -48; k <= 48; k += 1) {
      const t = 15 * k;
      for (const [tool, shift] of [
        ['sin', 0],
        ['cos', 90],
      ] as const) {
        const want = RATIONAL_SIN[mod(t + shift, 360)];
        const q = at(RationalField, tool, rational(BigInt(t)));
        expect(q.kind, `${tool}(${String(t)})`).toBe(want === undefined ? 'inexact' : 'number');
        for (const F of [FloatField, RationalField, ModPField] as Field<unknown>[])
          expect(exactOf(at(F, tool, rational(BigInt(t))))).toBe(want);
        const f = at(FloatField, tool, rational(BigInt(t)));
        const m = tool === 'sin' ? Math.sin(t * DEG) : Math.cos(t * DEG);
        expect(f.kind === 'number' && Math.abs(f.v - m)).toBeLessThan(1e-15);
      }
    }
  });

  it('tan is Undefined at 90° (mod 180°), exact at the other multiples of 45°, Inexact elsewhere over Q', () => {
    for (let k = -48; k <= 48; k += 1) {
      const t = 15 * k;
      const r = mod(t, 180);
      const q = at(RationalField, 'tan', rational(BigInt(t)));
      const f = at(FloatField, 'tan', rational(BigInt(t)));
      if (r === 90) {
        expect(q.kind).toBe('undefined');
        expect(f.kind).toBe('undefined');
        continue;
      }
      const want = r === 0 ? 0 : r === 45 ? 1 : r === 135 ? -1 : undefined;
      expect(q.kind, `tan(${String(t)})`).toBe(want === undefined ? 'inexact' : 'number');
      expect(exactOf(f)).toBe(want);
      const m = Math.tan(t * DEG);
      expect(f.kind === 'number' && Math.abs(f.v - m)).toBeLessThan(
        1e-14 * Math.max(1, Math.abs(m)),
      );
    }
  });

  it('sqrt is exact on squares of rationals and Inexact otherwise over Q', () => {
    for (let n = 0; n <= 60; n += 1) {
      for (const d of [1, 2, 4, 7, 9, 12]) {
        const x = rational(BigInt(n), BigInt(d));
        const root = Math.sqrt(n / d);
        const q = at(RationalField, 'sqrt', x);
        // x is reduced (8/2 = 4/1), so it is a square iff its numerator and denominator are.
        expect(q.kind === 'number', `√(${String(n)}/${String(d)})`).toBe(
          isSquare(x.num) && isSquare(x.den),
        );
        if (q.kind === 'number') expect(Math.abs(toNumber(q.v) - root)).toBeLessThan(1e-15);
        const f = at(FloatField, 'sqrt', x);
        expect(f.kind === 'number' && Math.abs(f.v - root)).toBeLessThanOrEqual(1e-15 * root);
      }
    }
  });

  it('num is never asked for √ of a negative or a division by zero', () => {
    const args = [
      0,
      -0,
      1e-17,
      -1e-17,
      1e-12,
      -1e-12,
      5e-8,
      -5e-8,
      1e-7,
      -1e-7,
      2,
      -2,
      90,
      -90,
      270,
      45,
      90 + 1e-9,
      90 - 1e-6,
      1e30,
      -1e30,
    ];
    for (const F of [FloatField, RationalField, ModPField] as Field<unknown>[]) {
      const sq = withSqrtLog(F);
      const dv = withDivisorLog(sq.field);
      for (const tool of ['sqrt', 'sin', 'cos', 'tan']) {
        const spec = must(REGISTRY.get(tool));
        for (const a of args) {
          const r = F.fromRational(fromNumber(a));
          if (isInexact(r)) continue;
          // Without an exact value (as a measure gives it) and with one (as a literal does).
          spec.compute(dv.field, [numOf(r)], { scale: 1 });
          spec.compute(dv.field, [numOf(r, fromNumber(a))], { scale: 1 });
        }
      }
      if (F.kind !== 'modp') {
        for (const s of sq.requests)
          expect(F.sign(s.arg, 'dimensionless', { scale: 1 })).not.toBe(-1);
        for (const s of sq.requests) expect(F.toNumber(s.arg)).toBeGreaterThanOrEqual(0);
      }
      for (const d of dv.divisors) expect(F.eq(d, F.zero)).toBe(false);
      // Mod p every trigonometric value is Inexact before anything is divided.
      expect(dv.divisors.length > 0).toBe(F.kind !== 'modp');
    }
  });

  it('an exact value the field cannot hold is Inexact, never a wrong number', () => {
    const p = (1n << 61n) - 1n;
    const sqrt = must(REGISTRY.get('sqrt'));
    const ctx = { scale: 1 };
    // Mod p: 4/p² has the root 2/p, whose denominator is divisible by p; 2/p has none.
    for (const e of [rational(4n, p * p), rational(2n, p)])
      expect(sqrt.compute(ModPField, [numOf(1n, e)], ctx)).toEqual({
        kind: 'inexact',
        reason: 'the denominator is divisible by p (mod p)',
      });
    // FloatField: an exact square whose root is beyond the double range.
    const huge = rational(10n ** 700n);
    expect(sqrt.compute(FloatField, [numOf(1, huge)], ctx)).toEqual({
      kind: 'inexact',
      reason: 'the number is beyond the double range',
    });
    // Mod p without an exact value: no order, so num is asked and answers Inexact.
    expect(sqrt.compute(ModPField, [numOf(4n)], ctx)).toEqual({
      kind: 'inexact',
      reason: 'square roots are not evaluable mod p',
    });
    // Also when the symmetric representative is negative: mod p has no order, so it is
    // neither "negative" (Undefined) nor "a negative within the band" (0).
    expect(sqrt.compute(ModPField, [numOf(ModPField.neg(4n))], ctx)).toEqual({
      kind: 'inexact',
      reason: 'square roots are not evaluable mod p',
    });
  });
});
