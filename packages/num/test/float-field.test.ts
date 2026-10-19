import { describe, expect, it } from 'vitest';
import { isInexact } from '../src/field';
import { FloatField as F } from '../src/float-field';
import { fromNumber, rational } from '../src/rational';
import { createRng } from '../src/rng';
import { isZero, sign3, toleranceContext, type Dim } from '../src/tolerance';

const DIMS: readonly Dim[] = ['length', 'area', 'dimensionless'];

function value(x: number | { kind: 'inexact'; reason: string }): number {
  if (typeof x !== 'number') throw new Error(x.reason);
  return x;
}

describe('FloatField basics', () => {
  it('is the float field', () => {
    expect(F.kind).toBe('float');
    expect(F.zero).toBe(0);
    expect(F.one).toBe(1);
  });

  it('isZero and sign are the tolerance-aware tests of tolerance.ts', () => {
    const rng = createRng(41);
    for (const d of [1e-3, 1, 1e3]) {
      const ctx = toleranceContext(d);
      for (let i = 0; i < 500; i++) {
        const x = (rng.nextFloat() - 0.5) * 10 ** rng.uniform(-12, 2);
        for (const dim of DIMS) {
          expect(F.isZero(x, dim, ctx)).toBe(isZero(x, dim, ctx));
          expect(F.sign(x, dim, ctx)).toBe(sign3(x, dim, ctx));
        }
      }
    }
    expect(F.sign(5e-8, 'length', toleranceContext(1))).toBe('ambiguous');
  });

  it('eq is exact equality', () => {
    expect(F.eq(0.1 + 0.2, 0.3)).toBe(false);
    expect(F.eq(0, -0)).toBe(true);
  });

  it('division by exactly zero throws (callers test isZero first)', () => {
    expect(() => F.div(1, 0)).toThrow(RangeError);
    expect(() => F.div(1, -0)).toThrow(RangeError);
    expect(F.div(1, 4)).toBe(0.25);
  });

  it('sqrt always succeeds on non-negative input and rejects negative input', () => {
    expect(F.sqrt(2)).toBe(Math.SQRT2);
    expect(F.sqrt(0)).toBe(0);
    expect(() => F.sqrt(-1e-300)).toThrow(RangeError);
    expect(() => F.sqrt(Number.NaN)).toThrow(RangeError);
    expect(() => F.sqrt(Infinity)).toThrow(RangeError);
  });

  it('fromRational rounds correctly and reports values beyond the double range', () => {
    expect(F.fromRational(rational(1n, 10n))).toBe(0.1);
    expect(F.fromRational(rational(-2n, 3n))).toBe(-2 / 3);
    const huge = F.fromRational(rational(10n ** 400n));
    expect(isInexact(huge)).toBe(true);
    expect(F.toNumber(-2.5)).toBe(-2.5);
    expect(F.fromRational(fromNumber(Number.MAX_VALUE))).toBe(Number.MAX_VALUE);
  });
});

describe('FloatField trigonometry (degrees)', () => {
  it('special angles are exact: sin/cos at multiples of 30° in [-720°, 720°]', () => {
    const sinTable: Record<number, number> = {
      0: 0,
      30: 0.5,
      90: 1,
      150: 0.5,
      180: 0,
      210: -0.5,
      270: -1,
      330: -0.5,
    };
    for (let deg = -720; deg <= 720; deg += 30) {
      const r = ((deg % 360) + 360) % 360;
      const s = sinTable[r];
      const c = sinTable[(r + 90) % 360];
      if (s !== undefined) expect(value(F.sin(deg))).toBe(s);
      if (c !== undefined) expect(value(F.cos(deg))).toBe(c);
      if (s === undefined)
        expect(Math.abs(value(F.sin(deg)) - Math.sin((deg * Math.PI) / 180))).toBeLessThan(1e-15);
      if (c === undefined)
        expect(Math.abs(value(F.cos(deg)) - Math.cos((deg * Math.PI) / 180))).toBeLessThan(1e-15);
    }
  });

  it('general angles match Math.sin/cos and satisfy sin² + cos² = 1', () => {
    const rng = createRng(42);
    for (let i = 0; i < 2000; i++) {
      const deg = rng.uniform(-1000, 1000);
      const s = value(F.sin(deg));
      const c = value(F.cos(deg));
      expect(Math.abs(s - Math.sin((deg * Math.PI) / 180))).toBeLessThan(1e-12);
      expect(Math.abs(c - Math.cos((deg * Math.PI) / 180))).toBeLessThan(1e-12);
      expect(Math.abs(s * s + c * c - 1)).toBeLessThan(1e-15);
    }
  });

  it('rejects non-finite angles', () => {
    for (const x of [Number.NaN, Infinity, -Infinity]) {
      expect(() => F.sin(x)).toThrow(RangeError);
      expect(() => F.cos(x)).toThrow(RangeError);
    }
  });

  it('atan2 is exact on the axes and diagonals, in (-180°, 180°]', () => {
    const cases: [number, number, number][] = [
      [0, 1, 0],
      [1, 1, 45],
      [1, 0, 90],
      [1, -1, 135],
      [0, -1, 180],
      [-0, -1, 180],
      [-1, -1, -135],
      [-1, 0, -90],
      [-1, 1, -45],
      [3, 3, 45],
      [-0, 2, 0],
      [2.5, -2.5, 135],
    ];
    for (const [y, x, deg] of cases) expect(value(F.atan2(y, x))).toBe(deg);
  });

  it('atan2 matches Math.atan2 in degrees elsewhere and never returns -180', () => {
    const rng = createRng(43);
    for (let i = 0; i < 2000; i++) {
      const y = rng.uniform(-5, 5);
      const x = rng.uniform(-5, 5);
      const a = value(F.atan2(y, x));
      expect(a > -180 && a <= 180).toBe(true);
      expect(Math.abs(a - (Math.atan2(y, x) * 180) / Math.PI)).toBeLessThan(1e-12);
    }
    // Math.atan2(-tiny, -1) is −π, i.e. −180°: folded to 180° so the range stays (-180, 180].
    expect(Math.atan2(-1e-300, -1)).toBe(-Math.PI);
    expect(value(F.atan2(-1e-300, -1))).toBe(180);
    expect(value(F.atan2(1e-300, -1))).toBe(180);
  });

  it('atan2(0, 0) and non-finite input are caller bugs', () => {
    expect(() => F.atan2(0, 0)).toThrow(RangeError);
    expect(() => F.atan2(-0, 0)).toThrow(RangeError);
    expect(() => F.atan2(Number.NaN, 1)).toThrow(RangeError);
    expect(() => F.atan2(1, Infinity)).toThrow(RangeError);
  });
});
