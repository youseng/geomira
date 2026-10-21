/**
 * Similarity transformations (SPEC §6.2, §8.1): reflect(l), reflect(P), rotate(O, θ),
 * homothety(O, k), translate(A, B), spiral(A, B, C, D), compose(T1, T2) (T2 first),
 * inverse(T), apply(T, X), and the image sugar reflect(X, ·), rotate(X, O, θ),
 * homothety(X, O, k), translate(X, A, B), spiral(X, A, B, C, D), which is apply(T, X) with
 * X as an extra FIRST argument (told apart by arity). Each map is built by one
 * field-generic function; images are computed by similarity.ts. Every Transform value
 * returned is invertible (similarityProblem), and numbers and maps are never imaged.
 */
import { cAbs2, cDiv, cMul, cScale, cSub, complex, type Complex } from '@geomira/num/complex';
import { allExact, isInexact, type Field, type Inexact } from '@geomira/num/field';
import { RationalField } from '@geomira/num/rational-field';
import { vSub } from '../geom';
import {
  applySimilarity,
  composeSimilarities,
  inverseSimilarity,
  similarity,
  similarityProblem,
  transformOf,
} from '../similarity';
import type { EvalContext, ExampleArg, ExportOp, Signature, ToolExample, ToolSpec } from '../tool';
import {
  capabilityKinds,
  undef,
  type Capability,
  type Num,
  type Similarity,
  type Undefined,
  type Value,
  type ValueKind,
  type Vec,
} from '../value';
import { badArgs, coincident, degenerateLine, lineAt, numAt, pointAt } from './args';

type Built<T> = Similarity<T> | Undefined | Inexact;

/** Builds a map from the arguments of one base signature (without X). */
type Build = <T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext) => Built<T>;

const c = <T>(v: Vec<T>): Complex<T> => complex(v.x, v.y);

/** z ↦ a·z + (P − a·P): the map with linear part a that fixes P. */
function fixing<T>(F: Field<T>, a: Complex<T>, P: Vec<T>): Similarity<T> {
  return similarity(false, a, cSub(F, c(P), cMul(F, a, c(P))));
}

/**
 * reflect(l): z ↦ p + (d/d̄)·conj(z − p), i.e. a = d²/|d|², b = p − a·p̄ (anti). Degenerate:
 * a line with no direction → Undefined (the v1 line tools never build one; a degenerate
 * line such as line(A, A) is already Undefined).
 */
function reflectLine<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Built<T> {
  const l = lineAt(args, 0);
  if (l === undefined) return badArgs('reflect');
  const bad = degenerateLine(F, l, ctx);
  if (bad !== undefined) return bad;
  const d = c(l.d);
  const a = cScale(F, cMul(F, d, d), F.div(F.one, cAbs2(F, d)));
  const p = c(l.p);
  return similarity(true, a, cSub(F, p, cMul(F, a, complex(p.re, F.neg(p.im)))));
}

/** reflect(P): the half turn about P, z ↦ 2P − z (no degenerate case); reflect(l) otherwise. */
function reflectBuild<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Built<T> {
  const P = pointAt(args, 0);
  return P === undefined ? reflectLine(F, args, ctx) : fixing(F, complex(F.neg(F.one), F.zero), P);
}

/**
 * cos θ and sin θ in degrees: from the exact value of θ when both are rational there (the
 * multiples of 90°), in every field; otherwise the field's own (Inexact over Q off those
 * angles, and mod p).
 */
function unit<T>(F: Field<T>, theta: Num<T>): Complex<T> | Inexact {
  if (theta.exact !== undefined) {
    // Both rational only at the multiples of 90° (0, ±1: representable in every field).
    const exact = allExact([RationalField.cos(theta.exact), RationalField.sin(theta.exact)]);
    const values = isInexact(exact) ? exact : allExact(exact.map((x) => F.fromRational(x)));
    const [fc, fs] = isInexact(values) ? [] : values;
    if (fc !== undefined && fs !== undefined) return complex(fc, fs);
  }
  const [co, si] = [F.cos(theta.v), F.sin(theta.v)];
  if (isInexact(co)) return co;
  if (isInexact(si)) return si;
  return complex(co, si);
}

