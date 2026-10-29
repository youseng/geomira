/**
 * Poles and the centre of a conic (internal; ADR-0042). The pole of the line u·(x, y, 1) = 0 is
 * adj(M)·u, and the centre is the pole of the line at infinity, Ĉ = (be − cd, bd − ae, ac − b²).
 * The pole's third coordinate is u·Ĉ, so the pole is at infinity exactly when the line passes
 * through the centre, or, for a parabola (whose centre is the point at infinity of its axis),
 * when it is parallel to the axis. The decision follows the type: a central conic (ac − b²
 * clearly non-zero, dimensionless over a² + 2b² + c²) tests the line's distance to the centre as
 * a LENGTH, as pole(l, c) does for circles; a parabola (within EPS) tests the sine between the
 * line and the axis; within the band of a parabola → Undefined (ambiguous); mod p the third
 * coordinate is tested for an exact zero. A pole at infinity is the ideal point of the pole's
 * first two coordinates (ADR-0040), its flag l's toggled (a quarter turn of l's direction enters).
 */
import type { Field } from '@geomira/num/field';
import { coeffsOf, conicProblem, delta, homCentre, poleOf, quadNorm } from '../conic';
import { isZeroNormalized, vDot, vRot90, vSub } from '../geom';
import type { EvalContext } from '../tool';
import { pointOf, undef, type Conic, type Line, type Value, type Vec } from '../value';
import { degenerateLine } from './args';

type AtInfinity = boolean | 'ambiguous';

/** Whether a line through `p` with normal n passes through the conic's centre (see above). */
function throughCentre<T>(
  F: Field<T>,
  k: Conic<T>,
  p: Vec<T>,
  n: Vec<T>,
  ctx: EvalContext,
): AtInfinity {
  const q = coeffsOf(k);
  const [cx, cy, w] = homCentre(F, q);
  const s = F.sign(F.div(delta(F, q), quadNorm(F, q)), 'dimensionless', ctx);
  if (s === 'ambiguous') return 'ambiguous';
  if (s === 'none')
    return F.eq(F.sub(F.add(F.mul(n.x, cx), F.mul(n.y, cy)), F.mul(vDot(F, n, p), w)), F.zero);
  const axis = { x: cx, y: cy };
  if (s === 0)
    return isZeroNormalized(
      F,
      vDot(F, n, axis),
      F.mul(vDot(F, n, n), vDot(F, axis, axis)),
      'dimensionless',
      ctx,
    );
  const C = { x: F.div(cx, w), y: F.div(cy, w) };
  return isZeroNormalized(F, vDot(F, n, vSub(F, C, p)), vDot(F, n, n), 'length', ctx);
}

/**
 * pole(l, k). Degenerate cases: a line without direction or an invalid conic → Undefined; l
 * through the centre (a parabola: parallel to its axis) → the point at infinity; a conic within
 * the band of a parabola → Undefined (ambiguous); l tangent to k → the touch point.
 */
export function conicPole<T>(F: Field<T>, l: Line<T>, k: Conic<T>, ctx: EvalContext): Value<T> {
  const bad = degenerateLine(F, l, ctx) ?? conicProblem(F, k, ctx);
  if (bad !== undefined) return bad;
  const n = vRot90(F, l.d);
  const [x, y, w] = poleOf(F, coeffsOf(k), [n.x, n.y, F.neg(vDot(F, n, l.p))]);
  const inf = throughCentre(F, k, l.p, n, ctx);
  if (inf === 'ambiguous') return undef('ambiguous: the conic is within the band of a parabola');
  if (inf || F.eq(w, F.zero)) return { kind: 'ideal_point', d: { x, y }, chiral: !l.chiral };
  return pointOf(F.div(x, w), F.div(y, w));
}

/**
 * conic_center(k): the centre, the pole of the line at infinity. Degenerate cases: an invalid
 * conic → Undefined; a parabola (ac − b² within EPS, dimensionless) → the point at infinity of
 * its axis (achiral: a direction of positions); within the band of a parabola → Undefined
 * (ambiguous); mod p: an exact zero test of ac − b².
 */
export function conicCentre<T>(F: Field<T>, k: Conic<T>, ctx: EvalContext): Value<T> {
  const bad = conicProblem(F, k, ctx);
  if (bad !== undefined) return bad;
  const q = coeffsOf(k);
  const [x, y, w] = homCentre(F, q);
  const s = F.sign(F.div(w, quadNorm(F, q)), 'dimensionless', ctx);
  if (s === 'ambiguous') return undef('ambiguous: the conic is within the band of a parabola');
  if (s === 0 || F.eq(w, F.zero)) return { kind: 'ideal_point', d: { x, y }, chiral: false };
  return pointOf(F.div(x, w), F.div(y, w));
}
