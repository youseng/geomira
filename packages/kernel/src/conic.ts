/**
 * Conics (ADR-0042; SPEC §4, §18 E8), field-generic. A conic is Q(X) = (X, 1)·M·(X, 1)ᵀ = 0 with
 * M = [[a, b, d], [b, c, e], [d, e, f]] in its NORMAL FORM det M = a² + 2b² + c² (value.ts). In
 * that form Q is dimensionless (scaling the figure by s gives Q(X/s)), so Q/|∇Q| is a length:
 * the first-order distance to the curve, on which incidence is decided. Everything here is a
 * polynomial or a ratio of polynomials in the coefficients, exact over Q and mod p; the only
 * square roots are taken to measure a decision in FloatField (exact fields test exactly).
 */
import { assertNever } from '@geomira/num/assert';
import { inexact, isInexact, type Field, type FieldSign, type Inexact } from '@geomira/num/field';
import { signNormalized, two, vDot } from './geom';
import type { EvalContext } from './tool';
import { adj3, det3, mul3, mulHom, type Hom, type Mat3 } from './transform/projective';
import { undef, type Circle, type Conic, type Undefined, type Vec } from './value';

/** The six coefficients of a conic (a, b, c, d, e, f), not necessarily in normal form. */
export type Coeffs<T> = readonly [T, T, T, T, T, T];

/** The coefficients of a conic value. */
export function coeffsOf<T>(k: Conic<T>): Coeffs<T> {
  return [k.a, k.b, k.c, k.d, k.e, k.f];
}

/** The symmetric matrix M of the coefficients. */
export function matrixOf<T>(q: Coeffs<T>): Mat3<T> {
  const [a, b, c, d, e, f] = q;
  return [a, b, d, b, c, e, d, e, f];
}

/** The coefficients of a symmetric matrix (its upper triangle). */
function coeffsOfMatrix<T>(m: Mat3<T>): Coeffs<T> {
  return [m[0], m[1], m[4], m[2], m[5], m[8]];
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
  const [a, b, c, d, e, f] = q;
  const minor = (x: T, y: T, z: T, w: T): T => F.sub(F.mul(x, w), F.mul(y, z));
  return F.add(
    F.sub(F.mul(a, minor(c, e, e, f)), F.mul(b, minor(b, e, d, f))),
    F.mul(d, minor(b, c, d, e)),
  );
}

/** g(X) = (aX + bY + d, bX + cY + e) = ∇Q(X)/2: the polar covector's linear part at X. */
export function halfGradient<T>(F: Field<T>, q: Coeffs<T>, X: Vec<T>): Vec<T> {
  const [a, b, c, d, e] = q;
  return {
    x: F.add(F.add(F.mul(a, X.x), F.mul(b, X.y)), d),
    y: F.add(F.add(F.mul(b, X.x), F.mul(c, X.y)), e),
  };
}

/** M·(X, 1): the polar of X as a covector (g, h), g·Y + h = 0, with g·X + h = Q(X). */
export function polarCovector<T>(F: Field<T>, q: Coeffs<T>, X: Vec<T>): Hom<T> {
  const g = halfGradient(F, q, X);
  const [, , , d, e, f] = q;
  return [g.x, g.y, F.add(F.add(F.mul(d, X.x), F.mul(e, X.y)), f)];
}

/** Q(X). */
export function qValue<T>(F: Field<T>, q: Coeffs<T>, X: Vec<T>): T {
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
  const [a, b, c, d, e] = q;
  return [F.sub(F.mul(b, e), F.mul(c, d)), F.sub(F.mul(b, d), F.mul(a, e)), delta(F, q)];
}

/** The pole of a line u·(x, y, 1) = 0: adj(M)·u (homogeneous). */
export function poleOf<T>(F: Field<T>, q: Coeffs<T>, u: Hom<T>): Hom<T> {
  return mulHom(F, adj3(F, matrixOf(q)), u);
}

/** Whether every number is a finite double (always true outside FloatField). */
function finite<T>(F: Field<T>, xs: readonly T[]): boolean {
  return F.kind !== 'float' || xs.every((x) => Number.isFinite(F.toNumber(x)));
}