/** rotate(O, θ): counter-clockwise by θ degrees about O. No degenerate case. */
function rotateBuild<T>(F: Field<T>, args: readonly Value<T>[]): Built<T> {
  const [O, theta] = [pointAt(args, 0), numAt(args, 1)];
  if (O === undefined || theta === undefined) return badArgs('rotate');
  const a = unit(F, theta);
  return isInexact(a) ? a : fixing(F, a, O);
}

/**
 * homothety(O, k): z ↦ O + k·(z − O). Degenerate: k = 0 (exactly, or within EPS as a
 * dimensionless number in FloatField) → Undefined (SPEC §6.3).
 */
function homothetyBuild<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Built<T> {
  const [O, k] = [pointAt(args, 0), numAt(args, 1)];
  if (O === undefined || k === undefined) return badArgs('homothety');
  return F.isZero(k.v, 'dimensionless', ctx)
    ? undef('homothety: the ratio k is 0')
    : fixing(F, complex(k.v, F.zero), O);
}

/** translate(A, B): z ↦ z + (B − A). Degenerate: A = B → the identity. */
function translateBuild<T>(F: Field<T>, args: readonly Value<T>[]): Built<T> {
  const [A, B] = [pointAt(args, 0), pointAt(args, 1)];
  if (A === undefined || B === undefined) return badArgs('translate');
  return similarity(false, complex(F.one, F.zero), c(vSub(F, B, A)));
}

/**
 * spiral(A, B, C, D): the direct similarity with A ↦ C and B ↦ D, a = (D − C)/(B − A),
 * b = C − a·A. Degenerate: A = B or C = D → Undefined (coincident points).
 */
function spiralBuild<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Built<T> {
  const [A, B, C, D] = [0, 1, 2, 3].map((i) => pointAt(args, i));
  if (A === undefined || B === undefined || C === undefined || D === undefined)
    return badArgs('spiral');
  const [ab, cd] = [vSub(F, B, A), vSub(F, D, C)];
  const bad =
    coincident(F, ab, ctx, 'spiral(A, B, C, D) needs A ≠ B') ??
    coincident(F, cd, ctx, 'spiral(A, B, C, D) needs C ≠ D');
  if (bad !== undefined) return bad;
  const a = cDiv(F, c(cd), c(ab));
  return similarity(false, a, cSub(F, c(C), cMul(F, a, c(A))));
}

/** What the image sugar (reflect(X, l), rotate(X, O, θ), …) takes: figures. */
const IMAGED: readonly Capability[] = ['point', 'curve', 'polygon'];

/** The figure kinds a map takes to the same kind (the sugar's result kinds). */
const IMAGE_KINDS: readonly ValueKind[] = ['point', 'line', 'circle', 'polygon'];

/** apply also maps marks and text (ADR-0011: derived layers image them). */
const APPLIED: readonly Capability[] = [...IMAGED, 'annotation'];
const APPLIED_KINDS: readonly ValueKind[] = [...IMAGE_KINDS, 'angle_mark', 'segment_mark', 'text'];

const TRANSFORM_KIND: readonly ValueKind[] = ['transform'];

/** An overload taking X (of capability `x`) first: its result has X's kinds. */
function imageSignature(x: Capability, params: readonly Capability[], radical: boolean): Signature {
  return radical
    ? { params: [x, ...params], output: capabilityKinds(x), radical }
    : { params: [x, ...params], output: capabilityKinds(x) };
}

/** A transform value that passed the validity check, or the problem. */
function finish<T>(F: Field<T>, s: Built<T>, ctx: EvalContext, tool: string): Value<T> {
  if ('kind' in s) return s;
  return similarityProblem(F, s, ctx, tool) ?? transformOf(s);
}

/**
 * The ToolSpec of a map: base signatures build the map, the same signatures with an X in
 * front (point, curve or polygon) give its image of X.
 */
