/**
 * The conic claims (ADR-0042): on(P, k) and tangent(l, k) with a conic, and conconic(A…F), over
 * Q, mod p and in floats; conconic's condition is the 6×6 determinant of the rows
 * (x², xy, y², x, y, 1) up to one constant factor.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { createRng } from '@geomira/num/rng';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { makeConic, type Coeffs } from '@geomira/kernel/conic';
import type { Conic, Value } from '@geomira/kernel/value';
import { claimKind } from '../src/kinds';
import type { ClaimKindSpec } from '../src/kind';
import { circle, exactTruth, lift, line, pt, type Xy } from './helpers/values';

function kind(name: string): ClaimKindSpec {
  const k = claimKind(name);
  if (k === undefined) throw new Error(name);
  return k;
}

/** The conic of coefficients (a, 2b, c, 2d, 2e, f) given as a·x² + 2b·xy + …, in normal form. */
function conic<T>(F: Field<T>, cs: readonly (string | number)[]): Conic<T> {
  const [a, b, c, d, e, f] = cs.map((x) => lift(F, x));
  if (a === undefined || b === undefined || c === undefined) throw new Error('six');
  if (d === undefined || e === undefined || f === undefined) throw new Error('six');
  const q: Coeffs<T> = [a, b, c, d, e, f];
  const k = makeConic(F, q, undefined, { scale: 1 });
  if (k.kind !== 'conic') throw new Error(k.reason);
  return k;
}

/** xy = 1 (b = 1/2, f = −1) and x²/4 + y² = 1. */
const HYP = [0, '1/2', 0, 0, 0, -1] as const;
const ELL = ['1/4', 0, 1, 0, 0, -1] as const;

type Build = <T>(F: Field<T>) => Value<T>[];

/** Expected truth over Q and mod p; the float residual near 0 exactly for 'true'. */
function check(name: string, build: Build, expected: 'true' | 'false' | 'degenerate'): void {
  const k = kind(name);
  expect(exactTruth(RationalField, k, build(RationalField)), `${name} over Q`).toBe(expected);
  expect(exactTruth(ModPField, k, build(ModPField)), `${name} mod p`).toBe(expected);
  if (expected === 'degenerate') return;
  const r = k.residual(build(FloatField), { scale: 10 });
  if (expected === 'true') expect(r, `${name} residual`).toBeLessThan(1e-12);
  else expect(r, `${name} residual`).toBeGreaterThan(1e-6);
}

describe('on(P, k) with a conic', () => {
  it('Q(P) = 0 decides; the gap is the kernel incidence length', () => {
    check('on', (F) => [pt(F, [2, '1/2']), conic(F, HYP)], 'true');
    check('on', (F) => [pt(F, [-4, '-1/4']), conic(F, HYP)], 'true');
    check('on', (F) => [pt(F, [2, 1]), conic(F, HYP)], 'false');
    check('on', (F) => [pt(F, ['6/5', '4/5']), conic(F, ELL)], 'true');
    // The gap is a length: (2, 1 + h) is about h from xy = 1 (the slope there is −1/4).
    const gap = kind('on').gap?.([pt(FloatField, [2, 0.5 + 1e-3]), conic(FloatField, HYP)], {
      scale: 1,
    });
    expect(Math.abs(gap ?? 0) / (1e-3 / Math.hypot(1, 1 / 4))).toBeCloseTo(1, 2);
  });
});

describe('tangent(l, k) with a conic', () => {
  it('the dual conic decides, in either order', () => {
    check('tangent', (F) => [line(F, [-3, 1], [3, 1]), conic(F, ELL)], 'true');
    check('tangent', (F) => [conic(F, ELL), line(F, [-3, 1], [3, 1])], 'true');
    check('tangent', (F) => [line(F, [-3, '1/2'], [3, '1/2']), conic(F, ELL)], 'false');
    check('tangent', (F) => [line(F, [-3, 2], [3, 2]), conic(F, ELL)], 'false');
    check('tangent', (F) => [line(F, [0, 2], [2, 0]), conic(F, HYP)], 'true');
    check('tangent', (F) => [line(F, [0, 3], [3, 0]), conic(F, HYP)], 'false');
  });

  it('a line in an asymptotic direction is degenerate (it meets the conic at infinity)', () => {
    // The asymptote y = 0 and the line y = 3 (direction (1, 0)) of xy = 1.
    check('tangent', (F) => [line(F, [0, 0], [1, 0]), conic(F, HYP)], 'degenerate');
    check('tangent', (F) => [line(F, [0, 3], [1, 3]), conic(F, HYP)], 'degenerate');
    // The parabola y = x²: a line parallel to its axis.
    check(
      'tangent',
      (F) => [line(F, [1, 0], [1, 1]), conic(F, [1, 0, 0, 0, '-1/2', 0])],
      'degenerate',
    );
  });

  it('a conic with a circle or a conic is undefined, with the reason', () => {
    const k = kind('tangent');
    for (const args of [
      [conic(RationalField, ELL), circle(RationalField, [0, 0], 1)],
      [conic(RationalField, ELL), conic(RationalField, HYP)],
    ]) {
      const a = k.algebra(RationalField, args, { scale: 1 });
      expect('kind' in a && a.kind === 'undefined' ? a.reason : '').toBe(
        'tangent: the tangency of a conic and a circle or of two conics is not decided',
      );
    }
  });
});

