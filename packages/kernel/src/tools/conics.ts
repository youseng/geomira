/**
 * Conic tools (ADR-0042): conic(A, B, C, D, E), the conic through five points, and
 * conic_center(k). The conic through A, B, C, D, E is a member of the pencil of the two line
 * pairs AB·CD and AC·BD (each through A, B, C, D): λ·AB·CD + μ·AC·BD with
 * (λ, μ) = (AC·BD(E), −AB·CD(E)), computed in coordinates relative to A (scaled by the points'
 * spread when its square root is representable, so floats keep their digits; exact fields do
 * not scale) and put in normal form, which is unique: every order of the five points gives the
 * same coefficients. Rational: exact over Q and mod p.
 */
import { isInexact, type Field } from '@geomira/num/field';
import { makeConic, mapCoeffs, pencilCoeffs } from '../conic';
import { isZeroNormalized, isZeroVec, vCross, vDot, vSub } from '../geom';
import type { ArgSymmetry, EvalContext, ExampleArg, ToolSpec } from '../tool';
import { undef, type Undefined, type Value, type Vec } from '../value';
import { badArgs, conicAt, pointsOf } from './args';
import { conicCentre } from './conic-lines';

/** Whether three points are collinear (the normalised cross product within EPS, ADR-0003 item 21). */
function collinear<T>(F: Field<T>, P: Vec<T>, Q: Vec<T>, R: Vec<T>, ctx: EvalContext): boolean {
  const [u, v] = [vSub(F, Q, P), vSub(F, R, P)];
  return isZeroNormalized(
    F,
    vCross(F, u, v),
    F.mul(vDot(F, u, u), vDot(F, v, v)),
    'dimensionless',
    ctx,
  );
}

/** Why five points determine no conic, or undefined. */
function fivePointsProblem<T>(
  F: Field<T>,
  ps: readonly Vec<T>[],
  ctx: EvalContext,
): Undefined | undefined {
  for (const [i, P] of ps.entries())
    for (const Q of ps.slice(i + 1))
      if (isZeroVec(F, vSub(F, Q, P), ctx))
        return undef('coincident points: conic(A, B, C, D, E) needs five distinct points');
  const pairs = new Map<string, number>();
  let triples = 0;
  for (let i = 0; i < 5; i++)
    for (let j = i + 1; j < 5; j++)
      for (let l = j + 1; l < 5; l++) {
        const [P, Q, R] = [ps[i], ps[j], ps[l]];
        if (P === undefined || Q === undefined || R === undefined) continue;
        if (!collinear(F, P, Q, R, ctx)) continue;
        triples++;
        for (const key of [
          `${String(i)}${String(j)}`,
          `${String(i)}${String(l)}`,
          `${String(j)}${String(l)}`,
        ])
          pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
  if (triples === 0) return undefined;
  if ([...pairs.values()].some((n) => n >= 2))
    return undef('four of the points are collinear: no unique conic passes through them');
  return undef('three of the points are collinear: the conic through them is a pair of lines');
}

/**
 * conic(A, B, C, D, E). Degenerate cases: two coincident points → Undefined; four collinear
 * points → Undefined (no unique conic); three collinear points → Undefined (the conic is a pair
 * of lines); a conic within the band of a pair of lines → Undefined (ambiguous); beyond the
 * double range → Inexact.
 */
function conic<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const pts = pointsOf(args, 5);
  if (pts === undefined) return badArgs('conic');
  const bad = fivePointsProblem(F, pts, ctx);
  if (bad !== undefined) return bad;
  const [A, B, C, D, E] = pts;
  if (A === undefined || B === undefined || C === undefined || D === undefined || E === undefined)
    return badArgs('conic');
  const rel = pts.map((P) => vSub(F, P, A));
  const spread = rel.reduce((s, w) => F.add(s, vDot(F, w, w)), F.zero);
  const r = F.sqrt(spread);
  const scale = isInexact(r) ? F.one : r;
  const [, b, c, d, e] = rel.map((w) => ({ x: F.div(w.x, scale), y: F.div(w.y, scale) }));
  const o = { x: F.zero, y: F.zero };
  if (b === undefined || c === undefined || d === undefined || e === undefined)
    return badArgs('conic');
  const local = pencilCoeffs(F, o, b, c, d, e);
  // Back to world coordinates: the point map w ↦ A + scale·w takes the local conic to the conic.
  const z = F.zero;
  const q = mapCoeffs(F, local, [scale, z, A.x, z, scale, A.y, z, z, F.one]);
  return makeConic(F, q, A, ctx);
}

function center<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const k = conicAt(args, 0);
  return k === undefined || args.length !== 1 ? badArgs('conic_center') : conicCentre(F, k, ctx);
}

/** Five points of the hyperbola xy = 1. */
const HYPERBOLA_POINTS: readonly ExampleArg[] = [
  ['1', '1'],
  ['2', '1/2'],
  ['-1', '-1'],
  ['4', '1/4'],
  ['1/2', '2'],
];

/** Five points of the ellipse x²/4 + y² = 1. */
const ELLIPSE_POINTS: readonly ExampleArg[] = [
  ['2', '0'],
  ['0', '1'],
  ['-2', '0'],
  ['0', '-1'],
  ['6/5', '4/5'],
];

/** The hyperbola xy = 1 (anchor (1, 1)), for the examples of the conic tools. */
export const HYPERBOLA: ExampleArg = { call: 'conic', args: HYPERBOLA_POINTS };

/** The ellipse x²/4 + y² = 1 (anchor (2, 0)). */
export const ELLIPSE: ExampleArg = { call: 'conic', args: ELLIPSE_POINTS };

/** B, C, D, E in any order: the same value; any order of the five: the same conic (anchor A). */
const FIVE: readonly ArgSymmetry[] = [
  { kind: 'permute', positions: [1, 2, 3, 4], same: 'value' },
  { kind: 'permute', positions: [0, 1, 2, 3, 4], same: 'figure' },
];

export const CONIC_TOOLS: readonly ToolSpec[] = [
  {
    id: 'conic',
    name: 'conic',
    family: 'circles',
    signatures: [{ params: ['point', 'point', 'point', 'point', 'point'], symmetry: FIVE }],
    outputKinds: ['conic'],
    compute: conic,
    degenerate: [
      'two coincident points → Undefined',
      'four collinear points → Undefined (no unique conic)',
      'three collinear points → Undefined (a pair of lines)',
      'a conic within the band of a pair of lines → Undefined (ambiguous)',
    ],
    export: 'numeric',
    doc: 'conic(A, B, C, D, E): the conic through five points (no three collinear), in the normal form det M = a² + 2b² + c² of Q = ax² + 2bxy + cy² + 2dx + 2ey + f; its known point (for gliders) is A; exact.',
    examples: [{ args: HYPERBOLA_POINTS }, { args: ELLIPSE_POINTS }],
  },
  {
    id: 'conic_center',
    name: 'conic_center',
    family: 'points',
    signatures: [{ params: ['conic'], output: ['point', 'ideal_point'] }],
    outputKinds: ['point', 'ideal_point'],
    compute: center,
    degenerate: [
      'a parabola → the point at infinity of its axis',
      'a conic within the band of a parabola → Undefined (ambiguous)',
    ],
    export: 'numeric',
    doc: "conic_center(k): the center of a conic, the pole of the line at infinity; a parabola's center is the point at infinity of its axis; exact.",
    examples: [{ args: [HYPERBOLA] }, { args: [ELLIPSE] }],
  },
];
