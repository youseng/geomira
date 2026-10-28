/**
 * Cross ratios and harmonic quadruples (Run 16a, ADR-0040 decision 15), POLYNOMIAL KINDS:
 *   - cross_ratio(A, B, C, D, k) and harmonic(A, B, C, D) (k = −1) on points: the complex cross
 *     ratio (C − A)(D − B) = k·(C − B)(D − A), two real conditions. It is real exactly when the
 *     four points are collinear or concyclic, and is then their cross ratio on the line, or the
 *     cross ratio of the lines from any fifth point of the circle (an inversion centred at that
 *     point is the projection from it onto a line and keeps the complex cross ratio up to
 *     conjugation). Four points on neither make the claim false. NDG: the four points distinct.
 *   - cross_ratio_lines(a, b, c, d, k) and harmonic_lines(a, b, c, d) on lines: the lines
 *     concurrent (the determinants of a, b with c and with d) and
 *     cross(u_a, u_c)·cross(u_b, u_d) = k·cross(u_b, u_c)·cross(u_a, u_d) (the cross ratio of the
 *     pencil: it cuts every transversal in four points of that cross ratio). NDG: the lines
 *     pairwise not parallel (a parallel pencil is degenerate, as `concurrent` keeps it).
 * Residuals are dimensionless: the complex residual over the sum of the moduli; for lines the
 * worse of the concurrency residual (as `concurrent`'s) and the cross ratio's.
 */
import { isInexact, type Field, type Inexact } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import type { ToleranceContext } from '@geomira/num/tolerance';
import { vCross, vSub } from '@geomira/kernel/geom';
import type { Line, Undefined, Vec } from '@geomira/kernel/value';
import * as f from './float';
import {
  argLabel,
  badClaim,
  distinctAll,
  lineAt,
  litAt,
  pairs,
  pointsFrom,
  type Algebra,
  type ClaimArgs,
  type ClaimKindSpec,
} from './kind';
import type { Ndg } from './ndg';

/** The complex product of two vectors read as complex numbers. */
function cmul<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): Vec<T> {
  return { x: F.sub(F.mul(a.x, b.x), F.mul(a.y, b.y)), y: F.add(F.mul(a.x, b.y), F.mul(a.y, b.x)) };
}

/** (C − A)(D − B) and (C − B)(D − A): the cross ratio is their quotient. */
function crossTerms<T>(F: Field<T>, pts: readonly Vec<T>[]): readonly [Vec<T>, Vec<T>] | undefined {
  const [a, b, c, d] = pts;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return undefined;
  return [cmul(F, vSub(F, c, a), vSub(F, d, b)), cmul(F, vSub(F, c, b), vSub(F, d, a))];
}

/** The literal k (−1 for the harmonic kinds), Inexact when this field cannot hold it. */
function literalK<T>(F: Field<T>, args: ClaimArgs<T>, harmonic: boolean): T | Inexact | undefined {
  if (harmonic) return F.neg(F.one);
  const lit = litAt(args, 4);
  return lit === undefined ? undefined : F.fromRational(lit);
}

function pointAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
  harmonic: boolean,
  name: string,
): Algebra<T> | Undefined | Inexact {
  const pts = pointsFrom(args.slice(0, 4), 0);
  const k = literalK(F, args, harmonic);
  const terms = pts === undefined ? undefined : crossTerms(F, pts);
  if (pts === undefined || k === undefined || terms === undefined) return badClaim(name);
  if (isInexact(k)) return k;
  const [p, q] = terms;
  const conditions = [F.sub(p.x, F.mul(k, q.x)), F.sub(p.y, F.mul(k, q.y))];
  return { conditions, ndg: distinctAll(pts, argLabel), order: [] };
}

function pointResidual(args: ClaimArgs<number>, harmonic: boolean): number {
  const pts = pointsFrom(args.slice(0, 4), 0);
  const k = literalK(FloatField, args, harmonic);
  const terms = pts === undefined ? undefined : crossTerms(FloatField, pts);
  if (k === undefined || isInexact(k) || terms === undefined) return Infinity;
  const [p, q] = terms;
  const r = Math.hypot(p.x - k * q.x, p.y - k * q.y);
  return f.ratio(r, f.norm(p) + Math.abs(k) * f.norm(q));
}

/** a·x + b·y + c = 0 of a line. */
function implicit<T>(F: Field<T>, l: Line<T>): readonly [T, T, T] {
  return [F.neg(l.d.y), l.d.x, F.sub(F.mul(l.d.y, l.p.x), F.mul(l.d.x, l.p.y))];
}

function det3<T>(
  F: Field<T>,
  p: readonly [T, T, T],
  q: readonly [T, T, T],
  s: readonly [T, T, T],
): T {
  const minor = (i: 0 | 1 | 2, j: 0 | 1 | 2) => F.sub(F.mul(q[i], s[j]), F.mul(q[j], s[i]));
  return F.add(F.sub(F.mul(p[0], minor(1, 2)), F.mul(p[1], minor(0, 2))), F.mul(p[2], minor(0, 1)));
}

