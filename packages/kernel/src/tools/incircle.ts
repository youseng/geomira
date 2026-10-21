/**
 * Tools that need side lengths (SPEC §6.2): incenter, excenter (opposite A), incircle,
 * excircle (opposite A), bisector(A, B, C) and ext_bisector(A, B, C) (of ∠ABC at B). Their
 * exact runs need the square roots of the squared lengths: over Q they succeed exactly
 * when those lengths are rational (for example a 13-14-15 triangle) and are Inexact
 * otherwise; mod p they are always Inexact. This is expected (SPEC §3.4).
 */
import { isInexact, type Field, type Inexact } from '@geomira/num/field';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { abs, vAdd, vDot, vRot90, vScale, vSub } from '../geom';
import {
  pointOf,
  undef,
  type Circle,
  type Point,
  type Undefined,
  type Value,
  type Vec,
} from '../value';
import { badArgs, coincident, pointsOf } from './args';
import { triangle, type Triangle } from './triangle';

/** |v|, or Inexact when it is not representable. */
function length<T>(F: Field<T>, v: Vec<T>): T | Inexact {
  return F.sqrt(vDot(F, v, v));
}

/** The side lengths a = |BC|, b = |CA|, c = |AB|. */
function sides<T>(F: Field<T>, t: Triangle<T>): readonly [T, T, T] | Inexact {
  const [a, b, c] = [length(F, vSub(F, t.c, t.b)), length(F, t.v), length(F, t.u)];
  if (isInexact(a)) return a;
  if (isInexact(b)) return b;
  return isInexact(c) ? c : [a, b, c];
}

interface Centre<T> {
  readonly t: Triangle<T>;
  readonly centre: Point<T>;
  /** The radius of the touching circle, r = cross / den (up to sign). */
  readonly r: T;
}

/**
 * The incenter (ka = 1) or the excenter opposite A (ka = −1): (ka·a·A + b·B + c·C) / den
 * with den = ka·a + b + c. Degenerate cases: coincident or collinear vertices → Undefined;
 * a length not representable → Inexact; den not clearly positive in FloatField (a
 * triangle flat beyond the precision of its lengths) → Undefined.
 */
function centreOf<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  tool: string,
  ka: 1 | -1,
): Centre<T> | Undefined | Inexact {
  const t = triangle(F, args, ctx, tool);
  if ('kind' in t) return t;
  const abc = sides(F, t);
  if (isInexact(abc)) return abc;
  const [a, b, c] = abc;
  const wa = ka === 1 ? a : F.neg(a);
  const den = F.add(F.add(wa, b), c);
  const s = F.sign(den, 'length', ctx);
  if (s === 'ambiguous')
    return undef(`ambiguous: ${tool}: the triangle is within the band of flat`);
  if (s !== 1) return undef(`collinear points: ${tool} needs a non-degenerate triangle`);
  const sum = vAdd(F, vAdd(F, vScale(F, t.a, wa), vScale(F, t.b, b)), vScale(F, t.c, c));
  const k = F.div(F.one, den);
  return { t, centre: pointOf(F.mul(sum.x, k), F.mul(sum.y, k)), r: F.mul(t.cross, k) };
}

function incenter<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const x = centreOf(F, args, ctx, 'incenter', 1);
  return 'kind' in x ? x : x.centre;
}

function excenter<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const x = centreOf(F, args, ctx, 'excenter', -1);
  return 'kind' in x ? x : x.centre;
}

/** The circle of a centre, anchored at its touch point on BC (the foot of the centre). */
function touching<T>(F: Field<T>, x: Centre<T>): Circle<T> {
  const bc = vSub(F, x.t.c, x.t.b);
  const k = F.div(vDot(F, vSub(F, x.centre, x.t.b), bc), vDot(F, bc, bc));
  const anchor = vAdd(F, x.t.b, vScale(F, bc, k));
  // r = cross / den: |cross| = 2·area and den = a + b + c (or b + c − a), so r² is the
  // squared inradius (exradius): 2·area / perimeter (2·area / (b + c − a)).
  return { kind: 'circle', c: x.centre, r2: F.mul(x.r, x.r), arc: null, anchor };
}

function incircle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const x = centreOf(F, args, ctx, 'incircle', 1);
  return 'kind' in x ? x : touching(F, x);
}

function excircle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const x = centreOf(F, args, ctx, 'excircle', -1);
  return 'kind' in x ? x : touching(F, x);
}

/**
 * The bisector directions at B: w = (A − B)/|A − B| + (C − B)/|C − B|, scaled to the
 * length |A − B| + |C − B| in the 1-norm (so a valid direction never looks like a zero
 * length). 'straight' when w is zero (EPS, dimensionless). Degenerate cases: A = B or
 * C = B → Undefined; w within the band of zero → Undefined (ambiguous); lengths not
 * representable → Inexact.
 */
