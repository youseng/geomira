/**
 * Inversion (ADR-0032 decisions 3 and 4): inversion(c), inversion(O, k), and the olympiad
 * presets, which are COMPOSITIONS ONLY: each preset's compute calls the registry tools' own
 * compute (reflect, bisector, dist, mul, div, power, circumcircle, orthocenter,
 * diameter_circle, compose, inversion) and contains no mapping formula of its own:
 *   sqrt_bc(A, B, C)            = compose(reflect(bisector(B, A, C)), inversion(A, AB·AC))
 *   orthocenter_inversion(A, B, C) = inversion(H, power(H, circumcircle(A, B, C)) / 2)
 *   inversion_fixing(O, c)      = inversion(O, power(O, c))
 *   inversion_swap(O, A, B)     = inversion(O, power(O, diameter_circle(A, B))), O on line AB
 *   feet_inversion(A, B, C)     = inversion(A, power(A, diameter_circle(B, C))) (ADR-0034)
 *   sqrt_bc2(A, B, C)           = compose(reflect(bisector(B, A, C)), inversion(A, AB·AC/2)).
 * Every map here is a Möbius map: its overloads output ['transform', 'mobius'] (the static
 * kind of ADR-0032 decision 13), and an inversion's power is an `absolute` argument (a squared
 * length: decision 14).
 */
import { complex, type Complex } from '@geomira/num/complex';
import type { Field } from '@geomira/num/field';
import { isZero as isZeroRational, rational } from '@geomira/num/rational';
import { vDot, vSub } from '../geom';
import { requireOnLine } from '../incidence';
import type { EvalContext, ExampleArg, Signature, ToolSpec } from '../tool';
import { badArgs, circleAt, degenerateCircle, numAt, pointAt } from '../tools/args';
import { ARITHMETIC_TOOLS } from '../tools/arithmetic';
import { CIRCLE_MEASURE_TOOLS } from '../tools/circle-measures';
import { CIRCLE_TOOLS } from '../tools/circles';
import { INCIRCLE_TOOLS } from '../tools/incircle';
import { MAP_OPERATIONS } from '../tools/map-ops';
import { MEASURE_TOOLS } from '../tools/measures';
import { TRANSFORM_TOOLS } from '../tools/transforms';
import { TRIANGLE_TOOLS } from '../tools/triangle';
import {
  isUnavailable,
  numOf,
  undef,
  type Num,
  type Value,
  type ValueKind,
  type Vec,
} from '../value';
import { mobius } from './mobius';

/** The tools the presets compose (looked up by name in their own modules). */
const PARTS: readonly ToolSpec[] = [
  ...ARITHMETIC_TOOLS,
  ...CIRCLE_MEASURE_TOOLS,
  ...CIRCLE_TOOLS,
  ...INCIRCLE_TOOLS,
  ...MAP_OPERATIONS,
  ...MEASURE_TOOLS,
  ...TRANSFORM_TOOLS,
  ...TRIANGLE_TOOLS,
];

/**
 * A call of the tool `name` (one of PARTS, or inversion itself) on evaluated arguments:
 * Undefined or Inexact arguments propagate, as in evaluate. Degenerate: a name that is not a
 * part (a bug, caught by the presets' tests) → Undefined.
 */
function run<T>(F: Field<T>, ctx: EvalContext, name: string, args: readonly Value<T>[]): Value<T> {
  const bad = args.find(isUnavailable);
  if (bad !== undefined) return bad;
  if (name === 'inversion') return inversion(F, args, ctx);
  const tool = PARTS.find((t) => t.name === name);
  return tool === undefined
    ? undef(`${name} is not a part of the presets`)
    : tool.compute(F, args, ctx);
}

const c = <T>(v: Vec<T>): Complex<T> => complex(v.x, v.y);
const two = <T>(F: Field<T>): Num<T> => numOf(F.add(F.one, F.one), rational(2n));

/** Whether a power is 0: on its exact value when it has one (ADR-0005 decision 2), else EPS. */
function zeroPower<T>(F: Field<T>, n: Num<T>, ctx: EvalContext): boolean {
  return n.exact === undefined ? F.isZero(n.v, 'area', ctx) : isZeroRational(n.exact);
}

