/**
 * Length claims (POLYNOMIAL KINDS, SPEC §10.1): `AB = k·CD` (length), `AB/CD = EF/GH`
 * (ratio) and `AB/CD = k` (ratio_value), k an exact positive number. Lengths enter as
 * squares, so the conditions need no square root.
 */
import { compare, mul, ZERO } from '@geomira/num/rational';
import { vDot, vSub } from '@geomira/kernel/geom';
import { undef, type Undefined, type Vec } from '@geomira/kernel/value';
import { isInexact, type Field, type Inexact } from '@geomira/num/field';
import * as f from './float';
import {
  argLabel,
  badClaim,
  litAt,
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

function distinct<T>(pts: readonly Vec<T>[], i: number, j: number): Ndg<T> | undefined {
  const [a, b] = [pts[i], pts[j]];
  return a === undefined || b === undefined
    ? undefined
    : { kind: 'distinct', a, b, what: `${argLabel(i)} and ${argLabel(j)} coincide` };
}

type Eight<T> = readonly [Vec<T>, Vec<T>, Vec<T>, Vec<T>, Vec<T>, Vec<T>, Vec<T>, Vec<T>];

/** Exactly eight points, as a tuple. */
function eight<T>(pts: readonly Vec<T>[] | undefined): Eight<T> | undefined {
  if (pts?.length !== 8) return undefined;
  const [a, b, c, d, e, g, h, i] = pts;
  if (a === undefined || b === undefined || c === undefined || d === undefined) return undefined;
  if (e === undefined || g === undefined || h === undefined || i === undefined) return undefined;
  return [a, b, c, d, e, g, h, i];
}

function defined<X>(xs: readonly (X | undefined)[]): X[] {
  return xs.filter((x): x is X => x !== undefined);
}

/** AB = k·CD (k > 0): |AB|² − k²|CD|² = 0, NDG C ≠ D. */
function scaledAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
  name: string,
): Algebra<T> | Undefined | Inexact {
  const pts = pointsFrom(args.slice(0, 4), 0);
  const k = litAt(args, 4);
  const [a, b, c, d] = [pts?.[0], pts?.[1], pts?.[2], pts?.[3]];
  if (
    pts === undefined ||
    k === undefined ||
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined
  ) {
    return badClaim(name);
  }
  if (compare(k, ZERO) <= 0) return undef(`${name}: the factor k must be positive`);
  const k2 = F.fromRational(mul(k, k));
  if (isInexact(k2)) return k2;
  return {
    conditions: [F.sub(d2(F, a, b), F.mul(k2, d2(F, c, d)))],
    ndg: defined([distinct(pts, 2, 3)]),
    order: [],
  };
}

/** | |AB| − k|CD| | / (|AB| + k|CD|). */
function scaledResidual(args: ClaimArgs<number>): number {
  const pts = pointsFrom(args.slice(0, 4), 0);
  const k = args[4];
  const [a, b, c, d] = [pts?.[0], pts?.[1], pts?.[2], pts?.[3]];
  if (
    k?.kind !== 'number' ||
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined
  )
    return Infinity;
  const [x, y] = [f.dist(a, b), k.v * f.dist(c, d)];
  return f.ratio(x - y, x + y);
}

function ratioAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
): Algebra<T> | ReturnType<typeof badClaim> {
  const pts = pointsFrom(args, 0);
  const p8 = eight(pts);
  if (pts === undefined || p8 === undefined) return badClaim('ratio');
  const [a, b, c, d, e, g, h, i] = p8;
  const lhs = F.mul(d2(F, a, b), d2(F, h, i));
  const rhs = F.mul(d2(F, e, g), d2(F, c, d));
  const both = distinct(pts, 0, 1);
  const other = distinct(pts, 4, 5);
  const zero: Ndg<T>[] =
    both === undefined || other === undefined
      ? []
      : [
          {
            kind: 'any',
            items: [both, other],
            what: `${argLabel(0)} = ${argLabel(1)} and ${argLabel(4)} = ${argLabel(5)}`,
          },
        ];
  return {
    conditions: [F.sub(lhs, rhs)],
    ndg: [...defined([distinct(pts, 2, 3), distinct(pts, 6, 7)]), ...zero],
    order: [],
  };
}

/** |AB·GH − EF·CD| / (AB·GH + EF·CD). */
function ratioResidual(args: ClaimArgs<number>): number {
  const p8 = eight(pointsFrom(args, 0));
  if (p8 === undefined) return Infinity;
  const [a, b, c, d, e, g, h, i] = p8;
  const [x, y] = [f.dist(a, b) * f.dist(h, i), f.dist(e, g) * f.dist(c, d)];
  return f.ratio(x - y, x + y);
}

export const METRIC_KINDS: readonly ClaimKindSpec[] = [
  {
    name: 'length',
    params: ['point', 'point', 'point', 'point', 'number'],
    polynomial: true,
    test: 'floor',
    doc: 'length(A, B, C, D, k): AB = k·CD (k exact, positive).',
    algebra: (F, args) => scaledAlgebra(F, args, 'length'),
    residual: scaledResidual,
  },
  {
    name: 'ratio',
    params: ['point', 'point', 'point', 'point', 'point', 'point', 'point', 'point'],
    polynomial: true,
    test: 'floor',
    doc: 'ratio(A, B, C, D, E, F, G, H): AB/CD = EF/GH.',
    algebra: (F, args) => ratioAlgebra(F, args),
    residual: ratioResidual,
  },
  {
    name: 'ratio_value',
    params: ['point', 'point', 'point', 'point', 'number'],
    polynomial: true,
    test: 'floor',
    doc: 'ratio_value(A, B, C, D, k): AB/CD = k (k exact, positive).',
    algebra: (F, args) => scaledAlgebra(F, args, 'ratio_value'),
    residual: scaledResidual,
  },
];
