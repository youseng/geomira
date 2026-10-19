/**
 * Measures (SPEC §6.2): dist, ratio, angle (undirected), dangle (directed, mod 180°), area.
 * Square roots and angles are exact only where the field can represent them; otherwise
 * the result is Inexact with the field's reason. Angles are in degrees.
 */
import { assertNever } from '@geomira/num/assert';
import type { Field, Inexact } from '@geomira/num/field';
import { isInexact } from '@geomira/num/field';
import { fromInteger } from '@geomira/num/rational';
import type { EvalContext, ToolSpec } from '../tool';
import { abs, half, signNormalized, vCross, vDot, vSub } from '../geom';
import { numOf, undef, type Value, type Vec } from '../value';
import {
  allPoints,
  badArgs,
  coincident,
  degenerateLine,
  lineAt,
  pointAt,
  pointsOf,
  polygonAt,
} from './args';

function num<T>(x: T | Inexact): Value<T> {
  return isInexact(x) ? x : numOf(x);
}

/**
 * dist(A, B) = |B − A|; dist(P, l) = distance from P to the carrier line of l. Degenerate
 * cases: A = B → 0; P on l → 0; a line with no direction → Undefined; √ not representable →
 * Inexact (always mod p).
 */
function dist<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [P, l] = [pointAt(args, 0), lineAt(args, 1)];
  if (P !== undefined && l !== undefined && args.length === 2) {
    const bad = degenerateLine(F, l, ctx);
    if (bad !== undefined) return bad;
    const c = vCross(F, vSub(F, P, l.p), l.d);
    return num(F.sqrt(F.div(F.mul(c, c), vDot(F, l.d, l.d))));
  }
  const [a, b] = pointsOf(args, 2) ?? [];
  if (a === undefined || b === undefined) return badArgs('dist');
  const d = vSub(F, b, a);
  return num(F.sqrt(vDot(F, d, d)));
}

/**
 * ratio(A, B, C, D) = AB / CD. Degenerate cases: C = D → Undefined (coincident points);
 * A = B → 0; √ not representable → Inexact.
 */
function ratio<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [a, b, c, d] = pointsOf(args, 4) ?? [];
  if (a === undefined || b === undefined || c === undefined || d === undefined) {
    return badArgs('ratio');
  }
  const ab = vSub(F, b, a);
  const cd = vSub(F, d, c);
  const bad = coincident(F, cd, ctx, 'ratio(A, B, C, D) needs C ≠ D');
  if (bad !== undefined) return bad;
  return num(F.sqrt(F.div(vDot(F, ab, ab), vDot(F, cd, cd))));
}

/** The arms A − B and C − B of an angle at B, or Undefined when one is a zero length. */
function arms<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  tool: string,
): readonly [Vec<T>, Vec<T>] | Value<T> {
  const [a, b, c] = pointsOf(args, 3) ?? [];
  if (a === undefined || b === undefined || c === undefined) return badArgs(tool);
  const u = vSub(F, a, b);
  const v = vSub(F, c, b);
  return (
    coincident(F, u, ctx, `${tool}(A, B, C) needs A ≠ B`) ??
    coincident(F, v, ctx, `${tool}(A, B, C) needs C ≠ B`) ?? [u, v]
  );
}

/**
 * angle(A, B, C): the undirected angle ABC in [0°, 180°]. Degenerate cases: A = B or C = B
 * → Undefined; collinear → 0° or 180°; mod p (no order) or atan2 off the special angles
 * over Q → Inexact.
 */
function angle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const uv = arms(F, args, ctx, 'angle');
  if ('kind' in uv) return uv;
  const [u, v] = uv;
  const s = abs(F, vCross(F, u, v), 'area', ctx);
  return isInexact(s) ? s : num(F.atan2(s, vDot(F, u, v)));
}

/**
 * dangle(A, B, C): the directed angle ∡ABC from line BA to line BC, counter-clockwise,
 * as the representative in [0°, 180°). Degenerate cases: A = B or C = B → Undefined;
 * collinear → 0; within the band of collinear → Undefined (ambiguous: the representative
 * would jump between ~0° and ~180°); mod p → Inexact.
 */
