/**
 * Randomness (SPEC §3.2). The only file of the pure packages that produces random numbers.
 * Seeded generators are explicit objects (no global state); every random procedure takes
 * and reports a seed. Cryptographic randomness enters only through cryptoSource, which
 * wraps a getRandomValues function supplied by the host (used only by the mod-p rung).
 */
import { bitLength } from './bigint';

/** A seed: a safe integer in [0, 2^53). */
export type Seed = number;

/** The full internal state of a seeded generator: four uint32 words, not all zero. */
export type RngState = readonly [number, number, number, number];

/** A source of uniformly distributed 32-bit words. */
export interface EntropySource {
  nextUint32(): number;
}

/** A seeded, reproducible generator (xoshiro128**). */
export interface Rng extends EntropySource {
  /** The seed this stream was created from. */
  readonly seed: Seed;
  /** Uniform in [0, 1) with 53 random bits. */
  nextFloat(): number;
  /** Uniform integer in [0, n), unbiased, for an integer n in [1, 2^32]. */
  nextInt(n: number): number;
  /** Uniform in [lo, hi] (hi itself only through rounding); lo ≤ hi, both finite. */
  uniform(lo: number, hi: number): number;
  /** Standard normal deviate (Box–Muller); always finite. */
  gaussian(): number;
  /** A snapshot of the state; restoreRng(seed, state) resumes the stream exactly. */
  state(): RngState;
}

const TWO_32 = 2 ** 32;
const TWO_53 = 2 ** 53;

function checkSeed(seed: Seed): Seed {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new RangeError(`seed must be a safe integer ≥ 0, got ${String(seed)}`);
  }
  return seed;
}

/** murmur3's 32-bit finaliser: a bijection on uint32. */
function fmix32(h0: number): number {
  let h = h0 >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The k-th output of a splitmix32 stream started at x. */
function splitmix32(x: number, k: number): number {
  return fmix32((x + Math.imul(k, 0x9e3779b9)) >>> 0);
}

/**
 * State from a seed. s0 and s1 come from the low word, s2 and s3 from the high word, so
 * distinct seeds give distinct states (fmix32 is a bijection). s0 and s1 are fmix32 of two
 * distinct inputs, so at most one of them is zero: the all-zero state cannot occur.
 */
function seedState(seed: Seed): [number, number, number, number] {
  const lo = seed % TWO_32;
  const hi = Math.floor(seed / TWO_32);
  const h = (hi ^ 0x5bd1e995) >>> 0;
  return [splitmix32(lo, 1), splitmix32(lo, 2), splitmix32(h, 1), splitmix32(h, 2)];
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

class Xoshiro128 implements Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(
    readonly seed: Seed,
    s: RngState,
  ) {
    [this.s0, this.s1, this.s2, this.s3] = s;
  }

  nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  nextFloat(): number {
    const hi = this.nextUint32() >>> 5;
    const lo = this.nextUint32() >>> 6;
    return (hi * 2 ** 26 + lo) / TWO_53;
  }

  nextInt(n: number): number {
    if (!Number.isInteger(n) || n < 1 || n > TWO_32) {
      throw new RangeError(`nextInt bound must be an integer in [1, 2^32], got ${String(n)}`);
    }
    // Rejection sampling: accept only words below the largest multiple of n.
    const limit = TWO_32 - (TWO_32 % n);
    for (;;) {
      const w = this.nextUint32();
      if (w < limit) return w % n;
    }
  }

  uniform(lo: number, hi: number): number {
    const width = hi - lo;
    if (!Number.isFinite(lo) || !Number.isFinite(width) || width < 0) {
      throw new RangeError(`uniform needs finite lo ≤ hi, got ${String(lo)}, ${String(hi)}`);
    }
    return lo + width * this.nextFloat();
  }

  gaussian(): number {
    const u1 = 1 - this.nextFloat(); // in (0, 1], so the logarithm is finite
    const u2 = this.nextFloat();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  state(): RngState {
    return [this.s0, this.s1, this.s2, this.s3];
  }
}

/** A generator seeded with `seed`. Degenerate: an invalid seed → RangeError. */
export function createRng(seed: Seed): Rng {
  const valid = checkSeed(seed);
  return new Xoshiro128(valid, seedState(valid));
}

/**
 * Resumes a stream from a snapshot taken with rng.state(). Degenerate cases: an invalid
 * seed, a word outside uint32, or the all-zero state (a fixed point of xoshiro) → RangeError.
 */
export function restoreRng(seed: Seed, state: RngState): Rng {
  checkSeed(seed);
  if (!state.every((w) => Number.isInteger(w) && w >= 0 && w < TWO_32)) {
    throw new RangeError('rng state words must be uint32');
  }
  if (state.every((w) => w === 0)) throw new RangeError('rng state must not be all zero');
  return new Xoshiro128(seed, state);
}

/**
 * The seed of sub-stream `stream` of `seed` (for example one stream per sample), so
 * that any sample can be reproduced alone. Deterministic; the result is a valid seed.
 * Degenerate: an invalid seed or stream index → RangeError.
 */
export function deriveSeed(seed: Seed, stream: number): Seed {
  checkSeed(seed);
  checkSeed(stream);
  const sLo = seed % TWO_32;
  const sHi = Math.floor(seed / TWO_32);
  const kLo = stream % TWO_32;
  const kHi = Math.floor(stream / TWO_32);
  const a = fmix32(splitmix32(sLo, 3) ^ fmix32(kLo ^ 0x27d4eb2f) ^ sHi);
  const b = fmix32(splitmix32(sHi ^ kHi, 4) ^ fmix32(a ^ kLo));
  return (b & 0x1fffff) * TWO_32 + a;
}

/**
 * Wraps a cryptographic getRandomValues (for example `crypto.getRandomValues` bound to
 * `crypto`, supplied by the host, since pure packages read no globals). Words are drawn
 * in batches into a buffer owned by the returned object.
 */
export function cryptoSource(getRandomValues: (buffer: Uint32Array) => unknown): EntropySource {
  const buffer = new Uint32Array(64);
  // Words are read back little-endian; on a big-endian host they come out byte-swapped,
  // which is still uniformly distributed.
  const view = new DataView(buffer.buffer);
  let next = buffer.length;
  return {
    nextUint32(): number {
      if (next === buffer.length) {
        getRandomValues(buffer);
        next = 0;
      }
      return view.getUint32(4 * next++, true);
    },
  };
}

/**
 * Uniform integer in [0, n) from any entropy source (rejection sampling on the bit length
 * of n − 1, so no modulo bias). n = 1 → 0 without drawing. Degenerate: n ≤ 0 → RangeError.
 */
export function uniformBigInt(src: EntropySource, n: bigint): bigint {
  if (n <= 0n) throw new RangeError(`uniformBigInt bound must be ≥ 1, got ${String(n)}`);
  // n = 1: zero bits, zero words, and the loop returns 0 without drawing.
  const bits = bitLength(n - 1n);
  const words = Math.ceil(bits / 32);
  const mask = (1n << BigInt(bits)) - 1n;
  for (;;) {
    let x = 0n;
    for (let i = 0; i < words; i++) x = (x << 32n) | BigInt(src.nextUint32());
    x &= mask;
    if (x < n) return x;
  }
}
