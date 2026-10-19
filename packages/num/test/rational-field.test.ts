import { describe, expect, it } from 'vitest';
import { isInexact, type Inexact } from '../src/field';
import { FloatField } from '../src/float-field';
import { RationalField as F } from '../src/rational-field';
import { eq, fromInteger, rational, toNumber, type Rational } from '../src/rational';
import { createRng } from '../src/rng';
import { toleranceContext } from '../src/tolerance';

const q = (n: number, d = 1): Rational => rational(BigInt(n), BigInt(d));
const ctx = toleranceContext(1e3);

function value(x: Rational | Inexact): Rational {
  if (isInexact(x)) throw new Error(x.reason);
  return x;
}

describe('RationalField basics', () => {
  it('is exact: sign and isZero ignore tolerances', () => {
    expect(F.kind).toBe('rational');
    const tiny = rational(1n, 10n ** 30n);
    expect(F.isZero(tiny, 'area', ctx)).toBe(false);
    expect(F.sign(tiny, 'length', ctx)).toBe(1);
    expect(F.sign(F.neg(tiny), 'length', ctx)).toBe(-1);
    expect(F.isZero(F.zero, 'dimensionless', ctx)).toBe(true);
    expect(F.eq(q(2, 4), q(1, 2))).toBe(true);
  });

  it('fromRational is the identity and toNumber rounds correctly', () => {
    const r = q(-7, 3);
    expect(F.fromRational(r)).toBe(r);
    expect(F.toNumber(r)).toBe(-7 / 3);
  });

  it('division by zero throws', () => {
    expect(() => F.div(F.one, F.zero)).toThrow(RangeError);
  });
});

describe('RationalField.sqrt', () => {
  it('succeeds exactly on perfect squares', () => {
    expect(value(F.sqrt(q(9, 4)))).toEqual(q(3, 2));
    expect(value(F.sqrt(F.zero))).toEqual(F.zero);
  });

  it('returns Inexact with a reason otherwise', () => {
    const r = F.sqrt(q(2));
    expect(isInexact(r)).toBe(true);
    if (isInexact(r)) expect(r.reason).toMatch(/2/);
    expect(isInexact(F.sqrt(q(1, 2)))).toBe(true);
  });

  it('negative input is a caller bug', () => {
    expect(() => F.sqrt(q(-1))).toThrow(RangeError);
  });
});

describe('RationalField trigonometry (degrees)', () => {
  it('sin and cos are exact exactly at multiples of 30° (Niven), Inexact elsewhere', () => {
    for (let deg = -720; deg <= 720; deg++) {
      const s = F.sin(fromInteger(deg));
      const c = F.cos(fromInteger(deg));
      const special = deg % 30 === 0;
      const fs = FloatField.sin(deg);
      const fc = FloatField.cos(deg);
      if (typeof fs !== 'number' || typeof fc !== 'number') throw new Error('float trig failed');
      const sinIsRational = [0, 0.5, -0.5, 1, -1].includes(fs) && special;
      const cosIsRational = [0, 0.5, -0.5, 1, -1].includes(fc) && special;
      expect(isInexact(s)).toBe(!sinIsRational);
      expect(isInexact(c)).toBe(!cosIsRational);
      if (!isInexact(s)) expect(toNumber(s)).toBe(fs);
      if (!isInexact(c)) expect(toNumber(c)).toBe(fc);
    }
  });

  it('the exact values form the table of SPEC §3.3', () => {
    expect(value(F.sin(fromInteger(30)))).toEqual(q(1, 2));
    expect(value(F.cos(fromInteger(60)))).toEqual(q(1, 2));
    expect(value(F.sin(fromInteger(-90)))).toEqual(q(-1));
    expect(value(F.cos(fromInteger(180)))).toEqual(q(-1));
    expect(value(F.cos(fromInteger(90)))).toEqual(F.zero);
    expect(value(F.sin(fromInteger(390)))).toEqual(q(1, 2));
    expect(value(F.cos(fromInteger(-240)))).toEqual(q(-1, 2));
    expect(isInexact(F.sin(fromInteger(60)))).toBe(true);
    expect(isInexact(F.cos(fromInteger(30)))).toBe(true);
    expect(isInexact(F.sin(fromInteger(45)))).toBe(true);
  });

  it('non-integer degrees are Inexact, whatever their size', () => {
    expect(isInexact(F.sin(q(1, 2)))).toBe(true);
    expect(isInexact(F.cos(q(181, 2)))).toBe(true);
    // numerators that are special integers must not be mistaken for the angle itself
    expect(isInexact(F.sin(q(30, 7)))).toBe(true);
    expect(isInexact(F.cos(q(-90, 7)))).toBe(true);
    expect(isInexact(F.sin(q(-90, 11)))).toBe(true);
    const r = F.sin(q(61, 2));
    if (isInexact(r)) expect(r.reason).toMatch(/sin/);
  });

  it('handles huge integer angles by exact reduction mod 360', () => {
    const big = rational(360n * 10n ** 30n + 30n);
    expect(value(F.sin(big))).toEqual(q(1, 2));
    expect(value(F.cos(rational(-(360n * 10n ** 30n) - 180n)))).toEqual(q(-1));
  });

  it('atan2 is exact on axes and diagonals (Niven for tan), Inexact elsewhere', () => {
    const cases: [number, number, number][] = [
      [0, 1, 0],
      [1, 1, 45],
      [2, 0, 90],
      [1, -1, 135],
      [0, -3, 180],
      [-1, -1, -135],
      [-5, 0, -90],
      [-1, 1, -45],
      [7, 7, 45],
    ];
    for (const [y, x, deg] of cases) expect(value(F.atan2(q(y), q(x)))).toEqual(q(deg));
    expect(value(F.atan2(q(1, 3), q(-1, 3)))).toEqual(q(135));
    const rng = createRng(51);
    for (let i = 0; i < 500; i++) {
      const y = q(rng.nextInt(41) - 20, rng.nextInt(5) + 1);
      const x = q(rng.nextInt(41) - 20, rng.nextInt(5) + 1);
      if (F.isZero(x, 'length', ctx) && F.isZero(y, 'length', ctx)) continue;
      const exact =
        F.isZero(x, 'length', ctx) || F.isZero(y, 'length', ctx) || eq(y, x) || eq(y, F.neg(x));
      const a = F.atan2(y, x);
      expect(isInexact(a)).toBe(!exact);
      const fa = FloatField.atan2(toNumber(y), toNumber(x));
      if (!isInexact(a) && typeof fa === 'number') expect(toNumber(a)).toBe(fa);
    }
  });

  it('atan2(0, 0) is a caller bug', () => {
    expect(() => F.atan2(F.zero, F.zero)).toThrow(RangeError);
  });
});
