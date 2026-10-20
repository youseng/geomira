/** Test helpers: claim argument values over any field, from exact rationals. */
import { isInexact, type Field } from '@geomira/num/field';
import { parseRational, rational, type Rational } from '@geomira/num/rational';
import type { Circle, Line, Num, Point, Value } from '@geomira/kernel/value';
import type { Algebra, ClaimKindSpec } from '../../src/kind';
import { ndgFailure } from '../../src/ndg';

export function q(x: string | number | bigint): Rational {
  if (typeof x === 'bigint') return rational(x);
  const r = parseRational(String(x));
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

export function lift<T>(F: Field<T>, x: string | number | Rational): T {
  const v = F.fromRational(typeof x === 'object' ? x : q(x));
  if (isInexact(v)) throw new Error(v.reason);
  return v;
}

export type Xy = readonly [string | number, string | number];

export function pt<T>(F: Field<T>, [x, y]: Xy): Point<T> {
  return { kind: 'point', x: lift(F, x), y: lift(F, y) };
}

export function line<T>(
  F: Field<T>,
  a: Xy,
  b: Xy,
  range: 'line' | 'segment' | 'ray' = 'line',
): Line<T> {
  const [p, r] = [pt(F, a), pt(F, b)];
  return {
    kind: 'line',
    p: { x: p.x, y: p.y },
    d: { x: F.sub(r.x, p.x), y: F.sub(r.y, p.y) },
    lo: range === 'line' ? null : F.zero,
    hi: range === 'segment' ? F.one : null,
    chiral: false,
  };
}

export function circle<T>(F: Field<T>, c: Xy, r2: string | number): Circle<T> {
  const o = pt(F, c);
  return { kind: 'circle', c: { x: o.x, y: o.y }, r2: lift(F, r2), arc: null };
}

export function lit<T>(F: Field<T>, x: string | number): Num<T> {
  return { kind: 'number', v: lift(F, x), exact: q(x) };
}

/** The algebra of a kind, or a thrown error when it is Undefined or Inexact. */
export function algebraOf<T>(
  F: Field<T>,
  kind: ClaimKindSpec,
  args: readonly Value<T>[],
): Algebra<T> {
  const a = kind.algebra(F, args, { scale: 1 });
  if ('kind' in a) throw new Error(`${a.kind}: ${a.reason}`);
  return a;
}

/** 'true' | 'false' | 'degenerate' for exact fields (order items by exact sign). */
export function exactTruth<T>(F: Field<T>, kind: ClaimKindSpec, args: readonly Value<T>[]): string {
  const a = algebraOf(F, kind, args);
  const bad = ndgFailure(F, a.ndg, { scale: 1 });
  if (bad !== undefined) return bad.status;
  if (!a.conditions.every((c) => F.isZero(c, 'length', { scale: 1 }))) return 'false';
  for (const o of a.order) {
    const s = F.sign(o.value, o.dim, { scale: 1 });
    if (s === 'none') return 'inexact';
    if (o.strict ? s !== 1 : s === -1) return 'false';
  }
  return 'true';
}
