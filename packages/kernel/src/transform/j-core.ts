/**
 * The inversion J(w) = 1/w̄ = w/|w|² in the unit circle about the origin (ADR-0032 decision 5),
 * the middle factor of every Möbius map with a pole: shared helpers. In J's frame the pole
 * (the center of inversion) is the origin and lengths are the world's (the first factor is an
 * isometry), so the decisions here use the figure's tolerance context.
 */
import { assertNever } from '@geomira/num/assert';
import { inexact, type Field, type FieldSign, type Inexact } from '@geomira/num/field';
import { vDot, vScale } from '../geom';
import type { EvalContext } from '../tool';
import { undef, type Undefined, type Vec } from '../value';

/** The reason for a point at the pole. */
export const AT_POLE = 'apply: the point is the center of inversion: its image is at infinity';

/** The reason for a decision within the band of the pole. */
export const NEAR_POLE = 'ambiguous: within the band of the center of inversion';

/** Inexact: a decision of the map needs an order (mod p). */
export function noOrder<T>(F: Field<T>, what: string): Inexact {
  return inexact(`apply: ${what} through an inversion needs an order, which ${F.name} lacks`);
}

/**
 * Whether the position w (relative to the pole) is the pole: both components zero lengths
 * (the kernel's max-norm coincidence, ADR-0003 item 21) → 'pole'; both within the band →
 * Undefined (ambiguous); otherwise 'off'. Mod p: the exact zero test.
 */
export function poleTest<T>(F: Field<T>, w: Vec<T>, ctx: EvalContext): 'pole' | 'off' | Undefined {
  const [sx, sy] = [F.sign(w.x, 'length', ctx), F.sign(w.y, 'length', ctx)];
  if (sx === 'none' || sy === 'none')
    return F.isZero(w.x, 'length', ctx) && F.isZero(w.y, 'length', ctx) ? 'pole' : 'off';
  const small = (s: FieldSign): boolean => s === 0 || s === 'ambiguous';
  if (sx === 0 && sy === 0) return 'pole';
  return small(sx) && small(sy) ? undef(NEAR_POLE) : 'off';
}

/** J(w) = w/|w|² (the caller has excluded the pole). */
export function jPoint<T>(F: Field<T>, w: Vec<T>): Vec<T> {
  return vScale(F, w, F.div(F.one, vDot(F, w, w)));
}

/** A banded sign as the side of the pole: 1, −1, 0 (on), or the reason. */
export type Side = 1 | -1 | 0 | 'none' | Undefined;

/** The side from a field sign: in the band → Undefined (ambiguous); mod p → 'none'. */
export function sideOf(s: FieldSign): Side {
  switch (s) {
    case 1:
    case -1:
    case 0:
      return s;
    case 'ambiguous':
      return undef(NEAR_POLE);
    case 'none':
      return 'none';
    default:
      return assertNever(s, 'field sign');
  }
}
