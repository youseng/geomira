/**
 * Claims about conics (ADR-0042), POLYNOMIAL KINDS over the kernel's normal-form coefficients
 * (exact over Q and mod p, so the exact rungs decide them):
 *   - on(P, k): Q(P) = 0. Float gap: Q(P)/|∇Q(P)|, a LENGTH, as the kernel decides incidence on a
 *     conic (conic.ts onConicSign), so a claim and a construction never disagree.
 *   - tangent(l, k) (either order): the line's coordinates u = (n, −n·p), n = rot90(d), satisfy
 *     uᵀ·adj(M)·u = 0 (the dual conic). NDG: d is not an asymptotic direction of k (α = dᵀM₂d
 *     ≠ 0, decided over |d|²·√(a² + 2b² + c²) as the kernel's line ∩ conic decides it): such a
 *     line meets k at a point at infinity, and an asymptote touches it there. Float gap: the
 *     kernel's chord gap (positive: two common points, zero: a tangency), the count of
 *     intersect(l, k).
 *   - conconic(A, B, C, D, E, F): one determinant condition, the 6×6 determinant of the rows
 *     (x², xy, y², x, y, 1), written as Q(F) = 0 for the pencil conic through A…E
 *     ([ACE][BDE][ABF][CDF] − [ABE][CDE][ACF][BDF], which is that determinant up to a constant
 *     factor and vanishes for any order of the six points). NDG: the six points pairwise distinct
 *     and no three collinear (a conic through three collinear points is a line pair, which
 *     conic(A, B, C, D, E) refuses). Residual: the distance from F to the conic through A…E over
 *     the points' diameter (dimensionless).
 * Tangency of a conic and a circle or of two conics is not a claim of this version: undefined
 * with the reason (it needs conic ∩ conic).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import type { ToleranceContext } from '@geomira/num/tolerance';
import {
  chordGap,
  coeffsOf,
  halfGradient,
  pencilCoeffs,
  poleOf,
  qDirection,
  qValue,
  quadNorm,
  type Coeffs,
} from '@geomira/kernel/conic';
import { vDot, vRot90 } from '@geomira/kernel/geom';
import { undef, type Conic, type Line, type Undefined, type Vec } from '@geomira/kernel/value';
import * as f from './float';
import {
  argLabel,
  badClaim,
  distinctAll,
  lineAt,
  pairs,
  pointAt,
  pointsFrom,
  type Algebra,
  type ClaimArgs,
  type ClaimKindSpec,
} from './kind';
import type { Ndg } from './ndg';

function conicAt<T>(args: ClaimArgs<T>, i: number): Conic<T> | undefined {
  const v = args[i];
  return v?.kind === 'conic' ? v : undefined;
}

/** on(P, k) for a conic k: Q(P) = 0. */
export function onConicAlgebra<T>(F: Field<T>, P: Vec<T>, k: Conic<T>): Algebra<T> {
  return { conditions: [qValue(F, coeffsOf(k), P)], ndg: [], order: [] };
}

/** Q(P)/|∇Q(P)|: the kernel's incidence gap on a conic, a signed length. */
export function onConicGap(P: Vec<number>, k: Conic<number>): number {
  const q = coeffsOf(k);
  const g = halfGradient(FloatField, q, P);
  const r = qValue(FloatField, q, P) / (2 * Math.hypot(g.x, g.y));
  return Number.isNaN(r) ? Infinity : r;
}

/** The line and the conic of a tangency claim with their argument positions, in either order. */
export function lineConic<T>(
  args: ClaimArgs<T>,
):
  | { readonly l: Line<T>; readonly k: Conic<T>; readonly li: number; readonly ki: number }
  | undefined {
  const [l0, l1, k0, k1] = [lineAt(args, 0), lineAt(args, 1), conicAt(args, 0), conicAt(args, 1)];
  if (l0 !== undefined && k1 !== undefined) return { l: l0, k: k1, li: 0, ki: 1 };
  if (l1 !== undefined && k0 !== undefined) return { l: l1, k: k0, li: 1, ki: 0 };
  return undefined;
}

/** Whether a tangency claim names a conic beside a circle or another conic (not decided). */
export function conicWithCurve<T>(args: ClaimArgs<T>): Undefined | undefined {
  const conic = args.some((a) => a.kind === 'conic');
  const other = args.some((a) => a.kind === 'circle') || args.every((a) => a.kind === 'conic');
  return conic && other
    ? undef('tangent: the tangency of a conic and a circle or of two conics is not decided')
    : undefined;
}

