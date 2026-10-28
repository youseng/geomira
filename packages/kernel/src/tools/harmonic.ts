/**
 * harmonic_conjugate (Run 16a, ADR-0040 decision 14), rational in its arguments: exact over Q
 * and mod p.
 *   - harmonic_conjugate(A, B, C): the point D of line AB with (A, B; C, D) = −1. With M the
 *     midpoint of AB, MC·MD = MA² (signed, along AB), so D = M + (|AB|²/4)/|MC|²·(C − M):
 *     symmetric in A ↔ B. C a point at infinity of AB's direction gives M; C = M gives the point
 *     at infinity of AB.
 *   - harmonic_conjugate(a, b, c): the line d of the pencil of a, b with (a, b; c, d) = −1.
 *     Through P = a ∩ b with direction cross(w, v)·u − cross(u, w)·v (u, v, w the directions
 *     of a, b, c): if w = αu + βv this is cross(u, v)·(αu − βv), the harmonic conjugate
 *     direction; symmetric in a ↔ b; trilinear with one cross product, so it is chiral unless
 *     an odd number of the inputs is (SPEC §4). A pencil of parallel lines gives the parallel
 *     through the harmonic conjugate on the transversal through c's base point perpendicular
 *     to c, with c's direction and flag.
 */
import type { Field } from '@geomira/num/field';
import { requireOnLine } from '../incidence';
import {
  half,
  isZeroNormalized,
  isZeroVec,
  vAdd,
  vCross,
  vDot,
  vRot90,
  vScale,
  vSub,
} from '../geom';
import type { ArgSymmetry, EvalContext, ExampleArg, Signature, ToolSpec } from '../tool';
import { undef, type Line, type Value, type Vec } from '../value';
import { badArgs, degenerateLine, lineAt, pointAt } from './args';
import { parallelism } from './parallel-lines';

const NAME = 'harmonic_conjugate';

/** D for C on line AB (C ≠ A, B checked by the caller): a point, or AB's point at infinity. */
function conjugatePoint<T>(
  F: Field<T>,
  a: Vec<T>,
  b: Vec<T>,
  c: Vec<T>,
  ctx: EvalContext,
): Value<T> {
  const m = vScale(F, vAdd(F, a, b), half(F));
  const mc = vSub(F, c, m);
  const u = vSub(F, b, a);
  if (isZeroVec(F, mc, ctx)) return { kind: 'ideal_point', d: u, chiral: false };
  const four = F.add(F.add(F.one, F.one), F.add(F.one, F.one));
  const k = F.div(vDot(F, u, u), F.mul(four, vDot(F, mc, mc)));
  return { kind: 'point', ...vAdd(F, m, vScale(F, mc, k)) };
}

/**
 * The point form. Degenerate cases: A = B → Undefined; C (a point) not on line AB, within the
 * band → Undefined (ambiguous), off it → Undefined; C = A or C = B → Undefined (no conjugate);
 * C a point at infinity not of AB's direction → Undefined; C = M → AB's point at infinity.
 */
function pointForm<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [a, b, c] = [pointAt(args, 0), pointAt(args, 1), args[2]];
  if (a === undefined || b === undefined || (c?.kind !== 'point' && c?.kind !== 'ideal_point'))
    return badArgs(NAME);
  const u = vSub(F, b, a);
  if (isZeroVec(F, u, ctx)) return undef(`coincident points: ${NAME}(A, B, C) needs A ≠ B`);
  if (c.kind === 'ideal_point') {
    const nn = F.mul(vDot(F, u, u), vDot(F, c.d, c.d));
    return isZeroNormalized(F, vCross(F, u, c.d), nn, 'dimensionless', ctx)
      ? { kind: 'point', ...vScale(F, vAdd(F, a, b), half(F)) }
      : undef(`${NAME}: C is a point at infinity off line AB`);
  }
  const line: Line<T> = { kind: 'line', p: a, d: u, lo: null, hi: null, chiral: false };
  const off = requireOnLine(F, c, line, ctx, `${NAME}(A, B, C) needs C on line AB`);
  if (off !== undefined) return off;
  if (isZeroVec(F, vSub(F, c, a), ctx) || isZeroVec(F, vSub(F, c, b), ctx))
    return undef(`${NAME}: C = A or C = B has no harmonic conjugate`);
  return conjugatePoint(F, a, b, c, ctx);
}

/** The parameter s of the point c.p + s·n of a line l parallel to c (n = rot90(c.d)). */
function across<T>(F: Field<T>, l: Line<T>, c: Line<T>, n: Vec<T>): T {
  return F.div(vCross(F, l.d, vSub(F, l.p, c.p)), vCross(F, l.d, n));
}

