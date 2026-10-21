/**
 * Hypotheses at their edges (SPEC §10.3, ADR-0008 decision 12): exact refusal messages, the
 * dimension a comparison is decided in, and each hypothesis where its decision is closest to
 * flipping (Run 10, note A: the mutation survivors of hypotheses.ts).
 */
import { describe, expect, it } from 'vitest';
import type { Assumption } from '@geomira/kernel/document';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import type { Value } from '@geomira/kernel/value';
import { assumptionProblem, checkAssumption, comparisonDim } from '../src/hypotheses';
import { q } from './helpers/build';

const P = (x: number, y: number): Value<number> => ({ kind: 'point', x, y });
const poly = (...xy: [number, number][]): Value<number> => ({
  kind: 'polygon',
  pts: xy.map(([x, y]) => ({ x, y })),
});
const line = (px: number, py: number, dx: number, dy: number): Value<number> => ({
  kind: 'line',
  p: { x: px, y: py },
  d: { x: dx, y: dy },
  lo: null,
  hi: null,
  chiral: false,
});
const circle = (r: number): Value<number> => ({
  kind: 'circle',
  c: { x: 0, y: 0 },
  r2: r * r,
  arc: null,
});
const num = (v: number): Value<number> => ({ kind: 'number', v });
const S1 = { scale: 1 };

function a(kind: string, ...args: Expr[]): Assumption {
  return { id: 1, kind, args };
}
const angle = (...s: Expr[]) => call('angle', s);
const dist = (...s: Expr[]) => call('dist', s);
const [A, B, C] = [ref(1), ref(2), ref(3)];
const k = (x: number) => lit(q(x));

describe('assumptionProblem: exact messages', () => {
  it('equality assumptions, by every name, are refused with "construct it"', () => {
    for (const kind of [
      'equal',
      'eq',
      'equals',
      'right',
      'isosceles',
      'equilateral',
      'collinear',
      'concyclic',
    ])
      expect(assumptionProblem(a(kind, A, B))).toBe(
        `equality assumptions are not allowed: construct it instead of assuming ${kind}(…)`,
      );
    expect(assumptionProblem(a('foo', A))).toBe('unknown assumption "foo"');
  });

  it('arity of each kind', () => {
    expect(assumptionProblem(a('acute', A, B))).toBe('acute takes three points');
    expect(assumptionProblem(a('scalene', A, B, C, A))).toBe('scalene takes three points');
    expect(assumptionProblem(a('acute', A, B, C))).toBeUndefined();
    expect(assumptionProblem(a('convex', A, B))).toBe('convex takes at least three points');
    expect(assumptionProblem(a('convex', A, B, C))).toBeUndefined();
    expect(assumptionProblem(a('inside', A, B, C))).toBe('inside takes a point and a polygon');
    expect(assumptionProblem(a('inside', A))).toBe('inside takes a point and a polygon');
    expect(assumptionProblem(a('inside', A, B))).toBeUndefined();
    expect(assumptionProblem(a('in_order', A, B))).toBe(
      'in_order takes at least two points and a curve',
    );
    expect(assumptionProblem(a('in_order', A, B, C))).toBeUndefined();
  });

  it('comparisons: two measures of one dimension (or a number)', () => {
    expect(comparisonDim([angle(A, B, C), k(90)])).toEqual({ ok: true, dim: 'angle' });
    expect(comparisonDim([k(2), dist(A, B)])).toEqual({ ok: true, dim: 'length' });
    expect(comparisonDim([k(2), k(3)])).toEqual({ ok: true, dim: 'number' });
    expect(comparisonDim([dist(A, B), dist(B, C)])).toEqual({ ok: true, dim: 'length' });
    const two = 'a comparison takes two measures';
    expect(comparisonDim([dist(A, B)])).toEqual({ ok: false, reason: two });
    expect(comparisonDim([dist(A, B), k(1), k(2)])).toEqual({ ok: false, reason: two });
    const what = 'compare angle(…) or dist(…) measures with each other or with a number';
    for (const bad of [
      angle(A, B),
      dist(A, B, C),
      call('midpoint', [A, B]),
      call('angle', [A, B, C], [{ kind: 'near', p: A }]),
      call('dist', [A, B], [{ kind: 'near', p: A }]),
      A,
    ])
      expect(comparisonDim([bad, k(1)])).toEqual({ ok: false, reason: what });
    expect(comparisonDim([angle(A, B, C), dist(A, B)])).toEqual({
      ok: false,
      reason: 'compare angles with angles and lengths with lengths',
    });
    expect(assumptionProblem(a('less', angle(A, B, C), dist(A, B)))).toBe(
      'compare angles with angles and lengths with lengths',
    );
  });
});

