import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decimalText, floorLog10, pow10, roundTo } from '../src/decimal';
import { compare, eq, fromNumber, parseRational, rational, sub, abs, mul } from '../src/rational';

/** Run 9b: the exact decimal helpers (moved from packages/editor's rounding.ts). */

function q(text: string) {
  const r = parseRational(text);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

describe('exact decimals', () => {
  it('pow10 is exact for both signs', () => {
    expect(pow10(0)).toEqual(rational(1n));
    expect(pow10(3)).toEqual(rational(1000n));
    expect(pow10(-2)).toEqual(rational(1n, 100n));
  });

  it('floorLog10 is exact at powers of ten and clamps degenerate input', () => {
    expect(floorLog10(q('1000'))).toBe(3);
    expect(floorLog10(q('999/1'))).toBe(2);
    expect(floorLog10(q('1/1000'))).toBe(-3);
    expect(floorLog10(q('999/1000000'))).toBe(-4);
    expect(floorLog10(q('0'))).toBe(-400);
    expect(floorLog10(q('-5'))).toBe(-400);
    expect(floorLog10(rational(10n ** 500n))).toBe(400);
  });

  it('roundTo rounds to the nearest multiple, ties away from zero', () => {
    expect(roundTo(q('1.25'), -1)).toEqual(q('1.3'));
    expect(roundTo(q('-1.25'), -1)).toEqual(q('-1.3'));
    expect(roundTo(q('1.24'), -1)).toEqual(q('1.2'));
    expect(roundTo(q('1234'), 2)).toEqual(q('1200'));
  });

  it('decimalText writes multiples of 10^e briefly', () => {
    expect(decimalText(q('0.15'), -2)).toBe('0.15');
    expect(decimalText(q('-3'), -2)).toBe('-3');
    expect(decimalText(q('-0.05'), -2)).toBe('-0.05');
    expect(decimalText(q('1200'), 2)).toBe('1200');
  });

  it('property: |roundTo(x, e) − x| ≤ 10^e / 2 and its text reads back exactly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.integer({ min: -8, max: 3 }),
        (x, e) => {
          const v = fromNumber(x);
          const r = roundTo(v, e);
          expect(compare(mul(abs(sub(r, v)), rational(2n)), pow10(e))).toBeLessThanOrEqual(0);
          expect(eq(q(decimalText(r, e)), r)).toBe(true);
        },
      ),
      { seed: 9, numRuns: 500 },
    );
  });
});
