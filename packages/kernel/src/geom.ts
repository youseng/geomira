/**
 * Field-generic vector algebra for the tools (internal). Everything here is exact in exact
 * fields; the zero tests go through F.isZero / F.sign, so tolerances stay in num.
 */
import { assertNever } from '@geomira/num/assert';
import { isInexact, type Field, type FieldSign, type Inexact } from '@geomira/num/field';
import type { Dim, ToleranceContext } from '@geomira/num/tolerance';
import type { Vec } from './value';

export function vec<T>(x: T, y: T): Vec<T> {
  return { x, y };
}

export function vAdd<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): Vec<T> {
  return { x: F.add(a.x, b.x), y: F.add(a.y, b.y) };
}

export function vSub<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): Vec<T> {
  return { x: F.sub(a.x, b.x), y: F.sub(a.y, b.y) };
}

export function vScale<T>(F: Field<T>, a: Vec<T>, k: T): Vec<T> {
  return { x: F.mul(a.x, k), y: F.mul(a.y, k) };
}

export function vDot<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): T {
  return F.add(F.mul(a.x, b.x), F.mul(a.y, b.y));
}

/** a.x·b.y − a.y·b.x: twice the signed area of the triangle (0, a, b). */
export function vCross<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): T {
  return F.sub(F.mul(a.x, b.y), F.mul(a.y, b.x));
}

/** The counter-clockwise quarter turn (x, y) ↦ (−y, x). */
export function vRot90<T>(F: Field<T>, a: Vec<T>): Vec<T> {
  return { x: F.neg(a.y), y: a.x };
}

/** a + t·(b − a). */
export function vLerp<T>(F: Field<T>, a: Vec<T>, b: Vec<T>, t: T): Vec<T> {
  return vAdd(F, a, vScale(F, vSub(F, b, a), t));
}

export function two<T>(F: Field<T>): T {
  return F.add(F.one, F.one);
}

/** 1/2 (2 is invertible in every v1 field). */
export function half<T>(F: Field<T>): T {
  return F.div(F.one, two(F));
}

/**
 * Whether a displacement is a zero length: both components are zero lengths
 * (F.isZero, dimension length). The max-norm test needs no square root, so it is exact in
 * every field; in FloatField it is within a factor √2 of the Euclidean test.
 */
export function isZeroVec<T>(F: Field<T>, a: Vec<T>, ctx: ToleranceContext): boolean {
  return F.isZero(a.x, 'length', ctx) && F.isZero(a.y, 'length', ctx);
}

/**
 * |x| for a quantity of dimension `dim`. Degenerate cases: mod p (sign 'none') → Inexact
 * (no order); a zero or in-band sign → √(x²), which is |x| without a decision (and exact
 * in RationalField, where the sign is never in a band).
 */
export function abs<T>(F: Field<T>, x: T, dim: Dim, ctx: ToleranceContext): T | Inexact {
  const s = F.sign(x, dim, ctx);
  switch (s) {
    case 1:
      return x;
    case -1:
      return F.neg(x);
    case 0:
    case 'ambiguous':
      return F.sqrt(F.mul(x, x));
    case 'none':
      return { kind: 'inexact', reason: `absolute values need an order, which ${F.name} lacks` };
    default:
      return assertNever(s, 'field sign');
  }
}

/**
 * x / √n, the quantity x measured against a norm n > 0 (for example sin θ = cross / |u||v|
 * with n = |u|²|v|²). Undefined when √n is not representable or is zero: that happens only
 * in exact fields (RationalField, ModPField), whose zero and sign tests are exact and need
 * no normalisation, so callers then test x itself.
 */
function normalized<T>(F: Field<T>, x: T, n: T): T | undefined {
  const r = F.sqrt(n);
  if (isInexact(r) || F.eq(r, F.zero)) return undefined;
  return F.div(x, r);
}

/**
 * Zero test of x / √n as a quantity of dimension `dim` (exact test of x when √n is not
 * representable). Used for angles between directions, so short but valid segments are
 * never called parallel. Degenerate: n ≤ 0 is the caller's bug (n is a sum of squares).
 */
export function isZeroNormalized<T>(
  F: Field<T>,
  x: T,
  n: T,
  dim: Dim,
  ctx: ToleranceContext,
): boolean {
  return F.isZero(normalized(F, x, n) ?? x, dim, ctx);
}

/** Banded sign of x / √n (exact sign of x when √n is not representable). */
export function signNormalized<T>(
  F: Field<T>,
  x: T,
  n: T,
  dim: Dim,
  ctx: ToleranceContext,
): FieldSign {
  return F.sign(normalized(F, x, n) ?? x, dim, ctx);
}
