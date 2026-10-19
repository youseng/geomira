/**
 * The geometry of branchable calls (internal; SPEC §7, ADR-0006). A Pair is the two
 * objects whose common points are a call's candidates, with:
 *   - count(): how many candidates there are, decided on the DISCRIMINANT measured as a
 *     length (rootGap) with the band: clearly negative → Undefined ("no intersection"),
 *     within the band → one double point, clearly positive → two candidates. Exact in Q,
 *     an exact zero test mod p. No square root is taken to decide (ADR-0005's note);
 *   - list(n): the candidates as mid ∓ off (off needs a square root: Inexact when it is
 *     not representable), each with its STRUCTURAL low-level label (along: mid + off is
 *     further along d; orient: the sign of the orientation), a double point labelled 0;
 *     candidates outside a segment or ray are not candidates;
 *   - vieta(P): the other common point given one, without square roots (exact; other(P)).
 * select.ts applies the selectors.
 */
import { isInexact, type Field, type Inexact } from '@geomira/num/field';
import {
  abs,
  isZeroNormalized,
  isZeroVec,
  vAdd,
  vCross,
  vDot,
  vRot90,
  vScale,
  vSub,
} from '../geom';
import { rootGap } from '../incidence';
import type { BranchShape, EvalContext } from '../tool';
import {
  pointOf,
  undef,
  type Circle,
  type Line,
  type Undefined,
  type Value,
  type Vec,
} from '../value';
import { degenerateCircle, degenerateLine } from './args';
import { outsideReason, rangeStatus } from './range';

export type Side = -1 | 0 | 1;

/**
 * A candidate: its point `at` (what the selectors judge) and its low-level label: ±1 by
 * construction, 0 for a double point or a lone intersection, or 'measure' for the other
 * point of other(P), whose label is measured against `from` = P when a selector needs it.
 */
export type Cand<T> =
  | { readonly at: Vec<T>; readonly side: Side }
  | { readonly at: Vec<T>; readonly side: 'measure'; readonly from: Vec<T> };

/** The reference of the pair's low-level selector. */
export type Low<T> =
  | { readonly kind: 'along'; readonly d: Vec<T> }
  | { readonly kind: 'orient'; readonly from: Vec<T>; readonly to: Vec<T> }
  | { readonly kind: 'none' };

export interface Curve<T> {
  readonly obj: Line<T> | Circle<T>;
  /** Its role in messages: "the line", "the first circle", "the polar of P". */
  readonly name: string;
}

export interface Pair<T> {
  readonly shape: BranchShape;
  /** What a candidate is called in messages: "intersection", "touch point", "tangent". */
  readonly noun: string;
  readonly curves: readonly [Curve<T>, Curve<T>];
  readonly low: Low<T>;
  /** A segment or ray takes part: list() must run before counting survivors. */
  readonly ranged: boolean;
  count(): 1 | 2 | Undefined | Inexact;
  list(n: 1 | 2): readonly Cand<T>[] | Undefined | Inexact;
  /** The other common point given P on both curves (exact); absent for line ∩ line. */
  readonly vieta?: (P: Vec<T>) => Vec<T>;
  /** Whether a point given by vieta lies on the ranges ('in'), or why not. */
  range(X: Vec<T>): 'in' | Undefined | Inexact;
  output(X: Vec<T>): Value<T>;
}

export const LINE_LINE: BranchShape = {
  candidates: 1,
  low: 'none',
  other: false,
  describe: 'line ∩ line',
};
export const LINE_CIRCLE: BranchShape = {
  candidates: 2,
  low: 'along',
  other: true,
  describe: 'line ∩ circle',
};
export const CIRCLE_CIRCLE: BranchShape = {
  candidates: 2,
  low: 'orient',
  other: true,
  describe: 'circle ∩ circle',
};

const asPoint = <T>(X: Vec<T>): Value<T> => pointOf(X.x, X.y);

/** a ∓ off, labelled −1 and +1 (or +1 and −1 when `flip`). */
function plusMinus<T>(F: Field<T>, mid: Vec<T>, off: Vec<T>, flip: boolean): Cand<T>[] {
  return [
    { at: vSub(F, mid, off), side: flip ? 1 : -1 },
    { at: vAdd(F, mid, off), side: flip ? -1 : 1 },
  ];
}

/**
 * mid ∓ √rad·dir (n = 2) or [mid] (n = 1). Degenerate: √rad not representable → Inexact.
 * rad > 0 whenever n = 2: count() decided it on the same quantity.
 */
export function midOff<T>(
  F: Field<T>,
  n: 1 | 2,
  mid: Vec<T>,
  rad: T,
  dir: Vec<T>,
  flip: boolean,
): Cand<T>[] | Inexact {
  if (n === 1) return [{ at: mid, side: 0 }];
  const k = F.sqrt(rad);
  return isInexact(k) ? k : plusMinus(F, mid, vScale(F, dir, k), flip);
}

/**
 * The count from a gap (a length) and its exact zero test mod p. Degenerate cases: clearly
 * negative → Undefined(`missing`); within the band → 1 (the double point).
 */
