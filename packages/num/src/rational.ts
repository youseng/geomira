/**
 * Exact rationals as BigInt fractions (SPEC §3.3, §3.4). A Rational is always in normal
 * form: den > 0, gcd(|num|, den) = 1, and zero is 0/1. Values are immutable.
 */
import { absBig, bitLength, gcd, isqrt } from './bigint';

export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

/** Result of parseRational: the value, or a reason it is not a number literal. */
export type ParseResult =
  { readonly ok: true; readonly value: Rational } | { readonly ok: false; readonly reason: string };

export const ZERO: Rational = Object.freeze({ num: 0n, den: 1n });
export const ONE: Rational = Object.freeze({ num: 1n, den: 1n });

/** num/den in normal form. Degenerate: den = 0 → RangeError. */
export function rational(num: bigint, den = 1n): Rational {
  if (den === 0n) throw new RangeError('rational with zero denominator');
  if (num === 0n) return ZERO;
  const g = gcd(num, den);
  const s = den < 0n ? -g : g;
  return { num: num / s, den: den / s };
}

/** An integer as a rational. Degenerate: not a safe integer → RangeError. */
export function fromInteger(n: number): Rational {
  if (!Number.isSafeInteger(n)) throw new RangeError(`not a safe integer: ${String(n)}`);
  return rational(BigInt(n));
}

const DECIMAL = /^([+-]?)(\d+)(?:\.(\d+))?$/;
const FRACTION = /^([+-]?)(\d+)\/(\d+)$/;

/**
 * Parses an exact number literal: an integer (`2`, `-3`, `+5`), a decimal (`0.1`, `-2.125`)
 * or a fraction (`2/3`, `-3/4`). No whitespace, exponents, or signs in the denominator.
 * Degenerate cases: a zero denominator or any other text → { ok: false, reason }.
 */
export function parseRational(text: string): ParseResult {
  const dec = DECIMAL.exec(text);
  if (dec !== null) {
    const [, sign = '', whole = '', frac = ''] = dec;
    const num = BigInt(whole + frac) * (sign === '-' ? -1n : 1n);
    return { ok: true, value: rational(num, 10n ** BigInt(frac.length)) };
  }
  const fr = FRACTION.exec(text);
  if (fr !== null) {
    const [, sign = '', n = '', d = ''] = fr;
    const den = BigInt(d);
    if (den === 0n) return { ok: false, reason: `"${text}": the denominator is zero` };
    return { ok: true, value: rational(BigInt(n) * (sign === '-' ? -1n : 1n), den) };
  }
  return {
    ok: false,
    reason: `"${text}" is not an exact number (expected forms: 2, 0.1, 2/3, -3/4)`,
  };
}

/** Canonical text: `n` for integers, `n/d` otherwise; parseRational reads it back. */
export function formatRational(r: Rational): string {
  return r.den === 1n ? String(r.num) : `${String(r.num)}/${String(r.den)}`;
}

/**
 * a.num/a.den + sign·b.num/b.den in normal form, with the gcds taken on the small factors
 * (Knuth, TAOCP vol. 2, §4.5.1): d₁ = gcd(a.den, b.den), t = a.num·(b.den/d₁) ±
 * b.num·(a.den/d₁), d₂ = gcd(t, d₁); the sum is (t/d₂) / ((a.den/d₁)·(b.den/d₂)). The result
 * equals the normalised plain formula (normal forms are unique), only cheaper.
 */
function addSigned(a: Rational, b: Rational, minus: boolean): Rational {
  const d1 = gcd(a.den, b.den);
  const [ad, bd] = [a.den / d1, b.den / d1];
  const t = minus ? a.num * bd - b.num * ad : a.num * bd + b.num * ad;
  if (t === 0n) return ZERO;
  const d2 = d1 === 1n ? 1n : gcd(t, d1);
  return { num: t / d2, den: ad * (b.den / d2) };
}

export function add(a: Rational, b: Rational): Rational {
  return addSigned(a, b, false);
}

export function sub(a: Rational, b: Rational): Rational {
  return addSigned(a, b, true);
}

/**
 * The product in normal form with cross-cancellation (TAOCP §4.5.1): g₁ = gcd(a.num, b.den),
 * g₂ = gcd(b.num, a.den); (a.num/g₁)(b.num/g₂) / ((a.den/g₂)(b.den/g₁)) is already reduced.
 */
export function mul(a: Rational, b: Rational): Rational {
  if (a.num === 0n || b.num === 0n) return ZERO;
  const g1 = gcd(a.num, b.den);
  const g2 = gcd(b.num, a.den);
  return { num: (a.num / g1) * (b.num / g2), den: (a.den / g2) * (b.den / g1) };
}

