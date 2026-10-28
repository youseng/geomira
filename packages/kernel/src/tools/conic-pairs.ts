/**
 * The branchable geometry of conics (internal; ADR-0042, SPEC §7, ADR-0006): line ∩ conic and the
 * tangents from a point, as Pairs for select.ts. On the line p + t·d,
 *   Q(p + t·d) = α·t² + β·t + γ,  α = dᵀM₂d, β = 2·g(p)·d, γ = Q(p)  (g = ∇Q/2).
 *   - α = 0 (d an asymptotic direction of a hyperbola, or the axis direction of a parabola):
 *     the line meets the conic once, at t = −γ/β; the other common point is at infinity. α is
 *     decided as a dimensionless quantity (α over |d|²·√(a² + 2b² + c²)) with the band: within
 *     EPS → one point; inside the band → Undefined (the far point is near infinity, and the
 *     along(±) label of the near one would flip there); β = 0 too → the line is an asymptote
 *     (no finite common point);
 *   - otherwise the chord's midpoint is mid = p − β/(2α)·d and Q(mid) = −Δ/(4α), Δ = β² − 4αγ;
 *     the count is decided on −sign(α)·Q(mid)/|∇Q(mid)| as a LENGTH with the band (the distance
 *     from the chord's midpoint to the conic, which near a tangency is the line's distance to
 *     it: no square root of a rounding residue is taken): clearly negative → no intersection,
 *     within the band → the double point mid, clearly positive → mid ∓ √(Δ/4α²)·d, so along(+)
 *     is mid + … (further along d, structurally);
 *   - other(P) by Vieta: t₁ = −β/α − t₀ (exact; α within EPS → the other point is at infinity).
 * Tangents from P: the touch points are the polar of P (g(P)·X + h = 0) ∩ the conic, the polar
 * taken through P − Q(P)/|g|²·g (the foot of P on it) with direction rot90(g); orient(+) is
 * cross(mid − P, T − P) > 0 (as for circles, where mid − P points to O), which for mid + s·u is
 * the sign of −Q(P); other(T): the other point of the polar by Vieta.
 */
import { isInexact, type Field, type FieldSign, type Inexact } from '@geomira/num/field';
import { signNormalized, two, vAdd, vDot, vRot90, vScale, vSub } from '../geom';
import {
  coeffsOf,
  conicProblem,
  halfGradient,
  polarCovector,
  qDirection,
  qValue,
  quadNorm,
  type Coeffs,
} from '../conic';
import type { BranchShape, EvalContext } from '../tool';
import { undef, type Conic, type Line, type Undefined, type Value, type Vec } from '../value';
import { degenerateLine } from './args';
import { asPoint, midOff, onRange, paramOn, type Cand, type Curve, type Pair } from './pairs';
import { outsideReason, rangeStatus } from './range';

export const LINE_CONIC: BranchShape = {
  candidates: 2,
  low: 'along',
  other: true,
  describe: 'line ∩ conic',
};

/** x / √n as a dimensionless banded sign, with n = s²·√(a² + 2b² + c²) (exact fields: x). */
function scaledSign<T>(F: Field<T>, x: T, s2: T, q: Coeffs<T>, ctx: EvalContext): FieldSign {
  const r = F.sqrt(quadNorm(F, q));
  return isInexact(r)
    ? F.sign(x, 'dimensionless', ctx)
    : signNormalized(F, x, F.mul(s2, r), 'dimensionless', ctx);
}

/** The quadratic Q(p + t·d) = αt² + βt + γ. */
function quadratic<T>(F: Field<T>, q: Coeffs<T>, p: Vec<T>, d: Vec<T>) {
  return {
    alpha: qDirection(F, q, d),
    beta: F.mul(two(F), vDot(F, halfGradient(F, q, p), d)),
    gamma: qValue(F, q, p),
  };
}

type Meet<T> =
  | { readonly kind: 'two'; readonly mid: Vec<T>; readonly rad: T; readonly sign: 1 | -1 | 'none' }
  | { readonly kind: 'one'; readonly at: Vec<T> }
  | Undefined;

/**
 * How the carrier p + t·d meets the conic (module comment): two points (mid ∓ √rad·d), one
 * finite point (α = 0), or why not. `sign` is α's sign (mod p: 'none').
 */
