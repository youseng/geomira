/**
 * The projective constructors (ADR-0040 decisions 11 and 12), registry tools over the matrices of
 * projective.ts. Both are rational in their arguments: exact over Q and mod p.
 *   - projective(A, B, C, D, A′, B′, C′, D′): the map with A ↦ A′, …, D ↦ D′ (points or points
 *     at infinity, as homogeneous columns): M = N′·adj(N) with N = [αA | βB | γC] and
 *     (α, β, γ) = adj([A | B | C])·D, so N sends the basis and (1, 1, 1) to A, B, C, D.
 *   - send_to_infinity(l): with l = p + t·d and n = rot90(d), the frame X = p + t·d + s·n and
 *     (t : s : 1) ↦ (t : 1 : s), i.e. X ↦ p + (t/s)·d + (1/s)·n: it swaps l and the line at
 *     infinity and is its own inverse (the harmonic homology with axis s = 1 and centre p − n).
 */
import type { Field } from '@geomira/num/field';
import { isZeroNormalized, vCross, vDot, vRot90, vSub } from '../geom';
import type { EvalContext, ExampleArg, Signature, ToolSpec } from '../tool';
import { undef, type Value, type ValueKind, type Vec } from '../value';
import { badArgs, degenerateLine, lineAt } from '../tools/args';
import { mapProblem } from './mobius';
import { adj3, mul3, mulHom, projective, type Hom, type Mat3 } from './projective';

/** A point or a point at infinity: its position or direction, and whether it is finite. */
type PPoint<T> = { readonly at: Vec<T>; readonly finite: boolean };

function ppointAt<T>(args: readonly Value<T>[], i: number): PPoint<T> | undefined {
  const v = args[i];
  if (v?.kind === 'point') return { at: v, finite: true };
  return v?.kind === 'ideal_point' ? { at: v.d, finite: false } : undefined;
}

/**
 * Whether three projective points are collinear, decided on a sine (ADR-0003 item 21): finite
 * points on the angle at the first, a direction against the line or the other direction; three
 * points at infinity lie on the line at infinity. Coincident points count as collinear.
 */
function collinear3<T>(F: Field<T>, ps: readonly PPoint<T>[], ctx: EvalContext): boolean {
  const fin = ps.filter((p) => p.finite);
  const inf = ps.filter((p) => !p.finite);
  const sine = (u: Vec<T>, v: Vec<T>): boolean =>
    isZeroNormalized(F, vCross(F, u, v), F.mul(vDot(F, u, u), vDot(F, v, v)), 'dimensionless', ctx);
  const [f0, f1, f2] = fin;
  const [i0, i1] = inf;
  if (f0 !== undefined && f1 !== undefined && f2 !== undefined)
    return sine(vSub(F, f1.at, f0.at), vSub(F, f2.at, f0.at));
  if (f0 !== undefined && f1 !== undefined && i0 !== undefined)
    return sine(vSub(F, f1.at, f0.at), i0.at);
  if (i0 !== undefined && i1 !== undefined && fin.length === 1) return sine(i0.at, i1.at);
  return true;
}

const homOf = <T>(F: Field<T>, p: PPoint<T>): Hom<T> => [p.at.x, p.at.y, p.finite ? F.one : F.zero];

/** [αA | βB | γC] with (α, β, γ) = adj([A | B | C])·D: the basis and (1, 1, 1) to A, B, C, D. */
function frame<T>(F: Field<T>, ps: readonly PPoint<T>[]): Mat3<T> {
  const [a, b, c, d] = ps.map((p) => homOf(F, p));
  const z: Hom<T> = [F.zero, F.zero, F.zero];
  const [A, B, C, D] = [a ?? z, b ?? z, c ?? z, d ?? z];
  const n: Mat3<T> = [A[0], B[0], C[0], A[1], B[1], C[1], A[2], B[2], C[2]];
  const [al, be, ga] = mulHom(F, adj3(F, n), D);
  return [
    F.mul(al, A[0]),
    F.mul(be, B[0]),
    F.mul(ga, C[0]),
    F.mul(al, A[1]),
    F.mul(be, B[1]),
    F.mul(ga, C[1]),
    F.mul(al, A[2]),
    F.mul(be, B[2]),
    F.mul(ga, C[2]),
  ];
}

const TRIPLES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 1, 3],
  [0, 2, 3],
  [1, 2, 3],
];
const NAMES = ['A', 'B', 'C', 'D'];

/** The first collinear triple of four projective points, named, or undefined. */
function collinearTriple<T>(
  F: Field<T>,
  ps: readonly PPoint<T>[],
  ctx: EvalContext,
  prime: string,
): string | undefined {
  for (const tr of TRIPLES) {
    const three = tr.map((i) => ps[i]).filter((p): p is PPoint<T> => p !== undefined);
    if (collinear3(F, three, ctx)) return tr.map((i) => `${NAMES[i] ?? '?'}${prime}`).join(', ');
  }
  return undefined;
}

