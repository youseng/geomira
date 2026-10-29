/**
 * The filters of branch selection (internal; SPEC §7, ADR-0006; select.ts applies them):
 * same_side(Q, l), opposite_side(Q, l), on_arc(B, C, [not] A), between(A, B), inside(c),
 * outside(c). Each keeps the candidates that satisfy it; a deciding quantity within the band →
 * Undefined (ambiguous); a sign mod p → Inexact.
 */
import { inexact, type Field, type FieldSign, type Inexact } from '@geomira/num/field';
import { isZeroVec, signNormalized, vCross, vDot, vSub } from './geom';
import { circleGap } from './incidence';
import type { EvaluatedSelector } from './selector';
import type { EvalContext } from './tool';
import { degenerateCircle, degenerateLine } from './tools/args';
import type { Cand } from './tools/pairs';
import { undef, type Line, type Undefined, type Vec } from './value';

type List<T> = readonly Cand<T>[];
type Result<T> = List<T> | Undefined | Inexact;
type Verdict = boolean | Undefined | Inexact;

/** Inexact: the selector needs an order (mod p). */
export function noOrder<T>(F: Field<T>, s: EvaluatedSelector<T>): Inexact {
  return inexact(`${s.text} needs an order, which ${F.name} lacks`);
}

function keepIf<T>(list: List<T>, keep: (X: Vec<T>) => Verdict): Result<T> {
  const out: Cand<T>[] = [];
  for (const c of list) {
    const k = keep(c.at);
    if (typeof k !== 'boolean') return k;
    if (k) out.push(c);
  }
  return out;
}

/** The side of X with respect to l: the signed distance cross(X − p, d)/|d|, banded. */
function sideOf<T>(F: Field<T>, X: Vec<T>, l: Line<T>, ctx: EvalContext): FieldSign {
  return signNormalized(F, vCross(F, vSub(F, X, l.p), l.d), vDot(F, l.d, l.d), 'length', ctx);
}

/**
 * Keeps the candidates on Q's side of l (`same`) or on the other side. Degenerate cases: Q
 * on l → Undefined, within the band → ambiguous; a candidate on l or within its band →
 * ambiguous; mod p → Inexact.
 */
function sides<T>(
  F: Field<T>,
  s: EvaluatedSelector<T>,
  list: List<T>,
  ctx: EvalContext,
  Q: Vec<T>,
  l: Line<T>,
  same: boolean,
): Result<T> {
  const sq = sideOf(F, Q, l, ctx);
  if (sq === 'none') return noOrder(F, s);
  if (sq === 0) return undef(`${s.text}: the reference point lies on the line`);
  if (sq === 'ambiguous') {
    return undef(`ambiguous: ${s.text}: the reference point is within the band of the line`);
  }
  return keepIf(list, (X) => {
    const sx = sideOf(F, X, l, ctx);
    if (sx === 'none') return noOrder(F, s);
    if (sx === 0 || sx === 'ambiguous') {
      return undef(`ambiguous: ${s.text}: a candidate is within the band of the line`);
    }
    return same === (sx === sq);
  });
}

export function sideFilter<T>(
  F: Field<T>,
  s: EvaluatedSelector<T>,
  list: List<T>,
  ctx: EvalContext,
  same: boolean,
): Result<T> {
  const [Q, l] = s.args;
  if (Q?.kind !== 'point' || l?.kind !== 'line') return undef(`${s.text} needs a point and a line`);
  return degenerateLine(F, l, ctx) ?? sides(F, s, list, ctx, Q, l, same);
}

/** on_arc(B, C, [not] A): A's side of line BC (`not`: the other side). Degenerate: B = C. */
export function arcFilter<T>(
  F: Field<T>,
  s: EvaluatedSelector<T>,
  list: List<T>,
  ctx: EvalContext,
): Result<T> {
  const [B, C, A] = s.args;
  if (B?.kind !== 'point' || C?.kind !== 'point' || A?.kind !== 'point') {
    return undef(`${s.text} needs three points`);
  }
  const d = vSub(F, C, B);
  if (isZeroVec(F, d, ctx)) return undef(`${s.text} needs two distinct ends B ≠ C`);
  const bc: Line<T> = { kind: 'line', p: B, d, lo: null, hi: null, chiral: false };
  return sides(F, s, list, ctx, A, bc, !(s.selector.kind === 'on_arc' && s.selector.not));
}

/**
 * between(A, B): strictly between the perpendiculars to AB at A and at B (on segment AB
 * for a candidate on line AB). Degenerate cases: A = B → Undefined; a candidate within
 * the band of an end → ambiguous; mod p → Inexact.
 */
export function betweenFilter<T>(
  F: Field<T>,
  s: EvaluatedSelector<T>,
  list: List<T>,
  ctx: EvalContext,
): Result<T> {
  const [A, B] = s.args;
  if (A?.kind !== 'point' || B?.kind !== 'point') return undef(`${s.text} needs two points`);
  const u = vSub(F, B, A);
  if (isZeroVec(F, u, ctx)) return undef(`${s.text} needs two distinct points`);
  const uu = vDot(F, u, u);
  return keepIf(list, (X) => {
    const a = signNormalized(F, vDot(F, vSub(F, X, A), u), uu, 'length', ctx);
    const b = signNormalized(F, vDot(F, vSub(F, B, X), u), uu, 'length', ctx);
    if (a === 'none' || b === 'none') return noOrder(F, s);
    if (a === -1 || b === -1) return false;
    if (a === 1 && b === 1) return true;
    return undef(`ambiguous: ${s.text}: a candidate is within the band of an end`);
  });
}

/** inside(c) / outside(c). Degenerate: a candidate on c or within its band → ambiguous. */
export function discFilter<T>(
  F: Field<T>,
  s: EvaluatedSelector<T>,
  list: List<T>,
  ctx: EvalContext,
  inside: boolean,
): Result<T> {
  const c = s.args[0];
  if (c?.kind !== 'circle') return undef(`${s.text} needs a circle`);
  const bad = degenerateCircle(F, c, ctx);
  if (bad !== undefined) return bad;
  return keepIf(list, (X) => {
    const g = F.sign(circleGap(F, X, c), 'length', ctx);
    if (g === 'none') return noOrder(F, s);
    if (g === 0 || g === 'ambiguous') {
      return undef(`ambiguous: ${s.text}: a candidate is within the band of the circle`);
    }
    return inside === (g === -1);
  });
}