function meet<T>(F: Field<T>, q: Coeffs<T>, p: Vec<T>, d: Vec<T>, ctx: EvalContext): Meet<T> {
  const { alpha, beta, gamma } = quadratic(F, q, p, d);
  const dd = vDot(F, d, d);
  const sa = scaledSign(F, alpha, F.mul(dd, dd), q, ctx);
  if (sa === 'ambiguous')
    return undef('ambiguous: the line is within the band of an asymptotic direction of the conic');
  if (sa === 0 || (sa === 'none' && F.isZero(alpha, 'dimensionless', ctx))) {
    const sb = scaledSign(F, beta, dd, q, ctx);
    if (sb === 0 || sb === 'ambiguous' || (sb === 'none' && F.isZero(beta, 'dimensionless', ctx)))
      return undef('no intersection: the line meets the conic only at infinity (an asymptote)');
    return { kind: 'one', at: vAdd(F, p, vScale(F, d, F.neg(F.div(gamma, beta)))) };
  }
  const mid = vAdd(F, p, vScale(F, d, F.neg(F.div(beta, F.mul(two(F), alpha)))));
  const four = F.mul(two(F), two(F));
  const disc = F.sub(F.mul(beta, beta), F.mul(four, F.mul(alpha, gamma)));
  const rad = F.div(disc, F.mul(four, F.mul(alpha, alpha)));
  return { kind: 'two', mid, rad, sign: sa === 'none' ? 'none' : sa };
}

/** The count of a 'two' meet: the gap −sign(α)·Q(mid)/|∇Q(mid)| as a length. */
function countTwo<T>(
  F: Field<T>,
  q: Coeffs<T>,
  m: Extract<Meet<T>, { kind: 'two' }>,
  ctx: EvalContext,
  missing: string,
): 1 | 2 | Undefined {
  const value = qValue(F, q, m.mid);
  if (m.sign === 'none') return F.isZero(value, 'length', ctx) ? 1 : 2;
  const g = halfGradient(F, q, m.mid);
  const n = F.mul(F.mul(two(F), two(F)), vDot(F, g, g));
  const gap = m.sign === 1 ? F.neg(value) : value;
  const s = signNormalized(F, gap, n, 'length', ctx);
  if (s === -1) return undef(missing);
  return s === 1 ? 2 : 1;
}

/** The parameter of the other common point of the carrier with the conic, given P on both (Vieta). */
function vieta<T>(
  F: Field<T>,
  q: Coeffs<T>,
  l: Line<T>,
  P: Vec<T>,
  ctx: EvalContext,
): { readonly t: T } | Undefined {
  const { alpha, beta } = quadratic(F, q, l.p, l.d);
  const dd = vDot(F, l.d, l.d);
  const sa = scaledSign(F, alpha, F.mul(dd, dd), q, ctx);
  if (sa === 'ambiguous')
    return undef('ambiguous: the line is within the band of an asymptotic direction of the conic');
  if (sa === 0 || F.eq(alpha, F.zero))
    return undef('the other intersection is at infinity (the line has an asymptotic direction)');
  return { t: F.sub(F.neg(F.div(beta, alpha)), paramOn(F, l, P)) };
}

/**
 * Line ∩ conic (either order: `lineFirst`). Degenerate cases: a line with no direction or an
 * invalid conic → Undefined; see the module comment for the rest.
 */
export function lineConicPair<T>(
  F: Field<T>,
  l: Line<T>,
  k: Conic<T>,
  ctx: EvalContext,
  lineFirst: boolean,
): Pair<T> | Undefined {
  const bad = degenerateLine(F, l, ctx) ?? conicProblem(F, k, ctx);
  if (bad !== undefined) return bad.kind === 'inexact' ? undef(bad.reason) : bad;
  const q = coeffsOf(k);
  const m = meet(F, q, l.p, l.d, ctx);
  const curves: [Curve<T>, Curve<T>] = [
    { obj: l, name: 'the line' },
    { obj: k, name: 'the conic' },
  ];
  return {
    shape: LINE_CONIC,
    noun: 'intersection',
    low: { kind: 'along', d: l.d },
    ranged: l.lo !== null || l.hi !== null,
    count: () => {
      if (m.kind === 'undefined') return m;
      if (m.kind === 'one') return 1;
      return countTwo(F, q, m, ctx, 'no intersection: the line misses the conic');
    },
    list: (n) => {
      if (m.kind === 'undefined') return m;
      const list: Cand<T>[] | Inexact =
        m.kind === 'one' ? [{ at: m.at, side: 0 }] : midOff(F, n, m.mid, m.rad, l.d, false);
      return isInexact(list) ? list : onRange(F, l, list, ctx);
    },
    other: {
      curves: lineFirst ? curves : [curves[1], curves[0]],
      point: (P) => {
        const v = vieta(F, q, l, P, ctx);
        if ('kind' in v) return v;
        const r = rangeStatus(F, l, v.t, ctx, 'other intersection');
        if (r === 'out') return outsideReason(l, 'other intersection');
        if (r !== 'in') return r;
        return vAdd(F, l.p, vScale(F, l.d, v.t));
      },
    },
    output: asPoint,
  };
}