function mapTool(spec: {
  readonly name: ExportOp;
  readonly bases: readonly (readonly Capability[])[];
  readonly build: Build;
  readonly degenerate: readonly string[];
  readonly doc: string;
  readonly examples: readonly ToolExample[];
  /** The map needs cos θ and sin θ (rotate): every overload is radical (ADR-0008). */
  readonly radical?: boolean;
}): ToolSpec {
  const radical = spec.radical === true;
  const base = (params: readonly Capability[]): Signature =>
    radical ? { params, output: TRANSFORM_KIND, radical } : { params, output: TRANSFORM_KIND };
  const signatures: Signature[] = [
    ...spec.bases.map(base),
    ...spec.bases.flatMap((params) => IMAGED.map((x) => imageSignature(x, params, radical))),
  ];
  const arities = new Set(spec.bases.map((b) => b.length));
  return {
    id: spec.name,
    name: spec.name,
    family: 'transformations',
    signatures,
    outputKinds: ['transform', ...IMAGE_KINDS],
    compute: <T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> => {
      if (arities.has(args.length)) return finish(F, spec.build(F, args, ctx), ctx, spec.name);
      const [X, ...rest] = args;
      if (X === undefined || !arities.has(rest.length) || !IMAGE_KINDS.includes(X.kind))
        return badArgs(spec.name);
      const t = finish(F, spec.build(F, rest, ctx), ctx, spec.name);
      return t.kind === 'transform' ? applyChecked(F, t.t, X, spec.name) : t;
    },
    degenerate: spec.degenerate,
    export: { constructive: spec.name },
    doc: spec.doc,
    examples: spec.examples,
  };
}

/** apply with the kind check of the sugar and apply (numbers and maps are not imaged). */
function applyChecked<T>(F: Field<T>, s: Similarity<T>, X: Value<T>, tool: string): Value<T> {
  return APPLIED_KINDS.includes(X.kind) ? applySimilarity(F, s, X) : badArgs(tool);
}

/** The transform argument at i, checked to be invertible (hand-built values may not be). */
function mapAt<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  i: number,
  ctx: EvalContext,
  tool: string,
): Similarity<T> | Undefined {
  const v = args[i];
  if (v?.kind !== 'transform') return badArgs(tool);
  const s = v.t;
  return similarityProblem(F, s, ctx, tool) ?? s;
}

function compose<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  if (args.length !== 2) return badArgs('compose');
  const [s, t] = [mapAt(F, args, 0, ctx, 'compose'), mapAt(F, args, 1, ctx, 'compose')];
  if ('kind' in s) return s;
  if ('kind' in t) return t;
  return finish(F, composeSimilarities(F, s, t), ctx, 'compose');
}

function inverse<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  if (args.length !== 1) return badArgs('inverse');
  const s = mapAt(F, args, 0, ctx, 'inverse');
  return 'kind' in s ? s : transformOf(inverseSimilarity(F, s));
}

function apply<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [X] = args.slice(1);
  if (args.length !== 2 || X === undefined) return badArgs('apply');
  const s = mapAt(F, args, 0, ctx, 'apply');
  return 'kind' in s ? s : applyChecked(F, s, X, 'apply');
}

const P = (x: string, y: string): readonly [string, string] => [x, y];
const lineArg = (a: readonly [string, string], b: readonly [string, string]): ExampleArg => ({
  through: [a, b],
  as: 'line',
});
const callArg = (name: string, ...args: ExampleArg[]): ExampleArg => ({ call: name, args });

const O0 = P('0', '0');

