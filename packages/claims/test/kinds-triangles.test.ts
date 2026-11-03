/**
 * ADR-0051: similar and congruent triangles (either orientation, or one), AB·CD = EF·GH and
 * AB + CD = EF, field-generic. Truth over Q and mod p, the float residual, the NDG data (flat
 * triangles, null segments), and the polynomial whitelist (length_sum is not on it: L17).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { claimKind, POLYNOMIAL_KINDS } from '../src/kinds';
import type { ClaimKindSpec } from '../src/kind';
import { exactTruth, pt, type Xy } from './helpers/values';

function kind(name: string): ClaimKindSpec {
  const k = claimKind(name);
  if (k === undefined) throw new Error(name);
  return k;
}

type Truth = 'true' | 'false' | 'degenerate';

/** Over Q, mod p (unless `modp` is false: an order item), and the float residual. */
function check(name: string, xs: readonly Xy[], expected: Truth, modp = true): void {
  const k = kind(name);
  const P = <T>(F: Field<T>): Value<T>[] => xs.map((x) => pt(F, x));
  expect(exactTruth(RationalField, k, P(RationalField)), `${name} over Q`).toBe(expected);
  if (modp) expect(exactTruth(ModPField, k, P(ModPField)), `${name} mod p`).toBe(expected);
  if (expected === 'degenerate') return;
  const r = k.residual(P(FloatField), { scale: 10 });
  if (expected === 'true') expect(r, `${name} residual`).toBeLessThan(1e-12);
  else expect(r, `${name} residual`).toBeGreaterThan(1e-6);
}

// A scalene triangle and its images.
const ABC: Xy[] = [
  [0, 0],
  [4, 0],
  [1, 3],
];
/** z ↦ 2iz + (1 + i): a direct similarity (ratio 2). */
const direct = ([x, y]: Xy): Xy => [-2 * Number(y) + 1, 2 * Number(x) + 1];
/** z ↦ 2·conj(z): an opposite similarity (ratio 2). */
const opposite = ([x, y]: Xy): Xy => [2 * Number(x), -2 * Number(y)];
/** z ↦ iz + 5: a rotation (direct congruence). */
const rotation = ([x, y]: Xy): Xy => [-Number(y) + 5, x];
/** z ↦ conj(z) − 3: a reflection and a translation (opposite congruence). */
const reflection = ([x, y]: Xy): Xy => [Number(x) - 3, -Number(y)];

const tri = (f: (p: Xy) => Xy): Xy[] => [...ABC, ...ABC.map(f)];

describe('similar and congruent triangles (A ↔ D, B ↔ E, C ↔ F)', () => {
  it('a direct similarity: similar and similar_direct hold, similar_opposite does not', () => {
    check('similar', tri(direct), 'true');
    check('similar_direct', tri(direct), 'true');
    check('similar_opposite', tri(direct), 'false');
    check('congruent', tri(direct), 'false');
  });

  it('an opposite similarity: similar and similar_opposite hold, similar_direct does not', () => {
    check('similar', tri(opposite), 'true');
    check('similar_opposite', tri(opposite), 'true');
    check('similar_direct', tri(opposite), 'false');
    check('congruent_opposite', tri(opposite), 'false');
  });

  it('a rotation: every similarity and congruence of the direct orientation', () => {
    for (const n of ['similar', 'similar_direct', 'congruent', 'congruent_direct'])
      check(n, tri(rotation), 'true');
    check('congruent_opposite', tri(rotation), 'false');
  });

  it('a reflection: the opposite kinds, and the either-orientation kinds', () => {
    for (const n of ['similar', 'similar_opposite', 'congruent', 'congruent_opposite'])
      check(n, tri(reflection), 'true');
    check('congruent_direct', tri(reflection), 'false');
  });

  it('the correspondence matters: the vertices in another order are not similar', () => {
    const [d, e, g] = ABC.map(direct);
    if (d === undefined || e === undefined || g === undefined) throw new Error('points');
    check('similar', [...ABC, e, d, g], 'false');
    check('similar_direct', [...ABC, e, d, g], 'false');
  });

  it('NDG: a flat triangle is degenerate, never true or false', () => {
    const flat: Xy[] = [
      [0, 0],
      [1, 0],
      [3, 0],
    ];
    for (const n of ['similar', 'similar_direct', 'congruent_opposite']) {
      check(n, [...flat, ...flat], 'degenerate');
      check(n, [...ABC, ...flat], 'degenerate');
      check(n, [...ABC, [1, 1], [1, 1], [2, 2]], 'degenerate');
    }
  });
});

describe('AB·CD = EF·GH and AB + CD = EF', () => {
  it('the power of a point: PA·PB = PC·PD on two secants of a circle', () => {
    // x² + y² = 25; P = (7, 0); the secants through P meet it at (5, 0), (−5, 0) and at
    // (3, 4), and (7, 0) + t(−4, 4)·… : the line through P and (3, 4) meets it again at (4, 3).
    const pts: Xy[] = [
      [7, 0],
      [5, 0],
      [7, 0],
      [-5, 0],
      [7, 0],
      [3, 4],
      [7, 0],
      [4, 3],
    ];
    check('length_product', pts, 'true');
    check('length_product', [...pts.slice(0, 7), [4, 4]], 'false');
  });

  it('length_product: a null segment is degenerate', () => {
    check(
      'length_product',
      [
        [0, 0],
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 0],
        [3, 0],
        [1, 1],
        [1, 2],
      ],
      'degenerate',
    );
  });

  it('length_sum: a point between two others (AB + BC = AC), and not otherwise', () => {
    const sum: Xy[] = [
      [0, 0],
      [3, 0],
      [3, 0],
      [7, 0],
      [0, 0],
      [7, 0],
    ];
    check('length_sum', sum, 'true', false);
    // |AB − BC| = AC (B beyond C): the squared condition holds, the order item refuses it.
    const diff: Xy[] = [
      [0, 0],
      [7, 0],
      [7, 0],
      [3, 0],
      [0, 0],
      [3, 0],
    ];
    check('length_sum', diff, 'false', false);
    // A 3-4-5 triangle: 3 + 4 ≠ 5.
    check(
      'length_sum',
      [
        [0, 0],
        [3, 0],
        [3, 0],
        [3, 4],
        [0, 0],
        [3, 4],
      ],
      'false',
      false,
    );
    check(
      'length_sum',
      [
        [0, 0],
        [0, 0],
        [3, 0],
        [7, 0],
        [3, 0],
        [7, 0],
      ],
      'degenerate',
      false,
    );
  });

  it('length_sum mod p: its order item needs an order, so the exact decision is not available', () => {
    const k = kind('length_sum');
    const P = <T>(F: Field<T>): Value<T>[] =>
      (
        [
          [0, 0],
          [3, 0],
          [3, 0],
          [7, 0],
          [0, 0],
          [7, 0],
        ] as Xy[]
      ).map((x) => pt(F, x));
    expect(exactTruth(ModPField, k, P(ModPField))).toBe('inexact');
  });

  it('the whitelist: length_product and the triangles are polynomial, length_sum is not (L17)', () => {
    for (const n of [
      'similar',
      'similar_direct',
      'similar_opposite',
      'congruent',
      'congruent_direct',
      'congruent_opposite',
      'length_product',
    ])
      expect(POLYNOMIAL_KINDS).toContain(n);
    expect(POLYNOMIAL_KINDS).not.toContain('length_sum');
    expect(kind('length_sum').polynomial).toBe(false);
  });
});
