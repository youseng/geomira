/**
 * Run 16a (ADR-0040 decision 15): cross_ratio, harmonic and their line forms, field-generic.
 * Truth over Q and mod p, the float residual, the NDG data, the three configurations (four
 * collinear points, four concyclic points, four concurrent lines), collinear with points at
 * infinity (decision 4), and the polynomial whitelist (L17).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { claimKind, POLYNOMIAL_KINDS } from '../src/kinds';
import type { ClaimKindSpec } from '../src/kind';
import { exactTruth, line, lit, pt, type Xy } from './helpers/values';

function kind(name: string): ClaimKindSpec {
  const k = claimKind(name);
  if (k === undefined) throw new Error(name);
  return k;
}

type Build = <T>(F: Field<T>) => Value<T>[];

function check(name: string, build: Build, expected: 'true' | 'false' | 'degenerate'): void {
  const k = kind(name);
  expect(exactTruth(RationalField, k, build(RationalField)), `${name} over Q`).toBe(expected);
  expect(exactTruth(ModPField, k, build(ModPField)), `${name} mod p`).toBe(expected);
  if (expected === 'degenerate') return;
  const r = k.residual(build(FloatField), { scale: 10 });
  if (expected === 'true') expect(r, `${name} residual`).toBeLessThan(1e-12);
  else expect(r, `${name} residual`).toBeGreaterThan(1e-6);
}

const P = <T>(F: Field<T>, ...xs: Xy[]) => xs.map((x) => pt(F, x));
const ideal = <T>(F: Field<T>, x: Xy): Value<T> => {
  const p = pt(F, x);
  return { kind: 'ideal_point', d: { x: p.x, y: p.y }, chiral: false };
};

describe('cross_ratio and harmonic of four points', () => {
  it('four collinear points: (A, B; C, D) as on the line', () => {
    // (0, 6; 2, −6) = (2·(−12))/((−4)·(−6)) = −1.
    const harm = <T>(F: Field<T>) => P(F, [0, 0], [6, 0], [2, 0], [-6, 0]);
    check('harmonic', harm, 'true');
    check('cross_ratio', (F) => [...harm(F), lit(F, -1)], 'true');
    check('cross_ratio', (F) => [...harm(F), lit(F, 2)], 'false');
    // (0, 1; 2, 3) = (2·2)/(1·3) = 4/3, on a slanted line.
    const slant = <T>(F: Field<T>) => P(F, [0, 0], [1, 2], [2, 4], [3, 6]);
    check('cross_ratio', (F) => [...slant(F), lit(F, '4/3')], 'true');
    check('harmonic', slant, 'false');
  });

  it('four concyclic points: the cross ratio seen from the circle (a harmonic quadrilateral)', () => {
    // A square inscribed in the unit circle is harmonic: (1, −1; i, −i) = −1.
    check('harmonic', (F) => P(F, [1, 0], [-1, 0], [0, 1], [0, -1]), 'true');
    // On x² + y² = 25: (5, −5; 3 + 4i, −3 + 4i) = (−20)/(−80) = 1/4, real but not −1.
    const c = <T>(F: Field<T>) => P(F, [5, 0], [-5, 0], [3, 4], [-3, 4]);
    check('harmonic', c, 'false');
    check('cross_ratio', (F) => [...c(F), lit(F, '1/4')], 'true');
    // Not on one circle or line: the complex cross ratio is not real, so the claim is false.
    check('cross_ratio', (F) => [...P(F, [0, 0], [4, 0], [1, 3], [5, 2]), lit(F, -1)], 'false');
  });

  it('NDG: the four points distinct', () => {
    check('harmonic', (F) => P(F, [0, 0], [0, 0], [2, 0], [3, 0]), 'degenerate');
    check('cross_ratio', (F) => [...P(F, [0, 0], [1, 0], [2, 0], [2, 0]), lit(F, 1)], 'degenerate');
  });

  it('the symmetries: (A, B; C, D) = (B, A; D, C) = (C, D; A, B); harmonic adds A ↔ B, C ↔ D', () => {
    const pts: Xy[] = [
      [5, 0],
      [-5, 0],
      [3, 4],
      [-3, 4],
    ];
    const at =
      (perm: number[]) =>
      <T>(F: Field<T>) =>
        perm.map((i) => pt(F, pts[i] ?? [0, 0]));
    for (const perm of [
      [0, 1, 2, 3],
      [1, 0, 3, 2],
      [2, 3, 0, 1],
      [3, 2, 1, 0],
    ])
      check('cross_ratio', (F) => [...at(perm)(F), lit(F, '1/4')], 'true');
    check('cross_ratio', (F) => [...at([1, 0, 2, 3])(F), lit(F, '1/4')], 'false');
    check('cross_ratio', (F) => [...at([1, 0, 2, 3])(F), lit(F, 4)], 'true');
    const sq: Xy[] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const perm of [
      [1, 0, 2, 3],
      [0, 1, 3, 2],
      [2, 3, 0, 1],
    ])
      check('harmonic', (F) => perm.map((i) => pt(F, sq[i] ?? [0, 0])), 'true');
  });
});

describe('cross_ratio_lines and harmonic_lines of four concurrent lines', () => {
  const through = <T>(F: Field<T>, ...dirs: Xy[]) =>
    dirs.map(([x, y]) => line(F, [1, 1], [Number(x) + 1, Number(y) + 1]));

  it('the pencil x, y, x + y, x − y through (1, 1) is harmonic; (a, b; c, d) as on a transversal', () => {
    check('harmonic_lines', (F) => through(F, [1, 0], [0, 1], [1, 1], [1, -1]), 'true');
    check('harmonic_lines', (F) => through(F, [1, 0], [0, 1], [1, 1], [1, 2]), 'false');
    // cross(x, x + y)·cross(y, x + 2y) / (cross(y, x + y)·cross(x, x + 2y)) = (1·(−1))/((−1)·2).
    check(
      'cross_ratio_lines',
      (F) => [...through(F, [1, 0], [0, 1], [1, 1], [1, 2]), lit(F, '1/2')],
      'true',
    );
  });

  it('not concurrent: false; parallel or the same line: degenerate', () => {
    const lines = <T>(F: Field<T>) => [
      line(F, [0, 0], [1, 0]),
      line(F, [0, 0], [0, 1]),
      line(F, [0, 0], [1, 1]),
      line(F, [0, 1], [1, 0]),
    ];
    check('harmonic_lines', lines, 'false');
    const par = <T>(F: Field<T>) => [
      line(F, [0, 0], [1, 0]),
      line(F, [0, 1], [1, 1]),
      line(F, [0, 2], [1, 2]),
      line(F, [0, 3], [1, 3]),
    ];
    check('harmonic_lines', par, 'degenerate');
  });
});

describe('collinear with points at infinity (ADR-0040 decision 4)', () => {
  it('X∞ on line PQ iff PQ has its direction; two of them span the line at infinity', () => {
    check('collinear', (F) => [pt(F, [0, 0]), pt(F, [2, 1]), ideal(F, [4, 2])], 'true');
    check('collinear', (F) => [pt(F, [0, 0]), ideal(F, [4, 2]), pt(F, [2, 1])], 'true');
    check('collinear', (F) => [pt(F, [0, 0]), pt(F, [2, 1]), ideal(F, [1, 0])], 'false');
    check('collinear', (F) => [ideal(F, [1, 0]), ideal(F, [0, 1]), ideal(F, [1, 1])], 'true');
    check('collinear', (F) => [ideal(F, [1, 0]), ideal(F, [0, 1]), pt(F, [1, 1])], 'false');
    check('collinear', (F) => [pt(F, [1, 1]), ideal(F, [1, 0]), ideal(F, [3, 0])], 'degenerate');
  });

  it('the residual is a sine (dimensionless), 0 exactly when the condition holds', () => {
    const k = kind('collinear');
    const r = (args: Value<number>[]) => k.residual(args, { scale: 1 });
    expect(
      r([pt(FloatField, [0, 0]), pt(FloatField, [1, 0]), ideal(FloatField, [1, 1])]),
    ).toBeCloseTo(Math.SQRT1_2, 15);
    expect(r([ideal(FloatField, [1, 0]), ideal(FloatField, [0, 1]), pt(FloatField, [1, 1])])).toBe(
      1,
    );
    expect(r([pt(FloatField, [5, 5]), ideal(FloatField, [1, 0]), pt(FloatField, [9, 5])])).toBe(0);
  });
});

describe('the whitelist (L17)', () => {
  it('the four kinds are polynomial: exact over Q and mod p with exact literals', () => {
    for (const n of ['cross_ratio', 'harmonic', 'cross_ratio_lines', 'harmonic_lines'])
      expect(POLYNOMIAL_KINDS).toContain(n);
  });

  it('a literal k not representable mod p (a denominator divisible by p) is Inexact there', () => {
    const k = kind('cross_ratio');
    const p = 2n ** 61n - 1n;
    const args = [
      ...P(ModPField, [0, 0], [6, 0], [2, 0], [-6, 0]),
      { kind: 'number' as const, v: 0n, exact: { num: 1n, den: p } },
    ];
    expect(k.algebra(ModPField, args, { scale: 1 })).toMatchObject({ kind: 'inexact' });
  });
});
