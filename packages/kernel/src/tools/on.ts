/**
 * on(obj, param): gliders (SPEC §6.2), the free points that live on an object. The
 * formulas are in glider.ts (shared with the drag map): on(l, t) on a line, segment or
 * ray (t clamped to the range); on(c, u, v), the homogeneous stereographic parameter
 * (u : v) from the circle's anchor (rational, reaching the anchor at v = 0); on(c, θ), by
 * angle, the form for circle(O, r), which has no anchor.
 */
import type { Field } from '@geomira/num/field';
import { gliderPoint } from '../glider';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import type { Value } from '../value';
import { badArgs, circleAt, lineAt, numAt } from './args';

/**
 * Degenerate cases: a glider on an Undefined object → Undefined (evaluate propagates);
 * the rest as gliderPoint (no anchor, (0 : 0), a bounded range mod p, Inexact angles).
 */
function on<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [l, c, a, b] = [lineAt(args, 0), circleAt(args, 0), numAt(args, 1), numAt(args, 2)];
  if (l !== undefined && a !== undefined && args.length === 2) {
    return gliderPoint(F, l, { form: 'line', t: a.v }, ctx);
  }
  if (c !== undefined && a !== undefined && b !== undefined && args.length === 3) {
    return gliderPoint(F, c, { form: 'stereo', u: a.v, v: b.v }, ctx);
  }
  if (c !== undefined && a !== undefined && args.length === 2) {
    return gliderPoint(F, c, { form: 'angle', degrees: a.v }, ctx);
  }
  return badArgs('on');
}

const SEGMENT: ExampleArg = {
  through: [
    ['0', '0'],
    ['4', '2'],
  ],
  as: 'segment',
};
const CIRCLE: ExampleArg = {
  call: 'circle',
  args: [
    ['0', '0'],
    ['5', '0'],
  ],
};

export const GLIDER_TOOLS: readonly ToolSpec[] = [
  {
    id: 'on',
    name: 'on',
    family: 'points',
    signatures: [
      { params: ['linear', 'number'] },
      { params: ['round', 'number', 'number'] },
      { params: ['round', 'number'], radical: true },
    ],
    outputKinds: ['point'],
    compute: on,
    input: true,
    degenerate: [
      'a glider on an Undefined object → Undefined',
      'on(l, t) on a segment or ray clamps t to the range',
      'a segment or ray range mod p → Inexact',
      'on(c, u, v) on a circle without anchor → Undefined',
      'on(c, 0, 0) → Undefined',
      'on(c, u, 0) → the anchor',
      'on(c, θ) over Q or mod p → Inexact unless r, cos θ and sin θ are representable',
    ],
    export: 'numeric',
    doc: 'Gliders: on(l, t) = p + t·d on a line, segment or ray (t clamped to the range); on(c, u, v): the stereographic parameter (u : v) from the anchor of c (rational; (u : 0) is the anchor); on(c, θ): the point at angle θ (degrees) from the center.',
    examples: [
      { args: [SEGMENT, '1/4'] },
      { args: [CIRCLE, '1', '2'] },
      { args: [CIRCLE, '90'] },
      { args: [CIRCLE, '30'] },
    ],
  },
];
