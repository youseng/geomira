/**
 * Lines from circles (SPEC §6.2): tangent(P, c) (P on c), polar(P, c), radical_axis(c1,
 * c2); tangent and polar also take a conic (ADR-0042). Each turns an achiral direction (a direction from two points) by 90°, so each is
 * chiral (SPEC §4). All three are exact: no square root is needed.
 */
import type { Field } from '@geomira/num/field';
import { candidateValues, choose } from '../select';
import type { EvaluatedSelector } from '../selector';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { two, vAdd, vDot, vRot90, vScale, vSub } from '../geom';
import { requireOnCircle } from '../incidence';
import { undef, type Conic, type Line, type Value, type Vec } from '../value';
import { conicProblem } from '../conic';
import { requireOnConic } from '../conic-incidence';
import { badArgs, circleAt, conicAt, degenerateCircle, pointAt } from './args';
import { conicPolarLine, conicTangentAt, isConicCentre } from './conic-pairs';
import { COMMON_TANGENT_DEGENERATE, commonSignatures } from './common-tangents';
import { commonTangentPair } from './dual-tangents';

function chiralLine<T>(p: Vec<T>, d: Vec<T>): Line<T> {
  return { kind: 'line', p: { x: p.x, y: p.y }, d, lo: null, hi: null, chiral: true };
}

/**
 * The tangent at P: through P, direction rot90(P − O). Degenerate cases: P not on c →
 * Undefined; P within the band of c → Undefined (ambiguous); a selector → Undefined (the tangent
 * at P is unique). Two curves: their common tangents (ADR-0045, common-tangents.ts).
 */
function tangent<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  selectors: readonly EvaluatedSelector<T>[] = [],
): Value<T> {
  const common = commonTangentPair(F, args, ctx, 'line');
  if (common !== 'bad') return 'kind' in common ? common : choose(F, common, selectors, ctx);
  if (selectors.length > 0)
    return undef('tangent(P, c): the tangent at P is unique: it takes no selector');
  const k = conicAt(args, 1);
  if (k !== undefined) return conicTangent(F, args, k, ctx);
  const [P, c] = [pointAt(args, 0), circleAt(args, 1)];
  if (P === undefined || c === undefined || args.length !== 2) return badArgs('tangent');
  const bad =
    degenerateCircle(F, c, ctx) ?? requireOnCircle(F, P, c, ctx, 'tangent(P, c) needs P on c');
  return bad ?? chiralLine(P, vRot90(F, vSub(F, P, c.c)));
}

/**
 * The tangent to a conic at P (ADR-0042): through P, direction rot90(−g(P)) (for a circle, the
 * direction of tangent(P, c)). Degenerate cases: an invalid conic → Undefined; P not on k →
 * Undefined; within the band → Undefined (ambiguous).
 */
function conicTangent<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  k: Conic<T>,
  ctx: EvalContext,
): Value<T> {
  const P = pointAt(args, 0);
  if (P === undefined || args.length !== 2) return badArgs('tangent');
  const bad = conicProblem(F, k, ctx) ?? requireOnConic(F, P, k, ctx, 'tangent(P, k) needs P on k');
  return bad ?? conicTangentAt(F, k, P);
}

/**
 * The polar of P with respect to a conic (ADR-0042): g(P)·X + h = 0 (conic-pairs.ts). Degenerate
 * cases: an invalid conic → Undefined; P the center → Undefined (the line at infinity); P on k →
 * the tangent at P.
 */
function conicPolar<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  k: Conic<T>,
  ctx: EvalContext,
): Value<T> {
  const P = pointAt(args, 0);
  if (P === undefined || args.length !== 2) return badArgs('polar');
  const bad = conicProblem(F, k, ctx);
  if (bad !== undefined) return bad;
  if (isConicCentre(F, k, P, ctx))
    return undef('P is the center: its polar is the line at infinity');
  return conicPolarLine(F, k, P);
}

/**
 * The polar of P: the points X with (X − O)·(P − O) = r², through O + (P − O)·r²/|P − O|²
 * with direction rot90(P − O). Degenerate cases: P = O → Undefined (the polar of the
 * centre is the line at infinity); P on c → the tangent at P.
 */
function polar<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const k = conicAt(args, 1);
  if (k !== undefined) return conicPolar(F, args, k, ctx);
  const [P, c] = [pointAt(args, 0), circleAt(args, 1)];
  if (P === undefined || c === undefined || args.length !== 2) return badArgs('polar');
  const bad = degenerateCircle(F, c, ctx);
  if (bad !== undefined) return bad;
  const w = vSub(F, P, c.c);
  if (F.isZero(w.x, 'length', ctx) && F.isZero(w.y, 'length', ctx)) {
    return undef('P is the center: its polar is the line at infinity');
  }
  const foot = vAdd(F, c.c, vScale(F, w, F.div(c.r2, vDot(F, w, w))));
  return chiralLine(foot, vRot90(F, w));
}

