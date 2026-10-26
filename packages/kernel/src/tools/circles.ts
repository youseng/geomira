/**
 * Circle tools (SPEC §6.2): circle(O, A), circle(O, r), circle(A, B, C) = circumcircle,
 * cline (a circle, or the line when collinear: the v1 variable-kind tool),
 * diameter_circle, ninepoint_circle, and center(c). Every circle tool that has a known
 * point on its circle stores it as the `anchor` (SPEC §4): circle(O, A): A; circle(A, B,
 * C), circumcircle, cline: A; diameter_circle(A, B): A; ninepoint_circle(A, B, C): the
 * midpoint of BC. Only circle(O, r) has none. Arcs are not built in v1 (`arc: null`).
 */
import * as Q from '@geomira/num/rational';
import type { Field } from '@geomira/num/field';
import type { ArgSymmetry, EvalContext, ExampleArg, Signature, ToolSpec } from '../tool';
import { half, two, vAdd, vDot, vScale, vSub } from '../geom';
import { pointOf, undef, type Circle, type Undefined, type Value, type Vec } from '../value';
import { badArgs, circleAt, coincident, numAt, pointAt, pointsOf } from './args';
import { ANY_ORDER, circumcenterOf, triangle, triangleShape } from './triangle';

/** The circle with centre c through `through` (r2 = |through − c|²), anchored there. */
export function circleThrough<T>(F: Field<T>, c: Vec<T>, through: Vec<T>): Circle<T> {
  const d = vSub(F, through, c);
  return {
    kind: 'circle',
    c: { x: c.x, y: c.y },
    r2: vDot(F, d, d),
    arc: null,
    anchor: { x: through.x, y: through.y },
  };
}

/** circle(O, A): centre O through A. Degenerate: O = A → Undefined (coincident points). */
function centreThrough<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [O, A] = pointsOf(args, 2) ?? [];
  if (O === undefined || A === undefined) return badArgs('circle');
  return coincident(F, vSub(F, A, O), ctx, 'circle(O, A) needs O ≠ A') ?? circleThrough(F, O, A);
}

/**
 * circle(O, r): centre O, radius r (r2 = r², no anchor). Degenerate cases: r = 0 or
 * r < 0 → Undefined; r within the band of 0 → Undefined (ambiguous); mod p there is no
 * order and the sign of r is not checked (as with param, ADR-0003).
 */
function centreRadius<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [O, r] = [pointAt(args, 0), numAt(args, 1)];
  if (O === undefined || r === undefined || args.length !== 2) return badArgs('circle');
  const s = r.exact !== undefined && Q.isZero(r.exact) ? 0 : F.sign(r.v, 'length', ctx);
  if (s === 0 || (s === 'none' && F.isZero(r.v, 'length', ctx))) {
    return undef('zero radius: circle(O, r) needs r > 0');
  }
  if (s === -1) return undef('negative radius: circle(O, r) needs r > 0');
  if (s === 'ambiguous') return undef('ambiguous: the radius is within the band of zero');
  return { kind: 'circle', c: { x: O.x, y: O.y }, r2: F.mul(r.v, r.v), arc: null };
}

/**
 * The circle through A, B, C, anchored at A. Degenerate cases: coincident points →
 * Undefined; collinear points → Undefined (use cline).
 */
function circumcircleOf<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  tool: string,
): Value<T> {
  const t = triangle(F, args, ctx, tool);
  return 'kind' in t ? t : circleThrough(F, circumcenterOf(F, t), t.a);
}

/** circle(O, A), circle(O, r) or circle(A, B, C), by the argument kinds. */
function circle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  if (args.length === 3) return circumcircleOf(F, args, ctx, 'circle');
  return numAt(args, 1) === undefined ? centreThrough(F, args, ctx) : centreRadius(F, args, ctx);
}

function circumcircle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  return circumcircleOf(F, args, ctx, 'circumcircle');
}

/**
 * cline(A, B, C): the circle through A, B, C (anchor A), or, when they are collinear (the
 * same EPS test as circumcircle), the line through A and B (achiral direction B − A).
 * Degenerate: two coincident points → Undefined (no unique circle or line).
 */
