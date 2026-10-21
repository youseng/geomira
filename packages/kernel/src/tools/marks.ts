/**
 * Display tools (SPEC §6.2) of Run 8a (ADR-0011): mark_angle, mark_right, mark_segment and
 * text. Their values are marks and texts in world coordinates; the scene gives them their
 * size on screen (arc radii and tick lengths are pixels, not lengths of the figure).
 *
 * An angle mark marks the CONVEX angle ∠ABC (an undirected angle, as olympiad figures mark
 * them), stored counter-clockwise: the side of the angle is the sign of cross(A − B, C − B),
 * decided with the band (num's banded sign of the normalised cross product, as `dangle`
 * decides collinearity, ADR-0003 item 21). A zero or straight angle has no inner side to
 * mark: Undefined, never a mark that flips sides. Mod p there is no order: Inexact.
 */
import type { Field } from '@geomira/num/field';
import { inexact } from '@geomira/num/field';
import { compare, fromInteger, isInteger, type Rational } from '@geomira/num/rational';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { signNormalized, vCross, vDot, vSub } from '../geom';
import { undef, type Num, type Point, type Undefined, type Value, type Vec } from '../value';
import { badArgs, coincident, numAt, pointAt, pointsOf } from './args';

/** Arc and tick counts run from 1 to this. */
export const MAX_MARKS = 3;

/**
 * The count a mark tool was given (absent: 1). Degenerate: a number without an exact value,
 * or an exact value that is not a whole number from 1 to MAX_MARKS → Undefined.
 */
function markCount<T>(n: Num<T> | undefined, tool: string, what: string): number | Undefined {
  if (n === undefined) return 1;
  const e: Rational | undefined = n.exact;
  const ok =
    e !== undefined &&
    isInteger(e) &&
    compare(e, fromInteger(1)) >= 0 &&
    compare(e, fromInteger(MAX_MARKS)) <= 0;
  return ok
    ? Number(e.num)
    : undef(`${tool}: the ${what} count must be an exact 1, 2 or ${String(MAX_MARKS)}`);
}

/** The arms of ∠ABC (A − B, C − B), or why the angle has none (coincident points). */
function arms<T>(
  F: Field<T>,
  [A, B, C]: readonly Point<T>[],
  ctx: EvalContext,
  tool: string,
): { u: Vec<T>; v: Vec<T> } | Undefined {
  if (A === undefined || B === undefined || C === undefined) return badArgs(tool);
  const [u, v] = [vSub(F, A, B), vSub(F, C, B)];
  return (
    coincident(F, u, ctx, `${tool}(A, B, C) needs A ≠ B`) ??
    coincident(F, v, ctx, `${tool}(A, B, C) needs C ≠ B`) ?? { u, v }
  );
}

/**
 * The counter-clockwise order of the arms of ∠ABC: true when A comes first (cross > 0).
 * Degenerate cases: mod p → Inexact (no order); cross within EPS → Undefined (a zero or a
 * straight angle, told apart by the sign of the dot product, which is then clearly ±|u||v|);
 * cross inside the band → Undefined (ambiguous).
 */
function counterClockwise<T>(
  F: Field<T>,
  u: Vec<T>,
  v: Vec<T>,
  ctx: EvalContext,
  tool: string,
): boolean | Value<T> {
  const n = F.mul(vDot(F, u, u), vDot(F, v, v));
  const s = signNormalized(F, vCross(F, u, v), n, 'dimensionless', ctx);
  if (s === 'none')
    return inexact(`${tool} needs the inner side of the angle, an order ${F.name} lacks`);
  if (s === 1 || s === -1) return s === 1;
  const straight = signNormalized(F, vDot(F, u, v), n, 'dimensionless', ctx) === -1;
  if (s === 'ambiguous')
    return undef(
      `ambiguous: ${tool}: the angle ABC is within the band of ${straight ? '180°' : '0°'}`,
    );
  return undef(
    straight
      ? `${tool}: the angle ABC is straight (180°): its inner side is not determined`
      : `${tool}: the angle ABC is 0° (A and C lie on one ray from B)`,
  );
}

function markOf<T>(
  B: Point<T>,
  A: Point<T>,
  C: Point<T>,
  ccw: boolean,
  arcs: number,
  right: boolean,
): Value<T> {
  const [from, to] = ccw ? [A, C] : [C, A];
  const v = (p: Point<T>) => ({ x: p.x, y: p.y });
  return { kind: 'angle_mark', b: v(B), from: v(from), to: v(to), arcs, right };
}

/**
 * mark_angle(A, B, C[, n]): n arcs (default 1) marking the convex angle ∠ABC. Degenerate
 * cases: see the module comment and `counterClockwise`; a bad count → Undefined.
 */
function markAngle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const pts = pointsOf(args.slice(0, 3), 3);
  if (pts === undefined || args.length > 4) return badArgs('mark_angle');
  const n = args.length === 4 ? numAt(args, 3) : undefined;
  if (args.length === 4 && n === undefined) return badArgs('mark_angle');
  const arcs = markCount(n, 'mark_angle', 'arc');
  if (typeof arcs !== 'number') return arcs;
  const a = arms(F, pts, ctx, 'mark_angle');
  if ('kind' in a) return a;
  const ccw = counterClockwise(F, a.u, a.v, ctx, 'mark_angle');
  const [A, B, C] = pts;
  if (typeof ccw !== 'boolean' || A === undefined || B === undefined || C === undefined)
    return typeof ccw === 'boolean' ? badArgs('mark_angle') : ccw;
  return markOf(B, A, C, ccw, arcs, false);
}

