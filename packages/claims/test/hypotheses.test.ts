import { BAND, EPS } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import type { Value } from '@geomira/kernel/value';
import {
  ASSUMPTION_KINDS,
  assumptionProblem,
  checkAssumption,
  comparisonDim,
} from '../src/hypotheses';
import { q } from './helpers/build';

const CTX = { scale: 10 };
const P = (x: number, y: number): Value<number> => ({ kind: 'point', x, y });
const N = (v: number): Value<number> => ({ kind: 'number', v });
const check = (
  kind: string,
  args: Value<number>[],
  dim: 'angle' | 'length' | 'number' = 'number',
) => checkAssumption(kind, args, dim, CTX);
const assumption = (kind: string, args: Expr[]) => ({ id: 1, kind, args });

describe('hypotheses: open conditions with a BAND margin', () => {
  it('lists the v1 kinds', () => {
    expect(ASSUMPTION_KINDS).toEqual([
      'acute',
      'scalene',
      'convex',
      'inside',
      'in_order',
      'less',
      'greater',
      'not_equal',
    ]);
  });

  it('acute: all three angles below 90° by more than the band', () => {
    expect(check('acute', [P(1, 3), P(0, 0), P(4, 0)])).toBe('holds');
    expect(check('acute', [P(-1, 2), P(0, 0), P(4, 0)])).toBe('fails');
    expect(check('acute', [P(0, 3), P(0, 0), P(4, 0)])).toBe('fails');
    expect(check('acute', [P(3 * BAND, 3), P(0, 0), P(4, 0)])).toBe('ambiguous');
    expect(check('acute', [P(1, 1), P(1, 1), P(4, 0)])).toBe('fails');
  });

  it('scalene and not_equal', () => {
    expect(check('scalene', [P(0, 0), P(4, 0), P(1, 3)])).toBe('holds');
    expect(check('scalene', [P(-2, 0), P(2, 0), P(0, 3)])).toBe('fails');
    expect(check('scalene', [P(-2, 0), P(2, 0), P(3 * EPS * 10, 3)])).toBe('ambiguous');
    expect(check('not_equal', [N(5), N(5)], 'length')).toBe('fails');
    expect(check('not_equal', [N(5), N(5 + 3 * EPS * 10)], 'length')).toBe('ambiguous');
    expect(check('not_equal', [N(5), N(6)], 'length')).toBe('holds');
  });

  it('less and greater: lengths against BAND·scale, angles against BAND of a half turn', () => {
    expect(check('less', [N(3), N(4)], 'length')).toBe('holds');
    expect(check('less', [N(4), N(4)], 'length')).toBe('fails');
    expect(check('greater', [N(91), N(90)], 'angle')).toBe('holds');
    expect(check('greater', [N(90 + 2e-6), N(90)], 'angle')).toBe('ambiguous');
    expect(check('greater', [N(89), N(90)], 'angle')).toBe('fails');
    expect(check('less', [P(0, 0), N(1)], 'length')).toBe('fails');
  });

  it('convex polygons (either orientation); a bowtie and a star are not convex', () => {
    expect(check('convex', [P(0, 0), P(4, 0), P(4, 3), P(0, 3)])).toBe('holds');
    expect(check('convex', [P(0, 3), P(4, 3), P(4, 0), P(0, 0)])).toBe('holds');
    expect(check('convex', [P(0, 0), P(4, 3), P(4, 0), P(0, 3)])).toBe('fails');
    const star = [0, 2, 4, 1, 3].map((k) =>
      P(Math.cos((2 * Math.PI * k) / 5), Math.sin((2 * Math.PI * k) / 5)),
    );
    expect(check('convex', star)).toBe('fails');
    expect(check('convex', [P(0, 0), P(2, 0), P(4, 0), P(2, 3)])).toBe('fails');
  });

  it('inside a polygon (strictly; the boundary fails, its band is ambiguous)', () => {
    const square: Value<number> = { kind: 'polygon', pts: [P(0, 0), P(4, 0), P(4, 4), P(0, 4)] };
    expect(check('inside', [P(1, 1), square])).toBe('holds');
    expect(check('inside', [P(5, 1), square])).toBe('fails');
    expect(check('inside', [P(4, 1), square])).toBe('fails');
    expect(check('inside', [P(4 - 3 * EPS * 10, 1), square])).toBe('ambiguous');
  });

  it('in_order on a line (either direction) and on a circle (cyclic, either direction)', () => {
    const l: Value<number> = {
      kind: 'line',
      p: { x: 0, y: 0 },
      d: { x: 1, y: 1 },
      lo: null,
      hi: null,
      chiral: false,
    };
    expect(check('in_order', [P(0, 0), P(1, 1), P(3, 3), l])).toBe('holds');
    expect(check('in_order', [P(3, 3), P(1, 1), P(0, 0), l])).toBe('holds');
    expect(check('in_order', [P(1, 1), P(0, 0), P(3, 3), l])).toBe('fails');
    const c: Value<number> = { kind: 'circle', c: { x: 0, y: 0 }, r2: 1, arc: null };
    const at = (deg: number) => P(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180));
    expect(check('in_order', [at(10), at(100), at(200), at(300), c])).toBe('holds');
    expect(check('in_order', [at(300), at(200), at(100), at(10), c])).toBe('holds');
    expect(check('in_order', [at(10), at(200), at(100), at(300), c])).toBe('fails');
  });

  it('equality assumptions are refused ("construct it"); other problems are named', () => {
    const A = ref(1);
    const dist = call('dist', [A, ref(2)]);
    expect(assumptionProblem(assumption('equal', [dist, dist]))).toBe(
      'equality assumptions are not allowed: construct it instead of assuming equal(…)',
    );
    for (const k of ['collinear', 'right', 'isosceles', 'concyclic', 'angle_eq']) {
      expect(assumptionProblem(assumption(k, [A, A, A]))).toMatch(
        /^equality assumptions are not allowed/,
      );
    }
    expect(assumptionProblem(assumption('obtuse', [A]))).toBe('unknown assumption "obtuse"');
    expect(assumptionProblem(assumption('acute', [A, A]))).toBe('acute takes three points');
    expect(assumptionProblem(assumption('in_order', [A, A]))).toBe(
      'in_order takes at least two points and a curve',
    );
    const angle = call('angle', [A, A, A]);
    expect(assumptionProblem(assumption('less', [angle, dist]))).toBe(
      'compare angles with angles and lengths with lengths',
    );
    expect(assumptionProblem(assumption('less', [call('area', [A, A, A]), dist]))).toMatch(
      /^compare angle/,
    );
    expect(assumptionProblem(assumption('greater', [angle, lit(q(90))]))).toBeUndefined();
    expect(comparisonDim([lit(q(1)), dist])).toEqual({ ok: true, dim: 'length' });
    expect(comparisonDim([dist])).toEqual({ ok: false, reason: 'a comparison takes two measures' });
  });
});