function cline<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [a, b, c] = pointsOf(args, 3) ?? [];
  if (a === undefined || b === undefined || c === undefined) return badArgs('cline');
  const t = triangleShape(F, a, b, c, ctx);
  if (t === 'coincident') return undef('coincident points: cline needs three distinct points');
  if (t === 'collinear') {
    return {
      kind: 'line',
      p: { x: a.x, y: a.y },
      d: vSub(F, b, a),
      lo: null,
      hi: null,
      chiral: false,
    };
  }
  return circleThrough(F, circumcenterOf(F, t), a);
}

/** The circle with diameter AB, anchored at A. Degenerate: A = B → Undefined. */
function diameterCircle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [a, b] = pointsOf(args, 2) ?? [];
  if (a === undefined || b === undefined) return badArgs('diameter_circle');
  const bad = coincident(F, vSub(F, b, a), ctx, 'diameter_circle(A, B) needs A ≠ B');
  return bad ?? circleThrough(F, vScale(F, vAdd(F, a, b), half(F)), a);
}

/**
 * The nine-point circle: the circumcircle of the midpoints of the sides, anchored at the
 * midpoint of BC. Degenerate cases: coincident vertices → Undefined; collinear vertices →
 * Undefined.
 */
function ninepointOf<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  tool: string,
): Circle<T> | Undefined {
  const t = triangle(F, args, ctx, tool);
  if ('kind' in t) return t;
  const mid = (p: Vec<T>, q: Vec<T>) => {
    const m = vScale(F, vAdd(F, p, q), half(F));
    return pointOf(m.x, m.y);
  };
  const [ma, mb, mc] = [mid(t.b, t.c), mid(t.c, t.a), mid(t.a, t.b)];
  // The medial triangle is ABC scaled by −1/2: its sides are −u/2 and −v/2 and its cross
  // product is cross/4, taken from ABC's own (never 0: triangle() checked it). Recomputing
  // them from the rounded midpoints could give 0 for a tiny triangle far from the origin.
  const minusHalf = F.neg(half(F));
  const [u, v] = [vScale(F, t.u, minusHalf), vScale(F, t.v, minusHalf)];
  const medial = { a: ma, b: mb, c: mc, u, v, cross: F.div(t.cross, F.add(two(F), two(F))) };
  return circleThrough(F, circumcenterOf(F, medial), ma);
}

function ninepointCircle<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  return ninepointOf(F, args, ctx, 'ninepoint_circle');
}

/**
 * The centre of the nine-point circle (the midpoint of OH). Degenerate cases: coincident
 * vertices → Undefined; collinear vertices → Undefined.
 */
function ninepointCenter<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const c = ninepointOf(F, args, ctx, 'ninepoint_center');
  return c.kind === 'circle' ? pointOf(c.c.x, c.c.y) : c;
}

/** center(c): the centre of c. Degenerate: none. */
function center<T>(_F: Field<T>, args: readonly Value<T>[]): Value<T> {
  const c = circleAt(args, 0);
  if (c === undefined || args.length !== 1) return badArgs('center');
  return pointOf(c.c.x, c.c.y);
}

/** ninepoint_center, appended to the registry after the Run 3a tools (Run 3b audit). */
export const NINEPOINT_CENTER_TOOL: ToolSpec = {
  id: 'ninepoint_center',
  name: 'ninepoint_center',
  family: 'points',
  signatures: ANY_ORDER,
  outputKinds: ['point'],
  compute: ninepointCenter,
  degenerate: ['coincident vertices → Undefined', 'collinear vertices → Undefined'],
  export: 'numeric',
  doc: 'The center of the nine-point circle of ABC: the midpoint of the circumcenter and the orthocenter.',
  examples: [
    {
      args: [
        ['0', '0'],
        ['4', '0'],
        ['1', '3'],
      ],
    },
  ],
};

const O: readonly [string, string] = ['1', '2'];
const A: readonly [string, string] = ['4', '6'];
const ABC: readonly ExampleArg[] = [
  ['0', '0'],
  ['4', '0'],
  ['1', '3'],
];
/**
 * A circle of A, B, C anchored at A or on BC: B and C swap with the same value, any order
 * gives the same circle with another anchor (ADR-0029).
 */
