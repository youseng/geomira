/**
 * intersect(a, b) for two line-like objects (SPEC §6.2, §6.3). A segment or ray keeps its
 * range: the intersection must lie on both (ADR-0003). Parallelism is decided on the sine
 * of the angle between the directions, so short valid segments are never called parallel.
 */
import type { Field, Inexact } from '@geomira/num/field';
import { inexact } from '@geomira/num/field';
import type { EvalContext, ToolSpec } from '../tool';
import { isZeroNormalized, vAdd, vCross, vDot, vScale, vSub } from '../geom';
import { pointOf, undef, type Line, type Undefined, type Value } from '../value';
import { badArgs, degenerateLine, lineAt } from './args';

function rangeName<T>(l: Line<T>): string {
  return l.lo !== null && l.hi !== null ? 'segment' : 'ray';
}

/**
 * Why parameter t of `what` ("intersection", "other intersection") is not in l's range
 * [lo, hi], or undefined when it is.
 */
export function outOfRange<T>(
  F: Field<T>,
  l: Line<T>,
  t: T,
  ctx: EvalContext,
  what = 'intersection',
): Undefined | Inexact | undefined {
  const gaps = [l.lo === null ? null : F.sub(t, l.lo), l.hi === null ? null : F.sub(l.hi, t)];
  for (const gap of gaps) {
    if (gap === null) continue;
    const s = F.sign(gap, 'dimensionless', ctx);
    if (s === -1) return undef(`no ${what}: it lies outside the ${rangeName(l)}`);
    if (s === 'ambiguous') {
      return undef(`ambiguous: the ${what} is within the band of an end of the ${rangeName(l)}`);
    }
    if (s === 'none') {
      return inexact(
        `whether the ${what} lies on the ${rangeName(l)} needs an order, which ${F.name} lacks`,
      );
    }
  }
  return undefined;
}

/**
 * Degenerate cases: parallel lines → Undefined; coincident lines → Undefined; the
 * intersection outside a segment or ray → Undefined; within the band of an end →
 * Undefined (ambiguous); a range check mod p → Inexact.
 */
function intersect<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [a, b] = [lineAt(args, 0), lineAt(args, 1)];
  if (a === undefined || b === undefined || args.length !== 2) return badArgs('intersect');
  const bad = degenerateLine(F, a, ctx) ?? degenerateLine(F, b, ctx);
  if (bad !== undefined) return bad;
  const den = vCross(F, a.d, b.d);
  const w = vSub(F, b.p, a.p);
  const [aa, bb] = [vDot(F, a.d, a.d), vDot(F, b.d, b.d)];
  if (isZeroNormalized(F, den, F.mul(aa, bb), 'dimensionless', ctx)) {
    const on = isZeroNormalized(F, vCross(F, w, a.d), aa, 'length', ctx);
    return undef(on ? 'coincident lines' : 'parallel lines');
  }
  const t = F.div(vCross(F, w, b.d), den);
  const s = F.div(vCross(F, w, a.d), den);
  const range = outOfRange(F, a, t, ctx) ?? outOfRange(F, b, s, ctx);
  if (range !== undefined) return range;
  const x = vAdd(F, a.p, vScale(F, a.d, t));
  return pointOf(x.x, x.y);
}

export const INTERSECT_TOOLS: readonly ToolSpec[] = [
  {
    id: 'intersect',
    name: 'intersect',
    family: 'points',
    signatures: [{ params: ['linear', 'linear'] }],
    outputKinds: ['point'],
    compute: intersect,
    degenerate: [
      'parallel lines → Undefined',
      'coincident lines → Undefined',
      'the intersection outside a segment or ray → Undefined',
      'the intersection within the band of a segment end → Undefined (ambiguous)',
      'a segment or ray range mod p → Inexact',
    ],
    export: 'numeric',
    doc: 'The intersection point of two lines, segments or rays (on both ranges).',
    examples: [
      {
        args: [
          {
            through: [
              ['0', '0'],
              ['2', '2'],
            ],
            as: 'line',
          },
          {
            through: [
              ['0', '2'],
              ['2', '0'],
            ],
            as: 'segment',
          },
        ],
      },
    ],
  },
];
