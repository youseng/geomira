/**
 * Complex numbers over any field (SPEC §10.1 uses them for directed angles:
 * Im(z₁ⁿ·conj(z₂)) = 0). All operations are exact in exact fields.
 */
import type { Field } from './field';

export interface Complex<T> {
  readonly re: T;
  readonly im: T;
}

export function complex<T>(re: T, im: T): Complex<T> {
  return { re, im };
}

export function cAdd<T>(F: Field<T>, a: Complex<T>, b: Complex<T>): Complex<T> {
  return { re: F.add(a.re, b.re), im: F.add(a.im, b.im) };
}

export function cSub<T>(F: Field<T>, a: Complex<T>, b: Complex<T>): Complex<T> {
  return { re: F.sub(a.re, b.re), im: F.sub(a.im, b.im) };
}

export function cNeg<T>(F: Field<T>, a: Complex<T>): Complex<T> {
  return { re: F.neg(a.re), im: F.neg(a.im) };
}

export function cConj<T>(F: Field<T>, a: Complex<T>): Complex<T> {
  return { re: a.re, im: F.neg(a.im) };
}

export function cMul<T>(F: Field<T>, a: Complex<T>, b: Complex<T>): Complex<T> {
  return {
    re: F.sub(F.mul(a.re, b.re), F.mul(a.im, b.im)),
    im: F.add(F.mul(a.re, b.im), F.mul(a.im, b.re)),
  };
}

/** k·a for a field element k. */
export function cScale<T>(F: Field<T>, a: Complex<T>, k: T): Complex<T> {
  return { re: F.mul(a.re, k), im: F.mul(a.im, k) };
}

/** |a|² = a·conj(a), an element of the field. */
export function cAbs2<T>(F: Field<T>, a: Complex<T>): T {
  return F.add(F.mul(a.re, a.re), F.mul(a.im, a.im));
}

/**
 * a / b = a·conj(b) / |b|². Degenerate: |b|² exactly zero → RangeError (from F.div);
 * callers test the divisor with F.isZero first. Mod p, |b|² can vanish for b ≠ 0
 * (when −1 is a square mod p); that is a zero divisor like any other.
 */
export function cDiv<T>(F: Field<T>, a: Complex<T>, b: Complex<T>): Complex<T> {
  const n = cAbs2(F, b);
  const t = cMul(F, a, cConj(F, b));
  return { re: F.div(t.re, n), im: F.div(t.im, n) };
}

/** zⁿ by repeated squaring. Degenerate: n not a non-negative integer → RangeError. */
export function cPow<T>(F: Field<T>, z: Complex<T>, n: number): Complex<T> {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`cPow exponent must be a non-negative integer, got ${String(n)}`);
  }
  let result: Complex<T> = { re: F.one, im: F.zero };
  let base = z;
  for (let k = n; k > 0; k = Math.floor(k / 2)) {
    if (k % 2 === 1) result = cMul(F, result, base);
    base = cMul(F, base, base);
  }
  return result;
}

/** Exact equality of both components (F.eq). */
export function cEq<T>(F: Field<T>, a: Complex<T>, b: Complex<T>): boolean {
  return F.eq(a.re, b.re) && F.eq(a.im, b.im);
}
