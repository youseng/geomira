/** Stable local polynomial evaluation for translated conics (ADR-0072). */
import { inexact, type Field, type Inexact } from '@geomira/num/field';
import { two, vDot, vSub } from './geom';
import { adj3, mulHom, type Hom, type Mat3 } from './transform/projective';
import type { Conic, Vec } from './value';

/** The six coefficients of a conic (a, b, c, d, e, f), not necessarily in normal form. */
export type Coeffs<T> = readonly [T, T, T, T, T, T] & { readonly chart?: Conic<T>['chart'] };

/** The coefficients of a conic value. */
export function coeffsOf<T>(k: Conic<T>): Coeffs<T> {
  const q: Coeffs<T> = [k.a, k.b, k.c, k.d, k.e, k.f];
  return k.chart === undefined ? q : Object.assign(q, { chart: k.chart });
}

/** The symmetric matrix M of the coefficients. */
export function matrixOf<T>(q: Coeffs<T>): Mat3<T> {
  const [a, b, c, d, e, f] = q;
  return [a, b, d, b, c, e, d, e, f];
}

/** a² + 2b² + c²: the squared Frobenius norm of the quadratic part (zero only for a line). */
export function quadNorm<T>(F: Field<T>, q: Coeffs<T>): T {
  const [a, b, c] = q;
  return F.add(F.add(F.mul(a, a), F.mul(two(F), F.mul(b, b))), F.mul(c, c));
}

/** ac − b²: positive for an ellipse, zero for a parabola, negative for a hyperbola. */
export function delta<T>(F: Field<T>, q: Coeffs<T>): T {
  return F.sub(F.mul(q[0], q[2]), F.mul(q[1], q[1]));
}

/** det M. */
export function conicDet<T>(F: Field<T>, q: Coeffs<T>): T {
  if (q.chart !== undefined) return conicDet(F, q.chart.q);
  const [a, b, c, d, e, f] = q;
  const minor = (x: T, y: T, z: T, w: T): T => F.sub(F.mul(x, w), F.mul(y, z));
  return F.add(
    F.sub(F.mul(a, minor(c, e, e, f)), F.mul(b, minor(b, e, d, f))),
    F.mul(d, minor(b, c, d, e)),
  );
}

/** g(X) = (aX + bY + d, bX + cY + e) = ∇Q(X)/2: the polar covector's linear part at X. */
export function halfGradient<T>(F: Field<T>, q: Coeffs<T>, X: Vec<T>): Vec<T> {
  if (q.chart !== undefined) return halfGradient(F, q.chart.q, vSub(F, X, q.chart.origin));
  const [a, b, c, d, e] = q;
  return {
    x: F.add(F.add(F.mul(a, X.x), F.mul(b, X.y)), d),
    y: F.add(F.add(F.mul(b, X.x), F.mul(c, X.y)), e),
  };
}

/** M·(X, 1): the polar of X as a covector (g, h), g·Y + h = 0, with g·X + h = Q(X). */
export function polarCovector<T>(F: Field<T>, q: Coeffs<T>, X: Vec<T>): Hom<T> {
  const g = halfGradient(F, q, X);
  if (q.chart !== undefined) return [g.x, g.y, F.sub(qValue(F, q, X), vDot(F, g, X))];
  const [, , , d, e, f] = q;
  return [g.x, g.y, F.add(F.add(F.mul(d, X.x), F.mul(e, X.y)), f)];
}

/** Q(X). */
export function qValue<T>(F: Field<T>, q: Coeffs<T>, X: Vec<T>): T {
  if (q.chart !== undefined) return qValue(F, q.chart.q, vSub(F, X, q.chart.origin));
  const [g0, g1, h] = polarCovector(F, q, X);
  return F.add(F.add(F.mul(g0, X.x), F.mul(g1, X.y)), h);
}

/** The value of the quadratic part on a direction: dᵀ·M₂·d. */
export function qDirection<T>(F: Field<T>, q: Coeffs<T>, v: Vec<T>): T {
  const [a, b, c] = q;
  const cross = F.mul(two(F), F.mul(b, F.mul(v.x, v.y)));
  return F.add(F.add(F.mul(a, F.mul(v.x, v.x)), cross), F.mul(c, F.mul(v.y, v.y)));
}

/** The centre in homogeneous coordinates (be − cd, bd − ae, ac − b²): the pole of the line at infinity. */
export function homCentre<T>(F: Field<T>, q: Coeffs<T>): Hom<T> {
  if (q.chart !== undefined) {
    const [x, y, w] = homCentre(F, q.chart.q);
    return [F.add(x, F.mul(q.chart.origin.x, w)), F.add(y, F.mul(q.chart.origin.y, w)), w];
  }
  const [a, b, c, d, e] = q;
  return [F.sub(F.mul(b, e), F.mul(c, d)), F.sub(F.mul(b, d), F.mul(a, e)), delta(F, q)];
}

/** The pole of a line u·(x, y, 1) = 0: adj(M)·u (homogeneous). */
export function poleOf<T>(F: Field<T>, q: Coeffs<T>, u: Hom<T>): Hom<T> {
  if (q.chart !== undefined) {
    const o = q.chart.origin;
    const [x, y, w] = poleOf(F, q.chart.q, [
      u[0],
      u[1],
      F.add(u[2], F.add(F.mul(u[0], o.x), F.mul(u[1], o.y))),
    ]);
    return [F.add(x, F.mul(o.x, w)), F.add(y, F.mul(o.y, w)), w];
  }
  return mulHom(F, adj3(F, matrixOf(q)), u);
}

/** Convert field coefficients without discarding an available stable chart. */
export function numericCoeffs<T>(F: Field<T>, q: Coeffs<T>): Coeffs<number> {
  const numbers = (xs: readonly [T, T, T, T, T, T]): Coeffs<number> => [
    F.toNumber(xs[0]),
    F.toNumber(xs[1]),
    F.toNumber(xs[2]),
    F.toNumber(xs[3]),
    F.toNumber(xs[4]),
    F.toNumber(xs[5]),
  ];
  const out = numbers(q);
  if (q.chart === undefined) return out;
  return Object.assign(out, {
    chart: {
      origin: { x: F.toNumber(q.chart.origin.x), y: F.toNumber(q.chart.origin.y) },
      q: numbers(q.chart.q),
    },
  });
}

/** Whether every number is a finite double (always true outside FloatField). */
export function finite<T>(F: Field<T>, xs: readonly T[]): boolean {
  return F.kind !== 'float' || xs.every((x) => Number.isFinite(F.toNumber(x)));
}

/** Inexact: a conic beyond the double range. */
export const CONIC_BEYOND = inexact('the conic is beyond the double range');

/**
 * The normal form of valid coefficients: scaled by (a² + 2b² + c²)/det M (det M ≠ 0, given when
 * the caller knows it more accurately than from the coefficients).
 */
export function normalForm<T>(
  F: Field<T>,
  q: Coeffs<T>,
  det: T = conicDet(F, q),
): { readonly q: Coeffs<T> } | Inexact {
  const n = quadNorm(F, q);
  const k = F.div(n, det);
  if (F.eq(k, F.zero))
    return inexact(
      `the normal form of the conic divides by a² + 2b² + c², which is 0 in ${F.name}`,
    );
  const [a, b, c, d, e, f] = q;
  const m = (x: T): T => F.mul(x, k);
  return { q: [m(a), m(b), m(c), m(d), m(e), m(f)] };
}
