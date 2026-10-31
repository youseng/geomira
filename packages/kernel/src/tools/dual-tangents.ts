/**
 * Common tangents when a conic is among the two curves (internal; ADR-0045): the dual problem of
 * ADR-0043's conic ∩ conic. The tangent lines of a conic with matrix M are the points of its dual
 * conic adj(M) (a line ℓ is tangent iff ℓᵀ·adj(M)·ℓ = 0), so the common tangents are the common
 * points of the two duals, found by the pencil (conic-pencil.ts, unchanged), then mapped back.
 *   - Frame: x′ = (x − o)/L with L = ctx.scale and o a point no tangent of the first curve passes
 *     through: a circle's centre, else a focus of the conic (its only real tangents are none: the
 *     tangents from a focus are the isotropic lines), else an ellipse's centre. A line
 *     u·x′ + v·y′ + 1 = 0 is the dual point (u, v), so no common tangent is at infinity in the
 *     dual chart; the dual of the first curve is bounded (about a focus it is a circle).
 *   - The duals' common points are decided by the pencil in the dual chart with scale 1 (a dual
 *     length of BAND is a turn of BAND radians or a shift of BAND·L of a line at distance L), so
 *     a double common tangent (two curves that touch) merges with the band, as conic ∩ conic
 *     merges a double point.
 *   - Back: the line at infinity (|(u, v)| within EPS; a common tangent of two parabolas) is not a
 *     candidate, near it (within the band) → Undefined (ambiguous); the touch point on the first
 *     curve is the pole of the line, adj(M₁)·ℓ, not a candidate when it is at infinity (the line
 *     is an asymptote of the first curve), Undefined near infinity.
 * Over Q and mod p the common tangents are roots of a quartic: Inexact, never approximated.
 */
import { inexact, isInexact, type Field, type Inexact } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { fromNumber } from '@geomira/num/rational';
import { BAND, EPS } from '@geomira/num/tolerance';
import { circleCoeffs, coeffsOf, conicProblem, halfGradient, homCentre, qValue } from '../conic';
import type { Coeffs } from '../conic';
import { pencilPoints } from '../conic-pencil';
import type { EvalContext } from '../tool';
import { adj3, type Mat3 } from '../transform/projective';
import { undef, type Conic, type Undefined, type Value, type Vec } from '../value';
import { degenerateCircle } from './args';
import {
  COMMON_SHAPES,
  circleTangentsPair,
  onTheArcs,
  outputOf,
  toCount,
  type Curve2,
  type TangentOut,
} from './common-tangents';
import { FOCI_TOOLS } from './foci';
import type { Cand, Pair } from './pairs';

type N = number;

function num6<T>(F: Field<T>, q: Coeffs<T>): Coeffs<N> {
  const [a, b, c, d, e, f] = q.map((v) => F.toNumber(v));
  return [a ?? 0, b ?? 0, c ?? 0, d ?? 0, e ?? 0, f ?? 0];
}

function coeffsOfCurve<T>(F: Field<T>, k: Curve2<T>): Coeffs<T> {
  return k.kind === 'conic' ? coeffsOf(k) : circleCoeffs(F, k);
}

/** The matrix of q in the frame X = o + L·x′. */
function frameMatrix(q: Coeffs<N>, o: Vec<N>, L: N): Mat3<N> {
  const g = halfGradient(FloatField, q, o);
  const [a, b, c] = [q[0] * L * L, q[1] * L * L, q[2] * L * L];
  const [d, e, f] = [g.x * L, g.y * L, qValue(FloatField, q, o)];
  return [a, b, d, b, c, e, d, e, f];
}

/** A point no tangent of k passes through (module comment), or why there is none. */
function innerPoint(k: Curve2<N>, ctx: EvalContext): Vec<N> | string {
  if (k.kind === 'circle') return k.c;
  const spec = FOCI_TOOLS[0];
  const f = spec?.candidates?.(FloatField, [k], ctx)[0];
  if (f?.kind === 'point') return f;
  const h = homCentre(FloatField, coeffsOf(k));
  if (h[2] > 0 && Number.isFinite(h[0] / h[2])) return { x: h[0] / h[2], y: h[1] / h[2] };
  return 'ambiguous: the conic is within the band of a parabola';
}

/** The first curve as numbers (FloatField values: no rounding). */
function asNumbers<T>(F: Field<T>, k: Curve2<T>): Curve2<N> {
  const n = (x: T) => F.toNumber(x);
  if (k.kind === 'circle')
    return { kind: 'circle', c: { x: n(k.c.x), y: n(k.c.y) }, r2: n(k.r2), arc: null };
  const [a, b, c, d, e, f] = num6(F, coeffsOf(k));
  const out: Conic<N> = { kind: 'conic', a, b, c, d, e, f };
  return out;
}

/** The pencil's reasons, read in the dual. */
function dualReason(why: string): string {
  switch (why) {
    case 'the conics coincide':
      return 'the curves coincide: every tangent is common';
    case 'ambiguous: the conics nearly coincide':
      return 'ambiguous: the curves nearly coincide';
    case 'ambiguous: a common point is near infinity':
      return 'ambiguous: a common tangent passes near the frame origin';
    default:
      return `common tangents: ${why}`;
  }
}

