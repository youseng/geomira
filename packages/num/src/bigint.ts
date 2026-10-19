/** Internal BigInt helpers of @geomira/num (not part of the public surface). */

/** Number of bits of n ≥ 0 (0 → 0). Degenerate: negative n → RangeError. */
export function bitLength(n: bigint): number {
  if (n < 0n) throw new RangeError('bitLength of a negative number');
  return n === 0n ? 0 : n.toString(2).length;
}

/** |n|. */
export function absBig(n: bigint): bigint {
  return n < 0n ? -n : n;
}

/** Greatest common divisor, always ≥ 0; gcd(0, 0) = 0. */
export function gcd(a: bigint, b: bigint): bigint {
  let x = absBig(a);
  let y = absBig(b);
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
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
