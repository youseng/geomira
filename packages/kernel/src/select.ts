/**
 * Branch selection (internal; SPEC §7, ADR-0006): applies a call's selectors, IN ORDER, to
 * the candidates of a Pair (tools/pairs.ts) and returns the single survivor.
 *   - Filters keep the candidates that satisfy them: same_side(Q, l), opposite_side(Q, l),
 *     on_arc(B, C, [not] A) (A's side of line BC, i.e. the arc BC that contains A, for
 *     points of one circle through B and C), between(A, B) (strictly between the
 *     perpendiculars at A and B), inside(c), outside(c).
 *   - Rankers keep the best of two: near(P), far_from(P); other(P) keeps the candidates
 *     other than P: P must lie on both objects (the banded incidence of incidence.ts), and
 *     the other point is computed WITHOUT square roots (Vieta / reflection, exact in every
 *     field, as the other() tool); if it lies within the band of P it is the double point.
 *   - Low-level: along(±) and orient(±) keep the candidates labelled with their sign, and
 *     the double point (label 0) under both signs. A label names a BRANCH of the pair (the
 *     further of the carrier line's two intersections, the positive side of the line of
 *     centres…), not a rank among survivors: if that branch was removed (off a segment, by
 *     a filter), nothing satisfies the selector; the other branch is never substituted.
 * Rules: a deciding quantity within the band → Undefined("ambiguous: …"); zero survivors →
 * Undefined("no … satisfies …"); two survivors → Undefined("ambiguous: add a selector");
 * a sign-based decision mod p (no order) → Inexact.
 */
import { assertNever } from '@geomira/num/assert';
import { inexact, isInexact, type Field, type FieldSign, type Inexact } from '@geomira/num/field';
import { isZeroVec, signNormalized, vCross, vDot, vSub } from './geom';
import { circleGap, requireOnCircle, requireOnLine, rootGap } from './incidence';
import type { EvaluatedSelector } from './selector';
import type { EvalContext } from './tool';
import { degenerateCircle, degenerateLine } from './tools/args';
import type { Cand, Pair, Side } from './tools/pairs';
import { undef, type Line, type Undefined, type Value, type Vec } from './value';

type List<T> = readonly Cand<T>[];
type Result<T> = List<T> | Undefined | Inexact;
type Verdict = boolean | Undefined | Inexact;

/** The message of a call with two candidates and no selector that singles one out. */
function addSelector<T>(pair: Pair<T>): string {
  const low = pair.shape.low === 'none' ? '' : ` or ${pair.shape.low}(±)`;
  return (
    `ambiguous: add a selector: ${pair.shape.describe} has two ${pair.noun}s ` +
    `(for example other(P), near(P), same_side(Q, l)${low})`
  );
}

function noOrder<T>(F: Field<T>, s: EvaluatedSelector<T>): Inexact {
  return inexact(`${s.text} needs an order, which ${F.name} lacks`);
}

/**
 * Selectors that do not apply to this pair, whatever its candidates: along(±) / orient(±)
 * on a pair with another low-level selector, other(P) on two lines, other twice.
 */
function misused<T>(pair: Pair<T>, sels: readonly EvaluatedSelector<T>[]): Undefined | undefined {
  const { shape } = pair;
  for (const s of sels) {
    const k = s.selector.kind;
    if ((k === 'along' || k === 'orient') && shape.low !== k) {
      const use = shape.low === 'none' ? '' : `: use ${shape.low}(±)`;
      return undef(`${s.text} does not apply to ${shape.describe}${use}`);
    }
    if (k === 'other' && (!shape.other || pair.other === undefined)) {
      return undef(`${s.text} does not apply to ${shape.describe}: they meet only once`);
    }
  }
  if (sels.filter((s) => s.selector.kind === 'other').length > 1) {
    return undef('other(·) may appear only once in a call');
  }
  return undefined;
}

/** Whether X and P coincide as a decision: |X − P| zero or within the band (a length). */
function coincide<T>(F: Field<T>, X: Vec<T>, P: Vec<T>, ctx: EvalContext): boolean {
  const w = vSub(F, X, P);
  const n = F.sqrt(vDot(F, w, w));
  if (isInexact(n)) return isZeroVec(F, w, ctx);
  const s = F.sign(n, 'length', ctx);
  return s === 0 || s === 'ambiguous';
}

/**
 * The candidates other than P (first other(P) of the call): P on both curves, the other
 * point by the pair's Vieta map, range-checked; the double point when it is within the band of P or the
 * pair counts one candidate.
 */
function viaOther<T>(
  F: Field<T>,
  pair: Pair<T>,
  s: EvaluatedSelector<T>,
  ctx: EvalContext,
): Result<T> {
  const [P, other] = [s.args[0], pair.other];
  if (P?.kind !== 'point') return undef(`${s.text} needs a point`);
  if (other === undefined) return undef(`${s.text} does not apply to ${pair.shape.describe}`);
  const n = pair.count();
  if (typeof n !== 'number') return n;
  for (const c of other.curves) {
    const what = `${s.text} needs the point on ${c.name}`;
    const bad =
      c.obj.kind === 'line'
        ? requireOnLine(F, P, c.obj, ctx, what)
        : requireOnCircle(F, P, c.obj, ctx, what);
    if (bad !== undefined) return bad;
  }
  const X = other.point(P);
  if ('kind' in X) return X;
  return [
    n === 1 || coincide(F, X, P, ctx) ? { at: X, side: 0 } : { at: X, side: 'measure', from: P },
  ];
}