describe('checkAssumption at the edges', () => {
  it('scalene fails for every pair of equal sides', () => {
    expect(checkAssumption('scalene', [P(0, 0), P(3, 0), P(3, 3)], 'number', S1)).toBe('fails'); // AB = BC
    expect(checkAssumption('scalene', [P(0, 0), P(2, 0), P(1, 5)], 'number', S1)).toBe('fails'); // BC = CA
    expect(checkAssumption('scalene', [P(0, 0), P(5, 0), P(3, 4)], 'number', S1)).toBe('fails'); // CA = AB
    expect(checkAssumption('scalene', [P(0, 0), P(4, 0), P(1, 3)], 'number', S1)).toBe('holds');
    expect(checkAssumption('scalene', [P(0, 0), P(4, 0), num(1)], 'number', S1)).toBe('fails');
  });

  it('a turn whose height is inside the band makes convex ambiguous; coincident points fail', () => {
    // Height cross/longest = 2e-4 / 200 = 1e-6, inside the band at scale 200.
    const flat = [P(0, 0), P(100, 0), P(200, 0.000002)];
    expect(checkAssumption('convex', flat, 'number', { scale: 200 })).toBe('ambiguous');
    expect(checkAssumption('convex', [P(1, 1), P(1, 1), P(1, 1)], 'number', S1)).toBe('fails');
    expect(checkAssumption('convex', [P(0, 0), P(4, 0), P(4, 4), P(0, 4)], 'number', S1)).toBe(
      'holds',
    );
    expect(checkAssumption('convex', [P(0, 0), P(4, 4), P(4, 0), P(0, 4)], 'number', S1)).toBe(
      'fails',
    );
  });

  it('inside: a vertex at the point’s height, both sides, a repeated vertex, the boundary', () => {
    const tri = poly([0, 0], [4, 2], [0, 4]);
    expect(checkAssumption('inside', [P(1, 2), tri], 'number', S1)).toBe('holds');
    expect(checkAssumption('inside', [P(5, 2), tri], 'number', S1)).toBe('fails');
    expect(checkAssumption('inside', [P(-1, 2), tri], 'number', S1)).toBe('fails');
    expect(checkAssumption('inside', [P(1, 3.9), tri], 'number', S1)).toBe('fails');
    const square = poly([0, 0], [4, 0], [4, 0], [4, 4], [0, 4]);
    expect(checkAssumption('inside', [P(2, 1), square], 'number', S1)).toBe('holds');
    expect(checkAssumption('inside', [P(2, 0), square], 'number', S1)).toBe('fails');
    expect(checkAssumption('inside', [P(2, 0.00000005), square], 'number', S1)).toBe('ambiguous');
    // Beyond the end of an edge, close to its carrier line: the distance is to the segment.
    const l = poly([0, 0], [2, 0], [2, 2], [4, 2], [4, 4], [0, 4]);
    expect(checkAssumption('inside', [P(3, 2.00000005), l], 'number', S1)).toBe('ambiguous');
    expect(checkAssumption('inside', [P(3, 1), l], 'number', S1)).toBe('fails');
    expect(checkAssumption('inside', [P(1, 1), l], 'number', S1)).toBe('holds');
  });

  it('in_order along a line is decided on lengths, whatever |d|; other curves fail', () => {
    const pts = [P(0, 0), P(1, 0), P(2, 0)];
    expect(checkAssumption('in_order', [...pts, line(0, 0, 0.0001, 0)], 'number', S1)).toBe(
      'holds',
    );
    expect(
      checkAssumption('in_order', [P(2, 0), P(1, 0), P(0, 0), line(0, 0, 1000, 0)], 'number', S1),
    ).toBe('holds');
    expect(
      checkAssumption('in_order', [P(0, 0), P(2, 0), P(1, 0), line(0, 0, 1, 0)], 'number', S1),
    ).toBe('fails');
    expect(checkAssumption('in_order', [...pts, P(5, 5)], 'number', S1)).toBe('fails');
    expect(checkAssumption('in_order', [...pts, poly([0, 0], [1, 0], [0, 1])], 'number', S1)).toBe(
      'fails',
    );
  });

  it('in_order on a circle: the fan from the first point; two coincident points fail', () => {
    const c = circle(5);
    const at = (deg: number) =>
      P(5 * Math.cos((deg * Math.PI) / 180), 5 * Math.sin((deg * Math.PI) / 180));
    expect(checkAssumption('in_order', [at(0), at(90), at(180), at(270), c], 'number', S1)).toBe(
      'holds',
    );
    expect(checkAssumption('in_order', [at(0), at(180), at(90), at(270), c], 'number', S1)).toBe(
      'fails',
    );
    expect(checkAssumption('in_order', [at(0), at(90), at(90), c], 'number', S1)).toBe('fails');
    expect(checkAssumption('in_order', [at(0), at(90), c], 'number', S1)).toBe('holds');
  });

  it('comparisons: lengths are decided against the band times the scale, numbers and angles are not', () => {
    const big = { scale: 1000 };
    // A difference of 1e-5: inside the band of lengths at scale 1000 (1e-4), outside the
    // dimensionless band (1e-7).
    expect(checkAssumption('greater', [num(1.00001), num(1)], 'length', big)).toBe('ambiguous');
    expect(checkAssumption('greater', [num(1.00001), num(1)], 'number', big)).toBe('holds');
    expect(checkAssumption('less', [num(1), num(1.00001)], 'number', big)).toBe('holds');
    expect(checkAssumption('greater', [num(90.0018), num(90)], 'angle', big)).toBe('holds');
    expect(checkAssumption('not_equal', [num(3), num(3)], 'number', S1)).toBe('fails');
    expect(checkAssumption('not_equal', [num(3), num(4)], 'number', S1)).toBe('holds');
    expect(checkAssumption('less', [num(4), num(3)], 'number', S1)).toBe('fails');
  });
});
