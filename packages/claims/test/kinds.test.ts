import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { CLAIM_KINDS, POLYNOMIAL_KINDS, claimKind } from '../src/kinds';
import type { ClaimKindSpec } from '../src/kind';
import { circle, exactTruth, line, lit, pt, type Xy } from './helpers/values';

function kind(name: string): ClaimKindSpec {
  const k = claimKind(name);
  if (k === undefined) throw new Error(name);
  return k;
}

type Build = <T>(F: import('@geomira/num/field').Field<T>) => Value<T>[];

/** Expected exact truth over Q and mod p, and a float residual near 0 exactly for 'true'. */
function check(
  name: string,
  build: Build,
  expected: 'true' | 'false' | 'degenerate',
  byOrder = false,
): void {
  const k = kind(name);
  expect(exactTruth(RationalField, k, build(RationalField)), `${name} over Q`).toBe(expected);
  if (k.polynomial && expected !== 'degenerate') {
    const modp = exactTruth(ModPField, k, build(ModPField));
    // Order items (ranges) are not evaluable mod p.
    expect(['inexact', expected], `${name} mod p`).toContain(modp);
  }
  if (expected !== 'degenerate') {
    const r = k.residual(build(FloatField), { scale: 10 });
    if (expected === 'true') expect(r, `${name} residual`).toBeLessThan(1e-12);
    else if (!byOrder) expect(r, `${name} residual`).toBeGreaterThan(1e-6);
  }
}

const P = <T>(F: import('@geomira/num/field').Field<T>, ...xs: Xy[]) => xs.map((x) => pt(F, x));

describe('the claim kinds as data', () => {
  it('lists the kinds of SPEC §10.1, and POLYNOMIAL KINDS is the whitelist', () => {
    expect(CLAIM_KINDS.map((k) => k.name)).toEqual([
      ...['collinear', 'concyclic', 'concurrent', 'parallel', 'perpendicular', 'equal', 'on'],
      ...['tangent', 'length', 'ratio', 'ratio_value', 'dangle', 'dangle_lines'],
      ...['angle_eq', 'angle_sum', 'angle_diff'],
      ...['cross_ratio', 'harmonic', 'cross_ratio_lines', 'harmonic_lines'],
      'conconic',
      ...['similar', 'similar_direct', 'similar_opposite'],
      ...['congruent', 'congruent_direct', 'congruent_opposite'],
      ...['length_product', 'length_sum'],
    ]);
    expect(POLYNOMIAL_KINDS).toEqual([
      ...['collinear', 'concyclic', 'concurrent', 'parallel', 'perpendicular', 'equal', 'on'],
      ...['tangent', 'length', 'ratio', 'ratio_value', 'dangle', 'dangle_lines'],
      ...['cross_ratio', 'harmonic', 'cross_ratio_lines', 'harmonic_lines'],
      'conconic',
      ...['similar', 'similar_direct', 'similar_opposite'],
      ...['congruent', 'congruent_direct', 'congruent_opposite'],
      'length_product',
    ]);
    expect(Object.isFrozen(POLYNOMIAL_KINDS)).toBe(true);
    expect(Object.isFrozen(CLAIM_KINDS)).toBe(true);
    expect(claimKind('angle_sum')?.polynomial).toBe(false);
    expect(claimKind('nope')).toBeUndefined();
  });
});

