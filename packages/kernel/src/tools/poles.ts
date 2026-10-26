/**
 * v1.1 tools (SPEC §6.2, Run 13, ADR-0031): pole(l, c), the inverse of polar(P, c)
 * (tangents.ts), and radical_center(c1, c2, c3). Both are rational (exact over Q and mod p).
 * An arc counts as its carrier circle here (arc-range.ts), as polar and radical_axis do.
 */
import type { Field } from '@geomira/num/field';
import { isZeroNormalized, isZeroVec, vAdd, vCross, vDot, vRot90, vScale, vSub } from '../geom';
import type { EvalContext, ExampleArg, ToolSpec } from '../tool';
import { pointOf, undef, type Circle, type Value } from '../value';
import { badArgs, circleAt, degenerateCircle, degenerateLine, lineAt } from './args';

/**
 * The pole of l: with n = rot90(d) and k = n·(p − O), the point P = O + (r²/k)·n, whose
 * polar (X − O)·(P − O) = r² is l. Degenerate cases: l through the center (the distance
 * k/|n| zero as a length) → Undefined (its pole is at infinity); l tangent to c → the touch
 * point; a segment or ray → the pole of its carrier line.
 */
function pole<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const [l, c] = [lineAt(args, 0), circleAt(args, 1)];
  if (l === undefined || c === undefined || args.length !== 2) return badArgs('pole');
  const bad = degenerateLine(F, l, ctx) ?? degenerateCircle(F, c, ctx);
  if (bad !== undefined) return bad;
  const n = vRot90(F, l.d);
  const k = vDot(F, n, vSub(F, l.p, c.c));
  if (isZeroNormalized(F, k, vDot(F, n, n), 'length', ctx))
    return undef('l passes through the center: its pole is at infinity');
  const P = vAdd(F, c.c, vScale(F, n, F.div(c.r2, k)));
  return pointOf(P.x, P.y);
}

/** Why two of the circles are concentric, or undefined. */
function concentric<T>(
  F: Field<T>,
  cs: readonly Circle<T>[],
  ctx: EvalContext,
): string | undefined {
  for (const [i, a] of cs.entries())
    for (const b of cs.slice(i + 1))
      if (isZeroVec(F, vSub(F, b.c, a.c), ctx)) return 'concentric circles';
  return undefined;
}

/**
 * The radical center: X with equal power to the three circles. Relative to O₁, with
 * w₂ = O₂ − O₁, w₃ = O₃ − O₁: X·w₂ = α = (|w₂|² + r₁² − r₂²)/2 and X·w₃ = β (likewise), so
 * X = O₁ + (β·rot90(w₂) − α·rot90(w₃)) / cross(w₂, w₃). Degenerate cases: two concentric
 * circles → Undefined; collinear centers → Undefined (the radical axes are parallel, or
 * coincide when the circles are coaxal).
 */
function radicalCenter<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const cs = [circleAt(args, 0), circleAt(args, 1), circleAt(args, 2)];
  const [c1, c2, c3] = cs;
  if (c1 === undefined || c2 === undefined || c3 === undefined || args.length !== 3)
    return badArgs('radical_center');
  const bad =
    degenerateCircle(F, c1, ctx) ?? degenerateCircle(F, c2, ctx) ?? degenerateCircle(F, c3, ctx);
  if (bad !== undefined) return bad;
  const same = concentric(F, [c1, c2, c3], ctx);
  if (same !== undefined) return undef(same);
  const [w2, w3] = [vSub(F, c2.c, c1.c), vSub(F, c3.c, c1.c)];
  const half = (w: typeof w2, c: Circle<T>) =>
    F.div(F.sub(F.add(vDot(F, w, w), c1.r2), c.r2), F.add(F.one, F.one));
  const [alpha, beta] = [half(w2, c2), half(w3, c3)];
  const [n2, n3] = [vDot(F, w2, w2), vDot(F, w3, w3)];
  const cross = vCross(F, w2, w3);
  if (isZeroNormalized(F, cross, F.mul(n2, n3), 'dimensionless', ctx)) {
    // Parallel axes X·w₂ = α, X·w₃ = β coincide iff α·(w₂·w₃) = β·|w₂|² (as a length).
    const gap = F.sub(F.mul(alpha, vDot(F, w2, w3)), F.mul(beta, n2));
    const same = isZeroNormalized(F, gap, F.mul(F.mul(n2, n2), n3), 'length', ctx);
    return undef(
      same
        ? 'the circles are coaxal: their radical axes coincide'
        : 'the centers are collinear: the radical axes are parallel',
    );
  }
  const num = vSub(F, vScale(F, vRot90(F, w2), beta), vScale(F, vRot90(F, w3), alpha));
  const X = vAdd(F, c1.c, vScale(F, num, F.div(F.one, cross)));
  return pointOf(X.x, X.y);
}

const circle = (c: readonly [string, string], r: string): ExampleArg => ({
  call: 'circle',
  args: [c, r],
});
const C5: ExampleArg = {
  call: 'circle',
  args: [
    ['0', '0'],
    ['5', '0'],
  ],
};

export const POLE_TOOLS: readonly ToolSpec[] = [
  {
    id: 'pole',
    name: 'pole',
    family: 'points',
    signatures: [{ params: ['linear', 'round'], symmetry: [] }],
    outputKinds: ['point'],
    compute: pole,
    degenerate: [
      'l through the center → Undefined (the pole is at infinity)',
      'l tangent to c → the touch point',
      'a segment or ray is extended to its carrier line',
    ],
    export: 'numeric',
    doc: 'pole(l, c): the pole of the line l with respect to c, the point whose polar is l (the inverse of polar); exact.',
    examples: [
      {
        args: [
          {
            through: [
              ['5', '-5'],
              ['5', '5'],
            ],
            as: 'line',
          },
          C5,
        ],
      },
      {
        args: [
          {
            through: [
              ['2', '0'],
              ['0', '2'],
            ],
            as: 'line',
          },
          C5,
        ],
      },
    ],
  },
  {
    id: 'radical_center',
    name: 'radical_center',
    family: 'points',
    signatures: [
      {
        params: ['round', 'round', 'round'],
        symmetry: [{ kind: 'permute', positions: [0, 1, 2], same: 'value' }],
      },
    ],
    outputKinds: ['point'],
    compute: radicalCenter,
    degenerate: [
      'two concentric circles → Undefined',
      'collinear centers → Undefined (parallel radical axes)',
      'coaxal circles → Undefined (the radical axes coincide)',
    ],
    export: 'numeric',
    doc: 'radical_center(c1, c2, c3): the point with equal power to the three circles, where their radical axes meet; exact.',
    examples: [
      { args: [circle(['0', '0'], '2'), circle(['6', '0'], '3'), circle(['2', '5'], '1')] },
    ],
  },
];