function dangle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const uv = arms(F, args, ctx, 'dangle');
  if ('kind' in uv) return uv;
  const [u, v] = uv;
  const cross = vCross(F, u, v);
  const s = signNormalized(F, cross, F.mul(vDot(F, u, u), vDot(F, v, v)), 'dimensionless', ctx);
  switch (s) {
    case 0:
      return numOf(F.zero);
    case 'ambiguous':
      return undef('ambiguous: A, B, C are within the band of collinear');
    case 'none':
      return { kind: 'inexact', reason: `directed angles need an order, which ${F.name} lacks` };
    case 1:
      return num(F.atan2(cross, vDot(F, u, v)));
    case -1: {
      const a = F.atan2(cross, vDot(F, u, v));
      const straight = F.fromRational(fromInteger(180));
      if (isInexact(a)) return a;
      return isInexact(straight) ? straight : numOf(F.add(a, straight));
    }
    default:
      return assertNever(s, 'field sign');
  }
}

/** The unsigned area |shoelace| / 2 of the vertices. Degenerate: collinear vertices → 0. */
function areaOf<T>(F: Field<T>, pts: readonly Vec<T>[], ctx: EvalContext): Value<T> {
  let twice = F.zero;
  for (const [i, p] of pts.entries()) {
    const q = pts[(i + 1) % pts.length] ?? p;
    twice = F.add(twice, vCross(F, p, q));
  }
  const a = abs(F, twice, 'area', ctx);
  return isInexact(a) ? a : numOf(F.mul(a, half(F)));
}

/** area(polygon) or area(P1, P2, P3, …). Degenerate: collinear → 0; mod p → Inexact. */
function area<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const poly = polygonAt(args, 0);
  if (poly !== undefined && args.length === 1) return areaOf(F, poly.pts, ctx);
  const pts = allPoints(args);
  return pts === undefined || pts.length < 3 ? badArgs('area') : areaOf(F, pts, ctx);
}

const O: readonly [string, string] = ['0', '0'];
const X: readonly [string, string] = ['3', '0'];
const Y: readonly [string, string] = ['0', '4'];
const XY: readonly [string, string] = ['3', '4'];

export const MEASURE_TOOLS: readonly ToolSpec[] = [
  {
    id: 'dist',
    name: 'dist',
    family: 'measures',
    signatures: [{ params: ['point', 'point'] }, { params: ['point', 'linear'] }],
    outputKinds: ['number'],
    compute: dist,
    degenerate: [
      'dist(A, A) = 0',
      'P on l → 0',
      'a segment or ray is extended to its carrier line',
    ],
    export: 'numeric',
    doc: 'dist(A, B): the length AB; dist(P, l): the distance from P to the line l.',
    examples: [{ args: [O, XY] }, { args: [XY, { through: [O, X], as: 'segment' }] }],
  },
  {
    id: 'ratio',
    name: 'ratio',
    family: 'measures',
    signatures: [{ params: ['point', 'point', 'point', 'point'] }],
    outputKinds: ['number'],
    compute: ratio,
    degenerate: ['C = D → Undefined (coincident points)', 'A = B → 0'],
    export: 'numeric',
    doc: 'ratio(A, B, C, D) = AB / CD.',
    examples: [{ args: [O, XY, O, X] }],
  },
  {
    id: 'angle',
    name: 'angle',
    family: 'measures',
    signatures: [{ params: ['point', 'point', 'point'] }],
    outputKinds: ['number'],
    compute: angle,
    degenerate: ['A = B or C = B → Undefined', 'collinear: 0° or 180°', 'mod p → Inexact'],
    export: 'numeric',
    doc: 'angle(A, B, C): the undirected angle ABC in degrees, in [0, 180].',
    examples: [{ args: [X, O, Y] }, { args: [XY, O, X] }],
  },
  {
    id: 'dangle',
    name: 'dangle',
    family: 'measures',
    signatures: [{ params: ['point', 'point', 'point'] }],
    outputKinds: ['number'],
    compute: dangle,
    degenerate: [
      'A = B or C = B → Undefined',
      'collinear → 0',
      'within the band of collinear → Undefined (ambiguous)',
      'mod p → Inexact',
    ],
    export: 'numeric',
    doc: 'dangle(A, B, C): the directed angle ∡ABC (line BA to line BC, counter-clockwise) mod 180°, in [0, 180).',
    examples: [{ args: [Y, O, X] }, { args: [XY, O, X] }],
  },
  {
    id: 'area',
    name: 'area',
    family: 'measures',
    signatures: [{ params: ['polygon'] }, { params: ['point', 'point', 'point'], rest: 'point' }],
    outputKinds: ['number'],
    compute: area,
    degenerate: ['collinear vertices → 0', 'mod p → Inexact (unsigned area needs an order)'],
    export: 'numeric',
    doc: 'The (unsigned) area of a polygon, or of the polygon through the given points.',
    examples: [{ args: [O, X, XY] }, { args: [{ polygon: [O, X, XY, Y] }] }],
  },
];