/** A pencil of parallel lines: the parallel through the conjugate on the transversal at c.p. */
function parallelPencil<T>(
  F: Field<T>,
  a: Line<T>,
  b: Line<T>,
  c: Line<T>,
  ctx: EvalContext,
): Value<T> {
  const n = vRot90(F, c.d);
  const [sa, sb] = [across(F, a, c, n), across(F, b, c, n)];
  const m = F.mul(F.add(sa, sb), half(F));
  // c is at s = 0 on the transversal: (0 − m)(s_d − m) = ((s_b − s_a)/2)².
  if (isZeroVec(F, vScale(F, n, m), ctx))
    return undef(`${NAME}: c is midway between a and b, so its conjugate is the line at infinity`);
  const h = F.mul(F.sub(sb, sa), half(F));
  const sd = F.sub(m, F.div(F.mul(h, h), m));
  return {
    kind: 'line',
    p: vAdd(F, c.p, vScale(F, n, sd)),
    d: c.d,
    lo: null,
    hi: null,
    chiral: c.chiral,
  };
}

/**
 * The line form. Degenerate cases: a line without direction → Undefined; a = b, c = a or
 * c = b (the same line) → Undefined; a, b, c not concurrent (c off a ∩ b, within the band:
 * ambiguous; or a ∥ b with c not parallel to them) → Undefined; a parallel pencil with c midway
 * → Undefined (the line at infinity).
 */
function lineForm<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [a, b, c] = [lineAt(args, 0), lineAt(args, 1), lineAt(args, 2)];
  if (a === undefined || b === undefined || c === undefined) return badArgs(NAME);
  const bad = degenerateLine(F, a, ctx) ?? degenerateLine(F, b, ctx) ?? degenerateLine(F, c, ctx);
  if (bad !== undefined) return bad;
  const same = undef(`${NAME}: two of a, b, c are the same line`);
  const [ab, ac, bc] = [
    parallelism(F, a, b, ctx),
    parallelism(F, a, c, ctx),
    parallelism(F, b, c, ctx),
  ];
  if (ab === 'coincident' || ac === 'coincident' || bc === 'coincident') return same;
  const notConcurrent = `${NAME}(a, b, c) needs a, b and c concurrent`;
  if (ab === 'parallel')
    return ac === 'parallel' ? parallelPencil(F, a, b, c, ctx) : undef(notConcurrent);
  const den = vCross(F, a.d, b.d);
  const p = vAdd(F, a.p, vScale(F, a.d, F.div(vCross(F, vSub(F, b.p, a.p), b.d), den)));
  const off = requireOnLine(F, p, c, ctx, notConcurrent);
  if (off !== undefined) return off;
  const [u, v, w] = [a.d, b.d, c.d];
  const d = vSub(F, vScale(F, u, vCross(F, w, v)), vScale(F, v, vCross(F, u, w)));
  const odd = (a.chiral !== b.chiral) !== c.chiral;
  const chiral = !odd;
  return { kind: 'line', p, d, lo: null, hi: null, chiral };
}

function harmonicConjugate<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  if (args.length !== 3) return badArgs(NAME);
  return args[0]?.kind === 'line' ? lineForm(F, args, ctx) : pointForm(F, args, ctx);
}

const SWAP_AB: readonly ArgSymmetry[] = [{ kind: 'permute', positions: [0, 1], same: 'value' }];
const POINTS: Signature = {
  params: ['point', 'point', 'ppoint'],
  symmetry: SWAP_AB,
  output: ['point', 'ideal_point'],
};
const LINES: Signature = {
  params: ['linear', 'linear', 'linear'],
  symmetry: SWAP_AB,
  output: ['line'],
};
const P = (x: string, y: string): readonly [string, string] => [x, y];
const lineArg = (a: readonly [string, string], b: readonly [string, string]): ExampleArg => ({
  through: [a, b],
  as: 'line',
});

export const HARMONIC_TOOLS: readonly ToolSpec[] = [
  {
    id: NAME,
    name: NAME,
    family: 'points',
    signatures: [POINTS, LINES],
    outputKinds: ['point', 'ideal_point', 'line'],
    compute: harmonicConjugate,
    degenerate: [
      'A = B → Undefined',
      'C not on line AB → Undefined (within the band: ambiguous)',
      'C = A or C = B → Undefined',
      'C the midpoint of AB → the point at infinity of AB',
      'C the point at infinity of AB → the midpoint; of another direction → Undefined',
      'lines: two of a, b, c the same line → Undefined',
      'lines: a, b, c not concurrent → Undefined',
      'lines: a parallel pencil → the parallel line; c midway → Undefined (the line at infinity)',
    ],
    export: 'numeric',
    doc:
      'harmonic_conjugate(A, B, C): the point D of line AB with (A, B; C, D) = −1 (C on AB; the ' +
      'midpoint gives the point at infinity of AB). harmonic_conjugate(a, b, c): the line d ' +
      'through the common point of the concurrent lines a, b, c with (a, b; c, d) = −1. Exact.',
    examples: [
      { args: [P('0', '0'), P('6', '0'), P('2', '0')] },
      { args: [P('0', '0'), P('6', '0'), P('3', '0')] },
      {
        args: [
          lineArg(P('0', '0'), P('1', '0')),
          lineArg(P('0', '0'), P('0', '1')),
          lineArg(P('0', '0'), P('1', '1')),
        ],
      },
    ],
  },
];