describe('incidence kinds: conditions and NDG over Q and mod p', () => {
  it('collinear', () => {
    check('collinear', (F) => P(F, [0, 0], [1, 1], [3, 3], [-2, -2]), 'true');
    check('collinear', (F) => P(F, [0, 0], [1, 1], [3, 4]), 'false');
    check('collinear', (F) => P(F, [0, 0], [0, 0], [1, 2]), 'degenerate');
    check('collinear', (F) => P(F, [0, 0], [1, 2], [1, 2]), 'degenerate');
  });

  it('concyclic (some triple must be non-collinear)', () => {
    check('concyclic', (F) => P(F, [1, 0], [0, 1], [-1, 0], ['3/5', '-4/5'], [0, -1]), 'true');
    check('concyclic', (F) => P(F, [1, 0], [0, 1], [-1, 0], [2, 0]), 'false');
    check('concyclic', (F) => P(F, [0, 0], [1, 1], [2, 2], [3, 3]), 'degenerate');
    check('concyclic', (F) => P(F, [1, 0], [0, 1], [-1, 0], [1, 0]), 'degenerate');
    // Three collinear and one off the line: not concyclic, and not degenerate.
    check('concyclic', (F) => P(F, [0, 0], [1, 0], [2, 0], [0, 1]), 'false');
  });

  it('concurrent (distinct lines, not all parallel)', () => {
    const l = <T>(F: import('@geomira/num/field').Field<T>, a: Xy, b: Xy) => line(F, a, b);
    check(
      'concurrent',
      (F) => [l(F, [0, 0], [2, 2]), l(F, [1, 0], [1, 5]), l(F, [0, 2], [2, 0])],
      'true',
    );
    check(
      'concurrent',
      (F) => [l(F, [0, 0], [2, 2]), l(F, [1, 0], [1, 5]), l(F, [0, 3], [3, 0])],
      'false',
    );
    check(
      'concurrent',
      (F) => [l(F, [0, 0], [2, 2]), l(F, [1, 1], [3, 3]), l(F, [0, 3], [3, 0])],
      'degenerate',
    );
    check(
      'concurrent',
      (F) => [l(F, [0, 0], [1, 0]), l(F, [0, 1], [1, 1]), l(F, [0, 2], [1, 2])],
      'degenerate',
    );
    // Two parallel lines and a transversal: no common point (false, not degenerate).
    check(
      'concurrent',
      (F) => [l(F, [0, 0], [1, 0]), l(F, [0, 1], [1, 1]), l(F, [0, 0], [0, 1])],
      'false',
    );
  });

  it('parallel, perpendicular, equal', () => {
    check('parallel', (F) => [line(F, [0, 0], [2, 1]), line(F, [0, 1], [4, 3])], 'true');
    check('parallel', (F) => [line(F, [0, 0], [2, 1]), line(F, [0, 1], [4, 4])], 'false');
    check('parallel', (F) => [line(F, [0, 0], [2, 1]), line(F, [4, 2], [6, 3])], 'degenerate');
    check('perpendicular', (F) => [line(F, [0, 0], [2, 1]), line(F, [5, 5], [4, 7])], 'true');
    check('perpendicular', (F) => [line(F, [0, 0], [2, 1]), line(F, [5, 5], [4, 8])], 'false');
    check('equal', (F) => P(F, ['1/3', 2], ['1/3', 2]), 'true');
    check('equal', (F) => P(F, ['1/3', 2], ['1/3', '2.001']), 'false');
  });
});

describe('curve kinds', () => {
  it('on: lines with ranges, circles, arcs', () => {
    check('on', (F) => [pt(F, [3, 3]), line(F, [0, 0], [1, 1])], 'true');
    check('on', (F) => [pt(F, [3, 3]), line(F, [0, 0], [1, 1], 'segment')], 'false', true);
    check('on', (F) => [pt(F, ['1/2', '1/2']), line(F, [0, 0], [1, 1], 'segment')], 'true');
    check('on', (F) => [pt(F, [1, 1]), line(F, [0, 0], [1, 1], 'segment')], 'true');
    check('on', (F) => [pt(F, [-1, -1]), line(F, [0, 0], [1, 1], 'ray')], 'false', true);
    check('on', (F) => [pt(F, ['3/5', '4/5']), circle(F, [0, 0], 1)], 'true');
    check('on', (F) => [pt(F, ['3/5', '4/5']), circle(F, [0, 0], 2)], 'false');
    const arc = <T>(F: import('@geomira/num/field').Field<T>) => ({
      ...circle(F, [0, 0], 1),
      arc: { from: pt(F, [1, 0]), to: pt(F, [0, 1]) },
    });
    check('on', (F) => [pt(F, ['3/5', '4/5']), arc(F)], 'true');
    check('on', (F) => [pt(F, ['-3/5', '4/5']), arc(F)], 'false', true);
  });

  it('tangent: line and circle, two circles; two lines are never tangent', () => {
    check('tangent', (F) => [line(F, [-3, 1], [5, 1]), circle(F, [0, 0], 1)], 'true');
    check('tangent', (F) => [circle(F, [0, 0], 1), line(F, [-3, 2], [5, 2])], 'false');
    check('tangent', (F) => [circle(F, [0, 0], 1), circle(F, [2, 0], 1)], 'true');
    check('tangent', (F) => [circle(F, [0, 0], 4), circle(F, [1, 0], 1)], 'true');
    check('tangent', (F) => [circle(F, [0, 0], 4), circle(F, ['1.5', 0], 1)], 'false');
    check('tangent', (F) => [circle(F, [1, 2], 4), circle(F, [1, 2], 4)], 'degenerate');
    check('tangent', (F) => [circle(F, [0, 0], 4), circle(F, [0, 0], 1)], 'false');
    const r = kind('tangent').algebra(
      RationalField,
      [line(RationalField, [0, 0], [1, 0]), line(RationalField, [0, 1], [1, 1])],
      { scale: 1 },
    );
    expect(r).toEqual({
      kind: 'undefined',
      reason: 'tangent needs a circle: two lines are never tangent',
    });
  });
});

