/**
 * Run 5 sped up rational arithmetic with Knuth's cross-cancellation (TAOCP §4.5.1). Normal
 * forms are unique, so the results must equal the plain formulas reduced by one gcd.
 */
import { describe, expect, it } from 'vitest';
import { add, div, mul, rational, sub, type Rational } from '../src/rational';
import { createRng, type Rng } from '../src/rng';

function draw(rng: Rng): Rational {
  const big = (bits: number) => {
    let x = 0n;
    for (let i = 0; i < bits; i += 16) x = (x << 16n) | BigInt(rng.nextInt(65536));
    return x;
  };
  const bits = 8 + rng.nextInt(200);
  const smooth =
    BigInt(2 ** rng.nextInt(20)) * 3n ** BigInt(rng.nextInt(30)) * 5n ** BigInt(rng.nextInt(8));
  const num =
    (rng.nextInt(2) === 0 ? -1n : 1n) *
    (rng.nextInt(5) === 0 ? 0n : big(bits) * BigInt(1 + rng.nextInt(6)));
  return rational(num, rng.nextInt(2) === 0 ? smooth : big(bits) + 1n);
}

describe('rational arithmetic equals the plain normalised formulas', () => {
  it('add, sub, mul, div on 5,000 random pairs (shared factors in the denominators)', () => {
    const rng = createRng(4510);
    for (let i = 0; i < 5000; i++) {
      const [a, b] = [draw(rng), draw(rng)];
      expect(add(a, b)).toEqual(rational(a.num * b.den + b.num * a.den, a.den * b.den));
      expect(sub(a, b)).toEqual(rational(a.num * b.den - b.num * a.den, a.den * b.den));
      expect(mul(a, b)).toEqual(rational(a.num * b.num, a.den * b.den));
      if (b.num !== 0n) expect(div(a, b)).toEqual(rational(a.num * b.den, a.den * b.num));
    }
  });

  it('results are in normal form (den > 0, reduced, zero is 0/1)', () => {
    expect(sub(rational(3n, 4n), rational(3n, 4n))).toEqual({ num: 0n, den: 1n });
    expect(mul(rational(0n), rational(-5n, 7n))).toEqual({ num: 0n, den: 1n });
    expect(div(rational(2n, 3n), rational(-4n, 9n))).toEqual({ num: -3n, den: 2n });
    expect(add(rational(1n, 6n), rational(1n, 10n))).toEqual({ num: 4n, den: 15n });
  });
});