function bisectorAt<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  tool: string,
): { readonly b: Point<T>; readonly u: Vec<T>; readonly w: Vec<T> | 'straight' } | Value<T> {
  const [a, b, c] = pointsOf(args, 3) ?? [];
  if (a === undefined || b === undefined || c === undefined) return badArgs(tool);
  const [u, v] = [vSub(F, a, b), vSub(F, c, b)];
  const bad =
    coincident(F, u, ctx, `${tool}(A, B, C) needs A ≠ B`) ??
    coincident(F, v, ctx, `${tool}(A, B, C) needs C ≠ B`);
  if (bad !== undefined) return bad;
  const [lu, lv] = [length(F, u), length(F, v)];
  if (isInexact(lu)) return lu;
  if (isInexact(lv)) return lv;
  const w = vAdd(F, vScale(F, u, F.div(F.one, lu)), vScale(F, v, F.div(F.one, lv)));
  const sx = F.sign(w.x, 'dimensionless', ctx);
  const sy = F.sign(w.y, 'dimensionless', ctx);
  if (sx === 0 && sy === 0) return { b, u, w: 'straight' };
  if ((sx === 0 || sx === 'ambiguous') && (sy === 0 || sy === 'ambiguous')) {
    return undef(`ambiguous: ${tool}: the angle is within the band of a straight angle`);
  }
  const [ax, ay] = [abs(F, w.x, 'dimensionless', ctx), abs(F, w.y, 'dimensionless', ctx)];
  if (isInexact(ax)) return ax;
  if (isInexact(ay)) return ay;
  return { b, u, w: vScale(F, w, F.div(F.add(lu, lv), F.add(ax, ay))) };
}

function lineAtB<T>(b: Point<T>, d: Vec<T>, chiral: boolean): Value<T> {
  return { kind: 'line', p: { x: b.x, y: b.y }, d, lo: null, hi: null, chiral };
}

/**
 * The internal bisector of ∠ABC: through B along w (achiral). Degenerate cases: a straight
 * angle → the perpendicular at B (a quarter turn of A − B: chiral); a zero angle → the line
 * BA; the rest as bisectorAt.
 */
function bisector<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const x = bisectorAt(F, args, ctx, 'bisector');
  if ('kind' in x) return x;
  return x.w === 'straight' ? lineAtB(x.b, vRot90(F, x.u), true) : lineAtB(x.b, x.w, false);
}

/**
 * The external bisector of ∠ABC: through B along rot90(w) (a quarter turn: chiral).
 * Degenerate cases: a straight angle → the line BA (achiral); a zero angle → the
 * perpendicular at B; the rest as bisectorAt.
 */
function extBisector<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const x = bisectorAt(F, args, ctx, 'ext_bisector');
  if ('kind' in x) return x;
  return x.w === 'straight' ? lineAtB(x.b, x.u, false) : lineAtB(x.b, vRot90(F, x.w), true);
}

/** A 13-14-15 triangle: every side length rational, so the exact run succeeds. */
const HERON: readonly ExampleArg[] = [
  ['5', '12'],
  ['0', '0'],
  ['14', '0'],
];
/** Sides 4, √10 and 3√2: not all rational, so the exact run is Inexact. */
const GENERIC: readonly ExampleArg[] = [
  ['0', '0'],
  ['4', '0'],
  ['1', '3'],
];
/** Side or arm lengths are square roots: every overload is radical (ADR-0008). */
const THREE: readonly ToolSpec['signatures'][number][] = [
  { params: ['point', 'point', 'point'], radical: true },
];
const TRIANGLE_CASES = [
  'coincident vertices → Undefined',
  'collinear vertices → Undefined',
  'a side length not rational (over Q) → Inexact',
];
const BISECTOR_CASES = [
  'A = B or C = B → Undefined',
  'within the band of a straight angle → Undefined (ambiguous)',
  'an arm length not rational (over Q) → Inexact',
];

function triangleTool(
  name: string,
  compute: ToolSpec['compute'],
  outputKind: 'point' | 'circle',
  doc: string,
  exported: ToolSpec['export'] = 'numeric',
): ToolSpec {
  return {
    id: name,
    name,
    family: outputKind === 'point' ? 'points' : 'circles',
    signatures: THREE,
    outputKinds: [outputKind],
    compute,
    degenerate: TRIANGLE_CASES,
    export: exported,
    doc,
    examples: [{ args: HERON }, { args: GENERIC }],
  };
}

function bisectorTool(
  name: string,
  compute: ToolSpec['compute'],
  extra: string[],
  doc: string,
): ToolSpec {
  return {
    id: name,
    name,
    family: 'lines',
    signatures: THREE,
    outputKinds: ['line'],
    compute,
    degenerate: [...BISECTOR_CASES, ...extra],
    export: 'numeric',
    doc,
    examples: [{ args: HERON }, { args: GENERIC }],
  };
}

export const INCIRCLE_TOOLS: readonly ToolSpec[] = [
  triangleTool(
    'incenter',
    incenter,
    'point',
    'The incenter of ABC (where the internal bisectors meet).',
    { constructive: 'incenter' },
  ),
  triangleTool('excenter', excenter, 'point', 'excenter(A, B, C): the excenter opposite A.'),
  triangleTool(
    'incircle',
    incircle,
    'circle',
    'The incircle of ABC; anchor: its touch point on BC.',
    { constructive: 'incircle' },
  ),
  triangleTool(
    'excircle',
    excircle,
    'circle',
    'excircle(A, B, C): the excircle opposite A; anchor: its touch point on BC.',
  ),
  bisectorTool(
    'bisector',
    bisector,
    ['a straight angle → the perpendicular at B', 'a zero angle → the line BA'],
    'bisector(A, B, C): the internal bisector of ∠ABC, through B (achiral).',
  ),
  bisectorTool(
    'ext_bisector',
    extBisector,
    ['a straight angle → the line BA', 'a zero angle → the perpendicular at B'],
    'ext_bisector(A, B, C): the external bisector of ∠ABC, through B (chiral).',
  ),
];