/** The candidates by the discriminant; two and no selector → ambiguous before any root. */
function bySquareRoots<T>(pair: Pair<T>, selectors: number): Result<T> {
  const n = pair.count();
  if (typeof n !== 'number') return n;
  if (n === 2 && selectors === 0 && pair.ranged !== true) return undef(addSelector(pair));
  return pair.list(n);
}

/**
 * The value a branchable call selects. Degenerate cases: see the module comment; the
 * pair's own (no intersection, P inside c, concentric circles, Inexact roots).
 */
export function choose<T>(
  F: Field<T>,
  pair: Pair<T>,
  sels: readonly EvaluatedSelector<T>[],
  ctx: EvalContext,
): Value<T> {
  const bad = misused(pair, sels);
  if (bad !== undefined) return bad;
  const first = sels.find((s) => s.selector.kind === 'other');
  let list = first === undefined ? bySquareRoots(pair, sels.length) : viaOther(F, pair, first, ctx);
  for (const s of sels) {
    if ('kind' in list) return list;
    list = apply(F, pair, s, list, ctx);
  }
  if ('kind' in list) return list;
  const texts = sels.map((s) => s.text).join(', ');
  const [only, second] = list;
  if (only === undefined) return undef(`no ${pair.noun} satisfies ${texts}`);
  if (second !== undefined) {
    return undef(
      sels.length === 0
        ? addSelector(pair)
        : `ambiguous: add a selector: both ${pair.noun}s satisfy ${texts}`,
    );
  }
  return pair.output(only.at);
}

/** The values a branchable call can select (ToolSpec.candidates). */
export function candidateValues<T>(pair: Pair<T>): readonly Value<T>[] {
  const n = pair.count();
  if (typeof n !== 'number') return [];
  const list = pair.list(n);
  if (isInexact(list)) return n === 1 ? [list] : [list, list];
  return 'kind' in list ? [] : list.map((c) => pair.output(c.at));
}

function apply<T>(
  F: Field<T>,
  pair: Pair<T>,
  s: EvaluatedSelector<T>,
  list: List<T>,
  ctx: EvalContext,
): Result<T> {
  const k = s.selector.kind;
  switch (k) {
    case 'same_side':
    case 'opposite_side':
      return sideFilter(F, s, list, ctx, k === 'same_side');
    case 'on_arc':
      return arcFilter(F, s, list, ctx);
    case 'between':
      return betweenFilter(F, s, list, ctx);
    case 'inside':
    case 'outside':
      return discFilter(F, s, list, ctx, k === 'inside');
    case 'near':
    case 'far_from':
      return rank(F, s, list, ctx, k === 'near');
    case 'other':
      return list; // applied first (viaOther): the list holds only the other point
    case 'along':
    case 'orient':
      return lowLevel(F, pair, s, list, ctx);
    default:
      return assertNever(k, 'selector kind');
  }
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

function sideFilter<T>(
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
function arcFilter<T>(
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
function betweenFilter<T>(
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
function discFilter<T>(
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

/** near(P) / far_from(P) between two candidates. Degenerate: a tie within the band. */
function rank<T>(
  F: Field<T>,
  s: EvaluatedSelector<T>,
  list: List<T>,
  ctx: EvalContext,
  near: boolean,
): Result<T> {
  const P = s.args[0];
  if (P?.kind !== 'point') return undef(`${s.text} needs a point`);
  const [a, b] = list;
  if (a === undefined || b === undefined) return list;
  const [wa, wb] = [vSub(F, a.at, P), vSub(F, b.at, P)];
  const g = F.sign(rootGap(F, vDot(F, wa, wa), vDot(F, wb, wb)), 'length', ctx);
  if (g === 'none') return noOrder(F, s);
  if (g === 0 || g === 'ambiguous') {
    return undef(`ambiguous: ${s.text}: the candidates are equally far from the point`);
  }
  return [near === (g === -1) ? a : b];
}

/** The low-level label of a candidate whose label is measured (the other point of other(P)). */
function measure<T>(
  F: Field<T>,
  pair: Pair<T>,
  s: EvaluatedSelector<T>,
  c: Cand<T>,
  ctx: EvalContext,
): Side | Undefined | Inexact {
  if (c.side !== 'measure') return c.side;
  const low = pair.low;
  let g: FieldSign;
  if (low.kind === 'along') {
    g = signNormalized(
      F,
      vDot(F, vSub(F, c.at, c.from), low.d),
      vDot(F, low.d, low.d),
      'length',
      ctx,
    );
  } else if (low.kind === 'orient') {
    const w = vSub(F, low.to, low.from);
    g = signNormalized(F, vCross(F, w, vSub(F, c.at, low.from)), vDot(F, w, w), 'length', ctx);
  } else return 0;
  if (g === 'none') return noOrder(F, s);
  if (g === 0 || g === 'ambiguous') {
    return undef(`ambiguous: ${s.text}: the candidate is within the band of the dividing line`);
  }
  return g;
}

function lowLevel<T>(
  F: Field<T>,
  pair: Pair<T>,
  s: EvaluatedSelector<T>,
  list: List<T>,
  ctx: EvalContext,
): Result<T> {
  const want = s.selector.kind === 'along' || s.selector.kind === 'orient' ? s.selector.sign : 1;
  const out: Cand<T>[] = [];
  for (const c of list) {
    const side = measure(F, pair, s, c, ctx);
    if (typeof side !== 'number') return side;
    if (side === 0 || side === want) out.push(c);
  }
  return out;
}