/**
 * w = O + k/conj(z − O): the anti Möbius map (O, k − |O|², 1, −Ō), ad − bc = −k. k < 0 is the
 * inversion with power |k| followed by the half turn about O. Degenerate: k = 0 (an exact
 * zero; in FloatField within EPS as an area) → Undefined.
 */
function inversionAt<T>(F: Field<T>, O: Vec<T>, k: T, zero: boolean): Value<T> {
  if (zero) return undef('inversion: the power k is 0');
  const o = c(O);
  const b = complex(F.sub(k, vDot(F, O, O)), F.zero);
  const t = mobius(true, o, b, complex(F.one, F.zero), complex(F.neg(o.re), o.im));
  return { kind: 'transform', t };
}

/**
 * inversion(c) = inversion(center, r²) (a circle with no positive radius → Undefined);
 * inversion(O, k), k decided on its exact value when it has one (ADR-0005 decision 2).
 */
function inversion<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const k = circleAt(args, 0);
  if (k !== undefined && args.length === 1) {
    const bad = degenerateCircle(F, k, ctx);
    return bad ?? inversionAt(F, k.c, k.r2, false);
  }
  const [O, n] = [pointAt(args, 0), numAt(args, 1)];
  if (O === undefined || n === undefined || args.length !== 2) return badArgs('inversion');
  return inversionAt(F, O, n.v, zeroPower(F, n, ctx));
}

/**
 * sqrt_bc(A, B, C) = compose(reflect(bisector(B, A, C)), inversion(A, AB·AC)); with `half`,
 * sqrt_bc2(A, B, C), the same with power AB·AC/2 (ADR-0034).
 */
function sqrtMap(name: string, half: boolean) {
  return <T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> => {
    const [A, B, C] = [pointAt(args, 0), pointAt(args, 1), pointAt(args, 2)];
    if (args.length !== 3 || A === undefined || B === undefined || C === undefined)
      return badArgs(name);
    const mirror = run(F, ctx, 'reflect', [run(F, ctx, 'bisector', [B, A, C])]);
    const bc = run(F, ctx, 'mul', [run(F, ctx, 'dist', [A, B]), run(F, ctx, 'dist', [A, C])]);
    const k = half ? run(F, ctx, 'div', [bc, two(F)]) : bc;
    return run(F, ctx, 'compose', [mirror, run(F, ctx, 'inversion', [A, k])]);
  };
}

/**
 * feet_inversion(A, B, C) = inversion(A, power(A, diameter_circle(B, C))), power AB⃗·AC⃗
 * (ADR-0034). Degenerate: AB⃗·AC⃗ = 0 (a right angle at A, A = B or A = C) → Undefined with
 * that reason; B = C → Undefined (the diameter circle).
 */
function feetInversion<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [A, B, C] = [pointAt(args, 0), pointAt(args, 1), pointAt(args, 2)];
  if (args.length !== 3 || A === undefined || B === undefined || C === undefined)
    return badArgs('feet_inversion');
  const k = run(F, ctx, 'power', [A, run(F, ctx, 'diameter_circle', [B, C])]);
  if (k.kind === 'number' && zeroPower(F, k, ctx))
    return undef('feet_inversion(A, B, C): AB⃗·AC⃗ = 0 (a right angle at A, or A = B or A = C)');
  return run(F, ctx, 'inversion', [A, k]);
}

/** orthocenter_inversion(A, B, C) = inversion(H, power(H, circumcircle(A, B, C)) / 2). */
function orthocenterInversion<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
): Value<T> {
  if (args.length !== 3 || [0, 1, 2].some((i) => pointAt(args, i) === undefined))
    return badArgs('orthocenter_inversion');
  const H = run(F, ctx, 'orthocenter', args);
  const pow = run(F, ctx, 'power', [H, run(F, ctx, 'circumcircle', args)]);
  return run(F, ctx, 'inversion', [H, run(F, ctx, 'div', [pow, two(F)])]);
}

/** inversion_fixing(O, c) = inversion(O, power(O, c)). */
function inversionFixing<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [O, k] = [pointAt(args, 0), circleAt(args, 1)];
  if (args.length !== 2 || O === undefined || k === undefined) return badArgs('inversion_fixing');
  return run(F, ctx, 'inversion', [O, run(F, ctx, 'power', [O, k])]);
}