/**
 * mark_right(A, B, C): the right-angle square at B. It marks only a right angle (right
 * angles are constructed, never assumed, SPEC §6.2): the cosine of ∠ABC is decided with the
 * band. Degenerate cases: A = B or C = B → Undefined; cosine within EPS → the mark; inside
 * the band → Undefined (ambiguous); beyond → Undefined (not a right angle); mod p → Inexact.
 */
function markRight<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const pts = pointsOf(args, 3);
  const [A, B, C] = pts ?? [];
  if (pts === undefined || A === undefined || B === undefined || C === undefined)
    return badArgs('mark_right');
  const a = arms(F, pts, ctx, 'mark_right');
  if ('kind' in a) return a;
  const n = F.mul(vDot(F, a.u, a.u), vDot(F, a.v, a.v));
  const c = signNormalized(F, vDot(F, a.u, a.v), n, 'dimensionless', ctx);
  if (c === 'none')
    return inexact(`mark_right needs the inner side of the angle, an order ${F.name} lacks`);
  if (c === 'ambiguous')
    return undef('ambiguous: mark_right: the angle ABC is within the band of 90°');
  if (c !== 0) return undef('mark_right(A, B, C): the angle ABC is not a right angle');
  const ccw = counterClockwise(F, a.u, a.v, ctx, 'mark_right');
  return typeof ccw === 'boolean' ? markOf(B, A, C, ccw, 1, true) : ccw;
}

/** mark_segment(A, B[, n]): n ticks (default 1). Degenerate: A = B, a bad count → Undefined. */
function markSegment<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [A, B] = [pointAt(args, 0), pointAt(args, 1)];
  const n = args.length === 3 ? numAt(args, 2) : undefined;
  if (
    A === undefined ||
    B === undefined ||
    args.length > 3 ||
    (args.length === 3 && n === undefined)
  )
    return badArgs('mark_segment');
  const ticks = markCount(n, 'mark_segment', 'tick');
  if (typeof ticks !== 'number') return ticks;
  const bad = coincident(F, vSub(F, B, A), ctx, 'mark_segment(A, B) needs A ≠ B');
  if (bad !== undefined) return bad;
  return { kind: 'segment_mark', p: { x: A.x, y: A.y }, q: { x: B.x, y: B.y }, ticks };
}

/** text(P, s): the string s at P. Degenerate: an empty string → Undefined. */
function text<T>(_F: Field<T>, args: readonly Value<T>[]): Value<T> {
  const [P, s] = [pointAt(args, 0), args[1]];
  if (P === undefined || s?.kind !== 'string' || args.length !== 2) return badArgs('text');
  if (s.s === '') return undef('text: the string is empty');
  return { kind: 'text', at: { x: P.x, y: P.y }, text: s.s };
}

const P = (x: string, y: string): ExampleArg => [x, y];

export const MARK_TOOLS: readonly ToolSpec[] = [
  {
    id: 'mark_angle',
    name: 'mark_angle',
    family: 'display',
    signatures: [
      { params: ['point', 'point', 'point'] },
      { params: ['point', 'point', 'point', 'number'] },
    ],
    outputKinds: ['angle_mark'],
    compute: markAngle,
    degenerate: [
      'A = B or C = B → Undefined (coincident points)',
      'a zero angle (A and C on one ray from B) → Undefined',
      'a straight angle → Undefined (its inner side is not determined)',
      'an angle within the band of 0° or 180° → Undefined (ambiguous)',
      'an arc count that is not an exact 1, 2 or 3 → Undefined',
      'mod p → Inexact (the inner side needs an order)',
    ],
    export: 'numeric',
    doc:
      'mark_angle(A, B, C[, n]): n arcs (1–3, default 1) marking the convex angle ABC at B. ' +
      'Stored counter-clockwise; a reflection reverses it.',
    examples: [
      { args: [P('4', '0'), P('0', '0'), P('1', '3')] },
      { args: [P('1', '3'), P('0', '0'), P('4', '0'), '2'] },
    ],
  },
  {
    id: 'mark_right',
    name: 'mark_right',
    family: 'display',
    signatures: [{ params: ['point', 'point', 'point'] }],
    outputKinds: ['angle_mark'],
    compute: markRight,
    degenerate: [
      'A = B or C = B → Undefined (coincident points)',
      'an angle that is not right → Undefined',
      'an angle within the band of 90° → Undefined (ambiguous)',
      'mod p → Inexact (the inner side needs an order)',
    ],
    export: 'numeric',
    doc:
      'mark_right(A, B, C): the right-angle square at B. Only a right angle (decided with the ' +
      'band) gets the mark; construct the right angle, the mark does not assume it.',
    examples: [{ args: [P('3', '0'), P('0', '0'), P('0', '2')] }],
  },
  {
    id: 'mark_segment',
    name: 'mark_segment',
    family: 'display',
    signatures: [{ params: ['point', 'point'] }, { params: ['point', 'point', 'number'] }],
    outputKinds: ['segment_mark'],
    compute: markSegment,
    degenerate: [
      'A = B → Undefined (coincident points)',
      'a tick count that is not an exact 1, 2 or 3 → Undefined',
    ],
    export: 'numeric',
    doc: 'mark_segment(A, B[, n]): n ticks (1–3, default 1) across the middle of segment AB.',
    examples: [{ args: [P('0', '0'), P('4', '2')] }, { args: [P('0', '0'), P('4', '2'), '3'] }],
  },
  {
    id: 'text',
    name: 'text',
    family: 'display',
    signatures: [{ params: ['point', 'string'] }],
    outputKinds: ['text'],
    compute: text,
    degenerate: ['an empty string → Undefined'],
    export: 'numeric',
    doc: 'text(P, "…"): the string at P (label grammar: A_1, \\omega, primes).',
    examples: [{ args: [P('1', '2'), { text: 'Let ABC be a triangle' }] }],
  },
];
