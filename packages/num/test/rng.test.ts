import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createRng,
  cryptoSource,
  deriveSeed,
  restoreRng,
  uniformBigInt,
  type EntropySource,
  type Rng,
} from '../src/rng';

function take(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => rng.nextUint32());
}

/** Pearson chi-square statistic of observed bucket counts against a uniform expectation. */
function chiSquare(counts: readonly number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  const expected = total / counts.length;
  return counts.reduce((acc, c) => acc + (c - expected) ** 2 / expected, 0);
}

describe('seeded streams', () => {
  it('the same seed gives the same stream; different seeds differ', () => {
    expect(take(createRng(42), 1000)).toEqual(take(createRng(42), 1000));
    expect(take(createRng(42), 8)).not.toEqual(take(createRng(43), 8));
    expect(take(createRng(0), 8)).not.toEqual(take(createRng(2 ** 32), 8));
    expect(take(createRng(2 ** 53 - 1), 8)).not.toEqual(take(createRng(2 ** 32 - 1), 8));
  });

  it('reports its seed', () => {
    expect(createRng(7).seed).toBe(7);
    expect(restoreRng(9, [1, 2, 3, 4]).seed).toBe(9);
  });

  it('is xoshiro128** (hand-checked outputs from state [1, 2, 3, 4])', () => {
    const rng = restoreRng(0, [1, 2, 3, 4]);
    expect(take(rng, 3)).toEqual([11520, 0, 5927040]);
  });

  it('pinned: seeded streams reproduce across versions (a verdict is reproducible from its seed)', () => {
    expect(take(createRng(0), 4)).toEqual([3809008728, 353775016, 3440610153, 3617757269]);
    expect(take(createRng(2 ** 40 + 5), 4)).toEqual([
      3616982058, 3980102107, 4263376390, 3111432149,
    ]);
    const f = createRng(1);
    expect([f.nextFloat(), f.nextFloat(), f.nextFloat()]).toEqual([
      0.5686059900207275, 0.3307063415546303, 0.6463985387609995,
    ]);
    const g = createRng(1);
    expect(g.gaussian()).toBeCloseTo(-0.6297335712907329, 14);
    expect(g.gaussian()).toBeCloseTo(-0.6325839338303727, 14);
    expect([deriveSeed(0, 0), deriveSeed(7, 3), deriveSeed(2 ** 40 + 1, 2 ** 35 + 9)]).toEqual([
      7895999808702472, 1098765773680439, 6619688728686768,
    ]);
    const r = createRng(9);
    expect([
      uniformBigInt(r, 2n ** 61n - 1n),
      uniformBigInt(r, 1000n),
      uniformBigInt(r, 2n ** 64n),
    ]).toEqual([957068480754355016n, 595n, 6656436246085477073n]);
  });

  it('state() and restoreRng() resume a stream exactly', () => {
    const rng = createRng(123);
    take(rng, 37);
    rng.nextFloat();
    rng.gaussian();
    const snapshot = rng.state();
    const rest = take(rng, 100);
    expect(take(restoreRng(123, snapshot), 100)).toEqual(rest);
  });

  it('state() is a copy: advancing the generator does not change a snapshot', () => {
    const rng = createRng(1);
    const snapshot = rng.state();
    const copy = [...snapshot];
    take(rng, 10);
    expect([...snapshot]).toEqual(copy);
  });

  it('generators are independent objects (no shared global state)', () => {
    const a = createRng(5);
    const b = createRng(6);
    const interleaved: number[][] = [[], []];
    for (let i = 0; i < 50; i++) {
      interleaved[0]?.push(a.nextUint32());
      interleaved[1]?.push(b.nextUint32());
    }
    expect(interleaved[0]).toEqual(take(createRng(5), 50));
    expect(interleaved[1]).toEqual(take(createRng(6), 50));
  });

  it('rejects invalid seeds and states', () => {
    for (const seed of [-1, 1.5, Number.NaN, Infinity, 2 ** 53]) {
      expect(() => createRng(seed)).toThrow(RangeError);
    }
    expect(() => restoreRng(0, [0, 0, 0, 0])).toThrow(RangeError);
    expect(take(restoreRng(0, [0, 0, 0, 1]), 2)).toHaveLength(2);
    expect(take(restoreRng(0, [0, 2 ** 32 - 1, 0, 0]), 2)).toHaveLength(2);
    expect(() => restoreRng(0, [1, 2, 3, 2 ** 32])).toThrow(RangeError);
    expect(() => restoreRng(0, [1, 2, -3, 4])).toThrow(RangeError);
    expect(() => restoreRng(0, [1, 2.5, 3, 4])).toThrow(RangeError);
    expect(() => restoreRng(-1, [1, 2, 3, 4])).toThrow(RangeError);
  });
});

