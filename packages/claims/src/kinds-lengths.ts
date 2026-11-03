/**
 * Products and sums of lengths (ADR-0051).
 *
 *   length_product(A, B, C, D, E, F, G, H): AB·CD = EF·GH. A POLYNOMIAL KIND: lengths are
 *     non-negative, so the claim is |AB|²|CD|² − |EF|²|GH|² = 0 (no sign is lost by squaring).
 *     NDG: the four segments are proper (A ≠ B, C ≠ D, E ≠ F, G ≠ H): with a zero length the
 *     claim is 0 = 0 or says only that another segment is null (power of a point with P = A).
 *   length_sum(A, B, C, D, E, F): AB + CD = EF. NOT a polynomial kind: with a = AB, c = CD,
 *     e = EF, squaring twice gives (e² − a² − c²)² − 4a²c² = 0, which also holds when
 *     e = |a − c|; the ORDER item e² − a² − c² ≥ 0 keeps exactly a + c = e (when e = |a − c|,
 *     e² − a² − c² = −2ac < 0 unless ac = 0, where |a − c| = a + c anyway). An order item is
 *     not evaluable mod p, and the kind is off the whitelist, so the mod-p rung never applies
 *     (L17); the exact rung over Q decides it (Q has an order), else the numeric rung. NDG:
 *     the three segments are proper.
 */
import { vDot, vSub } from '@geomira/kernel/geom';
import type { Vec } from '@geomira/kernel/value';
import type { Field } from '@geomira/num/field';
import * as f from './float';
import {
  argLabel,
  badClaim,
  pointsFrom,
  type Algebra,
  type ClaimArgs,
  type ClaimKindSpec,
} from './kind';
import type { Ndg } from './ndg';

function d2<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): T {
  const w = vSub(F, b, a);
  return vDot(F, w, w);
}

/** The segments of `n` points taken in pairs (P₀P₁, P₂P₃, …), or undefined. */
function segments<T>(args: ClaimArgs<T>, n: number): (readonly [Vec<T>, Vec<T>])[] | undefined {
  const pts = pointsFrom(args, 0);
  if (pts?.length !== n) return undefined;
  const out: (readonly [Vec<T>, Vec<T>])[] = [];
  for (let i = 0; i + 1 < n; i += 2) {
    const [a, b] = [pts[i], pts[i + 1]];
    if (a === undefined || b === undefined) return undefined;
    out.push([a, b]);
  }
  return out;
}

/** "A and B coincide" for every segment. */
function proper<T>(segs: readonly (readonly [Vec<T>, Vec<T>])[]): Ndg<T>[] {
  return segs.map(([a, b], k) => ({
    kind: 'distinct',
    a,
    b,
    what: `${argLabel(2 * k)} and ${argLabel(2 * k + 1)} coincide`,
  }));
}

function productAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
): Algebra<T> | ReturnType<typeof badClaim> {
  const s = segments(args, 8);
  const [p, q, r, t] = s ?? [];
  if (s === undefined || p === undefined || q === undefined || r === undefined || t === undefined)
    return badClaim('length_product');
  const lhs = F.mul(d2(F, ...p), d2(F, ...q));
  const rhs = F.mul(d2(F, ...r), d2(F, ...t));
  return { conditions: [F.sub(lhs, rhs)], ndg: proper(s), order: [] };
}

/** |AB·CD − EF·GH| / (AB·CD + EF·GH). */
function productResidual(args: ClaimArgs<number>): number {
  const s = segments(args, 8);
  if (s === undefined) return Infinity;
  const [p, q, r, t] = s.map(([a, b]) => f.dist(a, b));
  if (p === undefined || q === undefined || r === undefined || t === undefined) return Infinity;
  return f.ratio(p * q - r * t, p * q + r * t);
}

function sumAlgebra<T>(F: Field<T>, args: ClaimArgs<T>): Algebra<T> | ReturnType<typeof badClaim> {
  const s = segments(args, 6);
  const [p, q, r] = s ?? [];
  if (s === undefined || p === undefined || q === undefined || r === undefined)
    return badClaim('length_sum');
  const [a2, c2, e2] = [d2(F, ...p), d2(F, ...q), d2(F, ...r)];
  const gap = F.sub(F.sub(e2, a2), c2);
  const two = F.add(F.one, F.one);
  const four = F.add(two, two);
  const total = F.add(F.add(e2, a2), c2);
  return {
    conditions: [F.sub(F.mul(gap, gap), F.mul(four, F.mul(a2, c2)))],
    ndg: proper(s),
    order: [
      {
        value: gap,
        norm: F.mul(total, total),
        dim: 'dimensionless',
        strict: false,
        what: `${argLabel(4)}${argLabel(5)} = |${argLabel(0)}${argLabel(1)} − ${argLabel(2)}${argLabel(3)}|, not the sum`,
      },
    ],
  };
}

/** |AB + CD − EF| / (AB + CD + EF). */
function sumResidual(args: ClaimArgs<number>): number {
  const s = segments(args, 6);
  if (s === undefined) return Infinity;
  const [a, c, e] = s.map(([x, y]) => f.dist(x, y));
  if (a === undefined || c === undefined || e === undefined) return Infinity;
  return f.ratio(a + c - e, a + c + e);
}

export const LENGTH_KINDS: readonly ClaimKindSpec[] = [
  {
    name: 'length_product',
    params: ['point', 'point', 'point', 'point', 'point', 'point', 'point', 'point'],
    polynomial: true,
    test: 'floor',
    doc: 'length_product(A, B, C, D, E, F, G, H): AB·CD = EF·GH.',
    algebra: (F, args) => productAlgebra(F, args),
    residual: productResidual,
  },
  {
    name: 'length_sum',
    params: ['point', 'point', 'point', 'point', 'point', 'point'],
    polynomial: false,
    test: 'floor',
    doc: 'length_sum(A, B, C, D, E, F): AB + CD = EF (not a polynomial kind: never mod p).',
    algebra: (F, args) => sumAlgebra(F, args),
    residual: sumResidual,
  },
];
