/** Random figures for property tests: four free points A, B, C, D plus constructions. */
import { isInexact, type Field } from '@geomira/num/field';
import { fromNumber, rational } from '@geomira/num/rational';
import { createRng, deriveSeed } from '@geomira/num/rng';
import type { RefExpr } from '../../src/expr';
import { call, lit } from '../../src/expr';
import type { EvalContext } from '../../src/tool';
import type { Value, Vec } from '../../src/value';
import { Builder, contextOf, evalDoc, q, valueOf } from './doc';

export interface Figure<T> {
  readonly F: Field<T>;
  readonly ctx: EvalContext;
  get(name: string): Value<T>;
}

export type Pts = readonly [RefExpr, RefExpr, RefExpr, RefExpr];

/**
 * Builds and evaluates a random figure (grid coordinates for exact fields, doubles for
 * FloatField). Returns undefined when one of `required` is Undefined (a degenerate draw).
 */
export function figure<T>(
  F: Field<T>,
  seed: number,
  build: (b: Builder, p: Pts) => void,
  required: readonly string[] = [],
): Figure<T> | undefined {
  const rng = createRng(seed);
  const b = new Builder();
  const coord = () =>
    F.kind === 'float'
      ? fromNumber(rng.uniform(-20, 20))
      : rational(BigInt(rng.nextInt(2049) - 1024), 32n);
  const free = (n: string): RefExpr => b.add(n, call('point', [lit(coord()), lit(coord())]));
  const p: Pts = [free('A'), free('B'), free('C'), free('D')];
  build(b, p);
  const ctx = contextOf(b.doc);
  const ev = evalDoc(b.doc, F, ctx);
  const fig: Figure<T> = { F, ctx, get: (name) => valueOf(b.doc, ev, name) };
  return required.some((n) => fig.get(n).kind === 'undefined') ? undefined : fig;
}

/** Runs `check` on `n` random figures; returns how many were not degenerate. */
export function forFigures<T>(
  F: Field<T>,
  n: number,
  build: (b: Builder, p: Pts) => void,
  required: readonly string[],
  check: (f: Figure<T>, i: number) => void,
): number {
  let used = 0;
  for (let i = 0; i < n; i += 1) {
    const f = figure(F, deriveSeed(4242, i), build, required);
    if (f === undefined) continue;
    check(f, i);
    used += 1;
  }
  return used;
}

export function asPoint<T>(v: Value<T>): Vec<T> {
  if (v.kind !== 'point') throw new Error(`expected a point, got ${v.kind}`);
  return v;
}

export function asNum<T>(v: Value<T>): T {
  if (v.kind !== 'number') throw new Error(`expected a number, got ${v.kind}`);
  return v.v;
}

/** Whether two named points coincide (exactly over Q, within EPS in FloatField). */
export function samePoints<T>(f: Figure<T>, a: string, b: string): boolean {
  const [p, r] = [asPoint(f.get(a)), asPoint(f.get(b))];
  return (
    f.F.isZero(f.F.sub(p.x, r.x), 'length', f.ctx) && f.F.isZero(f.F.sub(p.y, r.y), 'length', f.ctx)
  );
}

/** Whether a named number equals `value` (exact text) up to the field's zero test. */
export function numIs<T>(f: Figure<T>, name: string, value: string): boolean {
  const t = f.F.fromRational(q(value));
  if (isInexact(t)) throw new Error(t.reason);
  return f.F.isZero(f.F.sub(asNum(f.get(name)), t), 'dimensionless', f.ctx);
}
