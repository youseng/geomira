/**
 * Triangle centres (SPEC §6.2): circumcenter, centroid, orthocenter. Each is computed from
 * its own formula (the orthocenter is NOT A + B + C − 2·O), so the Euler-line theorem
 * tests compare independent constructions.
 */
import type { Field } from '@geomira/num/field';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { isZeroNormalized, two, vAdd, vCross, vDot, vRot90, vScale, vSub } from '../geom';
import { pointOf, undef, type Point, type Undefined, type Value, type Vec } from '../value';
import { badArgs, pointsOf } from './args';

interface Triangle<T> {
  readonly a: Point<T>;
  readonly b: Point<T>;
  readonly c: Point<T>;
  /** B − A and C − A. */
  readonly u: Vec<T>;
  readonly v: Vec<T>;
  /** cross(B − A, C − A) ≠ 0. */
  readonly cross: T;
}

/**
 * The triangle of three point arguments. Degenerate cases: two coincident vertices →
 * Undefined("coincident points"); collinear vertices (the sine of the angle at A is zero)
 * → Undefined("collinear points").
 */
function triangle<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  tool: string,
): Triangle<T> | Undefined {
  const [a, b, c] = pointsOf(args, 3) ?? [];
  if (a === undefined || b === undefined || c === undefined) return badArgs(tool);
  const u = vSub(F, b, a);
  const v = vSub(F, c, a);
  const sides = [u, v, vSub(F, c, b)];
  if (sides.some((s) => F.isZero(s.x, 'length', ctx) && F.isZero(s.y, 'length', ctx))) {
    return undef(`coincident points: ${tool} needs three distinct vertices`);
  }
  const cross = vCross(F, u, v);
  if (isZeroNormalized(F, cross, F.mul(vDot(F, u, u), vDot(F, v, v)), 'dimensionless', ctx)) {
    return undef(`collinear points: ${tool} needs a non-degenerate triangle`);
  }
  return { a, b, c, u, v, cross };
}

/**
 * O = A + x with 2·x·u = |u|², 2·x·v = |v|² (u = B − A, v = C − A):
 * x = (|u|²·v.y − |v|²·u.y, |v|²·u.x − |u|²·v.x) / (2·cross(u, v)). Degenerate cases:
 * coincident vertices → Undefined; collinear vertices → Undefined (use cline).
 */
function circumcenter<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const t = triangle(F, args, ctx, 'circumcenter');
  if ('kind' in t) return t;
  const [uu, vv] = [vDot(F, t.u, t.u), vDot(F, t.v, t.v)];
  const den = F.mul(two(F), t.cross);
  const x = F.div(F.sub(F.mul(t.v.y, uu), F.mul(t.u.y, vv)), den);
  const y = F.div(F.sub(F.mul(t.u.x, vv), F.mul(t.v.x, uu)), den);
  return pointOf(F.add(t.a.x, x), F.add(t.a.y, y));
}

/** Degenerate: none; a flat or repeated triangle still has its vertex mean. */
function centroid<T>(F: Field<T>, args: readonly Value<T>[]): Value<T> {
  const [a, b, c] = pointsOf(args, 3) ?? [];
  if (a === undefined || b === undefined || c === undefined) return badArgs('centroid');
  const third = F.div(F.one, F.add(two(F), F.one));
  const g = vScale(F, vAdd(F, vAdd(F, a, b), c), third);
  return pointOf(g.x, g.y);
}

/**
 * H = A + h with h·(C − B) = 0 and (h + A − B)·(C − A) = 0 (the altitudes from A and B):
 * h = k·rot90(C − B) / cross(C − B, C − A) with k = (B − A)·(C − A). Degenerate cases:
 * coincident vertices → Undefined; collinear vertices → Undefined.
 */
function orthocenter<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const t = triangle(F, args, ctx, 'orthocenter');
  if ('kind' in t) return t;
  const w = vSub(F, t.c, t.b);
  const k = vDot(F, t.u, t.v);
  // cross(C − B, C − A) = −cross(B − A, C − A), which triangle() showed is not zero.
  const h = vScale(F, vRot90(F, w), F.div(k, F.neg(t.cross)));
  return pointOf(F.add(t.a.x, h.x), F.add(t.a.y, h.y));
}

const ABC: readonly ExampleArg[] = [
  ['0', '0'],
  ['4', '0'],
  ['1', '3'],
];

export const TRIANGLE_TOOLS: readonly ToolSpec[] = [
  {
    id: 'circumcenter',
    name: 'circumcenter',
    family: 'points',
    signatures: [{ params: ['point', 'point', 'point'] }],
    outputKinds: ['point'],
    compute: circumcenter,
    degenerate: ['coincident vertices → Undefined', 'collinear vertices → Undefined (use cline)'],
    export: 'numeric',
    doc: 'The centre of the circle through A, B, C.',
    examples: [{ args: ABC }],
  },
  {
    id: 'centroid',
    name: 'centroid',
    family: 'points',
    signatures: [{ params: ['point', 'point', 'point'] }],
    outputKinds: ['point'],
    compute: centroid,
    degenerate: ['collinear or coincident vertices → the mean of the vertices'],
    export: 'numeric',
    doc: 'The centroid (A + B + C) / 3, where the medians meet.',
    examples: [{ args: ABC }],
  },
  {
    id: 'orthocenter',
    name: 'orthocenter',
    family: 'points',
    signatures: [{ params: ['point', 'point', 'point'] }],
    outputKinds: ['point'],
    compute: orthocenter,
    degenerate: ['coincident vertices → Undefined', 'collinear vertices → Undefined'],
    export: 'numeric',
    doc: 'The orthocenter, where the altitudes meet.',
    examples: [{ args: ABC }],
  },
];
