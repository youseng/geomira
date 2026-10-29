/**
 * A projective map on a line, segment, ray or pair of rays (ADR-0040 decision 9). With
 * P = M·(p, 1) and D = M·(d, 0), the image line has the covector (a, b, c) = P × D; its direction
 * is N = (b, −a) = D_xy·P_w − P_xy·D_w, the direction of the derivative of t ↦ f(p + t·d) at
 * every t (it is N/W(t)²), and its base point the foot of the origin −c·(a, b)/(a² + b²). The
 * image of p + t·d is base + σ(t)·N with σ(t) = (X(t)·N)/(W(t)|N|²), X(t) = P_xy + t·D_xy,
 * W(t) = P_w + t·D_w: increasing on each side of t₀ (where the line meets ℓ, the line sent to
 * infinity), σ(t₀) = ∞, σ(∞) = (D_xy·N)/(D_w|N|²) (∞ when the line is parallel to ℓ). A range,
 * as an arc of the projective parameter line (proj-range.ts), maps to (σ(start), σ(end)),
 * through ∞ exactly when t₀ lies strictly inside it. Degenerate cases:
 *   - the line is ℓ (p on ℓ and d parallel to it) → Undefined (sent to infinity); within the
 *     band of that → Undefined (ambiguous);
 *   - an end of a range within the band of ℓ, or (for an end at ∞) a direction within the band
 *     of parallel to ℓ → Undefined (ambiguous);
 *   - mod p: a range (not a full line) → Inexact (no order);
 *   - an intermediate beyond the double range (floats) → Inexact.
 * Chirality: kept (N is the image of d by the derivative).
 */
import { isInexact, type Field, type Inexact } from '@geomira/num/field';
import { fromNumber } from '@geomira/num/rational';
import { vAdd, vDot, vScale } from '../geom';
import type { EvalContext } from '../tool';
import { undef, type Line, type Undefined, type Value, type Vec } from '../value';
import { projRange, rangeFields, type End, type RangeFields } from './proj-range';
import { homOf, mulHom, type Hom, type Mat3 } from './projective';
import {
  BEYOND,
  directionSide,
  finiteIn,
  noOrderProj,
  onInfinityLine,
  positionSide,
  wOf,
  NEAR_INFINITY,
  type WSide,
} from './proj-side';

const SENT = 'apply: the line is sent to infinity (the line at infinity is not an object)';

interface Frame<T> {
  readonly P: Hom<T>;
  readonly D: Hom<T>;
  readonly N: Vec<T>;
  readonly NN: T;
}

/**
 * The frame with N scaled by a power of two k (NN by k²) so that |N| is within a factor √2 of
 * the figure's scale, as line(A, B)'s direction is: the range is decided on σ as a
 * dimensionless number (range.ts), and P × D has an arbitrary length (Run 16c audit: about 10⁴
 * at figure size 5). Every image point base + σ·N is unchanged (σ scales by 1/k); exact in
 * floats and over Q. Mod p (no order, no range decisions) and a length that is not a finite
 * positive double: unchanged. Only a range is scaled: a full line has no range decision, and
 * its mod p value must reduce the exact one coefficient by coefficient (L3).
 */
function atScale<T>(F: Field<T>, f: Frame<T>, ctx: EvalContext): Frame<T> {
  if (F.kind === 'modp') return f;
  const n = Math.sqrt(F.toNumber(f.NN));
  const k2 = 2 ** Math.round(Math.log2(ctx.scale / n));
  if (!(n > 0) || !Number.isFinite(k2) || !(k2 > 0)) return f;
  const k = F.fromRational(fromNumber(k2));
  if (isInexact(k)) return f;
  return { ...f, N: vScale(F, f.N, k), NN: F.mul(f.NN, F.mul(k, k)) };
}

/** σ(t) for a finite t off ℓ. */
function sigma<T>(F: Field<T>, f: Frame<T>, t: T): T {
  const x = { x: F.add(f.P[0], F.mul(t, f.D[0])), y: F.add(f.P[1], F.mul(t, f.D[1])) };
  const w = F.add(f.P[2], F.mul(t, f.D[2]));
  return F.div(vDot(F, x, f.N), F.mul(w, f.NN));
}

