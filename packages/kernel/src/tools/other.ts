/**
 * other(a, b, P) (SPEC §6.2): the intersection of two curves other than the known common
 * point P, without square roots (exact in every field):
 *   - line and circle (either order): Vieta. The chord's midpoint is the foot F of the
 *     centre on the line, so the other point is 2F − P;
 *   - two circles: the reflection of P in the line of centres.
 * P must lie on both objects (a decision with the band, incidence.ts). Tangency gives the
 * double point P itself, with no special case.
 */
import type { Field } from '@geomira/num/field';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { vAdd, vDot, vScale, vSub } from '../geom';
import { requireOnCircle, requireOnLine } from '../incidence';
import { pointOf, undef, type Circle, type Line, type Point, type Value } from '../value';
import { badArgs, circleAt, degenerateCircle, degenerateLine, lineAt, pointAt } from './args';
import { outOfRange } from './range';

/** The parameter of X's projection on l (X ↦ (X − p)·d / |d|²). */
function along<T>(F: Field<T>, l: Line<T>, X: { readonly x: T; readonly y: T }): T {
  return F.div(vDot(F, vSub(F, X, l.p), l.d), vDot(F, l.d, l.d));
}

/**
 * Line and circle. Degenerate cases: P off the carrier line or off c → Undefined; within
 * the band → Undefined (ambiguous); tangency → P; the other point outside a segment or ray
 * → Undefined, within the band of an end → Undefined (ambiguous), mod p → Inexact.
 */
function lineCircle<T>(
  F: Field<T>,
  l: Line<T>,
  c: Circle<T>,
  P: Point<T>,
  ctx: EvalContext,
): Value<T> {
  const bad =
    degenerateLine(F, l, ctx) ??
    degenerateCircle(F, c, ctx) ??
    requireOnLine(F, P, l, ctx, 'other(a, b, P) needs P on the line') ??
    requireOnCircle(F, P, c, ctx, 'other(a, b, P) needs P on the circle');
  if (bad !== undefined) return bad;
  const t = F.sub(F.add(along(F, l, c.c), along(F, l, c.c)), along(F, l, P));
  const range = outOfRange(F, l, t, ctx, 'other intersection');
  if (range !== undefined) return range;
  const q = vAdd(F, l.p, vScale(F, l.d, t));
  return pointOf(q.x, q.y);
}

/**
 * Two circles. Degenerate cases: concentric circles (equal ones included) → Undefined;
 * P off either circle → Undefined; within the band → Undefined (ambiguous); tangency → P.
 */
function twoCircles<T>(
  F: Field<T>,
  c1: Circle<T>,
  c2: Circle<T>,
  P: Point<T>,
  ctx: EvalContext,
): Value<T> {
  const bad = degenerateCircle(F, c1, ctx) ?? degenerateCircle(F, c2, ctx);
  if (bad !== undefined) return bad;
  const w = vSub(F, c2.c, c1.c);
  if (F.isZero(w.x, 'length', ctx) && F.isZero(w.y, 'length', ctx)) {
    return undef('concentric circles');
  }
  const on =
    requireOnCircle(F, P, c1, ctx, 'other(a, b, P) needs P on the first circle') ??
    requireOnCircle(F, P, c2, ctx, 'other(a, b, P) needs P on the second circle');
  if (on !== undefined) return on;
  const k = F.div(vDot(F, vSub(F, P, c1.c), w), vDot(F, w, w));
  const foot = vAdd(F, c1.c, vScale(F, w, k));
  return pointOf(F.sub(F.add(foot.x, foot.x), P.x), F.sub(F.add(foot.y, foot.y), P.y));
}

function other<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const P = pointAt(args, 2);
  if (P === undefined || args.length !== 3) return badArgs('other');
  const [l0, l1, c0, c1] = [lineAt(args, 0), lineAt(args, 1), circleAt(args, 0), circleAt(args, 1)];
  if (l0 !== undefined && c1 !== undefined) return lineCircle(F, l0, c1, P, ctx);
  if (c0 !== undefined && l1 !== undefined) return lineCircle(F, l1, c0, P, ctx);
  if (c0 !== undefined && c1 !== undefined) return twoCircles(F, c0, c1, P, ctx);
  return badArgs('other');
}

const P: readonly [string, string] = ['3', '4'];
const CIRCLE: ExampleArg = { call: 'circle', args: [['0', '0'], P] };

export const OTHER_TOOLS: readonly ToolSpec[] = [
  {
    id: 'other',
    name: 'other',
    family: 'points',
    signatures: [
      { params: ['linear', 'round', 'point'] },
      { params: ['round', 'linear', 'point'] },
      { params: ['round', 'round', 'point'] },
    ],
    outputKinds: ['point'],
    compute: other,
    degenerate: [
      'P not on both objects → Undefined',
      'P within the band of an object → Undefined (ambiguous)',
      'tangency at P → P (the double point)',
      'concentric circles → Undefined',
      'the other point outside a segment or ray → Undefined',
      'the other point within the band of a segment end → Undefined (ambiguous)',
      'a segment or ray range mod p → Inexact',
    ],
    export: 'numeric',
    doc: 'other(a, b, P): the second intersection of a line and a circle, or of two circles, given one common point P (Vieta; exact).',
    examples: [
      { args: [{ through: [P, ['-4', '-3']], as: 'line' }, CIRCLE, P] },
      { args: [CIRCLE, { call: 'circle', args: [['6', '0'], P] }, P] },
    ],
  },
];
