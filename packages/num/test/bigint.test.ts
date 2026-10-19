import { describe, expect, it } from 'vitest';
import { absBig, bitLength, gcd, isqrt, mod, modInverse } from '../src/bigint';
import { createRng, uniformBigInt } from '../src/rng';

describe('BigInt helpers', () => {
  it('bitLength', () => {
    expect(bitLength(0n)).toBe(0);
    expect(bitLength(1n)).toBe(1);
    expect(bitLength(255n)).toBe(8);
    expect(bitLength(256n)).toBe(9);
    expect(bitLength(2n ** 1000n)).toBe(1001);
    expect(() => bitLength(-1n)).toThrow(RangeError);
  });

  it('absBig and gcd', () => {
    expect(absBig(-5n)).toBe(5n);
    expect(absBig(5n)).toBe(5n);
    expect(gcd(12n, -18n)).toBe(6n);
    expect(gcd(0n, -7n)).toBe(7n);
    expect(gcd(0n, 0n)).toBe(0n);
  });

  it('isqrt is the floor square root (property)', () => {
    const rng = createRng(71);
    for (const n of [0n, 1n, 2n, 3n, 4n, 15n, 16n, 17n, 10n ** 40n, 10n ** 40n - 1n]) {
      const r = isqrt(n);
      expect(r * r <= n && (r + 1n) * (r + 1n) > n).toBe(true);
    }
    for (let i = 0; i < 1000; i++) {
      const n = uniformBigInt(rng, 2n ** BigInt(1 + rng.nextInt(300)));
      const r = isqrt(n);
      expect(r * r <= n && (r + 1n) * (r + 1n) > n).toBe(true);
    }
    expect(() => isqrt(-1n)).toThrow(RangeError);
  });

  it('mod and modInverse', () => {
    expect(mod(-7n, 5n)).toBe(3n);
    expect(mod(7n, 5n)).toBe(2n);
    expect(mod(-10n, 5n)).toBe(0n);
    const m = 2n ** 61n - 1n;
    const rng = createRng(72);
    for (let i = 0; i < 500; i++) {
      const a = uniformBigInt(rng, m - 1n) + 1n;
      expect(mod(a * modInverse(a, m), m)).toBe(1n);
      expect(mod(-a * modInverse(-a, m), m)).toBe(1n);
    }
    expect(() => modInverse(0n, m)).toThrow(RangeError);
    expect(() => modInverse(m, m)).toThrow(RangeError);
    expect(() => modInverse(6n, 9n)).toThrow(RangeError);
  });
});
