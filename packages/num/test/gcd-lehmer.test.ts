/**
 * ADR-0056: gcd of large BigInts by Lehmer's algorithm (Knuth, TAOCP vol. 2, §4.5.2, Algorithm
 * L). Every exact rational operation normalises through gcd, and Euclid's remainder steps on
 * numbers of tens of thousands of bits made one exact `foci` call take 40 s (the extreme-value
 * hunt of the kernel, kernel/test/hunt-extreme.test.ts, and every mutant covered by it).
 * The result must equal Euclid's on every input; on large numbers it must be much faster.
 */
import { describe, expect, it } from 'vitest';
import { gcd } from '../src/bigint';
import { createRng, uniformBigInt, type Rng } from '../src/rng';

/** The reference: Euclid's algorithm, as gcd was before ADR-0056. */
function euclid(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function bits(rng: Rng, n: number): bigint {
  return n <= 0 ? 0n : uniformBigInt(rng, 1n << BigInt(n));
}

describe('gcd (ADR-0056)', () => {
  it('equals Euclid on random pairs with common factors, around the 64-bit switch', () => {
    const rng = createRng(20261031);
    for (let i = 0; i < 1500; i++) {
      const g = bits(rng, 1 + Math.floor(rng.uniform(0, 300))) + 1n;
      const a = bits(rng, Math.floor(rng.uniform(0, 1200))) * g;
      const b = bits(rng, Math.floor(rng.uniform(0, 1200))) * g;
      const sa = rng.uniform(0, 1) < 0.5 ? -a : a;
      expect(gcd(sa, b), `${String(sa)}, ${String(b)}`).toBe(euclid(a, b));
      expect(gcd(b, sa)).toBe(euclid(a, b));
    }
    for (let k = 56; k <= 72; k++) {
      const x = (1n << BigInt(k)) - 1n;
      for (const y of [x, x - 1n, 1n << BigInt(k - 1), 3n, 0n, (x * 2n) / 3n])
        expect(gcd(x * 6n, y * 6n)).toBe(euclid(x * 6n, y * 6n));
    }
  });

  it('equals Euclid on the inputs that stress the single-precision quotients', () => {
    // Consecutive Fibonacci numbers (every quotient 1), a huge quotient (the B = 0 step), equal
    // numbers, powers of two, one zero.
    const fib: bigint[] = [1n, 1n];
    for (let i = 2; i < 400; i++) fib.push((fib[i - 1] ?? 0n) + (fib[i - 2] ?? 0n));
    const [f398, f399] = [fib[398] ?? 0n, fib[399] ?? 0n];
    const big = (1n << 500n) + 12345n;
    const cases: [bigint, bigint][] = [
      [f399, f398],
      [f399 * 7n, f398 * 7n],
      [big * (1n << 300n), big],
      [big, big],
      [1n << 700n, 1n << 650n],
      [big, 0n],
      [0n, -big],
      [-big, -(big * 3n)],
    ];
    for (const [a, b] of cases) expect(gcd(a, b)).toBe(euclid(a, b));
    expect(gcd(f399, f398)).toBe(1n);
  });

  it('is much faster than Euclid on numbers of 50,000 bits', () => {
    const rng = createRng(7);
    const [a, b] = [bits(rng, 50_000), bits(rng, 50_000)];
    const time = (f: (x: bigint, y: bigint) => bigint): number => {
      const t0 = performance.now();
      f(a, b);
      return performance.now() - t0;
    };
    const median = (f: (x: bigint, y: bigint) => bigint): number =>
      [time(f), time(f), time(f)].sort((x, y) => x - y)[1] ?? Number.POSITIVE_INFINITY;
    expect(gcd(a, b)).toBe(euclid(a, b));
    // Lehmer is about 15 times faster at this size. Mutation testing instruments the source's gcd
    // and not this file's Euclid (Stryker's dry run measured 2.65 times at 30,000 bits), so the
    // bound is 2: Euclid's quadratic steps cannot reach it, and the instrumented Lehmer keeps it.
    expect(median(gcd) * 2).toBeLessThan(median(euclid));
  });
});
