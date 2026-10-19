/**
 * Point tools (SPEC §6.2): point(x, y), param, midpoint, divide, foot. Each compute is
 * field-generic and total; degenerate cases are listed in each spec and tested by name.
 */
import type { Field } from '@geomira/num/field';
import type { EvalContext, ToolSpec } from '../tool';
import { half, vAdd, vDot, vLerp, vScale, vSub } from '../geom';
import { numOf, pointOf, undef, type Line, type Value } from '../value';
import { badArgs, coincident, degenerateLine, lineAt, numAt, pointAt, pointsOf } from './args';

/** point(x, y). Degenerate: none (any two numbers make a point). */
function point<T>(_F: Field<T>, args: readonly Value<T>[]): Value<T> {
  const x = numAt(args, 0);
  const y = numAt(args, 1);
  if (x === undefined || y === undefined || args.length !== 2) return badArgs('point');
  return pointOf(x.v, y.v);
}

/**
 * param(min, max, v): the free number v. Degenerate cases: min ≥ max → Undefined; v
 * outside [min, max] → Undefined; a decision inside the band → Undefined("ambiguous");
 * mod p there is no order and the range is not checked (ADR-0003).
 */
function param<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [min, max, v] = [numAt(args, 0), numAt(args, 1), numAt(args, 2)];
  if (min === undefined || max === undefined || v === undefined || args.length !== 3) {
    return badArgs('param');
  }
  const checks = [
    {
      s: F.sign(F.sub(max.v, min.v), 'dimensionless', ctx),
      bad: 'min must be less than max',
      strict: true,
    },
    {
      s: F.sign(F.sub(v.v, min.v), 'dimensionless', ctx),
      bad: 'the value is below min',
      strict: false,
    },
    {
      s: F.sign(F.sub(max.v, v.v), 'dimensionless', ctx),
      bad: 'the value is above max',
      strict: false,
    },
  ];
  for (const { s, bad, strict } of checks) {
    if (s === 'none') break;
    if (s === 'ambiguous') return undef(`ambiguous: param range, ${bad} within the band`);
    if (s === -1 || (strict && s === 0)) return undef(`param: ${bad}`);
  }
  return numOf(v.v, v.exact);
}

/** (A + B) / 2. Degenerate: midpoint(A, A) = A (no Undefined case). */
function midpoint<T>(F: Field<T>, args: readonly Value<T>[]): Value<T> {
  const [a, b] = pointsOf(args, 2) ?? [];
  if (a === undefined || b === undefined) return badArgs('midpoint');
  const m = vScale(F, vAdd(F, a, b), half(F));
  return pointOf(m.x, m.y);
}

/** A + t·(B − A). Degenerate: divide(A, A, t) = A (no Undefined case). */
function divide<T>(F: Field<T>, args: readonly Value<T>[]): Value<T> {
  const [a, b, t] = [pointAt(args, 0), pointAt(args, 1), numAt(args, 2)];
  if (a === undefined || b === undefined || t === undefined || args.length !== 3) {
    return badArgs('divide');
  }
  const m = vLerp(F, a, b, t.v);
  return pointOf(m.x, m.y);
}

/**
 * The foot of P on the carrier line of l (segments and rays are extended). Degenerate: a
 * line with no direction → Undefined; P on l → P.
 */
function footOn<T>(F: Field<T>, P: Value<T>, l: Line<T>, ctx: EvalContext): Value<T> {
  if (P.kind !== 'point') return badArgs('foot');
  const bad = degenerateLine(F, l, ctx);
  if (bad !== undefined) return bad;
  const t = F.div(vDot(F, vSub(F, P, l.p), l.d), vDot(F, l.d, l.d));
  const f = vAdd(F, l.p, vScale(F, l.d, t));
  return pointOf(f.x, f.y);
}

/** foot(P, l) or foot(P, A, B). Degenerate: A = B → Undefined (coincident points). */
function foot<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [P, l] = [args[0], lineAt(args, 1)];
  if (P !== undefined && l !== undefined && args.length === 2) return footOn(F, P, l, ctx);
  const [p, a, b] = pointsOf(args, 3) ?? [];
  if (p === undefined || a === undefined || b === undefined) return badArgs('foot');
  const d = vSub(F, b, a);
  const bad = coincident(F, d, ctx, 'foot(P, A, B) needs A ≠ B');
  if (bad !== undefined) return bad;
  return footOn(F, p, { kind: 'line', p: a, d, lo: null, hi: null, chiral: false }, ctx);
}

export const POINT_TOOLS: readonly ToolSpec[] = [
  {
    id: 'point',
    name: 'point',
    family: 'points',
    signatures: [{ params: ['number', 'number'] }],
    outputKinds: ['point'],
    compute: point,
    degenerate: [],
    export: 'numeric',
    doc: 'The point with coordinates (x, y); `(x, y)` is the same. Free when x and y are literals.',
    examples: [{ args: ['1', '-2/3'] }],
  },
  {
    id: 'param',
    name: 'param',
    family: 'points',
    signatures: [{ params: ['number', 'number', 'number'] }],
    outputKinds: ['number'],
    compute: param,
    degenerate: [
      'min ≥ max → Undefined',
      'v outside [min, max] → Undefined',
      'a range decision inside the band → Undefined (ambiguous)',
      'mod p the range is not checked',
    ],
    export: 'numeric',
    doc: 'param(min, max, v): a free number v in [min, max] (a slider).',
    examples: [{ args: ['0', '1', '1/3'] }],
  },
  {
    id: 'midpoint',
    name: 'midpoint',
    family: 'points',
    signatures: [{ params: ['point', 'point'] }],
    outputKinds: ['point'],
    compute: midpoint,
    degenerate: ['midpoint(A, A) = A'],
    export: 'numeric',
    doc: 'The midpoint of A and B.',
    examples: [
      {
        args: [
          ['0', '0'],
          ['3', '1'],
        ],
      },
    ],
  },
  {
    id: 'divide',
    name: 'divide',
    family: 'points',
    signatures: [{ params: ['point', 'point', 'number'] }],
    outputKinds: ['point'],
    compute: divide,
    degenerate: ['divide(A, A, t) = A'],
    export: 'numeric',
    doc: 'divide(A, B, t) = A + t·(B − A): t = 1/2 is the midpoint, t = 2 reflects A in B.',
    examples: [{ args: [['0', '0'], ['3', '6'], '1/3'] }],
  },
  {
    id: 'foot',
    name: 'foot',
    family: 'points',
    signatures: [{ params: ['point', 'linear'] }, { params: ['point', 'point', 'point'] }],
    outputKinds: ['point'],
    compute: foot,
    degenerate: [
      'foot(P, A, A) → Undefined (coincident points)',
      'P on the line → P',
      'a segment or ray is extended to its carrier line',
    ],
    export: 'numeric',
    doc: 'foot(P, l) or foot(P, A, B): the orthogonal projection of P on the line.',
    examples: [
      {
        args: [
          ['1', '3'],
          {
            through: [
              ['0', '0'],
              ['4', '0'],
            ],
            as: 'line',
          },
        ],
      },
      {
        args: [
          ['1', '3'],
          ['0', '0'],
          ['2', '2'],
        ],
      },
    ],
  },
];