/** a / b. Degenerate: b = 0 → RangeError. */
export function div(a: Rational, b: Rational): Rational {
  if (b.num === 0n) throw new RangeError('division by zero');
  const inv: Rational = b.num < 0n ? { num: -b.den, den: -b.num } : { num: b.den, den: b.num };
  return mul(a, inv);
}

export function neg(a: Rational): Rational {
  return a.num === 0n ? ZERO : { num: -a.num, den: a.den };
}

export function abs(a: Rational): Rational {
  return a.num < 0n ? { num: -a.num, den: a.den } : a;
}

export function sign(a: Rational): -1 | 0 | 1 {
  return a.num > 0n ? 1 : a.num < 0n ? -1 : 0;
}

export function isZero(a: Rational): boolean {
  return a.num === 0n;
}

export function isInteger(a: Rational): boolean {
  return a.den === 1n;
}

/** Exact equality (normal forms are unique). */
export function eq(a: Rational, b: Rational): boolean {
  return a.num === b.num && a.den === b.den;
}

/** −1, 0 or 1 as a <, =, > b. */
export function compare(a: Rational, b: Rational): -1 | 0 | 1 {
  const d = a.num * b.den - b.num * a.den;
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}

/** Bits of numerator and denominator: the size measure of the exact rung's budget. */
export function bitSize(a: Rational): number {
  return bitLength(absBig(a.num)) + bitLength(a.den);
}

/**
 * √a when a is the square of a rational, otherwise undefined. Since a is in normal form,
 * that happens iff num and den are both perfect squares. Degenerate: a < 0 → RangeError.
 */
export function sqrtExact(a: Rational): Rational | undefined {
  if (a.num < 0n) throw new RangeError('square root of a negative rational');
  const n = isqrt(a.num);
  const d = isqrt(a.den);
  return n * n === a.num && d * d === a.den ? { num: n, den: d } : undefined;
}

/** 2^e as a double, exactly, for e in [-1074, 1023]. */
function pow2(e: number): number {
  if (e < -1022) return pow2(e + 64) * pow2(-64);
  const view = new DataView(new ArrayBuffer(8));
  view.setUint32(0, (e + 1023) * 2 ** 20);
  return view.getFloat64(0);
}

/**
 * The double nearest to a (round half to even, with gradual underflow), or undefined when
 * |a| rounds to 2^1024 or more. A tiny negative a underflows to −0.
 */
export function tryToNumber(a: Rational): number | undefined {
  if (a.num === 0n) return 0;
  const negative = a.num < 0n;
  const n = absBig(a.num);
  const d = a.den;
  // t = ⌊log2(n/d)⌋
  let t = bitLength(n) - bitLength(d);
  if (t >= 0 ? n < d << BigInt(t) : n << BigInt(-t) < d) t -= 1;
  if (t > 1023) return undefined;
  // e = exponent of the ulp of the result; m = n / (d·2^e), rounded half to even.
  const e = Math.max(t - 52, -1074);
  const [num, den] = e >= 0 ? [n, d << BigInt(e)] : [n << BigInt(-e), d];
  let m = num / den;
  const twiceRem = (num % den) * 2n;
  if (twiceRem > den || (twiceRem === den && (m & 1n) === 1n)) m += 1n;
  if (e === 971 && m === 1n << 53n) return undefined;
  const x = Number(m) * pow2(e); // exact: m ≤ 2^53 and the product is representable
  return negative ? -x : x;
}

/**
 * The double nearest to a, so within half an ulp everywhere in the double range (see
 * tryToNumber). Degenerate: |a| rounds to 2^1024 or more → RangeError (never ±Infinity).
 */
export function toNumber(a: Rational): number {
  const x = tryToNumber(a);
  if (x === undefined) throw new RangeError('rational is beyond the double range');
  return x;
}

/** The exact value of a finite double. Degenerate: NaN or ±Infinity → RangeError. */
export function fromNumber(x: number): Rational {
  if (!Number.isFinite(x)) throw new RangeError(`not a finite number: ${String(x)}`);
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const biased = (hi >>> 20) & 0x7ff;
  const fraction = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  const mantissa = biased === 0 ? fraction : fraction | (1n << 52n);
  const exponent = (biased === 0 ? 1 : biased) - 1075;
  const signed = hi >>> 31 === 1 ? -mantissa : mantissa;
  return exponent >= 0
    ? rational(signed << BigInt(exponent))
    : rational(signed, 1n << BigInt(-exponent));
}
