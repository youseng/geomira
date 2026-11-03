/** Internal BigInt helpers of @geomira/num (not part of the public surface). */

/** Number of bits of n ≥ 0 (0 → 0). Degenerate: negative n → RangeError. */
export function bitLength(n: bigint): number {
  if (n < 0n) throw new RangeError('bitLength of a negative number');
  if (n === 0n) return 0;
  // Hexadecimal: a quarter of the binary string's length; the first digit gives 1–4 bits.
  const h = n.toString(16);
  return (h.length - 1) * 4 + (32 - Math.clz32(parseInt(h.charAt(0), 16)));
}

/** |n|. */
export function absBig(n: bigint): bigint {
  return n < 0n ? -n : n;
}

/** Below this, Lehmer's steps gain nothing: Euclid's remainders on one or two machine words. */
const LEHMER_FROM = 1n << 64n;
/** The leading part's size below which Lehmer's shift is measured again. */
const LEHMER_REFIT = 1n << 40n;

/**
 * Greatest common divisor, always ≥ 0; gcd(0, 0) = 0. Large numbers by Lehmer's algorithm
 * (Knuth, TAOCP vol. 2, §4.5.2, Algorithm L; ADR-0056): the quotients of Euclid's steps are
 * found on the leading 63 bits while they agree for both bounds of the cosequence, then applied
 * to the full numbers in one step; when the first quotient already disagrees, one Euclid step.
 * The result equals Euclid's for every input; on numbers of tens of thousands of bits it is
 * ten to twenty times faster (every exact rational operation normalises through gcd).
 */
export function gcd(a: bigint, b: bigint): bigint {
  let [x, y] = [absBig(a), absBig(b)];
  if (x < y) [x, y] = [y, x];
  // The shift keeps xh within 63 bits; any larger shift is as correct, only slower, so it is
  // measured again (one pass over x) only when xh has fallen below 40 bits.
  let s = BigInt(Math.max(0, bitLength(x) - 63));
  while (y >= LEHMER_FROM) {
    if (x >> s < LEHMER_REFIT) s = BigInt(bitLength(x) - 63);
    let [xh, yh] = [x >> s, y >> s];
    let [A, B, C, D] = [1n, 0n, 0n, 1n];
    // xh + A, yh + C and xh + B, yh + D bound the leading parts of the two remainders.
    while (yh + C !== 0n && yh + D !== 0n) {
      const q = (xh + A) / (yh + C);
      if (q !== (xh + B) / (yh + D)) break;
      [A, C] = [C, A - q * C];
      [B, D] = [D, B - q * D];
      [xh, yh] = [yh, xh - q * yh];
    }
    [x, y] = B === 0n ? [y, x % y] : [A * x + B * y, C * x + D * y];
  }
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** ⌊√n⌋ for n ≥ 0 (Newton's method from above). Degenerate: negative n → RangeError. */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError('isqrt of a negative number');
  if (n < 2n) return n;
  let x = 1n << BigInt((bitLength(n) + 1) >> 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/** a mod m in [0, m), for m > 0. */
export function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r < 0n ? r + m : r;
}

/**
 * Inverse of a modulo m > 1 (extended Euclid). Degenerate: gcd(a, m) ≠ 1 (in particular
 * a ≡ 0) → RangeError.
 */
export function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [mod(a, m), m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  if (oldR !== 1n) throw new RangeError('division by zero (no inverse modulo m)');
  return mod(oldS, m);
}
