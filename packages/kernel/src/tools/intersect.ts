/**
 * intersect(a, b, selectors) (SPEC §6.2, §7): the common point of two curves.
 *   - line ∩ line (Run 2): at most one point; a segment or ray keeps its range (ADR-0003
 *     item 15); parallelism is decided on the sine of the angle between the directions; two
 *     parallel full lines meet at their ideal point (ADR-0040; Undefined with selectors).
 *   - line ∩ circle and circle ∩ circle (Run 3b, ADR-0006): branchable, 0–2 candidates
 *     decided on the discriminant with the band (tools/pairs.ts), chosen by the selectors
 *     (select.ts): along(±) on line ∩ circle, orient(±) on circle ∩ circle, other(P) exact.
 *   - line ∩ conic (ADR-0042, tools/conic-pairs.ts): as line ∩ circle, along(±); a line with an
 *     asymptotic direction meets the conic once.
 */
import type { Field } from '@geomira/num/field';
import { choose, candidateValues } from '../select';
import type { EvaluatedSelector } from '../selector';
import type { ArgSymmetry, EvalContext, ExampleArg, ToolSpec } from '../tool';
import type { Undefined, Value } from '../value';
import { badArgs, circleAt, conicAt, lineAt } from './args';
import { LINE_CONIC, lineConicPair } from './conic-pairs';
import {
  CIRCLE_CIRCLE,
  LINE_CIRCLE,
  LINE_LINE,
  circleCirclePair,
  lineCirclePair,
  lineLinePair,
  type Pair,
} from './pairs';
import { idealMeet } from './parallel-lines';

function pairOf<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
): Pair<T> | Undefined | 'bad' {
  if (args.length !== 2) return 'bad';
  const [l0, l1, c0, c1] = [lineAt(args, 0), lineAt(args, 1), circleAt(args, 0), circleAt(args, 1)];
  const [k0, k1] = [conicAt(args, 0), conicAt(args, 1)];
  if (l0 !== undefined && k1 !== undefined) return lineConicPair(F, l0, k1, ctx, true);
  if (k0 !== undefined && l1 !== undefined) return lineConicPair(F, l1, k0, ctx, false);
  if (l0 !== undefined && l1 !== undefined) return lineLinePair(F, l0, l1, ctx);
  if (l0 !== undefined && c1 !== undefined) return lineCirclePair(F, l0, c1, ctx, true);
  if (c0 !== undefined && l1 !== undefined) return lineCirclePair(F, l1, c0, ctx, false);
  if (c0 !== undefined && c1 !== undefined) return circleCirclePair(F, c0, c1, ctx);
  return 'bad';
}

/**
 * Degenerate cases: as ToolSpec.degenerate below (the pair's and the selection rules').
 */
function intersect<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
  selectors: readonly EvaluatedSelector<T>[] = [],
): Value<T> {
  // Two parallel full lines meet at infinity (ADR-0040); a selector judges positions, so with
  // selectors the call stays Undefined there, as before.
  const [l0, l1] = [lineAt(args, 0), lineAt(args, 1)];
  const ideal =
    l0 === undefined || l1 === undefined || selectors.length > 0 || args.length !== 2
      ? undefined
      : idealMeet(F, l0, l1, ctx);
  if (ideal !== undefined) return ideal;
  const p = pairOf(F, args, ctx);
  if (p === 'bad') return badArgs('intersect');
  return 'kind' in p ? p : choose(F, p, selectors, ctx);
}

function candidates<T>(
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
): readonly Value<T>[] {
  const p = pairOf(F, args, ctx);
  return p === 'bad' || 'kind' in p ? [] : candidateValues(p);
}

/**
 * The two curves in either order (ADR-0029): the same point. along(±) measures on the line
 * whatever its position, and every filter and ranker reads only the candidates; orient(±) is
 * the sign of cross(O₂ − O₁, X − O₁), so swapping two circles flips it.
 */
const EITHER: readonly ArgSymmetry[] = [
  { kind: 'permute', positions: [0, 1], same: 'value', flipsOrient: true },
];

const C5: ExampleArg = {
  call: 'circle',
  args: [
    ['0', '0'],
    ['5', '0'],
  ],
};