describe('length kinds', () => {
  it('length, ratio_value, ratio', () => {
    const four = <T>(F: import('@geomira/num/field').Field<T>) =>
      P(F, [0, 0], [3, 4], [0, 0], [0, 10]);
    check('length', (F) => [...four(F), lit(F, '1/2')], 'true');
    check('length', (F) => [...four(F), lit(F, 1)], 'false');
    check('ratio_value', (F) => [...four(F), lit(F, '0.5')], 'true');
    check('length', (F) => [...P(F, [0, 0], [3, 4], [1, 1], [1, 1]), lit(F, 1)], 'degenerate');
    for (const k of ['0', '-1']) {
      const r = kind('length').algebra(
        RationalField,
        [...four(RationalField), lit(RationalField, k)],
        { scale: 1 },
      );
      expect(r).toEqual({ kind: 'undefined', reason: 'length: the factor k must be positive' });
    }
    check(
      'ratio',
      (F) => P(F, [0, 0], [3, 4], [0, 0], [0, 10], [1, 1], [2, 1], [5, 5], [5, 7]),
      'true',
    );
    check(
      'ratio',
      (F) => P(F, [0, 0], [3, 4], [0, 0], [0, 10], [1, 1], [2, 1], [5, 5], [5, 8]),
      'false',
    );
    check(
      'ratio',
      (F) => P(F, [0, 0], [0, 0], [0, 0], [0, 10], [1, 1], [1, 1], [5, 5], [5, 8]),
      'degenerate',
    );
    check(
      'ratio',
      (F) => P(F, [0, 0], [3, 4], [2, 2], [2, 2], [1, 1], [2, 1], [5, 5], [5, 8]),
      'degenerate',
    );
  });
});