/**
 * projective(A, B, C, D, A′, B′, C′, D′). Degenerate: three of A, B, C, D (or of A′, B′, C′, D′)
 * collinear (coincident points included; three points at infinity) → Undefined; a matrix beyond
 * the double range → Inexact.
 */
function projectiveTool<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const ps = args.map((_, i) => ppointAt(args, i));
  const pts = ps.filter((p): p is PPoint<T> => p !== undefined);
  if (args.length !== 8 || pts.length !== 8) return badArgs('projective');
  const [src, dst] = [pts.slice(0, 4), pts.slice(4)];
  for (const [side, prime] of [
    [src, ''],
    [dst, '′'],
  ] as const) {
    const bad = collinearTriple(F, side, ctx, prime);
    if (bad !== undefined)
      return undef(`projective: ${bad} are collinear: no three of the four points may be`);
  }
  const t = projective(mul3(F, frame(F, dst), adj3(F, frame(F, src))));
  return mapProblem(F, t, 'projective') ?? { kind: 'transform', t };
}

/**
 * send_to_infinity(l): the matrix of X ↦ p + (t/s)·d + (1/s)·n in world coordinates (rows times
 * |d|², a non-zero factor): W = n·(X − p), and the image numerator
 * p·(n·(X − p)) + (d·(X − p))·d + |d|²·n. Degenerate: a line without direction → Undefined; a
 * segment or ray → its carrier line.
 */
function sendToInfinity<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const l = lineAt(args, 0);
  if (l === undefined || args.length !== 1) return badArgs('send_to_infinity');
  const bad = degenerateLine(F, l, ctx);
  if (bad !== undefined) return bad;
  const { p, d } = l;
  const n = vRot90(F, d);
  const [np, dp, dd] = [vDot(F, n, p), vDot(F, d, p), vDot(F, d, d)];
  const row = (pc: T, dc: T, nc: T): readonly [T, T, T] => [
    F.add(F.mul(pc, n.x), F.mul(dc, d.x)),
    F.add(F.mul(pc, n.y), F.mul(dc, d.y)),
    F.add(F.sub(F.neg(F.mul(pc, np)), F.mul(dc, dp)), F.mul(dd, nc)),
  ];
  const t = projective<T>([...row(p.x, d.x, n.x), ...row(p.y, d.y, n.y), n.x, n.y, F.neg(np)]);
  return mapProblem(F, t, 'send_to_infinity') ?? { kind: 'transform', t };
}

const PROJECTIVE_OUT: readonly ValueKind[] = ['transform', 'projective'];
const P = (x: string, y: string): readonly [string, string] => [x, y];
const lineArg = (a: readonly [string, string], b: readonly [string, string]): ExampleArg => ({
  through: [a, b],
  as: 'line',
});
const EIGHT: Signature = {
  params: ['ppoint', 'ppoint', 'ppoint', 'ppoint', 'ppoint', 'ppoint', 'ppoint', 'ppoint'],
  output: PROJECTIVE_OUT,
  symmetry: [],
};

export const PROJECTIVE_TOOLS: readonly ToolSpec[] = [
  {
    id: 'projective',
    name: 'projective',
    family: 'transformations',
    signatures: [EIGHT],
    outputKinds: ['transform'],
    compute: projectiveTool,
    degenerate: [
      'three of A, B, C, D collinear (or coincident) → Undefined',
      "three of A', B', C', D' collinear (or coincident) → Undefined",
      'points at infinity among the eight → the map through them',
    ],
    export: 'numeric',
    doc:
      "projective(A, B, C, D, A', B', C', D'): the projective map taking A to A', B to B', C to " +
      "C' and D to D' (points, or points at infinity); no three of A, B, C, D (nor of A', B', " +
      "C', D') collinear. Apply it with apply(T, X) or a derived layer. Exact.",
    examples: [
      {
        args: [
          P('0', '0'),
          P('4', '0'),
          P('4', '4'),
          P('0', '4'),
          P('0', '0'),
          P('4', '0'),
          P('3', '2'),
          P('1', '2'),
        ],
      },
    ],
  },
  {
    id: 'send_to_infinity',
    name: 'send_to_infinity',
    family: 'transformations',
    signatures: [{ params: ['linear'], output: PROJECTIVE_OUT, symmetry: [] }],
    outputKinds: ['transform'],
    compute: sendToInfinity,
    degenerate: [
      'a line without direction → Undefined',
      'a segment or ray → the map of its carrier line',
      'l itself → Undefined under the map (sent to infinity)',
      'applied twice → the identity (an involution)',
    ],
    export: 'numeric',
    doc:
      'send_to_infinity(l): the projective map that swaps line l and the line at infinity: in ' +
      'the frame X = p + t·d + s·rot90(d) of l = p + t·d, X ↦ p + (t/s)·d + (1/s)·rot90(d). It ' +
      'is its own inverse; points of l go to infinity, points at infinity to l. Use it as ' +
      '`@layer inf = image(f, main)` with f = send_to_infinity(l). Exact.',
    examples: [{ args: [lineArg(P('0', '0'), P('4', '0'))] }],
  },
];
