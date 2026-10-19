/**
 * Line tools (SPEC §6.2): line, segment, ray, parallel, perp, perp_bisector. Chirality
 * (SPEC §4): directions from two points are achiral; parallel keeps its line's flag; perp
 * toggles it; perp_bisector turns an achiral direction, so it is chiral.
 */
import type { Field } from '@geomira/num/field';
import type { EvalContext, ExampleArg, Signature, ToolSpec } from '../tool';
import { half, vAdd, vRot90, vScale, vSub } from '../geom';
import type { Line, Value } from '../value';
import { badArgs, coincident, lineAt, pointAt, pointsOf } from './args';

type Range = 'line' | 'segment' | 'ray';

/**
 * The line, segment or ray from A through B (achiral direction B − A). Degenerate: A = B
 * (a zero length) → Undefined (coincident points).
 */
function through<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  kind: Range,
): Value<T> {
  const [a, b] = pointsOf(args, 2) ?? [];
  if (a === undefined || b === undefined) return badArgs(kind);
  const d = vSub(F, b, a);
  const bad = coincident(F, d, ctx, `${kind}(A, B) needs A ≠ B`);
  if (bad !== undefined) return bad;
  const lo = kind === 'line' ? null : F.zero;
  const hi = kind === 'segment' ? F.one : null;
  const p = { x: a.x, y: a.y };
  return { kind: 'line', p, d, lo, hi, chiral: false };
}

function line<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  return through(F, args, ctx, 'line');
}

function segment<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  return through(F, args, ctx, 'segment');
}

function ray<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  return through(F, args, ctx, 'ray');
}

/** The full line through P with direction d. */
function lineFrom<T>(
  P: { readonly x: T; readonly y: T },
  d: Line<T>['d'],
  chiral: boolean,
): Line<T> {
  return { kind: 'line', p: { x: P.x, y: P.y }, d, lo: null, hi: null, chiral };
}

/** The line through P with l's direction and flag. Degenerate: none (P on l → l's carrier). */
function parallel<T>(_F: Field<T>, args: readonly Value<T>[]): Value<T> {
  const [P, l] = [pointAt(args, 0), lineAt(args, 1)];
  if (P === undefined || l === undefined || args.length !== 2) return badArgs('parallel');
  return lineFrom(P, l.d, l.chiral);
}

/** The line through P with l's direction turned 90° (flag toggled). Degenerate: none. */
function perp<T>(F: Field<T>, args: readonly Value<T>[]): Value<T> {
  const [P, l] = [pointAt(args, 0), lineAt(args, 1)];
  if (P === undefined || l === undefined || args.length !== 2) return badArgs('perp');
  return lineFrom(P, vRot90(F, l.d), !l.chiral);
}

/** Through the midpoint of AB, direction rot90(B − A), chiral. Degenerate: A = B → Undefined. */
function perpBisector<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [a, b] = pointsOf(args, 2) ?? [];
  if (a === undefined || b === undefined) return badArgs('perp_bisector');
  const d = vSub(F, b, a);
  const bad = coincident(F, d, ctx, 'perp_bisector(A, B) needs A ≠ B');
  if (bad !== undefined) return bad;
  return lineFrom(vScale(F, vAdd(F, a, b), half(F)), vRot90(F, d), true);
}

const TWO_POINTS: readonly Signature[] = [{ params: ['point', 'point'] }];
const POINT_LINE: readonly Signature[] = [{ params: ['point', 'linear'] }];
const A: readonly [string, string] = ['0', '0'];
const B: readonly [string, string] = ['2', '1'];
const AB: readonly ExampleArg[] = [A, B];

export const LINE_TOOLS: readonly ToolSpec[] = [
  {
    id: 'line',
    name: 'line',
    family: 'lines',
    signatures: TWO_POINTS,
    outputKinds: ['line'],
    compute: line,
    degenerate: ['line(A, A) → Undefined (coincident points)'],
    export: 'numeric',
    doc: 'The line through A and B (achiral direction B − A).',
    examples: [{ args: AB }],
  },
  {
    id: 'segment',
    name: 'segment',
    family: 'lines',
    signatures: TWO_POINTS,
    outputKinds: ['line'],
    compute: segment,
    degenerate: ['segment(A, A) → Undefined (coincident points)'],
    export: 'numeric',
    doc: 'The segment AB: A + t·(B − A) for t in [0, 1].',
    examples: [{ args: AB }],
  },
  {
    id: 'ray',
    name: 'ray',
    family: 'lines',
    signatures: TWO_POINTS,
    outputKinds: ['line'],
    compute: ray,
    degenerate: ['ray(A, A) → Undefined (coincident points)'],
    export: 'numeric',
    doc: 'The ray from A through B: A + t·(B − A) for t ≥ 0.',
    examples: [{ args: AB }],
  },
  {
    id: 'parallel',
    name: 'parallel',
    family: 'lines',
    signatures: POINT_LINE,
    outputKinds: ['line'],
    compute: parallel,
    degenerate: ['P on l → the carrier line of l', 'a segment or ray gives a full line'],
    export: 'numeric',
    doc: 'The line through P parallel to l (keeps the chirality of l).',
    examples: [{ args: [['0', '1'], { through: [A, B], as: 'segment' }] }],
  },
  {
    id: 'perp',
    name: 'perp',
    family: 'lines',
    signatures: POINT_LINE,
    outputKinds: ['line'],
    compute: perp,
    degenerate: ['P on l → the perpendicular at P', 'a segment or ray gives a full line'],
    export: 'numeric',
    doc: 'The line through P perpendicular to l (a quarter turn: toggles the chirality).',
    examples: [{ args: [['0', '1'], { through: [A, B], as: 'line' }] }],
  },
  {
    id: 'perp_bisector',
    name: 'perp_bisector',
    family: 'lines',
    signatures: TWO_POINTS,
    outputKinds: ['line'],
    compute: perpBisector,
    degenerate: ['perp_bisector(A, A) → Undefined (coincident points)'],
    export: 'numeric',
    doc: 'The perpendicular bisector of AB (chiral: a quarter turn of B − A).',
    examples: [{ args: AB }],
  },
];
