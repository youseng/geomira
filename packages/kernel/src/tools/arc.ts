/**
 * arc(A, B, C) (SPEC §6.2, v1.1, Run 13, ADR-0031): the arc of the circle through A, B, C
 * that runs from A through B to C. The value is a Circle with SPEC §4's `arc` field
 * (counter-clockwise from `from` to `to`) and the anchor A, as circle(A, B, C). Exact over
 * Q (the circumcircle is rational); mod p the orientation needs an order (Inexact).
 */
import { assertNever } from '@geomira/num/assert';
import { inexact, type Field, type Inexact } from '@geomira/num/field';
import { signNormalized, vDot, vSub } from '../geom';
import type { EvalContext, ToolSpec } from '../tool';
import { undef, type Value } from '../value';
import { badArgs, pointsOf } from './args';
import { circumcenterOf, triangleShape, type Triangle } from './triangle';

/**
 * Whether A, B, C turn counter-clockwise. FloatField reads the sign of the cross product
 * itself inside the band (exact fields have exact signs): beyond EPS it is right, and the
 * arc does not jump there (see arc). Degenerate: mod p → Inexact (no order).
 */
function counterClockwise<T>(F: Field<T>, t: Triangle<T>, ctx: EvalContext): boolean | Inexact {
  const n = F.mul(vDot(F, t.u, t.u), vDot(F, t.v, t.v));
  const s = signNormalized(F, t.cross, n, 'dimensionless', ctx);
  switch (s) {
    case 1:
    case -1:
      return s === 1;
    case 0:
    case 'ambiguous':
      return F.toNumber(t.cross) > 0;
    case 'none':
      return inexact(`the orientation of an arc needs an order, which ${F.name} lacks`);
    default:
      return assertNever(s, 'field sign');
  }
}

/**
 * The arc through A, B, C: counter-clockwise from A to C when A, B, C turn counter-clockwise
 * (cross(B − A, C − A) > 0), else from C to A, so it always passes through B. As a point set
 * it is continuous when B crosses line AC (it tends to the segment AC, or to the two rays
 * outside it), so the orientation needs no band: only collinearity (within EPS) is
 * degenerate, as for cline. Degenerate cases: two coincident points → Undefined; collinear
 * points → Undefined (use segment); mod p → Inexact (the orientation needs an order).
 */
function arc<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [A, B, C] = pointsOf(args, 3) ?? [];
  if (A === undefined || B === undefined || C === undefined) return badArgs('arc');
  const t = triangleShape(F, A, B, C, ctx);
  if (t === 'coincident')
    return undef('coincident points: arc(A, B, C) needs three distinct points');
  if (t === 'collinear')
    return undef('collinear points: arc(A, B, C) needs three points not on one line (use segment)');
  const ccw = counterClockwise(F, t, ctx);
  if (typeof ccw !== 'boolean') return ccw;
  const O = circumcenterOf(F, t);
  const [from, to] = ccw ? [A, C] : [C, A];
  return {
    kind: 'circle',
    c: { x: O.x, y: O.y },
    r2: vDot(F, vSub(F, A, O), vSub(F, A, O)),
    arc: { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } },
    anchor: { x: A.x, y: A.y },
  };
}

export const ARC_TOOLS: readonly ToolSpec[] = [
  {
    id: 'arc',
    name: 'arc',
    family: 'circles',
    signatures: [
      {
        params: ['point', 'point', 'point'],
        symmetry: [{ kind: 'permute', positions: [0, 2], same: 'figure' }],
      },
    ],
    outputKinds: ['circle'],
    compute: arc,
    degenerate: [
      'coincident points → Undefined',
      'collinear points → Undefined (use segment)',
      'the orientation mod p → Inexact',
    ],
    export: 'numeric',
    doc: 'arc(A, B, C): the arc from A through B to C of the circle through A, B, C (a circle value whose arc runs counter-clockwise; anchor A). Points ON it (intersect, other, on, tangent_point, tangent_from) must lie on the arc; tools that use the whole circle (center, radius, power, tangent, polar, pole, radical_axis, radical_center) use its circle.',
    examples: [
      {
        args: [
          ['4', '0'],
          ['0', '4'],
          ['-4', '0'],
        ],
      },
      {
        args: [
          ['-4', '0'],
          ['0', '4'],
          ['4', '0'],
        ],
      },
    ],
  },
];