/** Inexact: a conic beyond the double range. */
export const CONIC_BEYOND = inexact('the conic is beyond the double range');

/**
 * How far the conic is from a degenerate one, as a LENGTH (FloatField only; undefined in exact
 * fields, which test det M = 0 exactly): ℓ = √(|det M| / (a² + 2b² + c²)^{3/2}), which is the
 * semi-latus rectum b²/a of an ellipse or a hyperbola (the radius of a circle, the parameter p of
 * a parabola y² = 2px): the radius of curvature at a vertex. A conic whose ℓ is within EPS·scale
 * is degenerate to the kernel (a pair of lines, a double line or a point), inside the band
 * ambiguous (ADR-0042).
 */
function degeneracyLength<T>(F: Field<T>, det: T, n: T): T | undefined {
  if (F.kind !== 'float') return undefined;
  const r = F.sqrt(n);
  if (isInexact(r)) return undefined;
  const q = F.div(det, F.mul(n, r));
  const s = F.sqrt(F.toNumber(q) < 0 ? F.neg(q) : q);
  return isInexact(s) ? undefined : s;
}

/** The sign of a non-zero quantity the band has already separated from 0 (floats, Q); mod p: 'none'. */
function clearSign<T>(F: Field<T>, x: T): 1 | -1 | 'none' {
  if (F.kind === 'modp') return 'none';
  return F.toNumber(x) > 0 ? 1 : -1;
}

/**
 * Why coefficients do not make a conic value, or undefined. Degenerate cases:
 *   - a coefficient beyond the double range (floats) → Inexact;
 *   - no quadratic part (a = b = c = 0 exactly) → Undefined (a line, not a conic);
 *   - det M = 0 (exact fields), or the degeneracy length within EPS·scale (floats) → Undefined
 *     (a pair of lines, a double line or a point); within the band → Undefined (ambiguous);
 *   - an imaginary ellipse (ac − b² > 0 with a·det M > 0: no real point) → Undefined; ac − b²
 *     within the band with a·det M > 0 → Undefined (ambiguous); mod p this is not decidable
 *     (no order) and is not checked.
 */
export function coeffsProblem<T>(
  F: Field<T>,
  q: Coeffs<T>,
  ctx: EvalContext,
): Undefined | Inexact | undefined {
  if (!finite(F, q)) return CONIC_BEYOND;
  const n = quadNorm(F, q);
  if (F.eq(n, F.zero)) return undef('degenerate conic: it has no quadratic part (a line)');
  const det = conicDet(F, q);
  if (!finite(F, [n, det])) return CONIC_BEYOND;
  const degenerate = undef('degenerate conic: a pair of lines, a double line or a point');
  const len = degeneracyLength(F, det, n);
  if (len === undefined) {
    if (F.eq(det, F.zero)) return degenerate;
  } else {
    const s = F.sign(len, 'length', ctx);
    if (s === 0 || s === -1) return degenerate;
    if (s === 'ambiguous')
      return undef('ambiguous: the conic is within the band of a pair of lines');
  }
  const t = F.sign(F.div(delta(F, q), n), 'dimensionless', ctx);
  if (t !== 1 && t !== 'ambiguous') return undefined;
  const sideSign = clearSign(F, F.mul(q[0], det));
  if (sideSign !== 1) return undefined;
  return t === 1
    ? undef('the conic has no real point (an imaginary ellipse)')
    : undef('ambiguous: the conic is within the band of an imaginary ellipse');
}

/**
 * The normal form of valid coefficients: scaled by (a² + 2b² + c²)/det M (det M ≠ 0, given when
 * the caller knows it more accurately than from the coefficients).
 */