const ON_HYP: readonly Xy[] = [
  [1, 1],
  [2, '1/2'],
  [-1, -1],
  [4, '1/4'],
  ['1/2', 2],
  [-2, '-1/2'],
];

const pts =
  (xs: readonly Xy[]): Build =>
  (F) =>
    xs.map((x) => pt(F, x));

describe('conconic(A, B, C, D, E, F)', () => {
  it('six points of a hyperbola or a circle: true in any order', () => {
    check('conconic', pts(ON_HYP), 'true');
    const order = [5, 2, 0, 4, 1, 3].map((i) => ON_HYP[i] ?? [0, 0]);
    check('conconic', pts(order), 'true');
    const circle6: Xy[] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      ['3/5', '4/5'],
      ['-3/5', '4/5'],
    ];
    check('conconic', pts(circle6), 'true');
  });

  it('a sixth point off the conic: false', () => {
    check('conconic', pts([...ON_HYP.slice(0, 5), [3, 2]]), 'false');
    check('conconic', pts([[3, 2], ...ON_HYP.slice(1)]), 'false');
  });

  it('a repeated point or three collinear points: degenerate', () => {
    check('conconic', pts([...ON_HYP.slice(0, 5), [1, 1]]), 'degenerate');
    // A line pair: three points on y = 0 and three on x = 0 lie on xy = 0.
    const pair: Xy[] = [
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ];
    check('conconic', pts(pair), 'degenerate');
  });

  it('the condition is the 6×6 determinant of (x², xy, y², x, y, 1) up to one constant', () => {
    const F = RationalField;
    const rng = createRng(7);
    const ratios = Array.from({ length: 8 }, () => {
      const xs: Xy[] = Array.from({ length: 6 }, () => [
        rng.nextInt(21) - 10,
        rng.nextInt(21) - 10,
      ]);
      const a = kind('conconic').algebra(F, pts(xs)(F), { scale: 1 });
      if ('kind' in a) throw new Error(a.reason);
      const [cond] = a.conditions;
      const det = det6(
        F,
        xs.map(([x, y]) => {
          const [u, v] = [lift(F, x), lift(F, y)];
          return [F.mul(u, u), F.mul(u, v), F.mul(v, v), u, v, F.one];
        }),
      );
      if (cond === undefined || F.eq(det, F.zero)) return undefined;
      return F.toNumber(F.div(cond, det));
    }).filter((x): x is number => x !== undefined);
    expect(ratios.length).toBeGreaterThan(4);
    for (const r of ratios) expect(r).toBe(ratios[0]);
    expect(ratios[0]).not.toBe(0);
  });
});

/** The determinant of a square matrix by elimination (exact fields). */
function det6<T>(F: Field<T>, rows: readonly (readonly T[])[]): T {
  const m = rows.map((r) => [...r]);
  let det = F.one;
  for (let i = 0; i < m.length; i++) {
    const p = m.findIndex((r, j) => j >= i && !F.eq(r[i] ?? F.zero, F.zero));
    if (p < 0) return F.zero;
    if (p !== i) {
      const [a, b] = [m[i] ?? [], m[p] ?? []];
      [m[i], m[p]] = [b, a];
      det = F.neg(det);
    }
    const row = m[i] ?? [];
    const piv = row[i] ?? F.one;
    det = F.mul(det, piv);
    for (let j = i + 1; j < m.length; j++) {
      const r = m[j] ?? [];
      const k = F.div(r[i] ?? F.zero, piv);
      for (let c = i; c < r.length; c++) r[c] = F.sub(r[c] ?? F.zero, F.mul(k, row[c] ?? F.zero));
    }
  }
  return det;
}