/** The tangent line of the conic at T: through T, direction rot90(−g(T)) (chiral). */
export function conicTangentAt<T>(F: Field<T>, k: Conic<T>, T0: Vec<T>): Line<T> {
  const g = halfGradient(F, coeffsOf(k), T0);
  const p = { x: T0.x, y: T0.y };
  return {
    kind: 'line',
    p,
    d: vRot90(F, vScale(F, g, F.neg(F.one))),
    lo: null,
    hi: null,
    chiral: true,
  };
}

/**
 * The polar of P (P not the centre: g(P) ≠ 0): through the foot of P on it, P − Q(P)/|g|²·g,
 * with direction rot90(−g) (chiral, a quarter turn; for a circle the direction of polar(P, c)).
 */
export function conicPolarLine<T>(F: Field<T>, k: Conic<T>, P: Vec<T>): Line<T> {
  const [gx, gy, h] = polarCovector(F, coeffsOf(k), P);
  const g = { x: gx, y: gy };
  const value = F.add(vDot(F, g, P), h);
  const foot = vSub(F, P, vScale(F, g, F.div(value, vDot(F, g, g))));
  return {
    kind: 'line',
    p: foot,
    d: vRot90(F, vScale(F, g, F.neg(F.one))),
    lo: null,
    hi: null,
    chiral: true,
  };
}

/**
 * Whether P is the centre of the conic: g(P) = 0, decided as the length |g|/(a² + 2b² + c²)^{1/4}
 * (|P − C| for a circle up to a constant; exact fields: g = 0 exactly).
 */
export function isConicCentre<T>(F: Field<T>, k: Conic<T>, P: Vec<T>, ctx: EvalContext): boolean {
  const q = coeffsOf(k);
  const g = halfGradient(F, q, P);
  const gg = vDot(F, g, g);
  const r = F.sqrt(quadNorm(F, q));
  if (isInexact(r)) return F.eq(g.x, F.zero) && F.eq(g.y, F.zero);
  const len = F.sqrt(F.div(gg, r));
  return isInexact(len) ? F.eq(gg, F.zero) : F.isZero(len, 'length', ctx);
}

export type TangentOutput = 'tangent_point' | 'tangent_from';

/**
 * The touch points of the tangents from P to k as a Pair (module comment). Degenerate cases:
 * an invalid conic → Undefined; P the centre → Undefined; no real tangent (the polar misses the
 * conic) → Undefined; P on k → the double point P; P on an asymptote (the polar has an
 * asymptotic direction) → Undefined (one touch point is at infinity), within the band:
 * ambiguous.
 */
export function conicTangentPair<T>(
  F: Field<T>,
  P: Vec<T>,
  k: Conic<T>,
  ctx: EvalContext,
  tool: TangentOutput,
  shape: BranchShape,
): Pair<T> | Undefined {
  const bad = conicProblem(F, k, ctx);
  if (bad !== undefined) return bad.kind === 'inexact' ? undef(bad.reason) : bad;
  const none = `${tool}(P, k): no tangent from P to the conic`;
  if (isConicCentre(F, k, P, ctx)) return undef(`${none} (P is its center)`);
  const q = coeffsOf(k);
  const polar = conicPolarLine(F, k, P);
  const m = meet(F, q, polar.p, polar.d, ctx);
  if (m.kind === 'one')
    return undef(`${tool}(P, k): P lies on an asymptote, so one touch point is at infinity`);
  if (m.kind === 'undefined')
    return m.reason.startsWith('ambiguous')
      ? m
      : undef(`${tool}(P, k): P lies on an asymptote, so one touch point is at infinity`);
  const qp = qValue(F, q, P);
  const flip = F.kind !== 'modp' && F.toNumber(qp) > 0;
  return {
    shape,
    noun: tool === 'tangent_point' ? 'touch point' : 'tangent',
    low: { kind: 'orient', from: P, to: m.mid },
    count: () => countTwo(F, q, m, ctx, `${none} (P is inside it)`),
    list: (n) => midOff(F, n, m.mid, m.rad, polar.d, flip),
    other: {
      curves: [
        { obj: k, name: 'the conic' },
        { obj: polar, name: 'the polar of P (the chord of contact)' },
      ],
      point: (X) => {
        const v = vieta(F, q, polar, X, ctx);
        return 'kind' in v ? v : vAdd(F, polar.p, vScale(F, polar.d, v.t));
      },
    },
    output: (X): Value<T> => (tool === 'tangent_point' ? asPoint(X) : conicTangentAt(F, k, X)),
  };
}