export function countFromGap<T>(
  F: Field<T>,
  gap: T,
  ctx: EvalContext,
  missing: string,
): 1 | 2 | Undefined {
  const s = F.sign(gap, 'length', ctx);
  if (s === -1) return undef(missing);
  if (s === 'none') return F.isZero(gap, 'length', ctx) ? 1 : 2;
  return s === 1 ? 2 : 1;
}

/** Line ∩ line: at most one point (Run 2's intersect). */
export function lineLinePair<T>(
  F: Field<T>,
  a: Line<T>,
  b: Line<T>,
  ctx: EvalContext,
): Pair<T> | Undefined {
  const bad = degenerateLine(F, a, ctx) ?? degenerateLine(F, b, ctx);
  if (bad !== undefined) return bad;
  return {
    shape: LINE_LINE,
    noun: 'intersection',
    curves: [
      { obj: a, name: 'the first line' },
      { obj: b, name: 'the second line' },
    ],
    low: { kind: 'none' },
    ranged: false,
    count: () => 1,
    list: () => {
      const X = lineLine(F, a, b, ctx);
      return 'kind' in X ? X : [{ at: X, side: 0 }];
    },
    range: () => 'in',
    output: asPoint,
  };
}

/**
 * Degenerate cases: parallel lines → Undefined; coincident lines → Undefined; the
 * intersection outside a segment or ray → Undefined; within the band of an end →
 * Undefined (ambiguous); a range check mod p → Inexact.
 */
function lineLine<T>(
  F: Field<T>,
  a: Line<T>,
  b: Line<T>,
  ctx: EvalContext,
): Vec<T> | Undefined | Inexact {
  const den = vCross(F, a.d, b.d);
  const w = vSub(F, b.p, a.p);
  const [aa, bb] = [vDot(F, a.d, a.d), vDot(F, b.d, b.d)];
  if (isZeroNormalized(F, den, F.mul(aa, bb), 'dimensionless', ctx)) {
    const on = isZeroNormalized(F, vCross(F, w, a.d), aa, 'length', ctx);
    return undef(on ? 'coincident lines' : 'parallel lines');
  }
  const t = F.div(vCross(F, w, b.d), den);
  const s = F.div(vCross(F, w, a.d), den);
  for (const [l, u] of [
    [a, t],
    [b, s],
  ] as const) {
    const r = rangeStatus(F, l, u, ctx, 'intersection');
    if (r === 'out') return outsideReason(l, 'intersection');
    if (r !== 'in') return r;
  }
  return vAdd(F, a.p, vScale(F, a.d, t));
}

/** The parameter of X's projection on l. */
function paramOn<T>(F: Field<T>, l: Line<T>, X: Vec<T>): T {
  return F.div(vDot(F, vSub(F, X, l.p), l.d), vDot(F, l.d, l.d));
}

/** The candidates on l's range: outside ones dropped; none left → the range's reason. */
function onRange<T>(
  F: Field<T>,
  l: Line<T>,
  list: readonly Cand<T>[],
  ctx: EvalContext,
): readonly Cand<T>[] | Undefined | Inexact {
  if (l.lo === null && l.hi === null) return list;
  const kept: Cand<T>[] = [];
  for (const c of list) {
    const r = rangeStatus(F, l, paramOn(F, l, c.at), ctx, 'intersection');
    if (r === 'in') kept.push(c);
    else if (r !== 'out') return r;
  }
  return kept.length > 0 ? kept : outsideReason(l, 'intersection');
}

/**
 * Line ∩ circle (either order: `lineFirst`). The foot F of the centre on the line is the
 * chord's midpoint; the gap r − h (h the distance from the centre to the line) decides the
 * count; the candidates are F ∓ √((r² − h²)/|d|²)·d, so along(+) is F + …. Degenerate
 * cases: a line with no direction or a circle with no positive radius → Undefined.
 */
export function lineCirclePair<T>(
  F: Field<T>,
  l: Line<T>,
  c: Circle<T>,
  ctx: EvalContext,
  lineFirst: boolean,
): Pair<T> | Undefined {
  const bad = degenerateLine(F, l, ctx) ?? degenerateCircle(F, c, ctx);
  if (bad !== undefined) return bad;
  const dd = vDot(F, l.d, l.d);
  const cross = vCross(F, vSub(F, c.c, l.p), l.d);
  const h2 = F.div(F.mul(cross, cross), dd);
  const diff = F.sub(c.r2, h2);
  const foot = vAdd(F, l.p, vScale(F, l.d, paramOn(F, l, c.c)));
  const curves: [Curve<T>, Curve<T>] = [
    { obj: l, name: 'the line' },
    { obj: c, name: 'the circle' },
  ];
  return {
    shape: LINE_CIRCLE,
    noun: 'intersection',
    curves: lineFirst ? curves : [curves[1], curves[0]],
    low: { kind: 'along', d: l.d },
    ranged: l.lo !== null || l.hi !== null,
    count: () =>
      countFromGap(F, rootGap(F, c.r2, h2), ctx, 'no intersection: the line misses the circle'),
    list: (n) => {
      const list = midOff(F, n, foot, F.div(diff, dd), l.d, false);
      return isInexact(list) ? list : onRange(F, l, list, ctx);
    },
    // As other.ts (same operations, so other(P) and other() agree bit for bit).
    vieta: (P) => {
      const tc = paramOn(F, l, c.c);
      return vAdd(F, l.p, vScale(F, l.d, F.sub(F.add(tc, tc), paramOn(F, l, P))));
    },
    range: (X) => {
      const r = rangeStatus(F, l, paramOn(F, l, X), ctx, 'other intersection');
      return r === 'out' ? outsideReason(l, 'other intersection') : r;
    },
    output: asPoint,
  };
}

