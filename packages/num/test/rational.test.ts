import { describe, expect, it } from 'vitest';
import {
  ONE,
  ZERO,
  abs,
  add,
  bitSize,
  compare,
  div,
  eq,
  formatRational,
  fromInteger,
  fromNumber,
  isInteger,
  isZero,
  mul,
  neg,
  parseRational,
  rational,
  sign,
  sqrtExact,
  sub,
  toNumber,
  tryToNumber,
  type Rational,
} from '../src/rational';
import { createRng, type Rng } from '../src/rng';
import { nextDown, nextUp } from './helpers/ulp';

function q(num: number | bigint, den: number | bigint = 1n): Rational {
  return rational(BigInt(num), BigInt(den));
}

function parsed(text: string): Rational {
  const result = parseRational(text);
  if (!result.ok) throw new Error(`expected ${text} to parse: ${result.reason}`);
  return result.value;
}

function randomRational(rng: Rng, maxNum = 1000, maxDen = 60): Rational {
  return q(rng.nextInt(2 * maxNum + 1) - maxNum, rng.nextInt(maxDen) + 1);
}

describe('normal form', () => {
  it('reduces, keeps the denominator positive, and has a unique zero', () => {
    expect(q(2, 4)).toEqual({ num: 1n, den: 2n });
    expect(q(1, -2)).toEqual({ num: -1n, den: 2n });
    expect(q(-6, -9)).toEqual({ num: 2n, den: 3n });
    expect(q(0, -5)).toEqual({ num: 0n, den: 1n });
    expect(ZERO).toEqual({ num: 0n, den: 1n });
    expect(ONE).toEqual({ num: 1n, den: 1n });
    expect(rational(7n)).toEqual({ num: 7n, den: 1n });
  });

  it('rejects a zero denominator', () => {
    expect(() => rational(1n, 0n)).toThrow(RangeError);
  });

  it('fromInteger accepts safe integers only', () => {
    expect(fromInteger(-12)).toEqual({ num: -12n, den: 1n });
    expect(() => fromInteger(1.5)).toThrow(RangeError);
    expect(() => fromInteger(2 ** 53)).toThrow(RangeError);
  });
});