describe('deriveSeed', () => {
  it('is deterministic and gives distinct valid seeds for distinct streams', () => {
    const seen = new Set<number>();
    for (let stream = 0; stream < 2000; stream++) {
      const s = deriveSeed(99, stream);
      expect(s).toBe(deriveSeed(99, stream));
      expect(Number.isSafeInteger(s) && s >= 0).toBe(true);
      seen.add(s);
    }
    expect(seen.size).toBe(2000);
    expect(deriveSeed(1, 0)).not.toBe(deriveSeed(2, 0));
    expect(() => createRng(deriveSeed(2 ** 53 - 1, 2 ** 53 - 1))).not.toThrow();
  });

  it('rejects invalid input', () => {
    expect(() => deriveSeed(-1, 0)).toThrow(RangeError);
    expect(() => deriveSeed(0, 0.5)).toThrow(RangeError);
  });
});

describe('distribution sanity (fixed seeds, so deterministic)', () => {
  it('nextFloat is in [0, 1) with mean ≈ 1/2 and passes a 16-bucket chi-square', () => {
    const rng = createRng(2024);
    const counts = new Array<number>(16).fill(0);
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const u = rng.nextFloat();
      expect(u >= 0 && u < 1).toBe(true);
      sum += u;
      const k = Math.floor(u * 16);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.005);
    expect(chiSquare(counts)).toBeLessThan(37.7); // df 15, p = 0.001
  });

  it('nextFloat uses 53 bits (low bits vary)', () => {
    const rng = createRng(8);
    const lowBits = new Set<number>();
    for (let i = 0; i < 64; i++) lowBits.add((rng.nextFloat() * 2 ** 53) % 2);
    expect(lowBits).toEqual(new Set([0, 1]));
  });

  it('nextUint32 bits are balanced', () => {
    const rng = createRng(77);
    const ones = new Array<number>(32).fill(0);
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const w = rng.nextUint32();
      expect(Number.isInteger(w) && w >= 0 && w < 2 ** 32).toBe(true);
      for (let b = 0; b < 32; b++) if ((w >>> b) & 1) ones[b] = (ones[b] ?? 0) + 1;
    }
    for (const c of ones) expect(Math.abs(c / n - 0.5)).toBeLessThan(0.02);
  });

  it('nextInt(n) is uniform on [0, n) and validates n', () => {
    const rng = createRng(31);
    const counts = new Array<number>(7).fill(0);
    for (let i = 0; i < 70_000; i++) {
      const k = rng.nextInt(7);
      expect(Number.isInteger(k) && k >= 0 && k < 7).toBe(true);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(chiSquare(counts)).toBeLessThan(22.5); // df 6, p = 0.001
    expect(rng.nextInt(1)).toBe(0);
    const big = rng.nextInt(2 ** 32);
    expect(big >= 0 && big < 2 ** 32).toBe(true);
    for (const n of [0, -3, 1.5, 2 ** 32 + 1, Number.NaN]) {
      expect(() => rng.nextInt(n)).toThrow(RangeError);
    }
  });

  it('nextInt rejection sampling stays unbiased for n just above 2^31', () => {
    const rng = createRng(4);
    const n = 2 ** 31 + 1;
    let low = 0;
    const m = 20_000;
    for (let i = 0; i < m; i++) if (rng.nextInt(n) < n / 2) low++;
    expect(Math.abs(low / m - 0.5)).toBeLessThan(0.02);
  });

  it('nextInt rejects the words that would bias n = 3·2^30 (plain modulo gives 1/2 below 2^30)', () => {
    const rng = createRng(6);
    const n = 3 * 2 ** 30;
    let low = 0;
    const m = 30_000;
    for (let i = 0; i < m; i++) if (rng.nextInt(n) < 2 ** 30) low++;
    expect(Math.abs(low / m - 1 / 3)).toBeLessThan(0.02);
  });

  it('uniform(lo, hi) stays in range and validates its bounds', () => {
    const rng = createRng(12);
    for (let i = 0; i < 10_000; i++) {
      const x = rng.uniform(-3, 5);
      expect(x >= -3 && x <= 5).toBe(true);
    }
    expect(rng.uniform(2, 2)).toBe(2);
    for (const [lo, hi] of [
      [1, 0],
      [Number.NaN, 1],
      [0, Infinity],
      [-Number.MAX_VALUE, Number.MAX_VALUE],
    ] as const) {
      expect(() => rng.uniform(lo, hi)).toThrow(RangeError);
    }
  });

  it('gaussian() is finite with mean ≈ 0, variance ≈ 1 and the 68–95 rule', () => {
    const rng = createRng(1001);
    const n = 50_000;
    let sum = 0;
    let sumSq = 0;
    let within1 = 0;
    let within2 = 0;
    for (let i = 0; i < n; i++) {
      const g = rng.gaussian();
      expect(Number.isFinite(g)).toBe(true);
      sum += g;
      sumSq += g * g;
      if (Math.abs(g) < 1) within1++;
      if (Math.abs(g) < 2) within2++;
    }
    const mean = sum / n;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(sumSq / n - mean * mean - 1)).toBeLessThan(0.03);
    expect(Math.abs(within1 / n - 0.6827)).toBeLessThan(0.01);
    expect(Math.abs(within2 / n - 0.9545)).toBeLessThan(0.006);
  });
});

