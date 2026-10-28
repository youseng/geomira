/**
 * The decisions of a projective map (ADR-0040 decision 9), shared by its per-kind images: on
 * which side of ℓ (the line the map sends to infinity) a position lies, and whether a direction
 * is parallel to ℓ. W(x, y) = m₃₁x + m₃₂y + m₃₃ is |(m₃₁, m₃₂)| times the signed distance to ℓ,
 * so the side is decided as a LENGTH with the band (a position within EPS of ℓ is on it, inside
 * the band ambiguous); a direction's W is decided as a SINE. An affine map (m₃₁ = m₃₂ = 0
 * exactly) has no ℓ: W = m₃₃ ≠ 0 everywhere. Mod p there is no order: only "exactly on ℓ" is
 * decidable.
 */
import { assertNever } from '@geomira/num/assert';
import { inexact, type Field, type FieldSign, type Inexact } from '@geomira/num/field';
import { signNormalized } from '../geom';
import type { EvalContext } from '../tool';
import { undef, type Undefined, type Vec } from '../value';
import { wRow, type Mat3 } from './projective';

/** The reason for a decision within the band of ℓ. */
export const NEAR_INFINITY = 'ambiguous: within the band of the line sent to infinity';

/** A side of ℓ: 1, −1, 0 (on ℓ), or the reason it cannot be decided. */
export type WSide = 1 | -1 | 0 | Undefined | Inexact;

/** Inexact: a decision of the map needs an order (mod p). */
export function noOrderProj<T>(F: Field<T>, what: string): Inexact {
  return inexact(`apply: ${what} through a projective map needs an order, which ${F.name} lacks`);
}

/** Whether the map is affine (m₃₁ = m₃₂ = 0 exactly): it sends no line to infinity. */
export function isAffine<T>(F: Field<T>, m: Mat3<T>): boolean {
  const [a, b] = wRow(m);
  return F.eq(a, F.zero) && F.eq(b, F.zero);
}

/** W of a position (finite) or of a direction (the linear part only). */
export function wOf<T>(F: Field<T>, m: Mat3<T>, v: Vec<T>, finite: boolean): T {
  const [a, b, c] = wRow(m);
  const lin = F.add(F.mul(a, v.x), F.mul(b, v.y));
  return finite ? F.add(lin, c) : lin;
}

function sideOfSign<T>(F: Field<T>, s: FieldSign, what: string): WSide {
  switch (s) {
    case 1:
    case -1:
    case 0:
      return s;
    case 'ambiguous':
      return undef(NEAR_INFINITY);
    case 'none':
      return noOrderProj(F, what);
    default:
      return assertNever(s, 'field sign');
  }
}

/**
 * The side of ℓ a position lies on. Affine maps: the sign of m₃₃ (exactly non-zero; mod p
 * Inexact). Degenerate: within the band of ℓ → Undefined (ambiguous); mod p → Inexact.
 */
export function positionSide<T>(F: Field<T>, m: Mat3<T>, x: Vec<T>, ctx: EvalContext): WSide {
  const [a, b, c] = wRow(m);
  if (isAffine(F, m)) {
    if (F.kind === 'modp') return noOrderProj(F, 'a side');
    return F.toNumber(c) > 0 ? 1 : -1;
  }
  const n = F.add(F.mul(a, a), F.mul(b, b));
  return sideOfSign(F, signNormalized(F, wOf(F, m, x, true), n, 'length', ctx), 'a side');
}

/**
 * Whether a position is on ℓ: 'on' (within EPS, or exactly 0 mod p), 'off', or Undefined in the
 * band. Decidable in every field (mod p: the exact zero test).
 */
export function onInfinityLine<T>(
  F: Field<T>,
  m: Mat3<T>,
  x: Vec<T>,
  ctx: EvalContext,
): 'on' | 'off' | Undefined {
  if (isAffine(F, m)) return 'off';
  if (F.kind === 'modp') return F.isZero(wOf(F, m, x, true), 'length', ctx) ? 'on' : 'off';
  const s = positionSide(F, m, x, ctx);
  if (s === 0) return 'on';
  return typeof s === 'number' ? 'off' : undef(NEAR_INFINITY);
}

/**
 * Whether a direction d is parallel to ℓ (W(d) = 0 as a sine): 'parallel', or the sign of W(d),
 * or Undefined in the band. Affine maps: always parallel. Mod p: 'parallel' iff W(d) = 0
 * exactly, otherwise 'none' (its sign is not decidable).
 */
export function directionSide<T>(
  F: Field<T>,
  m: Mat3<T>,
  d: Vec<T>,
  ctx: EvalContext,
): 'parallel' | 1 | -1 | 'none' | Undefined {
  if (isAffine(F, m)) return 'parallel';
  const w = wOf(F, m, d, false);
  if (F.kind === 'modp') return F.isZero(w, 'dimensionless', ctx) ? 'parallel' : 'none';
  const [a, b] = wRow(m);
  const n = F.mul(F.add(F.mul(a, a), F.mul(b, b)), F.add(F.mul(d.x, d.x), F.mul(d.y, d.y)));
  const s = signNormalized(F, w, n, 'dimensionless', ctx);
  if (s === 0) return 'parallel';
  if (s === 1 || s === -1) return s;
  return s === 'ambiguous' ? undef(NEAR_INFINITY) : 'none';
}

/** Whether every number is a finite double (always true outside FloatField). */
export function finiteIn<T>(F: Field<T>, xs: readonly T[]): boolean {
  return F.kind !== 'float' || xs.every((x) => Number.isFinite(F.toNumber(x)));
}

/** Inexact: an intermediate of the map is beyond the double range. */
export const BEYOND = inexact('apply: the projective image is beyond the double range');