function normalForm<T>(
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

/**
 * The conic value of coefficients (any scale), with an optional known point. Degenerate cases:
 * as coeffsProblem; the normal form not representable (mod p, a² + 2b² + c² = 0) → Inexact; a
 * result beyond the double range → Inexact.
 */
export function makeConic<T>(
  F: Field<T>,
  q: Coeffs<T>,
  anchor: Vec<T> | undefined,
  ctx: EvalContext,
): Conic<T> | Undefined | Inexact {
  const bad = coeffsProblem(F, q, ctx);
  if (bad !== undefined) return bad;
  const nf = normalForm(F, q);
  if (isInexact(nf)) return nf;
  if (!finite(F, nf.q)) return CONIC_BEYOND;
  const [a, b, c, d, e, f] = nf.q;
  const base: Conic<T> = { kind: 'conic', a, b, c, d, e, f };
  return anchor === undefined ? base : { ...base, anchor: { x: anchor.x, y: anchor.y } };
}

/** Why a conic VALUE is not usable (a hand-built one), as coeffsProblem. */
export function conicProblem<T>(
  F: Field<T>,
  k: Conic<T>,
  ctx: EvalContext,
): Undefined | Inexact | undefined {
  return coeffsProblem(F, coeffsOf(k), ctx);
}

export type ConicType = 'ellipse' | 'parabola' | 'hyperbola';

/**
 * The type, derived from ac − b² over a² + 2b² + c² (dimensionless) with the band: a parabola
 * within EPS; within the band → Undefined (ambiguous); mod p → Inexact (no order).
 */
export function conicType<T>(
  F: Field<T>,
  k: Conic<T>,
  ctx: EvalContext,
): ConicType | Undefined | Inexact {
  const q = coeffsOf(k);
  const s = F.sign(F.div(delta(F, q), quadNorm(F, q)), 'dimensionless', ctx);
  switch (s) {
    case 1:
      return 'ellipse';
    case -1:
      return 'hyperbola';
    case 0:
      return 'parabola';
    case 'ambiguous':
      return undef('ambiguous: the conic is within the band of a parabola');
    case 'none':
      return inexact(`the type of a conic needs an order, which ${F.name} lacks`);
    default:
      return assertNever(s, 'field sign');
  }
}

/**
 * The image coefficients under the point map X ↦ m·X (homogeneous; m invertible): the matrix
 * adj(m)ᵀ·M·adj(m), which is m⁻ᵀ·M·m⁻¹ up to a factor (not in normal form).
 */
export function mapCoeffs<T>(F: Field<T>, q: Coeffs<T>, m: Mat3<T>): Coeffs<T> {
  const A = adj3(F, m);
  const At: Mat3<T> = [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
  return coeffsOfMatrix(mul3(F, mul3(F, At, matrixOf(q)), A));
}

/**
 * The incidence gap Q(P)/|∇Q(P)| decided as a LENGTH with the band (exact fields: Q(P) exactly).
 * Returns the banded sign: 0 on the conic, 'ambiguous' within the band, ±1 off it.
 */
export function onConicSign<T>(F: Field<T>, k: Conic<T>, P: Vec<T>, ctx: EvalContext): FieldSign {
  const q = coeffsOf(k);
  const g = halfGradient(F, q, P);
  const n = F.mul(F.mul(two(F), two(F)), vDot(F, g, g));
  return signNormalized(F, qValue(F, q, P), n, 'length', ctx);
}

/** A circle as coefficients: |X − O|² − r² (a = c = 1). */
export function circleCoeffs<T>(F: Field<T>, c: Circle<T>): Coeffs<T> {
  const o = c.c;
  const f = F.sub(F.add(F.mul(o.x, o.x), F.mul(o.y, o.y)), c.r2);
  return [F.one, F.zero, F.one, F.neg(o.x), F.neg(o.y), f];
}

/**
 * The image of conic coefficients under an invertible point map m, in normal form, with the
 * image of the known point when it has one (`anchor`). No band decision is taken: the image of a
 * valid conic is valid; only an exact zero determinant (an underflow in floats) or the double
 * range can fail. Degenerate cases: det = 0 exactly → Undefined; beyond the double range →
 * Inexact.
 */
export function mapConicBy<T>(
  F: Field<T>,
  q: Coeffs<T>,
  m: Mat3<T>,
  anchor: Vec<T> | undefined,
): Conic<T> | Undefined | Inexact {
  const image = mapCoeffs(F, q, m);
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

type Form<T> = readonly [T, T, T];

/** The line through P and Q as a form (α, β, γ): α·x + β·y + γ = cross(Q − P, X − P). */
function lineForm<T>(F: Field<T>, P: Vec<T>, Q: Vec<T>): Form<T> {
  const [alpha, beta] = [F.sub(P.y, Q.y), F.sub(Q.x, P.x)];
  return [alpha, beta, F.neg(F.add(F.mul(alpha, P.x), F.mul(beta, P.y)))];
}

/** The product of two line forms, as conic coefficients. */
function productOf<T>(F: Field<T>, l: Form<T>, m: Form<T>): Coeffs<T> {
  const h = (x: T): T => F.div(x, two(F));
  const sym = (i: 0 | 1 | 2, j: 0 | 1 | 2): T => h(F.add(F.mul(l[i], m[j]), F.mul(l[j], m[i])));
  return [F.mul(l[0], m[0]), sym(0, 1), F.mul(l[1], m[1]), sym(0, 2), sym(1, 2), F.mul(l[2], m[2])];
}

function formAt<T>(F: Field<T>, l: Form<T>, X: Vec<T>): T {
  return F.add(F.add(F.mul(l[0], X.x), F.mul(l[1], X.y)), l[2]);
}

/**
 * The conic through A, B, C, D, E (no three collinear) as raw coefficients: the member
 * λ·AB·CD + μ·AC·BD of the pencil of two line pairs through A, B, C, D that passes through E,
 * (λ, μ) = (AC·BD(E), −AB·CD(E)). A polynomial in the coordinates (not in normal form): the
 * conconic claim's condition is Q(F) = 0 for it (ADR-0042).
 */
export function pencilCoeffs<T>(
  F: Field<T>,
  A: Vec<T>,
  B: Vec<T>,
  C: Vec<T>,
  D: Vec<T>,
  E: Vec<T>,
): Coeffs<T> {
  const [ab, cd, ac, bd] = [
    lineForm(F, A, B),
    lineForm(F, C, D),
    lineForm(F, A, C),
    lineForm(F, B, D),
  ];
  const lambda = F.mul(formAt(F, ac, E), formAt(F, bd, E));
  const mu = F.neg(F.mul(formAt(F, ab, E), formAt(F, cd, E)));
  const [p, r] = [productOf(F, ab, cd), productOf(F, ac, bd)];
  const c = (i: 0 | 1 | 2 | 3 | 4 | 5): T => F.add(F.mul(lambda, p[i]), F.mul(mu, r[i]));
  return [c(0), c(1), c(2), c(3), c(4), c(5)];
}

/**
 * The chord gap of the line p + t·d (FloatField; undefined in exact fields or when d is an
 * asymptotic direction, α = 0 exactly): −sign(α)·Q(mid)/|∇Q(mid)|, mid the chord's midpoint, a
 * length: positive when the line cuts the conic twice, zero at a tangency, negative when it misses
 * (tools/conic-pairs.ts decides the count on it with the band; the tangent claim reads it).
 */
export function chordGap<T>(F: Field<T>, q: Coeffs<T>, p: Vec<T>, d: Vec<T>): T | undefined {
  const alpha = qDirection(F, q, d);
  if (F.kind !== 'float' || F.eq(alpha, F.zero)) return undefined;
  const beta = F.mul(two(F), vDot(F, halfGradient(F, q, p), d));
  const t = F.neg(F.div(beta, F.mul(two(F), alpha)));
  const mid = { x: F.add(p.x, F.mul(t, d.x)), y: F.add(p.y, F.mul(t, d.y)) };
  const g = halfGradient(F, q, mid);
  const r = F.sqrt(F.mul(F.mul(two(F), two(F)), vDot(F, g, g)));
  if (isInexact(r) || F.eq(r, F.zero)) return undefined;
  const value = F.div(qValue(F, q, mid), r);
  return F.toNumber(alpha) > 0 ? F.neg(value) : value;
}
