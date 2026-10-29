/**
 * foci(k, selectors) (ADR-0043 decisions 15–16): the foci of a conic; the centre of a circle. With
 * the dual conic C* = adj(M) = [[A, B, D], [B, C, E], [D, E, G]], the isotropic lines through
 * z = x + iy are tangent to k exactly when
 *     q(z) = G·z² − 2(D + iE)·z + (A − C + 2iB) = 0,
 * so the foci are the roots of this complex quadratic (the classical characterisation of the foci
 * by the circular points). An ellipse or a hyperbola (G = ac − b² ≠ 0): the centre
 * c = (D + iE)/G and c ± √w/G, w = (D + iE)² − G·(A − C + 2iB), two candidates decided on the
 * half focal distance |√w/G| as a length with the band (within it: the centre, a double point; a
 * conic that is nearly a circle); √w needs two real square roots (Inexact over Q unless they are
 * squares, always mod p). A parabola (G = 0): the one focus (A − C + 2iB)/(2(D + iE)), rational.
 * No low-level selector; other(F): F a focus (|q(F)|/|q′(F)| as a length with the band, exact
 * fields q(F) = 0), the other focus 2c − F, exact; a parabola's is at infinity.
 */
import { isInexact, type Field, type Inexact } from '@geomira/num/field';
import { coeffsOf, conicProblem, conicType, matrixOf } from '../conic';
import { signNormalized, two, vAdd, vScale, vSub } from '../geom';
import { choose, candidateValues } from '../select';
import type { EvaluatedSelector } from '../selector';
import type { BranchShape, EvalContext, ExampleArg, ToolSpec } from '../tool';
import { adj3 } from '../transform/projective';
import { pointOf, undef, type Conic, type Undefined, type Value, type Vec } from '../value';
import { badArgs, circleAt, conicAt, degenerateCircle } from './args';
import { ELLIPSE, HYPERBOLA } from './conics';
import { asPoint, type Cand, type Pair } from './pairs';

export const FOCI: BranchShape = { candidates: 2, low: 'none', other: true, describe: 'foci(k)' };

/** Complex numbers as pairs (re, im) over F. */
type Cx<T> = Vec<T>;
const cmul = <T>(F: Field<T>, a: Cx<T>, b: Cx<T>): Cx<T> => ({
  x: F.sub(F.mul(a.x, b.x), F.mul(a.y, b.y)),
  y: F.add(F.mul(a.x, b.y), F.mul(a.y, b.x)),
});
const cabs2 = <T>(F: Field<T>, a: Cx<T>): T => F.add(F.mul(a.x, a.x), F.mul(a.y, a.y));

/** The quadratic's data: G, h = D + iE, s = A − C + 2iB. */
interface Quad<T> {
  readonly G: T;
  readonly h: Cx<T>;
  readonly s: Cx<T>;
}

function quadOf<T>(F: Field<T>, k: Conic<T>): Quad<T> {
  const m = adj3(F, matrixOf(coeffsOf(k)));
  return {
    G: m[8],
    h: { x: m[2], y: m[5] },
    s: { x: F.sub(m[0], m[4]), y: F.mul(two(F), m[1]) },
  };
}

/** q(z) and q′(z). */
function qAt<T>(F: Field<T>, d: Quad<T>, z: Cx<T>): { readonly v: Cx<T>; readonly dv: Cx<T> } {
  const Gz = vScale(F, z, d.G);
  const v = vAdd(F, vSub(F, cmul(F, Gz, z), vScale(F, cmul(F, d.h, z), two(F))), d.s);
  return { v, dv: vScale(F, vSub(F, Gz, d.h), two(F)) };
}

/** √w for a complex w (two real square roots; the stable branch). */
function csqrt<T>(F: Field<T>, w: Cx<T>): Cx<T> | Inexact {
  const m = F.sqrt(cabs2(F, w));
  if (isInexact(m)) return m;
  const half = (x: T) => F.div(x, two(F));
  if (F.kind !== 'modp' && F.toNumber(w.x) >= 0) {
    const a = F.sqrt(half(F.add(m, w.x)));
    if (isInexact(a)) return a;
    return F.eq(a, F.zero) ? { x: a, y: a } : { x: a, y: F.div(w.y, F.mul(two(F), a)) };
  }
  const b = F.sqrt(half(F.sub(m, w.x)));
  if (isInexact(b)) return b;
  const sb = F.kind !== 'modp' && F.toNumber(w.y) < 0 ? F.neg(b) : b;
  return F.eq(sb, F.zero) ? { x: sb, y: sb } : { x: F.div(w.y, F.mul(two(F), sb)), y: sb };
}

