/** Raw conic image algebra, independent of the chart-aware facade (ADR-0072). */
import { isInexact, type Field, type Inexact } from '@geomira/num/field';
import {
  CONIC_BEYOND,
  finite,
  normalForm,
  matrixOf,
  conicDet,
  quadNorm,
  type Coeffs,
} from './conic-form';
import { adj3, det3, mul3, type Mat3 } from './transform/projective';
import { undef, type Conic, type Undefined, type Vec } from './value';

/** The coefficients of a symmetric matrix (its upper triangle). */
function coeffsOfMatrix<T>(m: Mat3<T>): Coeffs<T> {
  return [m[0], m[1], m[4], m[2], m[5], m[8]];
}

/** Image of raw coefficients under an invertible point map. */
export function mapCoeffsRaw<T>(F: Field<T>, q: Coeffs<T>, m: Mat3<T>): Coeffs<T> {
  const A = adj3(F, m);
  const At: Mat3<T> = [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
  return coeffsOfMatrix(mul3(F, mul3(F, At, matrixOf(q)), A));
}

/** Normalized image without a chart; called by local chart conjugation. */
export function mapConicRaw<T>(
  F: Field<T>,
  q: Coeffs<T>,
  m: Mat3<T>,
  anchor: Vec<T> | undefined,
): Conic<T> | Undefined | Inexact {
  const image = mapCoeffsRaw(F, q, m);
  if (!finite(F, image)) return CONIC_BEYOND;
  // det(adj(m)ᵀ·M·adj(m)) = det(m)⁴·det M: exact algebra, and in floats far better conditioned
  // than the determinant of the rounded image coefficients.
  const dm = det3(F, m);
  const dm2 = F.mul(dm, dm);
  const det = F.mul(F.mul(dm2, dm2), conicDet(F, q));
  if (!finite(F, [det]) || F.eq(det, F.zero) || F.eq(quadNorm(F, image), F.zero))
    return undef('apply: the image of the conic is degenerate in this field');
  const nf = normalForm(F, image, det);
  if (isInexact(nf)) return nf;
  if (!finite(F, nf.q)) return CONIC_BEYOND;
  const [a, b, c, d, e, f] = nf.q;
  const base: Conic<T> = { kind: 'conic', a, b, c, d, e, f };
  return anchor === undefined ? base : { ...base, anchor: { x: anchor.x, y: anchor.y } };
}