/** The four lines, or undefined when an argument is not one. */
function fourLines<T>(
  args: ClaimArgs<T>,
): readonly [Line<T>, Line<T>, Line<T>, Line<T>] | undefined {
  const [a, b, c, d] = [0, 1, 2, 3].map((i) => lineAt(args, i));
  return a === undefined || b === undefined || c === undefined || d === undefined
    ? undefined
    : [a, b, c, d];
}

/** [cross(u_a, u_c)·cross(u_b, u_d), cross(u_b, u_c)·cross(u_a, u_d)]. */
function pencilTerms<T>(
  F: Field<T>,
  [a, b, c, d]: readonly [Line<T>, Line<T>, Line<T>, Line<T>],
): readonly [T, T] {
  return [
    F.mul(vCross(F, a.d, c.d), vCross(F, b.d, d.d)),
    F.mul(vCross(F, b.d, c.d), vCross(F, a.d, d.d)),
  ];
}

function lineAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
  harmonic: boolean,
  name: string,
): Algebra<T> | Undefined | Inexact {
  const ls = fourLines(args);
  const k = literalK(F, args, harmonic);
  if (ls === undefined || k === undefined) return badClaim(name);
  if (isInexact(k)) return k;
  const [l0, l1, l2, l3] = ls;
  const t = pencilTerms(F, ls);
  const [i0, i1] = [implicit(F, l0), implicit(F, l1)];
  const conditions = [
    det3(F, i0, i1, implicit(F, l2)),
    det3(F, i0, i1, implicit(F, l3)),
    F.sub(t[0], F.mul(k, t[1])),
  ];
  const ndg: Ndg<T>[] = pairs(4).flatMap(([i, j]) => {
    const [p, q] = [ls[i], ls[j]];
    const what = `${argLabel(i)} and ${argLabel(j)} are parallel`;
    return p === undefined || q === undefined
      ? []
      : [{ kind: 'nonparallel' as const, u: p.d, v: q.d, what }];
  });
  return { conditions, ndg, order: [] };
}

function lineResidual(args: ClaimArgs<number>, ctx: ToleranceContext, harmonic: boolean): number {
  const F = FloatField;
  const ls = fourLines(args);
  const k = literalK(F, args, harmonic);
  if (ls === undefined || k === undefined || isInexact(k)) return Infinity;
  const [l0, l1, l2, l3] = ls;
  const t = pencilTerms(F, ls);
  const concurrency = [l2, l3].map((lk) =>
    f.ratio(
      det3(F, implicit(F, l0), implicit(F, l1), implicit(F, lk)),
      f.norm(l0.d) * f.norm(l1.d) * f.norm(lk.d) * ctx.scale,
    ),
  );
  const ratio = f.ratio(t[0] - k * t[1], Math.abs(t[0]) + Math.abs(k) * Math.abs(t[1]));
  return f.maxOf([...concurrency, ratio]);
}

const DOC_POINTS =
  'four collinear or concyclic points (the complex cross ratio (C − A)(D − B) / ((C − B)(D − A)) is real exactly then)';

export const PROJECTIVE_KINDS: readonly ClaimKindSpec[] = [
  {
    name: 'cross_ratio',
    params: ['point', 'point', 'point', 'point', 'number'],
    polynomial: true,
    test: 'floor',
    doc: `cross_ratio(A, B, C, D) = k: (A, B; C, D) = k for ${DOC_POINTS}.`,
    algebra: (F, args) => pointAlgebra(F, args, false, 'cross_ratio'),
    residual: (args) => pointResidual(args, false),
  },
  {
    name: 'harmonic',
    params: ['point', 'point', 'point', 'point'],
    polynomial: true,
    test: 'floor',
    doc: `harmonic(A, B; C, D): (A, B; C, D) = −1 for ${DOC_POINTS}.`,
    algebra: (F, args) => pointAlgebra(F, args, true, 'harmonic'),
    residual: (args) => pointResidual(args, true),
  },
  {
    name: 'cross_ratio_lines',
    params: ['line', 'line', 'line', 'line', 'number'],
    polynomial: true,
    test: 'floor',
    doc: 'cross_ratio_lines(a, b, c, d, k): four concurrent lines with (a, b; c, d) = k.',
    algebra: (F, args) => lineAlgebra(F, args, false, 'cross_ratio_lines'),
    residual: (args, ctx) => lineResidual(args, ctx, false),
  },
  {
    name: 'harmonic_lines',
    params: ['line', 'line', 'line', 'line'],
    polynomial: true,
    test: 'floor',
    doc: 'harmonic_lines(a, b, c, d): four concurrent lines with (a, b; c, d) = −1.',
    algebra: (F, args) => lineAlgebra(F, args, true, 'harmonic_lines'),
    residual: (args, ctx) => lineResidual(args, ctx, true),
  },
];