describe('parseRational', () => {
  it.each([
    ['0.1', 1n, 10n],
    ['2/3', 2n, 3n],
    ['-3/4', -3n, 4n],
    ['+5', 5n, 1n],
    ['-0', 0n, 1n],
    ['007', 7n, 1n],
    ['1.50', 3n, 2n],
    ['4/6', 2n, 3n],
    ['-2.125', -17n, 8n],
    ['0/7', 0n, 1n],
    ['123456789012345678901234567890', 123456789012345678901234567890n, 1n],
    ['0.000000000000000000001', 1n, 10n ** 21n],
  ])('%s → %s/%s', (text, num, den) => {
    expect(parsed(text)).toEqual({ num, den });
  });

  it.each([
    '',
    ' 1',
    '1 ',
    '1/0',
    'abc',
    '1.',
    '.5',
    '1/-2',
    '1e3',
    '--1',
    '1/2/3',
    '0x10',
    '½',
    '1,5',
  ])('rejects %j with a reason', (text) => {
    const result = parseRational(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });

  it('says why 1/0 is rejected', () => {
    const result = parseRational('1/0');
    expect(result.ok ? '' : result.reason).toMatch(/zero/);
  });

  it('round-trips through formatRational', () => {
    const rng = createRng(21);
    for (let i = 0; i < 500; i++) {
      const r = randomRational(rng);
      expect(parsed(formatRational(r))).toEqual(r);
    }
    expect(formatRational(q(-3, 4))).toBe('-3/4');
    expect(formatRational(q(5))).toBe('5');
    expect(formatRational(ZERO)).toBe('0');
  });
});

describe('arithmetic', () => {
  it('computes known values exactly', () => {
    expect(add(q(1, 2), q(1, 3))).toEqual(q(5, 6));
    expect(sub(q(1, 2), q(1, 3))).toEqual(q(1, 6));
    expect(mul(q(2, 3), q(3, 4))).toEqual(q(1, 2));
    expect(div(q(2, 3), q(4, 9))).toEqual(q(3, 2));
    expect(div(q(-1, 3), q(1, -3))).toEqual(ONE);
    expect(neg(q(2, 5))).toEqual(q(-2, 5));
    expect(neg(ZERO)).toEqual(ZERO);
    expect(abs(q(-7, 3))).toEqual(q(7, 3));
    expect(add(parsed('0.1'), parsed('0.2'))).toEqual(parsed('0.3'));
  });

  it('division by zero throws', () => {
    expect(() => div(ONE, ZERO)).toThrow(RangeError);
  });

  it('results are always in normal form (property)', () => {
    const rng = createRng(22);
    const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
    for (let i = 0; i < 1000; i++) {
      const a = randomRational(rng);
      const b = randomRational(rng);
      const results = [add(a, b), sub(a, b), mul(a, b)];
      if (!isZero(b)) results.push(div(a, b));
      for (const r of results) {
        expect(r.den > 0n).toBe(true);
        expect(gcd(r.num < 0n ? -r.num : r.num, r.den)).toBe(1n);
        if (r.num === 0n) expect(r.den).toBe(1n);
      }
    }
  });

  it('matches float arithmetic on small operands (differential, within rounding)', () => {
    const rng = createRng(23);
    for (let i = 0; i < 1000; i++) {
      const a = randomRational(rng);
      const b = randomRational(rng);
      const fa = toNumber(a);
      const fb = toNumber(b);
      expect(toNumber(add(a, b))).toBeCloseTo(fa + fb, 9);
      expect(toNumber(mul(a, b))).toBeCloseTo(fa * fb, 9);
    }
  });
});

describe('compare, eq, sign, isZero, isInteger', () => {
  it('orders rationals', () => {
    expect(compare(q(1, 3), q(1, 2))).toBe(-1);
    expect(compare(q(1, 2), q(2, 4))).toBe(0);
    expect(compare(q(-1, 2), q(-2, 3))).toBe(1);
    expect(eq(q(3, 6), q(1, 2))).toBe(true);
    expect(eq(q(1, 3), q(1, 2))).toBe(false);
    expect(eq(q(1, 3), q(2, 3))).toBe(false);
    expect(sign(q(-1, 10n ** 40n))).toBe(-1);
    expect(sign(ZERO)).toBe(0);
    expect(sign(q(1, 10n ** 40n))).toBe(1);
    expect(isZero(ZERO)).toBe(true);
    expect(isZero(q(1, 10n ** 40n))).toBe(false);
    expect(isInteger(q(4, 2))).toBe(true);
    expect(isInteger(q(1, 2))).toBe(false);
  });

  it('is a total order consistent with subtraction (property)', () => {
    const rng = createRng(24);
    for (let i = 0; i < 1000; i++) {
      const a = randomRational(rng);
      const b = randomRational(rng);
      const c = randomRational(rng);
      expect(compare(a, b)).toBe(sign(sub(a, b)));
      expect(compare(b, a)).toBe(-compare(a, b));
      if (compare(a, b) <= 0 && compare(b, c) <= 0) expect(compare(a, c)).toBeLessThanOrEqual(0);
    }
  });
});

/** True iff x is a double nearest to r (ties allowed), checked exactly in rational arithmetic. */
function isNearestDouble(r: Rational, x: number): boolean {
  const err = abs(sub(r, fromNumber(x)));
  const up = nextUp(x);
  const down = nextDown(x);
  const errUp = Number.isFinite(up) ? abs(sub(r, fromNumber(up))) : undefined;
  const errDown = Number.isFinite(down) ? abs(sub(r, fromNumber(down))) : undefined;
  return (
    (errUp === undefined || compare(err, errUp) <= 0) &&
    (errDown === undefined || compare(err, errDown) <= 0)
  );
}

describe('toNumber', () => {
  it('equals IEEE division for operands below 2^53 (correctly rounded oracle)', () => {
    const rng = createRng(25);
    for (let i = 0; i < 5000; i++) {
      const n = rng.nextInt(2 ** 32) * 2 ** 20 + rng.nextInt(2 ** 20);
      const d = rng.nextInt(2 ** 32) * 2 ** 20 + rng.nextInt(2 ** 20) + 1;
      const sgn = rng.nextInt(2) === 0 ? 1 : -1;
      expect(toNumber(q(BigInt(sgn * n), BigInt(d)))).toBe((sgn * n) / d);
    }
    expect(toNumber(q(1, 10))).toBe(0.1);
    expect(toNumber(q(1, 3))).toBe(1 / 3);
    expect(toNumber(q(-2, 3))).toBe(-2 / 3);
    expect(toNumber(ZERO)).toBe(0);
  });

  it('is within half an ulp on [1e-12, 1e12] for large numerators and denominators', () => {
    const rng = createRng(26);
    for (let i = 0; i < 3000; i++) {
      const target = 10 ** rng.uniform(-12, 12);
      const den = (BigInt(rng.nextInt(2 ** 32)) << 64n) + BigInt(rng.nextInt(2 ** 32)) + 1n;
      const num = BigInt(Math.round(target * 2 ** 80)) * den + BigInt(rng.nextInt(2 ** 30));
      const r = q(num, den << 80n);
      const x = toNumber(r);
      expect(x / target).toBeGreaterThan(0.99);
      expect(isNearestDouble(r, x)).toBe(true);
    }
  });

  it('round-trips every double exactly with fromNumber', () => {
    const rng = createRng(27);
    const special = [
      0.1,
      -0.3,
      1e-12,
      1e12,
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
      Number.MIN_VALUE,
      2.2250738585072014e-308,
      2 ** 53 + 2,
      123456.789,
    ];
    for (const x of special) expect(toNumber(fromNumber(x))).toBe(x);
    const view = new DataView(new ArrayBuffer(8));
    for (let i = 0; i < 3000; i++) {
      view.setUint32(0, rng.nextUint32());
      view.setUint32(4, rng.nextUint32());
      const x = view.getFloat64(0);
      if (!Number.isFinite(x)) continue;
      expect(toNumber(fromNumber(x))).toBe(x === 0 ? 0 : x);
    }
  });

  it('rounds ties to even', () => {
    const two53 = 2n ** 53n;
    expect(toNumber(q(two53 + 1n))).toBe(2 ** 53);
    expect(toNumber(q(two53 + 3n))).toBe(2 ** 53 + 4);
    expect(toNumber(q(-(two53 + 1n)))).toBe(-(2 ** 53));
    expect(toNumber(q(two53 * 2n + 2n))).toBe(2 ** 54);
    expect(toNumber(q(two53 * 2n + 3n))).toBe(2 ** 54 + 4);
  });

  it('carries into the next binade when rounding up reaches 2^53', () => {
    expect(toNumber(q(2n ** 54n - 1n))).toBe(2 ** 54);
    expect(toNumber(q(2n ** 53n - 1n, 2n))).toBe(2 ** 52 - 0.5); // 53 bits: exact, no carry
    expect(toNumber(q(2n ** 54n - 1n, 2n))).toBe(2 ** 53); // 54 bits: tie, rounds to even
    expect(toNumber(q(2n ** 60n - 1n, 2n ** 70n))).toBe(2 ** -10);
    expect(toNumber(q(-(2n ** 54n - 1n)))).toBe(-(2 ** 54));
    expect(toNumber(q(2n ** 1000n - 1n))).toBe(2 ** 1000);
  });

  it('handles subnormals with gradual underflow', () => {
    const tiny = 2n ** 1074n;
    expect(toNumber(q(1n, tiny))).toBe(Number.MIN_VALUE);
    expect(toNumber(q(1n, tiny * 2n))).toBe(0);
    expect(toNumber(q(3n, tiny * 4n))).toBe(Number.MIN_VALUE);
    expect(toNumber(q(3n, tiny * 2n))).toBe(2 * Number.MIN_VALUE);
    expect(toNumber(q(1n, 10n ** 400n))).toBe(0);
    expect(toNumber(q(-1n, 10n ** 400n))).toBe(-0);
    expect(toNumber(q(5n, tiny))).toBe(5 * Number.MIN_VALUE);
  });

  it('reaches Number.MAX_VALUE and throws beyond the double range', () => {
    const max = fromNumber(Number.MAX_VALUE);
    expect(toNumber(max)).toBe(Number.MAX_VALUE);
    const halfway = add(max, q(2n ** 970n));
    expect(() => toNumber(halfway)).toThrow(RangeError);
    expect(toNumber(sub(halfway, q(1n)))).toBe(Number.MAX_VALUE);
    expect(() => toNumber(q(2n ** 1024n))).toThrow(RangeError);
    expect(() => toNumber(q(-(2n ** 1100n)))).toThrow(RangeError);
    expect(tryToNumber(halfway)).toBeUndefined();
    expect(tryToNumber(q(-(2n ** 1100n)))).toBeUndefined();
    expect(tryToNumber(q(-3, 4))).toBe(-0.75);
  });
});

describe('fromNumber', () => {
  it('is exact', () => {
    expect(fromNumber(0.1)).toEqual(q(3602879701896397n, 36028797018963968n));
    expect(fromNumber(-0)).toEqual(ZERO);
    expect(fromNumber(0.5)).toEqual(q(1, 2));
    expect(fromNumber(-3)).toEqual(q(-3));
    expect(fromNumber(Number.MIN_VALUE)).toEqual(q(1n, 2n ** 1074n));
    expect(fromNumber(2 ** 60)).toEqual(q(2n ** 60n));
  });

  it('rejects NaN and infinities', () => {
    for (const x of [Number.NaN, Infinity, -Infinity]) {
      expect(() => fromNumber(x)).toThrow(RangeError);
    }
  });
});

describe('bitSize', () => {
  it('counts the bits of numerator and denominator', () => {
    expect(bitSize(ZERO)).toBe(1);
    expect(bitSize(ONE)).toBe(2);
    expect(bitSize(q(3, 4))).toBe(5);
    expect(bitSize(q(-255, 256))).toBe(17);
    expect(bitSize(q(2n ** 100n, 3n))).toBe(103);
    expect(bitSize(add(q(1000), q(1, 1000)))).toBe(30);
  });

  it('grows predictably under mul and add (budget bounds, property)', () => {
    const rng = createRng(28);
    for (let i = 0; i < 1000; i++) {
      const a = randomRational(rng, 10 ** 6, 10 ** 4);
      const b = randomRational(rng, 10 ** 6, 10 ** 4);
      expect(bitSize(mul(a, b))).toBeLessThanOrEqual(bitSize(a) + bitSize(b));
      // a/b + c/d = (ad + bc)/(bd): the numerator gains at most the larger denominator + 1.
      const denBits = Math.max(a.den.toString(2).length, b.den.toString(2).length);
      expect(bitSize(add(a, b))).toBeLessThanOrEqual(bitSize(a) + bitSize(b) + denBits + 1);
    }
  });
});

describe('sqrtExact', () => {
  it('returns the root of perfect squares and undefined otherwise', () => {
    expect(sqrtExact(q(4, 9))).toEqual(q(2, 3));
    expect(sqrtExact(ZERO)).toEqual(ZERO);
    expect(sqrtExact(ONE)).toEqual(ONE);
    expect(sqrtExact(q(10n ** 40n))).toEqual(q(10n ** 20n));
    expect(sqrtExact(q(2))).toBeUndefined();
    expect(sqrtExact(q(4, 3))).toBeUndefined();
    expect(sqrtExact(q(3, 4))).toBeUndefined();
    expect(sqrtExact(q(10n ** 40n + 1n))).toBeUndefined();
  });

  it('squares back (property)', () => {
    const rng = createRng(29);
    for (let i = 0; i < 500; i++) {
      const r = abs(randomRational(rng, 10 ** 9, 10 ** 6));
      expect(sqrtExact(mul(r, r))).toEqual(r);
    }
  });

  it('negative input is a caller bug', () => {
    expect(() => sqrtExact(q(-4))).toThrow(RangeError);
  });
});