/**
 * inversion_swap(O, A, B) = inversion(O, power(O, diameter_circle(A, B))) (power OA⃗·OB⃗), which
 * swaps A and B exactly when O lies on line AB. Degenerate: O off line AB (the incidence
 * decision with the band) → Undefined; A = B → Undefined; O = A or O = B → power 0 → Undefined.
 */
function inversionSwap<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [O, A, B] = [pointAt(args, 0), pointAt(args, 1), pointAt(args, 2)];
  if (args.length !== 3 || O === undefined || A === undefined || B === undefined)
    return badArgs('inversion_swap');
  const circle = run(F, ctx, 'diameter_circle', [A, B]);
  if (isUnavailable(circle)) return circle;
  const line = { kind: 'line' as const, p: A, d: vSub(F, B, A), lo: null, hi: null, chiral: false };
  const off = requireOnLine(
    F,
    O,
    line,
    ctx,
    'inversion_swap(O, A, B): no inversion centered at O swaps A and B unless O lies on line AB',
  );
  return off ?? run(F, ctx, 'inversion', [O, run(F, ctx, 'power', [O, circle])]);
}

const MOBIUS_OUT: readonly ValueKind[] = ['transform', 'mobius'];
const sig = (params: Signature['params'], extra: Partial<Signature> = {}): Signature => ({
  params,
  output: MOBIUS_OUT,
  ...extra,
});

const P = (x: string, y: string): readonly [string, string] => [x, y];
const circleArg = (o: readonly [string, string], a: readonly [string, string]): ExampleArg => ({
  call: 'circle',
  args: [o, a],
});