/** tangent(l, k): uᵀ·adj(M)·u = 0, NDG d not an asymptotic direction (module comment). */
export function tangentConicAlgebra<T>(
  F: Field<T>,
  hit: NonNullable<ReturnType<typeof lineConic<T>>>,
): Algebra<T> {
  const { l, k, li, ki } = hit;
  const q: Coeffs<T> = coeffsOf(k);
  const n = vRot90(F, l.d);
  const u: readonly [T, T, T] = [n.x, n.y, F.neg(vDot(F, n, l.p))];
  const [x, y, w] = poleOf(F, q, u);
  const dual = F.add(F.add(F.mul(u[0], x), F.mul(u[1], y)), F.mul(u[2], w));
  const dd = vDot(F, l.d, l.d);
  const asymptotic: Ndg<T> = {
    kind: 'nonzero',
    value: qDirection(F, q, l.d),
    norm: F.mul(F.mul(dd, dd), quadNorm(F, q)),
    dim: 'dimensionless',
    what: `${argLabel(li)} has an asymptotic direction of ${argLabel(ki)} (it meets it at infinity)`,
  };
  return { conditions: [dual], ndg: [asymptotic], order: [] };
}

/** The tangency gap of a line and a conic: the kernel's chord gap (Infinity when undefined). */
export function tangentConicGap(hit: NonNullable<ReturnType<typeof lineConic<number>>>): number {
  return chordGap(FloatField, coeffsOf(hit.k), hit.l.p, hit.l.d) ?? Infinity;
}

/** The six points of a conconic claim, or undefined. */
function six<T>(args: ClaimArgs<T>): readonly Vec<T>[] | undefined {
  const pts = pointsFrom(args, 0);
  return pts?.length === 6 ? pts : undefined;
}

function conconicAlgebra<T>(F: Field<T>, args: ClaimArgs<T>): Algebra<T> | Undefined {
  const pts = six(args);
  const [a, b, c, d, e, x] = pts ?? [];
  if (a === undefined || b === undefined || c === undefined) return badClaim('conconic');
  if (d === undefined || e === undefined || x === undefined) return badClaim('conconic');
  const condition = qValue(F, pencilCoeffs(F, a, b, c, d, e), x);
  const triples: Ndg<T>[] = [];
  for (const [i, j] of pairs(6))
    for (let m = j + 1; m < 6; m++) {
      const [p, r, s] = [pts?.[i], pts?.[j], pts?.[m]];
      if (p !== undefined && r !== undefined && s !== undefined)
        triples.push({
          kind: 'noncollinear',
          a: p,
          b: r,
          c: s,
          what: `${argLabel(i)}, ${argLabel(j)} and ${argLabel(m)} are collinear`,
        });
    }
  return {
    conditions: [condition],
    ndg: [...distinctAll(pts ?? [], argLabel), ...triples],
    order: [],
  };
}

/** The distance from F to the conic through A…E over the six points' diameter. */
function conconicResidual(args: ClaimArgs<number>): number {
  const pts = six(args);
  const [a, b, c, d, e, x] = pts ?? [];
  if (pts === undefined || a === undefined || b === undefined || c === undefined) return Infinity;
  if (d === undefined || e === undefined || x === undefined) return Infinity;
  const q = pencilCoeffs(FloatField, a, b, c, d, e);
  const g = halfGradient(FloatField, q, x);
  const gap = qValue(FloatField, q, x) / (2 * Math.hypot(g.x, g.y));
  const diam = Math.max(...pts.flatMap((p, i) => pts.slice(i + 1).map((r) => f.dist(p, r))));
  return Number.isNaN(gap) ? Infinity : f.ratio(gap, diam);
}

export const CONIC_KINDS: readonly ClaimKindSpec[] = [
  {
    name: 'conconic',
    params: ['point', 'point', 'point', 'point', 'point', 'point'],
    polynomial: true,
    test: 'floor',
    doc: 'conconic(A, B, C, D, E, F): the six points lie on one conic (no three of them collinear).',
    algebra: (F, args) => conconicAlgebra(F, args),
    residual: (args) => conconicResidual(args),
  },
];

/** The point of an on(P, k) claim and its conic, or undefined. */
export function pointConic<T>(args: ClaimArgs<T>): readonly [Vec<T>, Conic<T>] | undefined {
  const [P, k] = [pointAt(args, 0), conicAt(args, 1)];
  return P === undefined || k === undefined ? undefined : [P, k];
}

/** The figure's scale ratio of a gap (the residual of on and tangent). */
export function scaled(gap: number, ctx: ToleranceContext): number {
  return f.ratio(gap, ctx.scale);
}
