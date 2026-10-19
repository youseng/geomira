import { describe, expect, it } from 'vitest';
import { isInexact } from '../src/field';
import { ModPField as F, P } from '../src/modp';
import { fromInteger, rational } from '../src/rational';
import { createRng, uniformBigInt } from '../src/rng';
import { toleranceContext } from '../src/tolerance';

const ctx = toleranceContext(1);

function value(x: bigint | { kind: 'inexact'; reason: string }): bigint {
  if (typeof x !== 'bigint') throw new Error(x.reason);
  return x;
}

describe('ModPField', () => {
  it('works modulo the Mersenne prime 2^61 − 1', () => {
    expect(P).toBe(2305843009213693951n);
    expect(F.kind).toBe('modp');
    expect(F.add(P - 1n, 1n)).toBe(0n);
    expect(F.sub(0n, 1n)).toBe(P - 1n);
    expect(F.neg(0n)).toBe(0n);
    expect(F.neg(1n)).toBe(P - 1n);
    expect(F.mul(P - 1n, P - 1n)).toBe(1n);
  });

  it('elements stay canonical (in [0, p)) under every operation (property)', () => {
    const rng = createRng(61);
    for (let i = 0; i < 1000; i++) {
      const a = uniformBigInt(rng, P);
      const b = uniformBigInt(rng, P - 1n) + 1n;
      for (const r of [F.add(a, b), F.sub(a, b), F.mul(a, b), F.div(a, b), F.neg(a)]) {
        expect(r >= 0n && r < P).toBe(true);
      }
    }
  });

  it('is exact: polynomial identities hold exactly (property)', () => {
    const rng = createRng(62);
    for (let i = 0; i < 500; i++) {
      const a = uniformBigInt(rng, P);
      const b = uniformBigInt(rng, P);
      const lhs = F.mul(F.add(a, b), F.add(a, b));
      const rhs = F.add(F.add(F.mul(a, a), F.mul(2n, F.mul(a, b))), F.mul(b, b));
      expect(lhs).toBe(rhs);
    }
  });

  it('inverts every non-zero element (Fermat check a^(p−1) = 1 on samples)', () => {
    const rng = createRng(63);
    for (let i = 0; i < 50; i++) {
      const a = uniformBigInt(rng, P - 1n) + 1n;
      expect(F.mul(a, F.div(1n, a))).toBe(1n);
      let acc = 1n;
      let base = a;
      let e = P - 1n;
      while (e > 0n) {
        if (e & 1n) acc = F.mul(acc, base);
        base = F.mul(base, base);
        e >>= 1n;
      }
      expect(acc).toBe(1n);
    }
    expect(() => F.div(1n, 0n)).toThrow(RangeError);
  });

  it('has no order: sign is "none"; zero is exact', () => {
    expect(F.sign(5n, 'length', ctx)).toBe('none');
    expect(F.sign(0n, 'area', ctx)).toBe('none');
    expect(F.isZero(0n, 'length', ctx)).toBe(true);
    expect(F.isZero(1n, 'length', ctx)).toBe(false);
  });

  it('sqrt and trig are always Inexact, with reasons', () => {
    for (const r of [F.sqrt(4n), F.sqrt(0n), F.sin(0n), F.cos(0n), F.atan2(0n, 1n)]) {
      expect(isInexact(r)).toBe(true);
      if (isInexact(r)) expect(r.reason).toMatch(/mod p/);
    }
  });

  it('maps rationals, and reports denominators divisible by p', () => {
    expect(value(F.fromRational(fromInteger(-1)))).toBe(P - 1n);
    expect(F.mul(value(F.fromRational(rational(1n, 2n))), 2n)).toBe(1n);
    expect(value(F.fromRational(rational(P + 5n)))).toBe(5n);
    expect(isInexact(F.fromRational(rational(1n, P)))).toBe(true);
    expect(isInexact(F.fromRational(rational(1n, 3n * P)))).toBe(true);
  });

  it('toNumber gives the symmetric representative (diagnostics only)', () => {
    expect(F.toNumber(P - 3n)).toBe(-3);
    expect(F.toNumber(7n)).toBe(7);
    expect(F.toNumber((P - 1n) / 2n)).toBe(Number((P - 1n) / 2n));
    expect(F.toNumber((P + 1n) / 2n)).toBe(-Number((P - 1n) / 2n));
  });
});