/** The world touch points on the first curve of the common tangents (floats), or why none. */
function touchPoints(a: Curve2<N>, b: Curve2<N>, ctx: EvalContext): Vec<N>[] | string {
  const o = innerPoint(a, ctx);
  if (typeof o === 'string') return o;
  const L = ctx.scale;
  const frame = (k: Curve2<N>) => frameMatrix(coeffsOfCurve(FloatField, k), o, L);
  const [m1, m2] = [frame(a), frame(b)];
  const [A1, A2] = [adj3(FloatField, m1), adj3(FloatField, m2)];
  const dual = (m: Mat3<N>): Coeffs<N> => [m[0], m[1], m[4], m[2], m[5], m[8]];
  const r = pencilPoints({ q1: dual(A1), q2: dual(A2), o: { x: 0, y: 0 }, ctx: { scale: 1 } });
  if (r.kind === 'undefined') return dualReason(r.reason);
  const out: Vec<N>[] = [];
  for (const p of r.points) {
    const [u, v] = [p.at.x, p.at.y];
    const n = Math.hypot(u, v);
    if (!(n > EPS)) continue;
    if (!(n > BAND)) return 'ambiguous: a common tangent is near the line at infinity';
    // The pole of ℓ = (u, v, 1) for the first curve: adj(M₁)·ℓ (M₁ is invertible).
    const [t0, t1, t2] = [0, 1, 2].map((i) => row(A1, i, u, v));
    if (t0 === undefined || t1 === undefined || t2 === undefined) continue;
    if (!(Math.hypot(t0, t1) * EPS < Math.abs(t2))) continue;
    if (!(Math.hypot(t0, t1) * BAND < Math.abs(t2)))
      return 'ambiguous: a common tangent touches the first curve near infinity';
    out.push({ x: o.x + (L * t0) / t2, y: o.y + (L * t1) / t2 });
  }
  return out;
}

/** Row i of adj(M₁)·(u, v, 1). */
function row(A: Mat3<N>, i: number, u: N, v: N): N {
  return (A[3 * i] ?? 0) * u + (A[3 * i + 1] ?? 0) * v + (A[3 * i + 2] ?? 0);
}

/** Why a curve is not valid, or undefined. */
function invalid<T>(F: Field<T>, k: Curve2<T>, ctx: EvalContext): Undefined | undefined {
  if (k.kind === 'circle') return degenerateCircle(F, k, ctx);
  const bad = conicProblem(F, k, ctx);
  return bad === undefined ? undefined : undef(bad.reason);
}

function quartic(name: string): Inexact {
  return inexact(
    `the common tangents of two conics are roots of a quartic, not representable in ${name}`,
  );
}

/**
 * The common tangents of a conic and a conic or a circle (either order). Degenerate cases: an
 * invalid curve → Undefined; the curves coincide → Undefined (nearly: ambiguous); no common
 * tangent → Undefined; two curves that touch → their common tangent there, a double candidate; the
 * line at infinity (two parabolas) and an asymptote of the first curve are not candidates (near
 * them: ambiguous); over Q and mod p → Inexact.
 */
export function dualTangentsPair<T>(
  F: Field<T>,
  a: Curve2<T>,
  b: Curve2<T>,
  ctx: EvalContext,
  out: TangentOut,
): Pair<T> | Undefined {
  const bad = invalid(F, a, ctx) ?? invalid(F, b, ctx);
  if (bad !== undefined) return bad;
  let memo: readonly Cand<T>[] | Undefined | Inexact | undefined;
  const cands = (): readonly Cand<T>[] | Undefined | Inexact => {
    if (F.kind !== 'float') return quartic(F.name);
    const pts = touchPoints(asNumbers(F, a), asNumbers(F, b), ctx);
    if (typeof pts === 'string') return undef(pts);
    const list: Cand<T>[] = [];
    for (const p of pts) {
      const [x, y] = [F.fromRational(fromNumber(p.x)), F.fromRational(fromNumber(p.y))];
      if (isInexact(x)) return x;
      if (isInexact(y)) return y;
      list.push({ at: { x, y }, side: 0 });
    }
    return list;
  };
  const get = () => (memo ??= cands());
  return {
    shape: out === 'line' ? COMMON_SHAPES.line.conics : COMMON_SHAPES.point.conics,
    noun: out === 'line' ? 'common tangent' : 'touch point',
    low: { kind: 'none' },
    ranged: [a, b].some((k) => k.kind === 'circle' && k.arc !== null),
    count: () => {
      const c = get();
      if ('kind' in c) return c;
      return c.length === 0 ? undef('no common tangent') : toCount(c.length);
    },
    list: () => {
      const c = get();
      return 'kind' in c ? c : onTheArcs(F, [a, b], c, ctx);
    },
    output: (X) => outputOf(F, a, X, out),
  };
}

/**
 * The common-tangent pair of a call with two curves (circles closed form, else the dual), or
 * 'bad' when the arguments are not two curves (another overload of the tool).
 */
export function commonTangentPair<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  out: TangentOut,
): Pair<T> | Undefined | 'bad' {
  const [a, b] = args;
  const curve = (v: Value<T> | undefined): v is Curve2<T> =>
    v?.kind === 'circle' || v?.kind === 'conic';
  if (args.length !== 2 || !curve(a) || !curve(b)) return 'bad';
  if (a.kind === 'circle' && b.kind === 'circle') return circleTangentsPair(F, a, b, ctx, out);
  return dualTangentsPair(F, a, b, ctx, out);
}