/** Where a finite end lies relative to ℓ, and its image parameter (∞ when it is on ℓ). */
function mapFinite<T>(
  F: Field<T>,
  m: Mat3<T>,
  l: Line<T>,
  f: Frame<T>,
  t: T,
  ctx: EvalContext,
): { end: End<T>; side: 1 | -1 | 0 } | Undefined | Inexact {
  const s: WSide = positionSide(F, m, vAdd(F, l.p, vScale(F, l.d, t)), ctx);
  if (typeof s !== 'number') return s;
  return { end: s === 0 ? 'inf' : { at: sigma(F, f, t) }, side: s };
}

/**
 * Whether t₀ lies strictly inside the arc, from the sides of W at its finite ends and, for an
 * end at ∞, the sign sD of W(d) (0: the line is parallel to ℓ, t₀ = ∞).
 */
function containsT0(
  start: 1 | -1 | 0 | 'inf',
  end: 1 | -1 | 0 | 'inf',
  sD: 1 | -1 | 0,
  outside: boolean,
): boolean {
  if (outside) return start !== 0 && end !== 0 && start === end;
  if (start === 'inf') return end !== 'inf' && end !== 0 && end === sD;
  if (end === 'inf') return start !== 0 && start === -sD;
  return start !== 0 && end !== 0 && start !== end;
}

function rangeImage<T>(
  F: Field<T>,
  m: Mat3<T>,
  l: Line<T>,
  f: Frame<T>,
  ctx: EvalContext,
): RangeFields<T> | Undefined | Inexact {
  const r = projRange(l);
  if (r === 'full') return { lo: null, hi: null };
  if (F.kind === 'modp') return noOrderProj(F, 'a range');
  const hasInf = r.start === 'inf' || r.end === 'inf';
  const ds = hasInf ? directionSide(F, m, l.d, ctx) : 0;
  if (ds === 'none') return noOrderProj(F, 'a range');
  if (typeof ds === 'object') return ds;
  const sD: 1 | -1 | 0 = ds === 'parallel' ? 0 : ds;
  const atInf: End<T> =
    sD === 0 ? 'inf' : { at: F.div(vDot(F, homXY(f.D), f.N), F.mul(f.D[2], f.NN)) };
  const one = (e: End<T>) =>
    e === 'inf' ? { end: atInf, side: 'inf' as const } : mapFinite(F, m, l, f, e.at, ctx);
  const [s, e] = [one(r.start), one(r.end)];
  if ('kind' in s) return s;
  if ('kind' in e) return e;
  return rangeFields(s.end, e.end, containsT0(s.side, e.side, sD, l.outside === true));
}

function homXY<T>(h: Hom<T>): Vec<T> {
  return { x: h[0], y: h[1] };
}

/** The image of a line value under the projective matrix m (valid). */
export function projLine<T>(
  F: Field<T>,
  m: Mat3<T>,
  l: Line<T>,
  ctx: EvalContext,
): Value<T> | Inexact {
  const [P, D] = [mulHom(F, m, homOf(F, l.p, true)), mulHom(F, m, homOf(F, l.d, false))];
  if (!finiteIn(F, [...P, ...D, wOf(F, m, l.p, true)])) return BEYOND;
  const onP = onInfinityLine(F, m, l.p, ctx);
  const par = directionSide(F, m, l.d, ctx);
  if (onP === 'on' && par === 'parallel') return undef(SENT);
  if (onP !== 'off' && typeof par === 'object') return undef(NEAR_INFINITY);
  if (typeof onP === 'object' && par === 'parallel') return undef(NEAR_INFINITY);
  const a = F.sub(F.mul(P[1], D[2]), F.mul(P[2], D[1]));
  const b = F.sub(F.mul(P[2], D[0]), F.mul(P[0], D[2]));
  const c = F.sub(F.mul(P[0], D[1]), F.mul(P[1], D[0]));
  const NN = F.add(F.mul(a, a), F.mul(b, b));
  if (!finiteIn(F, [a, b, c, NN]) || F.eq(NN, F.zero)) return BEYOND;
  const base = vScale(F, { x: a, y: b }, F.div(F.neg(c), NN));
  const raw = { P, D, N: { x: b, y: F.neg(a) }, NN };
  const frame = projRange(l) === 'full' ? raw : atScale(F, raw, ctx);
  const N = frame.N;
  const r = rangeImage(F, m, l, frame, ctx);
  if ('kind' in r) return r;
  const line: Line<T> = { kind: 'line', p: base, d: N, lo: null, hi: null, chiral: l.chiral };
  return { ...line, ...r };
}
