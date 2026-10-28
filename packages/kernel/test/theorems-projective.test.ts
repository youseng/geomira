/**
 * Projective theorems (Run 16a, ADR-0040), on random figures over FloatField and exactly over
 * RationalField (helpers/theorem-runner.ts). Classical facts only:
 *   - a projective map keeps the cross ratio of four collinear points (projective(…) and
 *     send_to_infinity(l));
 *   - Desargues with two corresponding sides parallel: the axis is parallel to them (it passes
 *     through their common point at infinity);
 *   - Pappus with two pairs of cross-joins parallel: the third pair is parallel too;
 *   - the complete quadrilateral: a diagonal is divided harmonically by the other two;
 *   - Brokard: for a cyclic quadrilateral, the polar of the intersection of the diagonals is the
 *     line through the intersections of the opposite sides, and the centre is the orthocenter
 *     of the diagonal triangle;
 *   - a cyclic quadrilateral ABCD with the tangents at A and C meeting on BD is harmonic, and
 *     then the tangents at B and D meet on AC;
 *   - projecting a harmonic quadruple of a circle from a point of the circle onto a line gives a
 *     harmonic quadruple.
 */
import type { Field } from '@geomira/num/field';
import { describe } from 'vitest';
import { call } from '../src/expr';
import { vCross, vSub } from '../src/geom';
import type { Vec } from '../src/value';
import { onLine } from './helpers/circle-properties';
import { num } from './helpers/doc';
import { asPoint, samePoints, type Figure } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import { ALL, collinear, theoremTests, type Theorem } from './helpers/theorem-runner';

/** The complex product of two vectors read as complex numbers. */
function cmul<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): Vec<T> {
  return { x: F.sub(F.mul(a.x, b.x), F.mul(a.y, b.y)), y: F.add(F.mul(a.x, b.y), F.mul(a.y, b.x)) };
}

/** (C − A)(D − B) and (C − B)(D − A) of four named points. */
function terms<T>(f: Figure<T>, names: readonly string[]): [Vec<T>, Vec<T>] {
  const [a, b, c, d] = names.map((n) => asPoint(f.get(n)));
  if (a === undefined || b === undefined || c === undefined || d === undefined)
    throw new Error('four points');
  const F = f.F;
  return [cmul(F, vSub(F, c, a), vSub(F, d, b)), cmul(F, vSub(F, c, b), vSub(F, d, a))];
}

/** (A, B; C, D) = −1: (C − A)(D − B) + (C − B)(D − A) = 0 (a complex number, as an area). */
function harmonic<T>(f: Figure<T>, ...names: string[]): boolean {
  const [p, q] = terms(f, names);
  const F = f.F;
  return (
    F.isZero(F.add(p.x, q.x), 'area', f.ctx) &&
    F.isZero(F.add(p.y, q.y), 'area', f.ctx) &&
    !F.isZero(q.x, 'area', f.ctx)
  );
}

/** a / b as complex numbers. */
function cdiv<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): Vec<T> {
  const n = F.add(F.mul(b.x, b.x), F.mul(b.y, b.y));
  return {
    x: F.div(F.add(F.mul(a.x, b.x), F.mul(a.y, b.y)), n),
    y: F.div(F.sub(F.mul(a.y, b.x), F.mul(a.x, b.y)), n),
  };
}

/** The (complex) cross ratios of two quadruples are equal: p₁q₂ / (p₂q₁) = 1. */
function sameCrossRatio<T>(f: Figure<T>, a: readonly string[], b: readonly string[]): boolean {
  const F = f.F;
  const [[p1, q1], [p2, q2]] = [terms(f, a), terms(f, b)];
  const z = cdiv(F, cmul(F, p1, q2), cmul(F, p2, q1));
  return (
    F.isZero(F.sub(z.x, F.one), 'dimensionless', f.ctx) && F.isZero(z.y, 'dimensionless', f.ctx)
  );
}

const isIdeal = <T>(f: Figure<T>, name: string) => f.get(name).kind === 'ideal_point';

