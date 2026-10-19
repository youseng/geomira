/**
 * Theorem tests on random triangles (Run 2, item 7), each run over FloatField and over
 * RationalField (exact: every construction here is rational). The checks are written once
 * against Field<T>: F.isZero is exact over Q and EPS-relative over floats.
 *   - O, G, H are collinear (the Euler line);  OG : GH = 1 : 2;
 *   - the three altitudes are concurrent (at the orthocenter);
 *   - each median is divided 2 : 1 by the centroid.
 * O, G and H come from three independent formulas (triangle.ts), so these are real checks.
 */
import { isInexact, type Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { fromNumber, rational, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, lit } from '../src/expr';
import type { EvalContext } from '../src/tool';
import { vCross, vSub } from '../src/geom';
import type { Value, Vec } from '../src/value';
import { Builder, contextOf, evalDoc, num, q, valueOf } from './helpers/doc';
import { LAW_TIMEOUT, lawCount } from './helpers/laws';

const TRIANGLES = lawCount(200);

interface Sample<T> {
  readonly F: Field<T>;
  readonly ctx: EvalContext;
  get(name: string): Value<T>;
}

type Coordinate = (rng: Rng) => Rational;

const grid: Coordinate = (rng) => rational(BigInt(rng.nextInt(4097) - 2048), 64n);
const double: Coordinate = (rng) => fromNumber(rng.uniform(-30, 30));

/** A random triangle with every construction the theorems need. */
function figure<T>(F: Field<T>, rng: Rng, coordinate: Coordinate): Sample<T> | undefined {
  const b = new Builder();
  const [A, B, C] = ['A', 'B', 'C'].map((n) =>
    b.add(n, call('point', [lit(coordinate(rng)), lit(coordinate(rng))])),
  );
  if (A === undefined || B === undefined || C === undefined) throw new Error('points');
  b.call('O', 'circumcenter', A, B, C);
  const G = b.call('G', 'centroid', A, B, C);
  b.call('H', 'orthocenter', A, B, C);
  b.call('r_euler', 'ratio', b.ref('O'), G, G, b.ref('H'));
  const altA = b.call('h_a', 'perp', A, call('line', [B, C]));
  const altB = b.call('h_b', 'perp', B, call('line', [C, A]));
  const altC = b.call('h_c', 'perp', C, call('line', [A, B]));
  const X = b.call('X', 'intersect', altA, altB);
  b.call('X_c', 'foot', X, altC);
  const Ma = b.call('M_a', 'midpoint', B, C);
  const Mb = b.call('M_b', 'midpoint', C, A);
  b.call('r_median', 'ratio', A, G, G, Ma);
  b.call('G_2', 'intersect', call('line', [A, Ma]), call('line', [B, Mb]));
  b.call('G_3', 'divide', A, Ma, num('2/3'));
  const ctx = contextOf(b.doc);
  const ev = evalDoc(b.doc, F, ctx);
  if (valueOf(b.doc, ev, 'O').kind === 'undefined') return undefined;
  return { F, ctx, get: (name) => valueOf(b.doc, ev, name) };
}

function point<T>(v: Value<T>): Vec<T> {
  if (v.kind !== 'point') throw new Error(`expected a point, got ${v.kind}`);
  return v;
}

function number<T>(v: Value<T>): T {
  if (v.kind !== 'number') throw new Error(`expected a number, got ${v.kind}`);
  return v.v;
}

function samePoint<T>(s: Sample<T>, p: string, q: string): boolean {
  const d = vSub(s.F, point(s.get(p)), point(s.get(q)));
  return s.F.isZero(d.x, 'length', s.ctx) && s.F.isZero(d.y, 'length', s.ctx);
}

function equals<T>(s: Sample<T>, name: string, value: string): boolean {
  const target = s.F.fromRational(q(value));
  if (isInexact(target)) throw new Error(target.reason);
  return s.F.isZero(s.F.sub(number(s.get(name)), target), 'dimensionless', s.ctx);
}

const THEOREMS: Record<string, <T>(s: Sample<T>) => boolean> = {
  'O, G, H are collinear': (s) => {
    const [O, G, H] = [point(s.get('O')), point(s.get('G')), point(s.get('H'))];
    return s.F.isZero(vCross(s.F, vSub(s.F, G, O), vSub(s.F, H, O)), 'area', s.ctx);
  },
  'OG : GH = 1 : 2': (s) => equals(s, 'r_euler', '1/2'),
  'the altitudes are concurrent at the orthocenter': (s) =>
    samePoint(s, 'X', 'X_c') && samePoint(s, 'X', 'H'),
  'the centroid divides each median 2 : 1': (s) =>
    equals(s, 'r_median', '2') && samePoint(s, 'G', 'G_2') && samePoint(s, 'G', 'G_3'),
};

function run<T>(
  F: Field<T>,
  coordinate: Coordinate,
  theorem: <U>(s: Sample<U>) => boolean,
): number {
  let checked = 0;
  for (let i = 0; i < TRIANGLES; i += 1) {
    const s = figure(F, createRng(deriveSeed(2026, i)), coordinate);
    if (s === undefined) continue;
    expect(theorem(s), `triangle ${String(i)}`).toBe(true);
    checked += 1;
  }
  return checked;
}

describe(`theorems on ${String(TRIANGLES)} random triangles`, { timeout: LAW_TIMEOUT }, () => {
  for (const [name, theorem] of Object.entries(THEOREMS)) {
    it(`${name} (FloatField, random doubles)`, () => {
      expect(run(FloatField, double, theorem)).toBeGreaterThan(TRIANGLES * 0.9);
    });
    it(`${name} (RationalField, exact)`, () => {
      expect(run(RationalField, grid, theorem)).toBeGreaterThan(TRIANGLES * 0.9);
    });
  }
});