/**
 * Circle ∩ circle: the count from the gaps r₁ + r₂ − d and d − |r₁ − r₂| (lengths) when
 * the roots are representable, else from the exact sign of
 * D = 2s(r₁² + r₂²) − s² − (r₁² − r₂²)² = 4s·h² (s = d², h the half chord). Degenerate
 * cases: apart / one inside the other → Undefined; tangency (a gap within the band) → 1.
 */
function circlesCount<T>(
  F: Field<T>,
  c1: Circle<T>,
  c2: Circle<T>,
  s: T,
  ctx: EvalContext,
): { readonly n: 1 | 2; readonly D: T } | Undefined {
  const [r1, r2, d] = [F.sqrt(c1.r2), F.sqrt(c2.r2), F.sqrt(s)];
  const apart = 'no intersection: the circles are apart';
  const inside = 'no intersection: one circle lies inside the other';
  if (!isInexact(r1) && !isInexact(r2) && !isInexact(d)) {
    const gap = abs(F, F.sub(r1, r2), 'length', ctx);
    if (!isInexact(gap)) {
      const [ext, int] = [F.sub(F.add(r1, r2), d), F.sub(d, gap)];
      const [se, si] = [F.sign(ext, 'length', ctx), F.sign(int, 'length', ctx)];
      if (se === -1) return undef(apart);
      if (si === -1) return undef(inside);
      const D = F.mul(F.mul(ext, F.add(F.add(r1, r2), d)), F.mul(int, F.add(d, gap)));
      return { n: se === 1 && si === 1 ? 2 : 1, D };
    }
  }
  const sum = F.add(c1.r2, c2.r2);
  const dr = F.sub(c1.r2, c2.r2);
  const D = F.sub(F.sub(F.mul(F.add(s, s), sum), F.mul(s, s)), F.mul(dr, dr));
  const sD = F.sign(D, 'area', ctx);
  if (sD === 'none') return { n: F.isZero(D, 'area', ctx) ? 1 : 2, D };
  if (sD === -1) return undef(F.sign(F.sub(s, sum), 'area', ctx) === -1 ? inside : apart);
  return { n: sD === 1 ? 2 : 1, D };
}

/**
 * Circle ∩ circle. The candidates are mid ∓ √(D / 4s²)·rot90(w) (w = O₂ − O₁, mid on the
 * line of centres), so orient(+) (cross(O₂ − O₁, X − O₁) > 0) is mid + …. Degenerate cases:
 * a circle with no positive radius → Undefined; concentric circles (equal ones included)
 * → Undefined.
 */
export function circleCirclePair<T>(
  F: Field<T>,
  c1: Circle<T>,
  c2: Circle<T>,
  ctx: EvalContext,
): Pair<T> | Undefined {
  const bad = degenerateCircle(F, c1, ctx) ?? degenerateCircle(F, c2, ctx);
  if (bad !== undefined) return bad;
  const w = vSub(F, c2.c, c1.c);
  if (isZeroVec(F, w, ctx)) return undef('concentric circles');
  const s = vDot(F, w, w);
  const k = F.div(F.sub(F.add(s, c1.r2), c2.r2), F.add(s, s));
  const mid = vAdd(F, c1.c, vScale(F, w, k));
  return {
    shape: CIRCLE_CIRCLE,
    noun: 'intersection',
    curves: [
      { obj: c1, name: 'the first circle' },
      { obj: c2, name: 'the second circle' },
    ],
    low: { kind: 'orient', from: c1.c, to: c2.c },
    ranged: false,
    count: () => {
      const r = circlesCount(F, c1, c2, s, ctx);
      return 'kind' in r ? r : r.n;
    },
    list: (n) => {
      const r = circlesCount(F, c1, c2, s, ctx);
      if ('kind' in r) return r;
      const rad = F.div(r.D, F.mul(F.add(s, s), F.add(s, s)));
      return midOff(F, n, mid, rad, vRot90(F, w), false);
    },
    vieta: (P) => reflectIn(F, c1.c, w, P),
    range: () => 'in',
    output: asPoint,
  };
}

/** The reflection of P in the line through `o` with direction w (w ≠ 0). */
export function reflectIn<T>(F: Field<T>, o: Vec<T>, w: Vec<T>, P: Vec<T>): Vec<T> {
  const foot = vAdd(F, o, vScale(F, w, F.div(vDot(F, vSub(F, P, o), w), vDot(F, w, w))));
  return vSub(F, vAdd(F, foot, foot), P);
}