describe('uniformBigInt', () => {
  const P = 2n ** 61n - 1n;

  it('draws in [0, n) uniformly', () => {
    const rng = createRng(17);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) {
      const k = uniformBigInt(rng, 3n);
      expect(k >= 0n && k < 3n).toBe(true);
      counts[Number(k)] = (counts[Number(k)] ?? 0) + 1;
    }
    expect(chiSquare(counts)).toBeLessThan(13.8); // df 2, p = 0.001
    for (let i = 0; i < 2000; i++) {
      const x = uniformBigInt(rng, P);
      expect(x >= 0n && x < P).toBe(true);
    }
    const huge = 2n ** 200n + 12345n;
    const big = uniformBigInt(rng, huge);
    expect(big >= 0n && big < huge).toBe(true);
  });

  it('draws the high bits too (values above 2^60 occur for n = 2^61 − 1)', () => {
    const rng = createRng(18);
    let high = 0;
    for (let i = 0; i < 1000; i++) if (uniformBigInt(rng, P) >= 2n ** 60n) high++;
    expect(high).toBeGreaterThan(400);
    expect(high).toBeLessThan(600);
  });

  it('n = 1 gives 0 without consuming entropy; n ≤ 0 is rejected', () => {
    const rng = createRng(19);
    const before = rng.state();
    expect(uniformBigInt(rng, 1n)).toBe(0n);
    expect(rng.state()).toEqual(before);
    expect(() => uniformBigInt(rng, 0n)).toThrow(RangeError);
    expect(() => uniformBigInt(rng, -5n)).toThrow(RangeError);
  });
});

describe('cryptoSource', () => {
  it('returns the words of the wrapped getRandomValues, in order, refilling as needed', () => {
    let next = 0;
    let calls = 0;
    const fake = (buffer: Uint32Array): Uint32Array => {
      calls++;
      for (let i = 0; i < buffer.length; i++) buffer[i] = next++;
      return buffer;
    };
    const src: EntropySource = cryptoSource(fake);
    const words = Array.from({ length: 200 }, () => src.nextUint32());
    expect(words).toEqual(Array.from({ length: 200 }, (_, i) => i));
    expect(calls).toBeGreaterThan(1);
  });

  it('works with the platform getRandomValues and feeds uniformBigInt', () => {
    const src = cryptoSource((buffer) => webcrypto.getRandomValues(buffer));
    const P = 2n ** 61n - 1n;
    const draws = Array.from({ length: 64 }, () => uniformBigInt(src, P));
    for (const x of draws) expect(x >= 0n && x < P).toBe(true);
    expect(new Set(draws).size).toBe(64);
  });

  it('a seeded Rng is also an EntropySource (for reproducible tests of exact rungs)', () => {
    const a: EntropySource = createRng(3);
    expect(uniformBigInt(a, 1000n)).toBe(uniformBigInt(createRng(3), 1000n));
  });
});