const ANCHORED_AT_A: readonly ArgSymmetry[] = [
  { kind: 'permute', positions: [1, 2], same: 'value' },
  { kind: 'permute', positions: [0, 1, 2], same: 'figure' },
];
const THREE: readonly Signature[] = [
  { params: ['point', 'point', 'point'], symmetry: ANCHORED_AT_A },
];
/** cline: any order gives the same circle, or the same line (its direction B − A changes). */
const CLINE: readonly Signature[] = [
  {
    params: ['point', 'point', 'point'],
    symmetry: [{ kind: 'permute', positions: [0, 1, 2], same: 'figure' }],
  },
];

export const CIRCLE_TOOLS: readonly ToolSpec[] = [
  {
    id: 'circle',
    name: 'circle',
    family: 'circles',
    signatures: [
      { params: ['point', 'point'] },
      { params: ['point', 'number'] },
      { params: ['point', 'point', 'point'], symmetry: ANCHORED_AT_A },
    ],
    outputKinds: ['circle'],
    compute: circle,
    degenerate: [
      'circle(O, O) → Undefined (coincident points)',
      'circle(O, r) with r ≤ 0 → Undefined',
      'circle(O, r) with r within the band of 0 → Undefined (ambiguous)',
      'circle(O, r) mod p: the sign of r is not checked',
      'circle(A, B, C) with coincident points → Undefined',
      'circle(A, B, C) with collinear points → Undefined (use cline)',
    ],
    export: { constructive: 'circle' },
    doc: 'circle(O, A): center O through A (anchor A); circle(O, r): center O, radius r (no anchor); circle(A, B, C): the circle through A, B, C (anchor A).',
    examples: [{ args: [O, A] }, { args: [O, '5/2'] }, { args: ABC }],
  },
  {
    id: 'circumcircle',
    name: 'circumcircle',
    family: 'circles',
    signatures: THREE,
    outputKinds: ['circle'],
    compute: circumcircle,
    sameAs: 'circle',
    degenerate: ['coincident vertices → Undefined', 'collinear vertices → Undefined (use cline)'],
    export: { constructive: 'circumcircle' },
    doc: 'The circle through A, B, C (the same as circle(A, B, C)); anchor A.',
    examples: [{ args: ABC }],
  },
  {
    id: 'cline',
    name: 'cline',
    family: 'circles',
    signatures: CLINE,
    outputKinds: ['circle', 'line'],
    compute: cline,
    degenerate: ['coincident points → Undefined', 'collinear points → the line through them'],
    export: 'numeric',
    doc: 'The circle through A, B, C (anchor A), or the line AB when A, B, C are collinear.',
    examples: [
      { args: ABC },
      {
        args: [
          ['0', '0'],
          ['1', '1'],
          ['3', '3'],
        ],
      },
    ],
  },
  {
    id: 'diameter_circle',
    name: 'diameter_circle',
    family: 'circles',
    signatures: [
      {
        params: ['point', 'point'],
        symmetry: [{ kind: 'permute', positions: [0, 1], same: 'figure' }],
      },
    ],
    outputKinds: ['circle'],
    compute: diameterCircle,
    degenerate: ['diameter_circle(A, A) → Undefined (coincident points)'],
    export: 'numeric',
    doc: 'The circle with diameter AB; anchor A.',
    examples: [{ args: [O, A] }],
  },
  {
    id: 'ninepoint_circle',
    name: 'ninepoint_circle',
    family: 'circles',
    signatures: THREE,
    outputKinds: ['circle'],
    compute: ninepointCircle,
    degenerate: ['coincident vertices → Undefined', 'collinear vertices → Undefined'],
    export: 'numeric',
    doc: 'The nine-point circle of ABC (through the midpoints of the sides); anchor: the midpoint of BC.',
    examples: [{ args: ABC }],
  },
  {
    id: 'center',
    name: 'center',
    family: 'points',
    signatures: [{ params: ['round'] }],
    outputKinds: ['point'],
    compute: center,
    degenerate: [],
    export: 'numeric',
    doc: 'The center of a circle.',
    examples: [{ args: [{ call: 'circle', args: ABC }] }],
  },
];
