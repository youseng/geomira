/**
 * Display tools (SPEC §6.2) of Run 2: polygon. (mark_angle, mark_right, mark_segment and
 * text arrive with the scene.)
 */
import type { Field } from '@geomira/num/field';
import type { EvalContext, ToolSpec } from '../tool';
import { isZeroVec, vSub } from '../geom';
import { undef, type Value } from '../value';
import { allPoints, badArgs } from './args';

/**
 * polygon(P1, …, Pn), n ≥ 3. Degenerate cases: two consecutive vertices (the last and the
 * first included) coincide → Undefined; collinear vertices → a flat polygon (area 0).
 */
function polygon<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const pts = allPoints(args);
  if (pts === undefined || pts.length < 3) return badArgs('polygon');
  for (const [i, p] of pts.entries()) {
    const q = pts[(i + 1) % pts.length] ?? p;
    if (isZeroVec(F, vSub(F, q, p), ctx)) {
      return undef(
        `coincident points: polygon vertices ${String(i + 1)} and ${String(((i + 1) % pts.length) + 1)} coincide`,
      );
    }
  }
  return { kind: 'polygon', pts: pts.map((p) => ({ x: p.x, y: p.y })) };
}

export const DISPLAY_TOOLS: readonly ToolSpec[] = [
  {
    id: 'polygon',
    name: 'polygon',
    family: 'display',
    signatures: [{ params: ['point', 'point', 'point'], rest: 'point' }],
    outputKinds: ['polygon'],
    compute: polygon,
    degenerate: [
      'consecutive coincident vertices → Undefined',
      'collinear vertices → a flat polygon',
    ],
    export: { constructive: 'polygon' },
    doc: 'The polygon with the given vertices, in order (at least three).',
    examples: [
      {
        args: [
          ['0', '0'],
          ['4', '0'],
          ['1', '3'],
        ],
      },
    ],
  },
];
