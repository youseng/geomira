/**
 * Claim kinds about points and lines: collinear, concyclic, concurrent, parallel,
 * perpendicular, equal (points). All are POLYNOMIAL KINDS (SPEC §10.1). Lines are judged
 * by their carriers (segment and ray ranges play no role). See ADR-0008 for the table of
 * conditions, NDG items and residuals.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import type { ToleranceContext } from '@geomira/num/tolerance';
import { vCross, vDot, vSub } from '@geomira/kernel/geom';
import type { Line, Vec } from '@geomira/kernel/value';
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

/** z(A, B, C) = (C − B)·conj(A − B) = (dot, cross) of A − B and C − B: arg z = ∡ABC. */
export function angleZ<T>(F: Field<T>, a: Vec<T>, b: Vec<T>, c: Vec<T>): Vec<T> {
  const [u, v] = [vSub(F, a, b), vSub(F, c, b)];
  return { x: vDot(F, u, v), y: vCross(F, u, v) };
}

/** Im(z₁·conj(z₂)) for complex numbers stored as vectors. */
export function imMulConj<T>(F: Field<T>, z1: Vec<T>, z2: Vec<T>): T {
  return F.sub(F.mul(z1.y, z2.x), F.mul(z1.x, z2.y));
}

function noOrder<T>(conditions: readonly T[], ndg: readonly Ndg<T>[]): Algebra<T> {
  return { conditions, ndg, order: [] };
}

function collinearAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
): Algebra<T> | ReturnType<typeof badClaim> {
  const pts = pointsFrom(args, 0);
  const [a, b] = [pts?.[0], pts?.[1]];
  if (pts === undefined || a === undefined || b === undefined) return badClaim('collinear');
  const conditions = pts.slice(2).map((p) => vCross(F, vSub(F, b, a), vSub(F, p, a)));
  return noOrder(conditions, distinctAll(pts, argLabel));
}

/** Distance of P_k from line P1P2 over the diameter of the triple, worst k. */
function collinearResidual(args: ClaimArgs<number>): number {
  const pts = pointsFrom(args, 0);
  const [a, b] = [pts?.[0], pts?.[1]];
  if (pts === undefined || a === undefined || b === undefined) return Infinity;
  return f.maxOf(
    pts.slice(2).map((p) => {
      const diam = Math.max(f.dist(a, b), f.dist(a, p), f.dist(b, p));
      return f.ratio(f.cross(f.sub(b, a), f.sub(p, a)), f.dist(a, b) * diam);
    }),
  );
}

function concyclicAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
): Algebra<T> | ReturnType<typeof badClaim> {
  const pts = pointsFrom(args, 0);
  const [a, b, c] = [pts?.[0], pts?.[1], pts?.[2]];
  if (pts === undefined || a === undefined || b === undefined || c === undefined) {
    return badClaim('concyclic');
  }
  // A, B, C, P concyclic (or collinear) iff ∡ACB = ∡APB (directed, mod 180°).
  const zc = angleZ(F, a, c, b);
  const conditions = pts.slice(3).map((p) => imMulConj(F, zc, angleZ(F, a, p, b)));
  const triples: Ndg<T>[] = [];
  for (const [i, j] of pairs(pts.length)) {
    for (let k = j + 1; k < pts.length; k++) {
      const [x, y, z] = [pts[i], pts[j], pts[k]];
      if (x !== undefined && y !== undefined && z !== undefined) {
        triples.push({ kind: 'noncollinear', a: x, b: y, c: z, what: 'the points are collinear' });
      }
    }
  }
  const allCollinear: Ndg<T> = {
    kind: 'any',
    items: triples,
    what: 'all the points are collinear',
  };
  return noOrder(conditions, [...distinctAll(pts, argLabel), allCollinear]);
}

/** |sin(∡ACB − ∡APB)|, worst extra point P. */
function concyclicResidual(args: ClaimArgs<number>): number {
  const pts = pointsFrom(args, 0);
  const [a, b, c] = [pts?.[0], pts?.[1], pts?.[2]];
  if (pts === undefined || a === undefined || b === undefined || c === undefined) return Infinity;
  const zc = angleZ(FloatField, a, c, b);
  return f.maxOf(
    pts.slice(3).map((p) => {
      const zp = angleZ(FloatField, a, p, b);
      return f.ratio(imMulConj(FloatField, zc, zp), f.norm(zc) * f.norm(zp));
    }),
  );
}

/** The implicit coefficients (a, b, c) of a line: a·x + b·y + c = 0. */
function implicit<T>(F: Field<T>, l: Line<T>): readonly [T, T, T] {
  return [F.neg(l.d.y), l.d.x, F.sub(F.mul(l.d.y, l.p.x), F.mul(l.d.x, l.p.y))];
}

function det3<T>(F: Field<T>, r: readonly (readonly [T, T, T])[]): T | undefined {
  const [p, q, s] = r;
  if (p === undefined || q === undefined || s === undefined) return undefined;
  const minor = (i: 0 | 1 | 2, j: 0 | 1 | 2) => F.sub(F.mul(q[i], s[j]), F.mul(q[j], s[i]));
  return F.add(F.sub(F.mul(p[0], minor(1, 2)), F.mul(p[1], minor(0, 2))), F.mul(p[2], minor(0, 1)));
}

/** Lines l and m are not the same line. */
function distinctLines<T>(l: Line<T>, m: Line<T>, what: string): Ndg<T> {
  return {
    kind: 'any',
    what,
    items: [
      { kind: 'nonparallel', u: l.d, v: m.d, what },
      { kind: 'off_line', p: m.p, q: l.p, d: l.d, what },
    ],
  };
}