/** X∞ = a point at infinity and the line through Y, Z have the same direction. */
function onInfinityOf<T>(f: Figure<T>, x: string, y: string, z: string): boolean {
  const X = f.get(x);
  if (X.kind !== 'ideal_point') return false;
  const F = f.F;
  const d = vSub(F, asPoint(f.get(z)), asPoint(f.get(y)));
  return (
    F.isZero(vCross(F, d, X.d), 'area', f.ctx) &&
    !F.isZero(F.add(F.mul(d.x, d.x), F.mul(d.y, d.y)), 'area', f.ctx)
  );
}

const THEOREMS: readonly Theorem[] = [
  {
    name: 'a projective map keeps the cross ratio of four collinear points',
    modes: ALL,
    build: (b, [A, B, C, D, E, F]) => {
      const T = b.call('T', 'projective', A, B, C, D, C, D, E, F);
      const P = b.call('P', 'divide', A, B, num('1/3'));
      const Q = b.call('Q', 'divide', A, B, num(-2));
      for (const [n, X] of [
        ['A_1', A],
        ['B_1', B],
        ['P_1', P],
        ['Q_1', Q],
      ] as const)
        b.call(n, 'apply', T, X);
    },
    required: ['A_1', 'B_1', 'P_1', 'Q_1'],
    check: (f) =>
      ['A_1', 'B_1', 'P_1', 'Q_1'].every((n) => f.get(n).kind === 'point') &&
      sameCrossRatio(f, ['A', 'B', 'P', 'Q'], ['A_1', 'B_1', 'P_1', 'Q_1']),
  },
  {
    name: 'send_to_infinity(l) keeps the cross ratio of four collinear points',
    modes: ALL,
    build: (b, [A, B, , D, E]) => {
      const T = b.call('T', 'send_to_infinity', call('line', [D, E]));
      const P = b.call('P', 'divide', A, B, num('3/4'));
      const Q = b.call('Q', 'harmonic_conjugate', A, B, P);
      for (const [n, X] of [
        ['A_1', A],
        ['B_1', B],
        ['P_1', P],
        ['Q_1', Q],
      ] as const)
        b.call(n, 'apply', T, X);
    },
    required: ['A_1', 'B_1', 'P_1', 'Q_1'],
    check: (f) =>
      ['A_1', 'B_1', 'P_1', 'Q_1'].every((n) => f.get(n).kind === 'point') &&
      harmonic(f, 'A', 'B', 'P', 'Q') &&
      harmonic(f, 'A_1', 'B_1', 'P_1', 'Q_1'),
  },
  {
    name: 'Desargues with AB ∥ A′B′: the axis through BC ∩ B′C′ and CA ∩ C′A′ is parallel to AB',
    modes: ALL,
    build: (b, [A, B, C, O]) => {
      const A2 = b.call('A_2', 'divide', O, A, num('1/3'));
      const B2 = b.call('B_2', 'divide', O, B, num('1/3'));
      const C2 = b.call('C_2', 'divide', O, C, num('-2/5'));
      b.call('X', 'intersect', call('line', [A, B]), call('line', [A2, B2]));
      b.call('Y', 'intersect', call('line', [B, C]), call('line', [B2, C2]));
      b.call('Z', 'intersect', call('line', [C, A]), call('line', [C2, A2]));
    },
    required: ['X', 'Y', 'Z'],
    check: (f) => onInfinityOf(f, 'X', 'Y', 'Z'),
  },
  {
    name: 'Pappus with P₁Q₂ ∥ P₂Q₁ and P₂Q₃ ∥ P₃Q₂: then P₁Q₃ ∥ P₃Q₁ (all three meets at infinity)',
    modes: ALL,
    build: (b, [A, B, C, D]) => {
      const P1 = b.call('P_1', 'divide', A, B, num('1/3'));
      const P2 = b.call('P_2', 'divide', A, B, num('3/2'));
      const P3 = b.call('P_3', 'divide', A, B, num('-1/2'));
      const Q2 = b.call('Q_2', 'divide', C, D, num('1/4'));
      const cd = call('line', [C, D]);
      const Q1 = b.call('Q_1', 'intersect', cd, call('parallel', [P2, call('line', [P1, Q2])]));
      const Q3 = b.call('Q_3', 'intersect', cd, call('parallel', [P2, call('line', [P3, Q2])]));
      b.call('X', 'intersect', call('line', [P1, Q2]), call('line', [P2, Q1]));
      b.call('Y', 'intersect', call('line', [P2, Q3]), call('line', [P3, Q2]));
      b.call('Z', 'intersect', call('line', [P1, Q3]), call('line', [P3, Q1]));
    },
    required: ['Q_1', 'Q_3', 'X', 'Y', 'Z'],
    check: (f) => isIdeal(f, 'X') && isIdeal(f, 'Y') && isIdeal(f, 'Z'),
  },
  {
    name: 'the complete quadrilateral: (A, C; P, X) = −1 for P = AC ∩ BD, X = AC ∩ EF',
    modes: ALL,
    build: (b, [A, B, C, D]) => {
      const E = b.call('E_1', 'intersect', call('line', [A, B]), call('line', [C, D]));
      const F = b.call('F_1', 'intersect', call('line', [A, D]), call('line', [B, C]));
      const P = b.call('P', 'intersect', call('line', [A, C]), call('line', [B, D]));
      b.call('X', 'intersect', call('line', [A, C]), call('line', [E, F]));
      b.call('X_h', 'harmonic_conjugate', A, C, P);
    },
    required: ['E_1', 'F_1', 'P', 'X', 'X_h'],
    check: (f) =>
      f.get('X').kind === 'point' && harmonic(f, 'A', 'C', 'P', 'X') && samePoints(f, 'X', 'X_h'),
  },
  {
    name: 'Brokard: the polar of P = AC ∩ BD is EF, and the centre is the orthocenter of PEF',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const w = b.call('w', 'circumcircle', A, B, C);
      const D = b.call('D_1', 'on', w, num(3), num(-2));
      const E = b.call('E_1', 'intersect', call('line', [A, B]), call('line', [C, D]));
      const F = b.call('F_1', 'intersect', call('line', [A, D]), call('line', [B, C]));
      const P = b.call('P', 'intersect', call('line', [A, C]), call('line', [B, D]));
      b.call('p', 'polar', P, w);
      b.call('H', 'orthocenter', P, E, F);
      b.call('O', 'center', w);
    },
    required: ['E_1', 'F_1', 'P', 'p', 'H'],
    check: (f) => onLine(f, 'E_1', 'p') && onLine(f, 'F_1', 'p') && samePoints(f, 'H', 'O'),
  },
  {
    name: 'the tangents at A and C meet on BD: (A, C; B, D) = −1, and the tangents at B and D meet on AC',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const w = b.call('w', 'circumcircle', A, B, C);
      const T = b.call('T', 'pole', call('line', [A, C]), w);
      const D = b.call('D_1', 'other', call('line', [T, B]), w, B);
      b.call('S', 'pole', call('line', [B, D]), w);
      b.call('l', 'line', A, C);
    },
    required: ['T', 'D_1', 'S'],
    check: (f) => harmonic(f, 'A', 'C', 'B', 'D_1') && onLine(f, 'S', 'l'),
  },
  {
    name: 'projecting a harmonic quadruple of a circle from a point of it onto a line keeps it harmonic',
    modes: ALL,
    build: (b, [A, B, C, , E, F]) => {
      const w = b.call('w', 'circumcircle', A, B, C);
      const T = b.call('T', 'pole', call('line', [A, C]), w);
      const D = b.call('D_1', 'other', call('line', [T, B]), w, B);
      const Q = b.call('Q', 'on', w, num(2), num(5));
      const m = call('line', [E, F]);
      for (const [n, X] of [
        ['A_2', A],
        ['B_2', B],
        ['C_2', C],
        ['D_2', D],
      ] as const)
        b.call(n, 'intersect', call('line', [Q, X]), m);
    },
    required: ['D_1', 'Q', 'A_2', 'B_2', 'C_2', 'D_2'],
    check: (f) =>
      ['A_2', 'B_2', 'C_2', 'D_2'].every((n) => f.get(n).kind === 'point') &&
      harmonic(f, 'A_2', 'C_2', 'B_2', 'D_2') &&
      collinear(f, asPoint(f.get('A_2')), asPoint(f.get('B_2')), asPoint(f.get('D_2'))),
  },
];

describe('projective theorems (Run 16a)', { timeout: LAW_TIMEOUT }, () => {
  theoremTests(THEOREMS, 1616);
});
