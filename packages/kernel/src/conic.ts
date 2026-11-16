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
import { parabolaSign } from './conic-type';
import { mapConicAround } from './conic-around';
import { mapCoeffsRaw, mapConicRaw } from './conic-image';

export { parabolaSign };
import { signNormalized, two, vDot } from './geom';
import type { EvalContext } from './tool';
import { mul3, mulHom, type Mat3 } from './transform/projective';
import { undef, type Circle, type Conic, type Undefined, type Vec } from './value';

export {
  coeffsOf,
  matrixOf,
  quadNorm,
  delta,
  conicDet,
  halfGradient,
  polarCovector,
  qValue,
  qDirection,
  homCentre,
  poleOf,
} from './conic-form';
import {
  coeffsOf,
  quadNorm,
  delta,
  conicDet,
  halfGradient,
  qValue,
  qDirection,
  type Coeffs,
  finite,
  CONIC_BEYOND,
  normalForm,
} from './conic-form';
export type { Coeffs } from './conic-form';
export { finite, CONIC_BEYOND } from './conic-form';

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
  if (q.chart !== undefined) {
    const zero = { x: F.zero, y: F.zero },
      o = q.chart.origin,
      z = F.zero;
    const local = makeConic(F, q.chart.q, undefined, ctx);
    if (local.kind !== 'conic') return local;
    const image = mapConicAround(
      F,
      coeffsOf(local),
      [F.one, z, o.x, z, F.one, o.y, z, z, F.one],
      zero,
      o,
      false,
    );
    return image.kind !== 'conic' || anchor === undefined ? image : { ...image, anchor };
  }
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
  if (k.chart !== undefined && !finite(F, [k.chart.origin.x, k.chart.origin.y, ...k.chart.q]))
    return CONIC_BEYOND;
  return coeffsProblem(F, coeffsOf(k), ctx);
}

export type ConicType = 'ellipse' | 'parabola' | 'hyperbola';

/**
 * The type, derived from the sign of ac − b² (conic-type.ts: in floats a parabola when the
 * centre is at infinity for the figure, ADR-0044); within the band → Undefined (ambiguous);
 * mod p → Inexact (no order).
 */
export function conicType<T>(
  F: Field<T>,
  k: Conic<T>,
  ctx: EvalContext,
): ConicType | Undefined | Inexact {
  const s = parabolaSign(F, coeffsOf(k), ctx);
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
  if (q.chart !== undefined) {
    const o = q.chart.origin,
      z = F.zero;
    return mapCoeffs(F, q.chart.q, mul3(F, m, [F.one, z, o.x, z, F.one, o.y, z, z, F.one]));
  }
  return mapCoeffsRaw(F, q, m);
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
  const q: Coeffs<T> = [F.one, F.zero, F.one, F.neg(o.x), F.neg(o.y), f];
  const local: Coeffs<T> = [F.one, F.zero, F.one, F.zero, F.zero, F.neg(c.r2)];
  return F.kind !== 'float' ? q : Object.assign(q, { chart: { origin: o, q: local } });
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
  if (q.chart !== undefined) {
    const A = q.chart.origin;
    const h = mulHom(F, m, [A.x, A.y, F.one]);
    if (!F.eq(h[2], F.zero)) {
      const B = { x: F.div(h[0], h[2]), y: F.div(h[1], h[2]) };
      if (finite(F, [B.x, B.y])) {
        const image = mapConicAround(F, q, m, A, B, false);
        return image.kind !== 'conic' || anchor === undefined ? image : { ...image, anchor };
      }
    }
  }
  if (q.chart !== undefined) {
    const o = q.chart.origin,
      z = F.zero;
    return mapConicRaw(
      F,
      q.chart.q,
      mul3(F, m, [F.one, z, o.x, z, F.one, o.y, z, z, F.one]),
      anchor,
    );
  }
  return mapConicRaw(F, q, m, anchor);
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
