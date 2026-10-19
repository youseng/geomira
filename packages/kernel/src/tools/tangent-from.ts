/**
 * Tangents from a point (SPEC §6.2, §7): tangent_point(P, c, selectors) (a touch point)
 * and tangent_from(P, c, selectors) (the tangent line at that touch point). The touch
 * points are the common points of c and the polar of P: with w = P − O,
 *   mid = O + (r²/|w|²)·w (on OP, the midpoint of the chord of contact),
 *   T = mid ∓ √(r²(|w|² − r²)/|w|⁴)·rot90(w),
 * and orient(+) (cross(O − P, T − P) > 0) is mid − …. Whether P is outside, on or inside c
 * is decided on the gap |OP| − r as a length with the band (ADR-0006): inside → Undefined,
 * on c → one double point (mid, which is P itself when P lies exactly on c), outside → two.
 * tangent_from's line is the tangent at T: through T, direction rot90(T − O), CHIRAL (a
 * quarter turn of T − O, as tangent(T, c)); it passes through P.
 */
import type { Field } from '@geomira/num/field';
import { circleGap } from '../incidence';
import type { BranchShape, EvalContext, ExampleArg, ToolSpec } from '../tool';
import { isZeroVec, vAdd, vDot, vRot90, vScale, vSub } from '../geom';
import { choose, candidateValues } from '../select';
import type { EvaluatedSelector } from '../selector';
import {
  pointOf,
  undef,
  type Circle,
  type Line,
  type Undefined,
  type Value,
  type Vec,
} from '../value';
import { badArgs, circleAt, degenerateCircle, pointAt } from './args';
import { countFromGap, midOff, reflectIn, type Pair } from './pairs';

type Output = 'tangent_point' | 'tangent_from';

const SHAPES: Record<Output, BranchShape> = {
  tangent_point: {
    candidates: 2,
    low: 'orient',
    other: true,
    describe: 'tangent_point(P, c)',
  },
  tangent_from: { candidates: 2, low: 'orient', other: true, describe: 'tangent_from(P, c)' },
};

function output<T>(F: Field<T>, c: Circle<T>, tool: Output, X: Vec<T>): Value<T> {
  if (tool === 'tangent_point') return pointOf(X.x, X.y);
  const p = { x: X.x, y: X.y };
  return { kind: 'line', p, d: vRot90(F, vSub(F, X, c.c)), lo: null, hi: null, chiral: true };
}

/**
 * Degenerate cases: a circle with no positive radius → Undefined; P = the centre or P
 * inside c → Undefined; P on c → the double point.
 */
function tangentPair<T>(
  F: Field<T>,
  P: Vec<T>,
  c: Circle<T>,
  ctx: EvalContext,
  tool: Output,
): Pair<T> | Undefined {
  const bad = degenerateCircle(F, c, ctx);
  if (bad !== undefined) return bad;
  const inside = `${tool}(P, c): P lies inside the circle`;
  const w = vSub(F, P, c.c);
  if (isZeroVec(F, w, ctx)) return undef(inside);
  const ww = vDot(F, w, w);
  const mid = vAdd(F, c.c, vScale(F, w, F.div(c.r2, ww)));
  const polar: Line<T> = {
    kind: 'line',
    p: mid,
    d: vRot90(F, w),
    lo: null,
    hi: null,
    chiral: true,
  };
  return {
    shape: SHAPES[tool],
    noun: tool === 'tangent_point' ? 'touch point' : 'tangent',
    curves: [
      { obj: c, name: 'the circle' },
      { obj: polar, name: 'the polar of P (the chord of contact)' },
    ],
    low: { kind: 'orient', from: P, to: c.c },
    ranged: false,
    count: () => countFromGap(F, circleGap(F, P, c), ctx, inside),
    list: (n) => {
      const rad = F.div(F.mul(c.r2, F.sub(ww, c.r2)), F.mul(ww, ww));
      return midOff(F, n, mid, rad, vRot90(F, w), true);
    },
    vieta: (X) => reflectIn(F, c.c, w, X),
    range: () => 'in',
    output: (X) => output(F, c, tool, X),
  };
}

function pairOf<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  tool: Output,
): Pair<T> | Undefined | 'bad' {
  const [P, c] = [pointAt(args, 0), circleAt(args, 1)];
  if (P === undefined || c === undefined || args.length !== 2) return 'bad';
  return tangentPair(F, P, c, ctx, tool);
}

function computeFor(tool: Output): ToolSpec['compute'] {
  return <T>(
    F: Field<T>,
    args: readonly Value<T>[],
    ctx: EvalContext,
    selectors: readonly EvaluatedSelector<T>[] = [],
  ): Value<T> => {
    const p = pairOf(F, args, ctx, tool);
    if (p === 'bad') return badArgs(tool);
    return 'kind' in p ? p : choose(F, p, selectors, ctx);
  };
}

function candidatesFor(tool: Output): NonNullable<ToolSpec['candidates']> {
  return <T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): readonly Value<T>[] => {
    const p = pairOf(F, args, ctx, tool);
    return p === 'bad' || 'kind' in p ? [] : candidateValues(p);
  };
}

const P5: ExampleArg = ['5', '5'];
const C5: ExampleArg = {
  call: 'circle',
  args: [
    ['0', '0'],
    ['5', '0'],
  ],
};

const DEGENERATE = [
  'P inside c (or P = the centre) → Undefined',
  'P on c (the gap |OP| − r within the band) → the double point',
  'two candidates and no selector → Undefined (ambiguous: add a selector)',
  'along(±) → Undefined (use orient(±))',
  'other(T) with T not a touch point → Undefined',
  'square roots not representable → Inexact over Q and mod p (other(T) is exact)',
];

export const TANGENT_FROM_TOOLS: readonly ToolSpec[] = [
  {
    id: 'tangent_point',
    name: 'tangent_point',
    family: 'points',
    signatures: [{ params: ['point', 'round'], branch: SHAPES.tangent_point }],
    outputKinds: ['point'],
    compute: computeFor('tangent_point'),
    candidates: candidatesFor('tangent_point'),
    degenerate: DEGENERATE,
    export: 'numeric',
    doc: 'tangent_point(P, c, selectors): a point where a tangent from P touches c; two candidates (orient(+): cross(O − P, T − P) > 0), one double point when P is on c.',
    examples: [{ args: [P5, C5], selectors: [{ kind: 'orient', sign: 1 }] }],
  },
  {
    id: 'tangent_from',
    name: 'tangent_from',
    family: 'lines',
    signatures: [{ params: ['point', 'round'], branch: SHAPES.tangent_from }],
    outputKinds: ['line'],
    compute: computeFor('tangent_from'),
    candidates: candidatesFor('tangent_from'),
    degenerate: DEGENERATE,
    export: 'numeric',
    doc: 'tangent_from(P, c, selectors): a tangent from P to c, the line through its touch point T with direction rot90(T − O) (chiral); selectors judge T.',
    examples: [{ args: [P5, C5], selectors: [{ kind: 'orient', sign: -1 }] }],
  },
];