export const INVERSION_TOOLS: readonly ToolSpec[] = [
  {
    id: 'inversion',
    name: 'inversion',
    family: 'transformations',
    signatures: [
      sig(['round'], { symmetry: [] }),
      sig(['point', 'number'], { symmetry: [], absolute: [1] }),
    ],
    outputKinds: ['transform'],
    compute: inversion,
    degenerate: [
      'k = 0 → Undefined',
      'k < 0 → the inversion with power |k| followed by the half turn about O',
      'an arc → the inversion in its carrier circle',
    ],
    export: 'numeric',
    doc:
      'inversion(c): the inversion in the circle c; inversion(O, k): the inversion with center ' +
      'O and power k (k < 0: followed by the half turn about O). An anti Möbius map: apply it ' +
      'with apply(T, X) or a derived layer. Exact for an exact power.',
    examples: [{ args: [circleArg(P('1', '1'), P('3', '1'))] }, { args: [P('0', '0'), '4'] }],
  },
  {
    id: 'sqrt_bc',
    name: 'sqrt_bc',
    family: 'transformations',
    signatures: [
      sig(['point', 'point', 'point'], {
        radical: true,
        symmetry: [{ kind: 'permute', positions: [1, 2], same: 'value' }],
      }),
    ],
    outputKinds: ['transform'],
    compute: sqrtMap('sqrt_bc', false),
    degenerate: [
      'A = B or A = C → Undefined',
      'collinear A, B, C → still defined (it swaps B and C)',
    ],
    export: 'numeric',
    doc:
      'sqrt_bc(A, B, C): the √(bc) inversion of triangle ABC at A, compose(reflect(bisector(B, ' +
      'A, C)), inversion(A, AB·AC)). It swaps B and C and maps the circumcircle to line BC.',
    examples: [{ args: [P('0', '0'), P('3', '4'), P('5', '0')] }],
  },
  {
    id: 'orthocenter_inversion',
    name: 'orthocenter_inversion',
    family: 'transformations',
    signatures: [
      sig(['point', 'point', 'point'], {
        symmetry: [{ kind: 'permute', positions: [0, 1, 2], same: 'value' }],
      }),
    ],
    outputKinds: ['transform'],
    compute: orthocenterInversion,
    degenerate: [
      'coincident or collinear vertices → Undefined',
      'a right angle (H on the circumcircle) → Undefined (power 0)',
    ],
    export: 'numeric',
    doc:
      'orthocenter_inversion(A, B, C): the inversion at the orthocenter H with power HA·HD ' +
      '(D the foot from A; negative in an acute triangle), inversion(H, power(H, ' +
      'circumcircle(A, B, C)) / 2). It swaps each vertex with the foot of its altitude and ' +
      'the circumcircle with the nine-point circle.',
    examples: [{ args: [P('0', '0'), P('4', '0'), P('1', '3')] }],
  },
  {
    id: 'inversion_fixing',
    name: 'inversion_fixing',
    family: 'transformations',
    signatures: [sig(['point', 'round'], { symmetry: [] })],
    outputKinds: ['transform'],
    compute: inversionFixing,
    degenerate: ['O on c → Undefined (power 0)', 'O inside c → a negative power (still fixes c)'],
    export: 'numeric',
    doc:
      'inversion_fixing(O, c): the inversion centered at O that maps c to itself, ' +
      'inversion(O, power(O, c)) (O inside c: a negative power, with the half turn).',
    examples: [{ args: [P('5', '0'), circleArg(P('0', '0'), P('3', '0'))] }],
  },
  {
    id: 'inversion_swap',
    name: 'inversion_swap',
    family: 'transformations',
    signatures: [
      sig(['point', 'point', 'point'], {
        symmetry: [{ kind: 'permute', positions: [1, 2], same: 'value' }],
      }),
    ],
    outputKinds: ['transform'],
    compute: inversionSwap,
    degenerate: [
      'O off line AB → Undefined (no inversion centered at O swaps them)',
      'A = B → Undefined',
      'O = A or O = B → Undefined (power 0)',
    ],
    export: 'numeric',
    doc:
      'inversion_swap(O, A, B): the inversion centered at O that swaps A and B, for O on line ' +
      'AB: inversion(O, power(O, diameter_circle(A, B))), power OA·OB (negative when O is ' +
      'between A and B).',
    examples: [{ args: [P('0', '0'), P('1', '0'), P('4', '0')] }],
  },
  {
    id: 'feet_inversion',
    name: 'feet_inversion',
    family: 'transformations',
    signatures: [
      sig(['point', 'point', 'point'], {
        symmetry: [{ kind: 'permute', positions: [1, 2], same: 'value' }],
      }),
    ],
    outputKinds: ['transform'],
    compute: feetInversion,
    degenerate: [
      'AB⃗·AC⃗ = 0 (a right angle at A, or A = B or A = C) → Undefined',
      'B = C → Undefined',
      'AB⃗·AC⃗ < 0 (an obtuse angle at A) → the inversion followed by the half turn about A',
      'collinear A, B, C → still defined (it swaps B and C)',
    ],
    export: 'numeric',
    doc:
      'feet_inversion(A, B, C): the inversion at A with power AB·AC·cos A (the dot product of ' +
      'AB and AC), inversion(A, power(A, diameter_circle(B, C))). It maps B and C to the feet ' +
      'of the altitudes from C and B, the orthocenter to the foot from A, the circumcircle to ' +
      'line EF and line BC to the circle on diameter AH.',
    examples: [{ args: [P('0', '0'), P('4', '0'), P('1', '3')] }],
  },
  {
    id: 'sqrt_bc2',
    name: 'sqrt_bc2',
    family: 'transformations',
    signatures: [
      sig(['point', 'point', 'point'], {
        radical: true,
        symmetry: [{ kind: 'permute', positions: [1, 2], same: 'value' }],
      }),
    ],
    outputKinds: ['transform'],
    compute: sqrtMap('sqrt_bc2', true),
    degenerate: [
      'A = B or A = C → Undefined',
      'collinear A, B, C → still defined (B goes to the midpoint of AC)',
    ],
    export: 'numeric',
    doc:
      'sqrt_bc2(A, B, C): the √(bc/2) inversion of triangle ABC at A, compose(reflect(' +
      'bisector(B, A, C)), inversion(A, AB·AC/2)). It maps B and C to the midpoints of AC and ' +
      'AB, the circumcircle to the midline through them, and is its own inverse.',
    examples: [{ args: [P('0', '0'), P('3', '4'), P('5', '0')] }],
  },
];
