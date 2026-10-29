/**
 * Conic images computed around a known point (Run 16c's audit, Run 16b known bug): mapConicBy in
 * coordinates centred at a point of the conic and at its image, which avoids the cancellation of
 * adj(m)ᵀ·M·adj(m) in world coordinates in floats. Exact fields get the same value.
 */
import { fromNumber } from '@geomira/num/rational';
import { isInexact, type Field, type Inexact } from '@geomira/num/field';
import {
  CONIC_BEYOND,
  coeffsOf,
  finite,
  halfGradient,
  mapConicBy,
  qValue,
  type Coeffs,
} from './conic';
import { mul3, type Mat3 } from './transform/projective';
import type { Conic, Undefined, Vec } from './value';

/** The coefficients of Y ↦ Q(P + Y): the conic in coordinates centred at P (a, b, c unchanged). */
export function translateCoeffs<T>(F: Field<T>, q: Coeffs<T>, P: Vec<T>): Coeffs<T> {
  const g = halfGradient(F, q, P);
  return [q[0], q[1], q[2], g.x, g.y, qValue(F, q, P)];
}

/**
 * The conic in coordinates centred at its known point A: Q(A) is 0 by definition (A lies on the
 * conic), so the constant term is 0 and not the rounding residue of Q(A) (a residue there is
 * amplified by the cancellation mapConicAround avoids).
 */
function atKnownPoint<T>(F: Field<T>, q: Coeffs<T>, A: Vec<T>): Coeffs<T> {
  const [a, b, c, d, e] = translateCoeffs(F, q, A);
  return [a, b, c, d, e, F.zero];
}

/** Floats: m scaled by a power of two (exact) so its largest entry is about 1; else m itself. */
function unitScale<T>(F: Field<T>, m: Mat3<T>): Mat3<T> {
  if (F.kind !== 'float') return m;
  const top = Math.max(...m.map((x) => Math.abs(F.toNumber(x))));
  if (!(top > 0) || !Number.isFinite(top)) return m;
  const k = F.fromRational(fromNumber(2 ** -Math.floor(Math.log2(top))));
  if (isInexact(k)) return m;
  const s = (x: T): T => F.mul(x, k);
  return [s(m[0]), s(m[1]), s(m[2]), s(m[3]), s(m[4]), s(m[5]), s(m[6]), s(m[7]), s(m[8])];
}

/**
 * mapConicBy computed around the known point A and its image B (both finite): the conic in
 * coordinates centred at A, the map conjugated by the two translations, the image translated back.
 * The same value in exact fields; in floats it avoids the cancellation of adj(m)ᵀ·M·adj(m) in
 * world coordinates (Run 16c's audit: conic_to_circle(k) of an eccentric conic far from the
 * origin lost fourteen digits there). Degenerate cases: as mapConicBy.
 */
export function mapConicAround<T>(
  F: Field<T>,
  q: Coeffs<T>,
  m: Mat3<T>,
  A: Vec<T>,
  B: Vec<T>,
): Conic<T> | Undefined | Inexact {
  const [z, o] = [F.zero, F.one];
  const to: Mat3<T> = [o, z, A.x, z, o, A.y, z, z, o];
  const back: Mat3<T> = [o, z, F.neg(B.x), z, o, F.neg(B.y), z, z, o];
  const local = mapConicBy(
    F,
    atKnownPoint(F, q, A),
    unitScale(F, mul3(F, mul3(F, back, m), to)),
    undefined,
  );
  if (local.kind !== 'conic') return local;
  const minusB = { x: F.neg(B.x), y: F.neg(B.y) };
  const [a, b, c, d, e, f] = translateCoeffs(F, coeffsOf(local), minusB);
  if (!finite(F, [d, e, f])) return CONIC_BEYOND;
  return { kind: 'conic', a, b, c, d, e, f, anchor: { x: B.x, y: B.y } };
}