describe('angle kinds', () => {
  // B = (0, 0), C = (4, 0), A = (1, 3) is acute with orthocentre H = (1, 1);
  // A' = (−1, 2) is obtuse at B, with orthocentre H' = (−1, −5/2) (SPEC run note).
  const acute = <T>(F: import('@geomira/num/field').Field<T>) =>
    P(F, [0, 0], [1, 1], [4, 0], [0, 0], [1, 3], [4, 0]);
  const obtuse = <T>(F: import('@geomira/num/field').Field<T>) =>
    P(F, [0, 0], [-1, '-5/2'], [4, 0], [0, 0], [-1, 2], [4, 0]);

  it('angle_sum: ∠BHC + ∠A = 180° when acute; when B is obtuse ∠BHC = ∠A instead', () => {
    check('angle_sum', (F) => [...acute(F), lit(F, 180)], 'true');
    check('angle_sum', (F) => [...obtuse(F), lit(F, 180)], 'false');
    check('angle_eq', (F) => obtuse(F), 'true');
    check('angle_eq', (F) => acute(F), 'false');
    check('angle_diff', (F) => [...obtuse(F), lit(F, 0)], 'true');
  });

  it('angle_sum at 90°: complementary angles; a half-turn apart is false, not true', () => {
    // In the right triangle (0, 0), (4, 0), (0, 3): ∠B + ∠C = 90°.
    const tri = <T>(F: import('@geomira/num/field').Field<T>) =>
      P(F, [0, 0], [4, 0], [0, 3], [4, 0], [0, 3], [0, 0]);
    check('angle_sum', (F) => [...tri(F), lit(F, 90)], 'true');
    check('angle_sum', (F) => [...tri(F), lit(F, 270)], 'false');
    check('angle_diff', (F) => [...tri(F), lit(F, 90)], 'false');
  });

  it('θ outside the reachable range is an invalid claim', () => {
    const args = [
      ...P(RationalField, [1, 0], [0, 0], [0, 1], [1, 0], [0, 0], [0, 1]),
      lit(RationalField, 400),
    ];
    expect(kind('angle_sum').algebra(RationalField, args, { scale: 1 })).toEqual({
      kind: 'undefined',
      reason: 'angle_sum: θ must lie in [0°, 360°]',
    });
  });

  it('dangle_lines: exact at multiples of 45°, else trigonometry (Inexact over Q)', () => {
    const lines = <T>(F: import('@geomira/num/field').Field<T>) => [
      line(F, [0, 0], [1, 0]),
      line(F, [0, 0], [2, 2]),
    ];
    check('dangle_lines', (F) => [...lines(F), lit(F, 45)], 'true');
    check('dangle_lines', (F) => [...lines(F), lit(F, -135)], 'true');
    check('dangle_lines', (F) => [...lines(F), lit(F, 135)], 'false');
    const k = kind('dangle_lines');
    expect(
      k.algebra(RationalField, [...lines(RationalField), lit(RationalField, 30)], { scale: 1 }),
    ).toMatchObject({ kind: 'inexact' });
    expect(k.needsTrig?.([lit(RationalField, 30).exact ?? { num: 0n, den: 1n }])).toMatch(
      /needs cos and sin/,
    );
    expect(k.needsTrig?.([lit(RationalField, 225).exact ?? { num: 0n, den: 1n }])).toBeUndefined();
    expect(k.residual([...lines(FloatField), lit(FloatField, 45)], { scale: 1 })).toBeLessThan(
      1e-15,
    );
  });

  it('dangle: the multiple must be an integer from 1 to 12', () => {
    const six = P(RationalField, [1, 0], [0, 0], [0, 1], [1, 0], [0, 0], [0, 1]);
    for (const n of ['0', '13', '-1']) {
      expect(
        kind('dangle').algebra(RationalField, [lit(RationalField, n), ...six], { scale: 1 }),
      ).toMatchObject({ kind: 'undefined' });
    }
    check(
      'dangle',
      (F) => [lit(F, 1), ...P(F, [1, 0], [0, 0], [0, 1], [5, 5], [3, 3], [1, 5])],
      'true',
    );
    check(
      'dangle',
      (F) => [lit(F, 1), ...P(F, [1, 0], [0, 0], [0, 1], [3, 3], [3, 3], [1, 5])],
      'degenerate',
    );
  });
});

describe('every kind is total on malformed arguments (never a throw, never NaN)', () => {
  const malformed: Value<number>[][] = [
    [],
    [{ kind: 'number', v: 1 }],
    Array.from({ length: 8 }, () => ({
      kind: 'number' as const,
      v: 2,
      exact: { num: 2n, den: 1n },
    })),
    Array.from({ length: 8 }, () => ({ kind: 'polygon' as const, pts: [] })),
    Array.from({ length: 8 }, (_, i) =>
      i % 2 === 0 ? pt(FloatField, [i, 1]) : line(FloatField, [0, 0], [1, i]),
    ),
  ];
  for (const k of CLAIM_KINDS) {
    it(k.name, () => {
      for (const args of malformed) {
        const a = k.algebra(FloatField, args, { scale: 1 });
        const r = k.residual(args, { scale: 1 });
        expect(Number.isNaN(r), `${k.name} residual`).toBe(false);
        if ('kind' in a) expect(['undefined', 'inexact']).toContain(a.kind);
        else expect(r).toBeGreaterThanOrEqual(0);
        if (k.gap !== undefined) expect(Number.isNaN(k.gap(args, { scale: 1 }))).toBe(false);
      }
    });
  }
});