export const TRANSFORM_TOOLS: readonly ToolSpec[] = [
  mapTool({
    name: 'reflect',
    bases: [['linear'], ['point']],
    build: reflectBuild,
    degenerate: [
      'a line with no direction → Undefined',
      'an Undefined mirror → Undefined',
      'X on the mirror (X = P for a point) → X itself',
    ],
    doc:
      'reflect(l): the reflection in the carrier line of l (an anti-similarity); reflect(P): ' +
      'the half turn about P. reflect(X, l) and reflect(X, P) are the images of X.',
    examples: [
      { args: [lineArg(O0, P('1', '1'))] },
      { args: [P('3', '1'), lineArg(O0, P('1', '1'))] },
      { args: [P('1', '2')] },
      { args: [P('3', '1'), P('1', '2')] },
    ],
  }),
  mapTool({
    name: 'rotate',
    bases: [['point', 'number']],
    build: rotateBuild,
    radical: true,
    degenerate: [
      'θ a multiple of 360° → the identity',
      'θ not a multiple of 90° → Inexact over Q and mod p',
      'an Undefined centre → Undefined',
    ],
    doc:
      'rotate(O, θ): the rotation by θ degrees counter-clockwise about O. rotate(X, O, θ) is ' +
      'the image of X. Exact over Q for multiples of 90°.',
    examples: [
      { args: [O0, '90'] },
      { args: [P('2', '0'), O0, '90'] },
      { args: [P('1', '0'), O0, '60'] },
    ],
  }),
  mapTool({
    name: 'homothety',
    bases: [['point', 'number']],
    build: homothetyBuild,
    degenerate: ['k = 0 → Undefined', 'k = 1 → the identity; k = −1 → the half turn about O'],
    doc:
      'homothety(O, k): the homothety with centre O and ratio k (negative k allowed). ' +
      'homothety(X, O, k) is the image of X.',
    examples: [
      { args: [P('1', '1'), '2'] },
      { args: [P('3', '1'), P('1', '1'), '1/2'] },
      { args: [callArg('circle', O0, P('1', '0')), P('2', '0'), '3'] },
    ],
  }),
  mapTool({
    name: 'translate',
    bases: [['point', 'point']],
    build: translateBuild,
    degenerate: ['A = B → the identity'],
    doc: 'translate(A, B): the translation taking A to B. translate(X, A, B) is the image of X.',
    examples: [{ args: [O0, P('2', '3')] }, { args: [lineArg(O0, P('1', '0')), O0, P('2', '3')] }],
  }),
  mapTool({
    name: 'spiral',
    bases: [['point', 'point', 'point', 'point']],
    build: spiralBuild,
    degenerate: ['A = B or C = D → Undefined (coincident points)', 'B − A = D − C → a translation'],
    doc:
      'spiral(A, B, C, D): the direct similarity taking A to C and B to D (a spiral ' +
      'similarity, or a translation when B − A = D − C). spiral(X, A, B, C, D) is the image of X.',
    examples: [
      { args: [O0, P('1', '0'), O0, P('0', '2')] },
      { args: [P('1', '1'), O0, P('1', '0'), O0, P('0', '2')] },
    ],
  }),
  {
    id: 'compose',
    name: 'compose',
    family: 'transformations',
    signatures: [{ params: ['transform', 'transform'], output: TRANSFORM_KIND }],
    outputKinds: ['transform'],
    compute: compose,
    degenerate: [
      'a scale factor that vanishes (within EPS) → Undefined',
      'compose(T, inverse(T)) → the identity',
      'two anti-similarities → a direct similarity',
    ],
    export: { constructive: 'compose' },
    doc: 'compose(T1, T2): the map X ↦ T1(T2(X)) (T2 first).',
    examples: [
      {
        args: [
          callArg('reflect', lineArg(O0, P('1', '0'))),
          callArg('reflect', lineArg(O0, P('0', '1'))),
        ],
      },
    ],
  },
  {
    id: 'inverse',
    name: 'inverse',
    family: 'transformations',
    signatures: [{ params: ['transform'], output: TRANSFORM_KIND }],
    outputKinds: ['transform'],
    compute: inverse,
    degenerate: [
      'a reflection or a half turn → itself',
      'a hand-built map with scale factor 0 → Undefined',
    ],
    export: { constructive: 'inverse' },
    doc: 'inverse(T): the inverse map (the preimage of Y is apply(inverse(T), Y)).',
    examples: [{ args: [callArg('homothety', P('1', '1'), '2')] }],
  },
  {
    id: 'apply',
    name: 'apply',
    family: 'transformations',
    signatures: APPLIED.map((x) => ({ params: ['transform', x], output: capabilityKinds(x) })),
    outputKinds: APPLIED_KINDS,
    compute: apply,
    degenerate: [
      'X a number or a transform → Undefined (not imaged)',
      'an Undefined T or X → Undefined',
      'an anti-similarity reverses arcs; ranges and the chirality flag are kept',
      'a circle without an anchor → an image without one',
      'an anti-similarity reverses an angle mark (its arms swap)',
    ],
    export: { constructive: 'apply' },
    doc:
      'apply(T, X): the image of a point, line, segment, ray, circle, arc, polygon, mark or ' +
      'text. Ranges ' +
      'are kept, an anti-similarity reverses arcs, the chirality flag and the anchor of a ' +
      'circle are mapped with it (gliders on an image circle stay exact).',
    examples: [
      { args: [callArg('rotate', O0, '90'), { polygon: [P('1', '0'), P('2', '0'), P('2', '1')] }] },
      {
        args: [
          callArg('reflect', lineArg(O0, P('1', '0'))),
          callArg('circle', P('1', '2'), P('1', '3')),
        ],
      },
    ],
  },
];