export const INTERSECT_TOOLS: readonly ToolSpec[] = [
  {
    id: 'intersect',
    name: 'intersect',
    family: 'points',
    signatures: [
      {
        params: ['linear', 'linear'],
        branch: LINE_LINE,
        symmetry: EITHER,
        output: ['point', 'ideal_point'],
      },
      { params: ['linear', 'round'], branch: LINE_CIRCLE, symmetry: EITHER },
      { params: ['round', 'linear'], branch: LINE_CIRCLE, symmetry: EITHER },
      { params: ['round', 'round'], branch: CIRCLE_CIRCLE, symmetry: EITHER },
      { params: ['linear', 'conic'], branch: LINE_CONIC, symmetry: EITHER },
      { params: ['conic', 'linear'], branch: LINE_CONIC, symmetry: EITHER },
    ],
    outputKinds: ['point', 'ideal_point'],
    compute: intersect,
    candidates,
    degenerate: [
      "parallel lines → their ideal point (the first line's direction and flag)",
      'parallel segments or rays → Undefined (no point at infinity is on them)',
      'coincident lines → Undefined',
      'the intersection outside a segment or ray → Undefined',
      'the intersection within the band of a segment end → Undefined (ambiguous)',
      'a segment or ray range mod p → Inexact',
      'a candidate outside an arc is not a candidate (none left → Undefined)',
      'a candidate within the band of an arc end → Undefined (ambiguous)',
      'line ∩ circle: the line misses the circle → Undefined',
      'line ∩ circle: tangency (the gap within the band) → the double point',
      'circle ∩ circle: apart or one inside the other → Undefined',
      'circle ∩ circle: tangency (a gap within the band) → the double point',
      'circle ∩ circle: the circles nearly coincide (centres and radii within the band) → two candidates by the half chord, or Undefined (ambiguous)',
      'concentric circles → Undefined',
      'line ∩ conic: the line misses the conic → Undefined',
      'line ∩ conic: tangency (the gap within the band) → the double point',
      'line ∩ conic: an asymptotic direction (α within EPS) → the one finite common point (both along signs)',
      'line ∩ conic: an asymptote → Undefined (no finite common point)',
      'line ∩ conic: α within the band of an asymptotic direction → Undefined (ambiguous)',
      'line ∩ conic: every decision is scale-free (the ellipse 10⁸ times larger gives the same points)',
      'other(P) on line ∩ conic with an asymptotic direction → Undefined (the other point is at infinity)',
      'two candidates and no selector → Undefined (ambiguous: add a selector)',
      'a deciding quantity of a selector within the band → Undefined (ambiguous)',
      'no candidate satisfies the selectors → Undefined',
      'two candidates satisfy the selectors → Undefined (ambiguous: add a selector)',
      'along(±), orient(±) or other(P) where it does not apply → Undefined',
      'other(P) with P not on both objects → Undefined (within the band: ambiguous)',
      'a candidate outside a segment or ray is not a candidate',
      'square roots not representable → Inexact over Q and mod p (other(P) is exact)',
      'a sign-based selector mod p → Inexact',
    ],
    export: { constructive: 'intersect' },
    doc: 'intersect(a, b, selectors): the common point of two lines, a line and a circle, two circles, or a line and a conic; a curve pair with two candidates needs selectors (along(±) on line ∩ circle and line ∩ conic, orient(±) on circle ∩ circle, other(P), near(P), same_side(Q, l), …).',
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
      {
        args: [
          {
            through: [
              ['-4', '-3'],
              ['4', '3'],
            ],
            as: 'line',
          },
          C5,
        ],
        selectors: [{ kind: 'along', sign: 1 }],
      },
      {
        args: [
          C5,
          {
            call: 'circle',
            args: [
              ['6', '0'],
              ['3', '4'],
            ],
          },
        ],
        selectors: [{ kind: 'orient', sign: 1 }],
      },
      {
        args: [
          {
            through: [
              ['3', '4'],
              ['0', '0'],
            ],
            as: 'line',
          },
          C5,
        ],
        selectors: [{ kind: 'other', p: ['3', '4'] }],
      },
      {
        args: [
          {
            through: [
              ['0', '0'],
              ['1', '0'],
            ],
            as: 'line',
          },
          {
            call: 'circle',
            args: [
              ['0', '0'],
              ['1', '1'],
            ],
          },
        ],
        selectors: [{ kind: 'along', sign: 1 }],
      },
    ],
  },
];