type Kind = 'central' | 'parabola';

/** The kind of conic for its foci: G = 0 exactly or a parabola by the type decision. */
function kindOf<T>(F: Field<T>, k: Conic<T>, d: Quad<T>, ctx: EvalContext): Kind | Undefined {
  if (F.eq(d.G, F.zero)) return 'parabola';
  if (F.kind === 'modp') return 'central';
  const t = conicType(F, k, ctx);
  if (typeof t !== 'string') return t.kind === 'inexact' ? undef(t.reason) : t;
  return t === 'parabola' ? 'parabola' : 'central';
}

/** A parabola's focus s/(2h); undefined when h = 0 (not a valid parabola: unreachable). */
function parabolaFocus<T>(F: Field<T>, d: Quad<T>): Vec<T> | undefined {
  const twoH = vScale(F, d.h, two(F));
  const n2 = cabs2(F, twoH);
  if (F.eq(n2, F.zero)) return undefined;
  const f = cmul(F, d.s, { x: twoH.x, y: F.neg(twoH.y) });
  return { x: F.div(f.x, n2), y: F.div(f.y, n2) };
}

/** The pair of foci of a valid conic (module comment). */
function fociPair<T>(F: Field<T>, k: Conic<T>, ctx: EvalContext): Pair<T> | Undefined {
  const bad = conicProblem(F, k, ctx);
  if (bad !== undefined) return undef(bad.reason);
  const d = quadOf(F, k);
  const kind = kindOf(F, k, d, ctx);
  if (typeof kind !== 'string') return kind;
  const centre = kind === 'central' ? vScale(F, d.h, F.div(F.one, d.G)) : parabolaFocus(F, d);
  if (centre === undefined) return undef('foci(k): the parabola has no finite focus');
  const w = vSub(F, cmul(F, d.h, d.h), vScale(F, d.s, d.G));
  const count = (): 1 | 2 => {
    if (kind === 'parabola') return 1;
    if (F.eq(w.x, F.zero) && F.eq(w.y, F.zero)) return 1;
    if (F.kind !== 'float') return 2;
    // The half focal distance |w|^{1/2}/|G|, a length with the band.
    const mw = F.sqrt(cabs2(F, w));
    if (isInexact(mw)) return 2;
    const [m, g] = [F.sqrt(mw), F.sqrt(F.mul(d.G, d.G))];
    if (isInexact(m) || isInexact(g)) return 2;
    const s = F.sign(F.div(m, g), 'length', ctx);
    return s === 1 ? 2 : 1;
  };
  return {
    shape: FOCI,
    noun: 'focus',
    plural: 'foci',
    low: { kind: 'none' },
    count,
    list: (n) => {
      if (n === 1) return [{ at: centre, side: 0 }];
      const r = csqrt(F, w);
      if (isInexact(r)) return r;
      const off = vScale(F, r, F.div(F.one, d.G));
      const cands: Cand<T>[] = [
        { at: vSub(F, centre, off), side: 0 },
        { at: vAdd(F, centre, off), side: 0 },
      ];
      return cands;
    },
    other: {
      curves: [],
      check: (P) => isFocus(F, d, P, ctx),
      point: (P) =>
        kind === 'parabola'
          ? undef('other(F): the other focus of a parabola is at infinity')
          : vSub(F, vScale(F, centre, two(F)), P),
    },
    output: asPoint,
  };
}

/** Undefined unless P is a focus: |q(P)|/|q′(P)| as a length with the band (exact: q(P) = 0). */
function isFocus<T>(F: Field<T>, d: Quad<T>, P: Vec<T>, ctx: EvalContext): Undefined | undefined {
  const { v, dv } = qAt(F, d, P);
  const what = 'other(F) needs F to be a focus of the conic';
  if (F.eq(v.x, F.zero) && F.eq(v.y, F.zero)) return undefined;
  if (F.kind !== 'float') return undef(what);
  const s = signNormalized(F, cabs2(F, v), F.mul(cabs2(F, v), cabs2(F, dv)), 'length', ctx);
  if (s === 0) return undefined;
  return s === 'ambiguous' ? undef(`ambiguous: within the band of a focus (${what})`) : undef(what);
}

