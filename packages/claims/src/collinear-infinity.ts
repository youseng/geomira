/**
 * collinear(…) with points at infinity (ADR-0040 decision 4, the maintainer's choice): points as
 * homogeneous columns (x, y, 1) and directions as (x, y, 0); the points lie on one line of the
 * projective plane iff det(P₁, P₂, P_k) = 0 for every k ≥ 3. So X∞ lies on line PQ iff PQ has its
 * direction, and two points at infinity span the line at infinity, which holds only points at
 * infinity. NDG: two finite points distinct, two points at infinity of different directions (a
 * finite point and a point at infinity are always distinct). Residuals are sines, except for
 * three finite points (the v1 formula, collinearResidual).
 */
import type { Field } from '@geomira/num/field';
import type { Vec } from '@geomira/kernel/value';
import * as f from './float';
import { argLabel, badClaim, pairs, type Algebra, type ClaimArgs } from './kind';
import type { Ndg } from './ndg';

/** A point or a point at infinity: its position or its direction. */
interface PPoint<T> {
  readonly at: Vec<T>;
  readonly finite: boolean;
}

/** Whether a claim's arguments include a point at infinity. */
export function hasIdeal<T>(args: ClaimArgs<T>): boolean {
  return args.some((a) => a.kind === 'ideal_point');
}

function ppoints<T>(args: ClaimArgs<T>): PPoint<T>[] | undefined {
  const out: PPoint<T>[] = [];
  for (const a of args) {
    if (a.kind === 'point') out.push({ at: a, finite: true });
    else if (a.kind === 'ideal_point') out.push({ at: a.d, finite: false });
    else return undefined;
  }
  return out;
}

/** det of the homogeneous columns (x, y, w), w = 1 for a point and 0 for a direction. */
function det<T>(F: Field<T>, a: PPoint<T>, b: PPoint<T>, c: PPoint<T>): T {
  const w = (p: PPoint<T>) => (p.finite ? F.one : F.zero);
  const m = (p: PPoint<T>, q: PPoint<T>) => F.sub(F.mul(p.at.x, q.at.y), F.mul(p.at.y, q.at.x));
  const yw = (p: PPoint<T>, q: PPoint<T>) => F.sub(F.mul(p.at.y, w(q)), F.mul(w(p), q.at.y));
  const xw = (p: PPoint<T>, q: PPoint<T>) => F.sub(F.mul(p.at.x, w(q)), F.mul(w(p), q.at.x));
  return F.add(F.sub(F.mul(a.at.x, yw(b, c)), F.mul(a.at.y, xw(b, c))), F.mul(w(a), m(b, c)));
}

export function collinearInfinityAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
): Algebra<T> | ReturnType<typeof badClaim> {
  const ps = ppoints(args);
  const [a, b] = [ps?.[0], ps?.[1]];
  if (ps === undefined || a === undefined || b === undefined) return badClaim('collinear');
  const conditions = ps.slice(2).map((p) => det(F, a, b, p));
  const ndg: Ndg<T>[] = [];
  for (const [i, j] of pairs(ps.length)) {
    const [p, q] = [ps[i], ps[j]];
    if (p === undefined || q === undefined || p.finite !== q.finite) continue;
    const what = `${argLabel(i)} and ${argLabel(j)} coincide`;
    ndg.push(
      p.finite
        ? { kind: 'distinct', a: p.at, b: q.at, what }
        : { kind: 'nonparallel', u: p.at, v: q.at, what },
    );
  }
  return { conditions, ndg, order: [] };
}

/** |sin| of the angle between u and v (0 for a zero vector). */
function sine(u: f.V, v: f.V): number {
  const n = f.norm(u) * f.norm(v);
  return n > 0 ? f.ratio(f.cross(u, v), n) : 0;
}

/** How far P_k is from the line P₁P₂, as a sine (one of the three is at infinity). */
function residual3(a: PPoint<number>, b: PPoint<number>, p: PPoint<number>): number {
  if (a.finite && b.finite) return sine(f.sub(b.at, a.at), p.finite ? f.sub(p.at, a.at) : p.at);
  if (a.finite !== b.finite) {
    const [o, d] = a.finite ? [a.at, b.at] : [b.at, a.at];
    return p.finite ? sine(d, f.sub(p.at, o)) : sine(d, p.at);
  }
  // Two points at infinity span the line at infinity: only points at infinity are on it.
  return p.finite ? 1 : 0;
}

/** The worst residual over k ≥ 3, with at least one point at infinity among the arguments. */
export function collinearInfinityResidual(args: ClaimArgs<number>): number {
  const ps = ppoints(args);
  const [a, b] = [ps?.[0], ps?.[1]];
  if (ps === undefined || a === undefined || b === undefined) return Infinity;
  return f.maxOf(ps.slice(2).map((p) => residual3(a, b, p)));
}
