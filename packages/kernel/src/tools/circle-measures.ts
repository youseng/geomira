/**
 * Measures of circles (SPEC §6.2): power(P, c) and radius(c). The power is a polynomial in
 * the inputs (exact in every field); the radius is √r², exact over Q exactly when r² is
 * the square of a rational, and always Inexact mod p (no square roots there).
 */
import { isInexact, type Field } from '@geomira/num/field';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { vDot, vSub } from '../geom';
import { numOf, type Value } from '../value';
import { badArgs, circleAt, degenerateCircle, pointAt } from './args';

/**
 * |P − O|² − r² (an area): negative inside c, zero on c, positive outside. Measured from the
 * circle's anchor A when it has one (a point on it): |P − A|² + 2·(P − A)·(A − O), the same
 * value exactly (|A − O|² = r²) without cancelling two quantities of size r², which lost
 * digits for huge circles in floats (Run 14, L3). Degenerate cases: P on c → 0; P = the
 * centre → −r²; a circle with no positive radius (never built by the v1 tools) → Undefined.
 */
function power<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [P, c] = [pointAt(args, 0), circleAt(args, 1)];
  if (P === undefined || c === undefined || args.length !== 2) return badArgs('power');
  const bad = degenerateCircle(F, c, ctx);
  if (bad !== undefined) return bad;
  if (c.anchor !== undefined) {
    const [w, e] = [vSub(F, P, c.anchor), vSub(F, c.anchor, c.c)];
    const we = vDot(F, w, e);
    return numOf(F.add(vDot(F, w, w), F.add(we, we)));
  }
  const w = vSub(F, P, c.c);
  return numOf(F.sub(vDot(F, w, w), c.r2));
}

/**
 * √r². Degenerate cases: r² not the square of a rational → Inexact over Q; always Inexact
 * mod p; a circle with no positive radius (never built by the v1 tools) → Undefined.
 */
function radius<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const c = circleAt(args, 0);
  if (c === undefined || args.length !== 1) return badArgs('radius');
  const bad = degenerateCircle(F, c, ctx);
  if (bad !== undefined) return bad;
  const r = F.sqrt(c.r2);
  return isInexact(r) ? r : numOf(r);
}

const C5: ExampleArg = {
  call: 'circle',
  args: [
    ['0', '0'],
    ['3', '4'],
  ],
};

export const CIRCLE_MEASURE_TOOLS: readonly ToolSpec[] = [
  {
    id: 'power',
    name: 'power',
    family: 'measures',
    signatures: [{ params: ['point', 'round'] }],
    outputKinds: ['number'],
    compute: power,
    degenerate: ['P on c → 0', 'P = the center → −r²'],
    export: 'numeric',
    doc: 'power(P, c) = |PO|² − r²: negative inside c, zero on c, positive outside (exact).',
    examples: [{ args: [['7', '1'], C5] }],
  },
  {
    id: 'radius',
    name: 'radius',
    family: 'measures',
    signatures: [{ params: ['round'], radical: true }],
    outputKinds: ['number'],
    compute: radius,
    degenerate: ['r² not the square of a rational → Inexact over Q (always Inexact mod p)'],
    export: 'numeric',
    doc: 'radius(c) = √r²: exact over Q when r² is the square of a rational.',
    examples: [
      { args: [C5] },
      {
        args: [
          {
            call: 'circle',
            args: [
              ['0', '0'],
              ['1', '1'],
            ],
          },
        ],
      },
    ],
  },
];