/**
 * foci(k, selectors) and foci(c). Degenerate cases: as ToolSpec.degenerate below; a circle →
 * its centre (an arc: its carrier's).
 */
function foci<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  selectors: readonly EvaluatedSelector<T>[] = [],
): Value<T> {
  const [k, c] = [conicAt(args, 0), circleAt(args, 0)];
  if (args.length !== 1) return badArgs('foci');
  if (c !== undefined) {
    if (selectors.length > 0)
      return undef('foci(c): a circle has one focus, its center: no selector');
    return degenerateCircle(F, c, ctx) ?? pointOf(c.c.x, c.c.y);
  }
  if (k === undefined) return badArgs('foci');
  const p = fociPair(F, k, ctx);
  return 'kind' in p ? p : choose(F, p, selectors, ctx);
}

function candidates<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
): readonly Value<T>[] {
  const [k, c] = [conicAt(args, 0), circleAt(args, 0)];
  if (c !== undefined)
    return degenerateCircle(F, c, ctx) === undefined ? [pointOf(c.c.x, c.c.y)] : [];
  if (k === undefined || args.length !== 1) return [];
  const p = fociPair(F, k, ctx);
  return 'kind' in p ? [] : candidateValues(p);
}

/** The ellipse x²/25 + y²/9 = 1, whose foci (±4, 0) are rational. */
const ELLIPSE_5_3: ExampleArg = {
  call: 'conic',
  args: [
    ['5', '0'],
    ['0', '3'],
    ['-5', '0'],
    ['0', '-3'],
    ['3', '12/5'],
  ],
};

/** The parabola y = x² (focus (0, 1/4)). */
const PARABOLA: ExampleArg = {
  call: 'conic',
  args: [
    ['0', '0'],
    ['1', '1'],
    ['-1', '1'],
    ['2', '4'],
    ['-2', '4'],
  ],
};

export const FOCI_TOOLS: readonly ToolSpec[] = [
  {
    id: 'foci',
    name: 'foci',
    family: 'points',
    signatures: [
      { params: ['round'], output: ['point'], symmetry: [] },
      { params: ['conic'], branch: FOCI, output: ['point'], radical: true, symmetry: [] },
    ],
    outputKinds: ['point'],
    compute: foci,
    candidates,
    degenerate: [
      'a circle → its center (no selector)',
      'an ellipse or a hyperbola: two foci; no selector → Undefined (ambiguous: add a selector)',
      'the two foci within the band of each other (a conic that is nearly a circle) → the center, one double point',
      'a parabola → its one focus, exact over Q and mod p',
      'a conic within the band of a parabola → Undefined (ambiguous)',
      'the square roots of the foci not representable → Inexact over Q and mod p',
      'other(F) with F not a focus → Undefined (within the band: ambiguous); a parabola’s other focus is at infinity → Undefined',
      'along(±) or orient(±) → Undefined (they do not apply)',
      'an invalid conic → Undefined',
    ],
    export: 'numeric',
    doc: "foci(k, selectors): a focus of a conic (an ellipse's or a hyperbola's two foci need a selector: other(F), near(P), same_side(Q, l), …; a parabola's one focus is exact); foci(c) is a circle's center. The foci are the points whose isotropic lines touch the conic.",
    examples: [
      { args: [ELLIPSE_5_3], selectors: [{ kind: 'near', p: ['10', '0'] }] },
      { args: [ELLIPSE_5_3], selectors: [{ kind: 'other', p: ['4', '0'] }] },
      { args: [ELLIPSE], selectors: [{ kind: 'near', p: ['2', '0'] }] },
      { args: [HYPERBOLA], selectors: [{ kind: 'near', p: ['1', '1'] }] },
      { args: [PARABOLA], selectors: [{ kind: 'near', p: ['0', '0'] }] },
      {
        args: [
          {
            call: 'circle',
            args: [
              ['1', '2'],
              ['4', '6'],
            ],
          },
        ],
      },
    ],
  },
];
