/**
 * Behaviour the num tests did not pin, found by the nightly's surviving mutants (Run 13,
 * SPEC §17 L15): floorLog10 when the float estimate is off or beyond the double range, the
 * text of a rounded zero, the double nearest to a rational, and classifyResidual's guard on
 * the floor.
 */
import { describe, expect, it } from 'vitest';
import { decimalText, floorLog10, pow10 } from '../src/decimal';
import { rational, sub, tryToNumber } from '../src/rational';
import { createRng } from '../src/rng';
import { classifyResidual } from '../src/tolerance';

describe('floorLog10 is exact whatever the float estimate says', () => {
  it('10^k − 1 has exponent k − 1, though log10 of its double rounds up to k', () => {
    for (const k of [16, 20, 23, 50, 100, 300]) {
      const x = sub(pow10(k), rational(1n));
      // The float estimate is k (the double of 10^k − 1 is 10^k): the exact correction runs.
      expect(Math.floor(Math.log10(tryToNumber(x) ?? Number.NaN)), String(k)).toBe(k);
      expect(floorLog10(x), String(k)).toBe(k - 1);
    }
  });

  it('powers of ten beyond the double range keep their exponent up to the clamp', () => {
    for (const k of [308, 309, 350, 399, 400]) expect(floorLog10(pow10(k)), String(k)).toBe(k);
    for (const k of [-324, -350, -399, -400]) expect(floorLog10(pow10(k)), String(k)).toBe(k);
    expect(floorLog10(sub(pow10(350), rational(1n)))).toBe(349);
  });

  it('beyond ±10^400 the exponent is clamped to ±400', () => {
    expect(floorLog10(pow10(500))).toBe(400);
    expect(floorLog10(pow10(-500))).toBe(-400);
    expect(floorLog10(rational(1n, 10n ** 401n + 7n))).toBe(-400);
  });
});

describe('decimalText', () => {
  it('a zero rounded to a negative exponent reads "0", never "-0"', () => {
    for (const e of [-1, -2, -5]) expect(decimalText(rational(0n), e)).toBe('0');
    expect(decimalText(rational(-3n, 100n), -2)).toBe('-0.03');
  });
});

describe('tryToNumber is the double nearest to the rational', () => {
  it('agrees with IEEE division of small integers (correctly rounded)', () => {
    const rng = createRng(13);
    for (let i = 0; i < 20000; i += 1) {
      const n = rng.nextInt(2 ** 31) - 2 ** 30;
      const d = rng.nextInt(2 ** 31) + 1;
      expect(tryToNumber(rational(BigInt(n), BigInt(d))), `${String(n)}/${String(d)}`).toBe(n / d);
    }
    for (const [n, d] of [
      [1, 3],
      [2, 3],
      [1, 10],
      [7, 1000],
      [123456789, 1000003],
    ] as const)
      expect(tryToNumber(rational(BigInt(n), BigInt(d)))).toBe(n / d);
  });
});

describe('classifyResidual', () => {
  it('a negative floor is a caller bug even when the residual is valid', () => {
    expect(() => classifyResidual(0.5, -1)).toThrow(RangeError);
    expect(() => classifyResidual(0, -Number.MIN_VALUE)).toThrow(RangeError);
    expect(() => classifyResidual(-1, 0.5)).toThrow(RangeError);
  });
});
