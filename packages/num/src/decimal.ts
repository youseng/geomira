/**
 * Exact decimals (moved from packages/editor's rounding.ts in Run 9b so that packages/claims
 * can write short decimals too): powers of ten, the decimal exponent of a rational, rounding
 * to a multiple of 10^e and the decimal text of such a multiple. Everything is exact on
 * rationals (a float log10 can be off by one at a power of ten).
 */
import { compare, div, mul, rational, tryToNumber, type Rational } from './rational';

/** Exponents are kept in this range (zoom and scale are clamped far inside it). */
const MAX_EXPONENT = 400;

/** 10^e as an exact rational. */
export function pow10(e: number): Rational {
  const p = 10n ** BigInt(Math.abs(e));
  return e >= 0 ? rational(p) : rational(1n, p);
}

/**
 * The largest e with 10^e ≤ x, for a finite rational x > 0 (exact; the float estimate is
 * corrected by exact comparisons). Degenerate: x ≤ 0 or beyond ±10^MAX_EXPONENT → clamped.
 */
export function floorLog10(x: Rational): number {
  if (x.num <= 0n) return -MAX_EXPONENT;
  const approx = Math.log10(Math.max(Number.MIN_VALUE, tryToNumber(x) ?? Number.MAX_VALUE));
  let e = Math.max(-MAX_EXPONENT, Math.min(MAX_EXPONENT, Math.floor(approx)));
  while (e > -MAX_EXPONENT && compare(pow10(e), x) > 0) e -= 1;
  while (e < MAX_EXPONENT && compare(pow10(e + 1), x) <= 0) e += 1;
  return e;
}

/**
 * The decimal text of a multiple of 10^e ("0.15", "-3", "1200"): what the text format
 * prints for a rounded coordinate (LitExpr.text, ADR-0009 decision 12). x must be a
 * multiple of 10^e (a result of roundTo).
 */
export function decimalText(x: Rational, e: number): string {
  if (e >= 0) return (x.num / x.den).toString();
  const n = (x.num * 10n ** BigInt(-e)) / x.den;
  const sign = n < 0n ? '-' : '';
  const digits = (n < 0n ? -n : n).toString().padStart(1 - e, '0');
  const int = digits.slice(0, digits.length + e);
  const frac = digits.slice(digits.length + e).replace(/0+$/u, '');
  return `${sign}${int}${frac === '' ? '' : `.${frac}`}`;
}

/** x rounded to the nearest multiple of 10^e (ties away from zero), exactly. */
export function roundTo(x: Rational, e: number): Rational {
  const q = div(x, pow10(e));
  const twice = 2n * q.num;
  const den = 2n * q.den;
  // round(q) = floor(q + 1/2) for q ≥ 0, −floor(−q + 1/2) for q < 0 (ties away from zero).
  const n = q.num >= 0n ? (twice + q.den) / den : -((-twice + q.den) / den);
  return mul(rational(n), pow10(e));
}
