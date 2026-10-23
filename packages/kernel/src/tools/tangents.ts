/**
 * Lines from circles (SPEC §6.2): tangent(P, c) (P on c), polar(P, c), radical_axis(c1,
 * c2). Each turns an achiral direction (a direction from two points) by 90°, so each is
 * chiral (SPEC §4). All three are exact: no square root is needed.
 */
import type { Field } from '@geomira/num/field';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { two, vAdd, vDot, vRot90, vScale, vSub } from '../geom';
import { requireOnCircle } from '../incidence';
import { undef, type Line, type Value, type Vec } from '../value';
import { badArgs, circleAt, degenerateCircle, pointAt } from './args';

function chiralLine<T>(p: Vec<T>, d: Vec<T>): Line<T> {
  return { kind: 'line', p: { x: p.x, y: p.y }, d, lo: null, hi: null, chiral: true };
}

/**
 * The tangent at P: through P, direction rot90(P − O). Degenerate cases: P not on c →
 * Undefined; P within the band of c → Undefined (ambiguous).
 */
function tangent<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [P, c] = [pointAt(args, 0), circleAt(args, 1)];
  if (P === undefined || c === undefined || args.length !== 2) return badArgs('tangent');
  const bad =
    degenerateCircle(F, c, ctx) ?? requireOnCircle(F, P, c, ctx, 'tangent(P, c) needs P on c');
  return bad ?? chiralLine(P, vRot90(F, vSub(F, P, c.c)));
}

/**
 * The polar of P: the points X with (X − O)·(P − O) = r², through O + (P − O)·r²/|P − O|²
 * with direction rot90(P − O). Degenerate cases: P = O → Undefined (the polar of the
 * centre is the line at infinity); P on c → the tangent at P.
 */
function polar<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
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
    signatures: [{ params: ['point', 'round'] }],
    outputKinds: ['line'],
    compute: tangent,
    degenerate: ['P not on c → Undefined', 'P within the band of c → Undefined (ambiguous)'],
    export: 'numeric',
    doc: 'tangent(P, c): the tangent to c at P (P on c); chiral (a quarter turn of P − O).',
    examples: [{ args: [['3', '4'], C] }],
  },
  {
    id: 'polar',
    name: 'polar',
    family: 'lines',
    signatures: [{ params: ['point', 'round'] }],
    outputKinds: ['line'],
    compute: polar,
    degenerate: ['P = the center → Undefined', 'P on c → the tangent at P'],
    export: 'numeric',
    doc: 'polar(P, c): the polar of P with respect to c; chiral (a quarter turn of P − O).',
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
