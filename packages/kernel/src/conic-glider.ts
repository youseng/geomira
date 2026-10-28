/**
 * Gliders on a conic (ADR-0042): the pencil of lines through the conic's known point A (its
 * anchor), as for circles' (u : v). With e = −g(A) (g = ∇Q/2: for a circle a positive multiple
 * of A − O) and f = rot90(e), the line through A with direction w = u·f − v·e meets the conic
 * again at
 *   X(u : v) = A − (β/α)·w,  α = wᵀM₂w,  β = 2·g(A)·w = 2v·|e|²,
 * rational in u and v (exact over Q and mod p) and, for a conic that is a circle, the circle
 * glider's point exactly. X(u : 0) = A (w is the tangent at A). The parameter runs over the whole
 * conic once: through the point at infinity of a parabola (w along its axis) and the two of a
 * hyperbola (w along an asymptote), where α = 0: those (u : v) are Undefined ("at infinity"),
 * within the band Undefined (ambiguous), so a glider leaves one branch of a hyperbola through
 * infinity, Undefined there, and comes back on the other. The inverse (exact, for points ON
 * the conic) is (u : v) = (w·f : −w·e) with w = X − A, (1 : 0) at A. The drag map (FloatField):
 * Newton steps X ← X − Q(X)·∇Q(X)/|∇Q(X)|² from the cursor to the curve, then the inverse.
 */
import { inexact, isInexact, type Field, type FieldSign, type Inexact } from '@geomira/num/field';
import { coeffsOf, conicProblem, halfGradient, qDirection, qValue, quadNorm } from './conic';
import { isZeroVec, signNormalized, two, vDot, vRot90, vScale, vSub } from './geom';
import type { EvalContext } from './tool';
import { pointOf, undef, type Conic, type Undefined, type Value, type Vec } from './value';

type Stereo<T> = { readonly form: 'stereo'; readonly u: T; readonly v: T };

/** The anchor and the frame (e, f) of the pencil through it. */
function frame<T>(
  F: Field<T>,
  k: Conic<T>,
  ctx: EvalContext,
): { A: Vec<T>; e: Vec<T>; f: Vec<T> } | Undefined | Inexact {
  const bad = conicProblem(F, k, ctx);
  if (bad !== undefined) return bad;
  const A = k.anchor;
  if (A === undefined) return undef('this conic has no known point: a glider on it needs one');
  const e = vScale(F, halfGradient(F, coeffsOf(k), A), F.neg(F.one));
  if (F.eq(e.x, F.zero) && F.eq(e.y, F.zero))
    return undef('the known point of the conic is its center');
  return { A, e, f: vRot90(F, e) };
}

/** α of a direction as a dimensionless banded sign (over |w|²·√(a² + 2b² + c²); exact fields: α). */
function directionSign<T>(F: Field<T>, k: Conic<T>, w: Vec<T>, ctx: EvalContext): FieldSign {
  const q = coeffsOf(k);
  const r = F.sqrt(quadNorm(F, q));
  const a = qDirection(F, q, w);
  if (isInexact(r)) return F.sign(a, 'dimensionless', ctx);
  const ww = vDot(F, w, w);
  return signNormalized(F, a, F.mul(F.mul(ww, ww), F.mul(r, r)), 'dimensionless', ctx);
}

/**
 * The glider's point X(u : v). Degenerate cases: an invalid conic or no known point →
 * Undefined; (0 : 0) → Undefined; an asymptotic direction (the point at infinity) → Undefined;
 * within the band → Undefined (ambiguous).
 */
export function conicGliderPoint<T>(
  F: Field<T>,
  k: Conic<T>,
  u: T,
  v: T,
  ctx: EvalContext,
): Value<T> {
  const fr = frame(F, k, ctx);
  if ('kind' in fr) return fr;
  if (F.isZero(u, 'dimensionless', ctx) && F.isZero(v, 'dimensionless', ctx))
    return undef('the glider parameter (0 : 0) is not a point');
  const w = vSub(F, vScale(F, fr.f, u), vScale(F, fr.e, v));
  const s = directionSign(F, k, w, ctx);
  if (s === 'ambiguous')
    return undef('ambiguous: the glider is within the band of a point at infinity of the conic');
  const alpha = qDirection(F, coeffsOf(k), w);
  if (s === 0 || F.eq(alpha, F.zero))
    return undef('the glider is at a point at infinity of the conic (an asymptotic direction)');
  const beta = F.mul(two(F), F.mul(v, vDot(F, fr.e, fr.e)));
  const X = vSub(F, fr.A, vScale(F, w, F.div(beta, alpha)));
  return pointOf(X.x, X.y);
}

/** The parameter of a point X on the conic (inverts conicGliderPoint; (1 : 0) at the anchor). */
export function conicGliderParameter<T>(
  F: Field<T>,
  k: Conic<T>,
  X: Vec<T>,
  ctx: EvalContext,
): Stereo<T> | Undefined | Inexact {
  const fr = frame(F, k, ctx);
  if ('kind' in fr) return fr;
  const w = vSub(F, X, fr.A);
  if (isZeroVec(F, w, ctx)) return { form: 'stereo', u: F.one, v: F.zero };
  return { form: 'stereo', u: vDot(F, w, fr.f), v: F.neg(vDot(F, w, fr.e)) };
}

/** Most Newton steps of the drag map. */
const STEPS = 64;

/**
 * The drag map: the cursor moved onto the conic by Newton steps along the gradient, then its
 * parameter. Degenerate cases: exact fields → Inexact (iterations are for floats); the cursor at
 * the centre (∇Q = 0) → Undefined; no convergence → Undefined.
 */
export function conicDragParameter<T>(
  F: Field<T>,
  k: Conic<T>,
  cursor: Vec<T>,
  ctx: EvalContext,
): Stereo<T> | Undefined | Inexact {
  if (F.kind !== 'float') return inexact('dragging on a conic needs float iterations');
  const bad = conicProblem(F, k, ctx);
  if (bad !== undefined) return bad;
  const q = coeffsOf(k);
  let X = cursor;
  for (let i = 0; i < STEPS; i++) {
    const g = vScale(F, halfGradient(F, q, X), two(F));
    const gg = vDot(F, g, g);
    if (F.eq(gg, F.zero) || !Number.isFinite(F.toNumber(gg)))
      return undef('the cursor is at the center: no nearest point');
    const value = qValue(F, q, X);
    X = vSub(F, X, vScale(F, g, F.div(value, gg)));
    const r = F.sqrt(gg);
    if (isInexact(r)) return r;
    if (F.isZero(F.div(qValue(F, q, X), r), 'length', ctx))
      return conicGliderParameter(F, k, X, ctx);
  }
  return undef('the cursor is too far from the conic: no nearest point');
}