function linesFrom<T>(args: ClaimArgs<T>): Line<T>[] | undefined {
  const out: Line<T>[] = [];
  for (let i = 0; i < args.length; i++) {
    const l = lineAt(args, i);
    if (l === undefined) return undefined;
    out.push(l);
  }
  return out;
}

function concurrentAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
): Algebra<T> | ReturnType<typeof badClaim> {
  const ls = linesFrom(args);
  const [l1, l2] = [ls?.[0], ls?.[1]];
  if (ls === undefined || l1 === undefined || l2 === undefined) return badClaim('concurrent');
  const conditions: T[] = [];
  for (const lk of ls.slice(2)) {
    const d = det3(F, [implicit(F, l1), implicit(F, l2), implicit(F, lk)]);
    if (d !== undefined) conditions.push(d);
  }
  const ndg: Ndg<T>[] = pairs(ls.length).flatMap(([i, j]) => {
    const [a, b] = [ls[i], ls[j]];
    return a === undefined || b === undefined
      ? []
      : [distinctLines(a, b, `${argLabel(i)} and ${argLabel(j)} are the same line`)];
  });
  const notAllParallel: Ndg<T> = {
    kind: 'any',
    what: 'all the lines are parallel',
    items: pairs(ls.length).flatMap(([i, j]) => {
      const [a, b] = [ls[i], ls[j]];
      return a === undefined || b === undefined
        ? []
        : [{ kind: 'nonparallel' as const, u: a.d, v: b.d, what: 'parallel' }];
    }),
  };
  return noOrder(conditions, [...ndg, notAllParallel]);
}

/** |det| / (|d₁||d₂||d_k|·scale), worst k. */
function concurrentResidual(args: ClaimArgs<number>, ctx: ToleranceContext): number {
  const ls = linesFrom(args);
  const [l1, l2] = [ls?.[0], ls?.[1]];
  if (ls === undefined || l1 === undefined || l2 === undefined) return Infinity;
  return f.maxOf(
    ls.slice(2).map((lk) => {
      const d =
        det3(FloatField, [
          implicit(FloatField, l1),
          implicit(FloatField, l2),
          implicit(FloatField, lk),
        ]) ?? Infinity;
      return f.ratio(d, f.norm(l1.d) * f.norm(l2.d) * f.norm(lk.d) * ctx.scale);
    }),
  );
}

function twoLines<T>(args: ClaimArgs<T>): readonly [Line<T>, Line<T>] | undefined {
  const [l, m] = [lineAt(args, 0), lineAt(args, 1)];
  return l === undefined || m === undefined ? undefined : [l, m];
}

export const INCIDENCE_KINDS: readonly ClaimKindSpec[] = [
  {
    name: 'collinear',
    params: ['point', 'point', 'point'],
    rest: 'point',
    polynomial: true,
    test: 'floor',
    doc: 'collinear(A, B, C, …): the points lie on one line.',
    algebra: (F, args) => collinearAlgebra(F, args),
    residual: collinearResidual,
  },
  {
    name: 'concyclic',
    params: ['point', 'point', 'point', 'point'],
    rest: 'point',
    polynomial: true,
    test: 'floor',
    doc: 'concyclic(A, B, C, D, …): the points lie on one circle.',
    algebra: (F, args) => concyclicAlgebra(F, args),
    residual: concyclicResidual,
  },
  {
    name: 'concurrent',
    params: ['line', 'line', 'line'],
    rest: 'line',
    polynomial: true,
    test: 'floor',
    doc: 'concurrent(l, m, n, …): the lines pass through one point.',
    algebra: (F, args) => concurrentAlgebra(F, args),
    residual: concurrentResidual,
  },
  {
    name: 'parallel',
    params: ['line', 'line'],
    polynomial: true,
    test: 'floor',
    doc: 'parallel(l, m): l ∥ m (distinct lines).',
    algebra: (F, args) => {
      const lm = twoLines(args);
      if (lm === undefined) return badClaim('parallel');
      const [l, m] = lm;
      return noOrder(
        [vCross(F, l.d, m.d)],
        [distinctLines(l, m, `${argLabel(0)} and ${argLabel(1)} are the same line`)],
      );
    },
    residual: (args) => {
      const lm = twoLines(args);
      return lm === undefined
        ? Infinity
        : f.ratio(f.cross(lm[0].d, lm[1].d), f.norm(lm[0].d) * f.norm(lm[1].d));
    },
  },
  {
    name: 'perpendicular',
    params: ['line', 'line'],
    polynomial: true,
    test: 'floor',
    doc: 'perpendicular(l, m): l ⟂ m.',
    algebra: (F, args) => {
      const lm = twoLines(args);
      return lm === undefined
        ? badClaim('perpendicular')
        : noOrder([vDot(F, lm[0].d, lm[1].d)], []);
    },
    residual: (args) => {
      const lm = twoLines(args);
      return lm === undefined
        ? Infinity
        : f.ratio(f.dot(lm[0].d, lm[1].d), f.norm(lm[0].d) * f.norm(lm[1].d));
    },
  },
  {
    name: 'equal',
    params: ['point', 'point'],
    polynomial: true,
    test: 'floor',
    doc: 'equal(P, Q): the points coincide.',
    algebra: (F, args) => {
      const [p, q] = [pointAt(args, 0), pointAt(args, 1)];
      if (p === undefined || q === undefined) return badClaim('equal');
      const w = vSub(F, p, q);
      return noOrder([w.x, w.y], []);
    },
    residual: (args, ctx) => {
      const [p, q] = [pointAt(args, 0), pointAt(args, 1)];
      return p === undefined || q === undefined ? Infinity : f.ratio(f.dist(p, q), ctx.scale);
    },
  },
];