/**
 * The radical axis: the points with equal power to both circles,
 * 2·X·(O₂ − O₁) = |O₂|² − |O₁|² − r₂² + r₁², through O₁ + t·w (w = O₂ − O₁,
 * t = (|w|² + r₁² − r₂²) / (2|w|²)) with direction rot90(w). Degenerate cases: concentric
 * circles (equal circles included) → Undefined; tangent circles → the common tangent at
 * the touch point.
 */
function radicalAxis<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [c1, c2] = [circleAt(args, 0), circleAt(args, 1)];
  if (c1 === undefined || c2 === undefined || args.length !== 2) return badArgs('radical_axis');
  const bad = degenerateCircle(F, c1, ctx) ?? degenerateCircle(F, c2, ctx);
  if (bad !== undefined) return bad;
  const w = vSub(F, c2.c, c1.c);
  if (F.isZero(w.x, 'length', ctx) && F.isZero(w.y, 'length', ctx)) {
    return undef('concentric circles');
  }
  const ww = vDot(F, w, w);
  const t = F.div(F.sub(F.add(ww, c1.r2), c2.r2), F.mul(two(F), ww));
  return chiralLine(vAdd(F, c1.c, vScale(F, w, t)), vRot90(F, w));
}

/** The common tangents' candidates (two curves); none for the tangent at a point. */
function candidates<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
): readonly Value<T>[] {
  const p = commonTangentPair(F, args, ctx, 'line');
  return p === 'bad' || 'kind' in p ? [] : candidateValues(p);
}

/** Two circles whose four common tangents are rational: touch points (4.2, ±5.6), (5.6, ±4.2). */
const C7: ExampleArg = { call: 'circle', args: [['0', '0'], '7'] };
const C1: ExampleArg = { call: 'circle', args: [['10', '0'], '1'] };

const C: ExampleArg = {
  call: 'circle',
  args: [
    ['0', '0'],
    ['5', '0'],
  ],
};

export const TANGENT_TOOLS: readonly ToolSpec[] = [
  {
    id: 'tangent',
    name: 'tangent',
    family: 'lines',
    signatures: [
      { params: ['point', 'round'] },
      { params: ['point', 'conic'] },
      ...commonSignatures('line'),
    ],
    outputKinds: ['line'],
    compute: tangent,
    candidates,
    degenerate: [
      'P not on c → Undefined',
      'P within the band of c → Undefined (ambiguous)',
      'a conic: P not on k (the gap Q/|∇Q| as a length) → Undefined; within the band → ambiguous',
      'tangent(P, c) with a selector → Undefined (the tangent at P is unique)',
      ...COMMON_TANGENT_DEGENERATE,
    ],
    export: 'numeric',
    doc: 'tangent(P, c): the tangent to c at P (P on c); chiral (a quarter turn of P − O). tangent(P, k) on a conic: the tangent at P, direction a quarter turn of −∇Q(P). tangent(c1, c2, selectors): a common tangent of two curves (circles or conics, up to four: two external and two internal for two circles), the tangent of c1 at its touch point T; selectors judge T; two circles: along(−) the external pair, along(+) the internal pair, orient(±) the side of O₁O₂ where T lies.',
    examples: [
      { args: [['3', '4'], C] },
      { args: [C7, C1], selectors: [{ kind: 'near', p: ['0', '10'] }] },
      {
        args: [C7, C1],
        selectors: [
          { kind: 'along', sign: 1 },
          { kind: 'orient', sign: -1 },
        ],
      },
    ],
  },
  {
    id: 'polar',
    name: 'polar',
    family: 'lines',
    signatures: [{ params: ['point', 'round'] }, { params: ['point', 'conic'] }],
    outputKinds: ['line'],
    compute: polar,
    degenerate: [
      'P = the center → Undefined',
      'P on c → the tangent at P',
      'a conic: P = its center (g(P) = 0 as a length) → Undefined; P on k → the tangent at P',
    ],
    export: 'numeric',
    doc: 'polar(P, c): the polar of P with respect to c; chiral (a quarter turn of P − O). polar(P, k) for a conic: the line g(P)·X + h = 0, (g, h) = M·(P, 1).',
    examples: [{ args: [['10', '5'], C] }],
  },
  {
    id: 'radical_axis',
    name: 'radical_axis',
    family: 'lines',
    signatures: [
      {
        params: ['round', 'round'],
        symmetry: [{ kind: 'permute', positions: [0, 1], same: 'figure' }],
      },
    ],
    outputKinds: ['line'],
    compute: radicalAxis,
    degenerate: [
      'concentric circles → Undefined (equal circles included)',
      'tangent circles → the common tangent at the touch point',
    ],
    export: 'numeric',
    doc: 'radical_axis(c1, c2): the points with equal power to both circles; chiral (a quarter turn of O₂ − O₁).',
    examples: [{ args: [C, { call: 'circle', args: [['6', '0'], '3'] }] }],
  },
];
