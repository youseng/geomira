/**
 * Conic theorems (Run 16b, ADR-0042), on random figures over FloatField and exactly over
 * RationalField (helpers/theorem-runner.ts). Classical facts only:
 *   - Pascal: the meets of opposite sides of a hexagon inscribed in a conic are collinear, on a
 *     conic and on a circle (where conic(…) of five points of the circle IS the circle);
 *   - Brianchon: the diagonals of a hexagon circumscribed about a conic are concurrent;
 *   - La Hire (pole–polar reciprocity): P on the polar of Q ⇔ Q on the polar of P, and
 *     pole(polar(Q)) = Q;
 *   - the conic through A, B, C, H (H the orthocenter) and a fifth point is a rectangular
 *     hyperbola (a + c = 0), and its centre lies on the nine-point circle;
 *   - conic_to_circle(k) sends k to a circle (a = c, b = 0) through the images of k's points,
 *     fixes k's known point, and keeps incidence and the cross ratio of four collinear points
 *     (exactly over Q); circle_to_centre(c, P)
 *     keeps c, sends P to the centre and keeps incidence and the cross ratio (floats: it needs a
 *     square root).
 */
import type { Field } from '@geomira/num/field';
import { describe } from 'vitest';
import { call, type Expr } from '../src/expr';
import { vSub } from '../src/geom';
import type { Vec } from '../src/value';
import { onLine } from './helpers/circle-properties';
import { asConic, onConic } from './helpers/conic-properties';
import { num } from './helpers/doc';
import { asPoint, samePoints, type Figure } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import { ALL, collinear, theoremTests, type Theorem } from './helpers/theorem-runner';

function cmul<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): Vec<T> {
  return { x: F.sub(F.mul(a.x, b.x), F.mul(a.y, b.y)), y: F.add(F.mul(a.x, b.y), F.mul(a.y, b.x)) };
}

function cdiv<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): Vec<T> {
  const n = F.add(F.mul(b.x, b.x), F.mul(b.y, b.y));
  return {
    x: F.div(F.add(F.mul(a.x, b.x), F.mul(a.y, b.y)), n),
    y: F.div(F.sub(F.mul(a.y, b.x), F.mul(a.x, b.y)), n),
  };
}

/** The complex cross ratio (C − A)(D − B) / ((C − B)(D − A)) of four named points. */
function crossRatio<T>(f: Figure<T>, names: readonly string[]): Vec<T> {
  const [a, b, c, d] = names.map((n) => asPoint(f.get(n)));
  if (a === undefined || b === undefined || c === undefined || d === undefined)
    throw new Error('four points');
  const F = f.F;
  return cdiv(F, cmul(F, vSub(F, c, a), vSub(F, d, b)), cmul(F, vSub(F, c, b), vSub(F, d, a)));
}

function sameCrossRatio<T>(f: Figure<T>, a: readonly string[], b: readonly string[]): boolean {
  const [p, q] = [crossRatio(f, a), crossRatio(f, b)];
  const F = f.F;
  return (
    F.isZero(F.sub(p.x, q.x), 'dimensionless', f.ctx) &&
    F.isZero(F.sub(p.y, q.y), 'dimensionless', f.ctx)
  );
}

const pt = <T>(f: Figure<T>, n: string): Vec<T> => asPoint(f.get(n));

/** A conic value is a circle: a = c and b = 0. */
function isCircle<T>(f: Figure<T>, k: string): boolean {
  const K = asConic<T>(f.get(k));
  return (
    f.F.isZero(f.F.sub(K.a, K.c), 'dimensionless', f.ctx) && f.F.isZero(K.b, 'dimensionless', f.ctx)
  );
}

/** Pascal's three meets X, Y, Z of the hexagon h₁…h₆ (by name). */
function pascal(b: Parameters<Theorem['build']>[0], h: readonly Expr[]): void {
  const [p1, p2, p3, p4, p5, p6] = h;
  if (p6 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) return;
  if (p4 === undefined || p5 === undefined) return;
  b.call('X', 'intersect', call('line', [p1, p2]), call('line', [p4, p5]));
  b.call('Y', 'intersect', call('line', [p2, p3]), call('line', [p5, p6]));
  b.call('Z', 'intersect', call('line', [p3, p4]), call('line', [p6, p1]));
}

const XYZ = (f: Figure<unknown>) => collinear(f, pt(f, 'X'), pt(f, 'Y'), pt(f, 'Z'));

const THEOREMS: readonly Theorem[] = [
  {
    name: 'Pascal on a conic: the meets of opposite sides of a hexagon on conic(A, B, C, D, E) are collinear',
    modes: ALL,
    build: (b, [A, B, C, D, E]) => {
      const k = b.call('k', 'conic', A, B, C, D, E);
      const P = b.call('P', 'on', k, num(2), num(-3));
      pascal(b, [A, B, C, D, E, P]);
    },
    required: ['k', 'P', 'X', 'Y', 'Z'],
    check: (f) => onConic(f, 'P', 'k') && XYZ(f),
  },
  {
    name: 'Pascal on a circle: conic(…) of five points of a circle is that circle, and Pascal holds',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const w = b.call('w', 'circumcircle', A, B, C);
      const D = b.call('D_1', 'on', w, num(3), num(1));
      const E = b.call('E_1', 'on', w, num(-1), num(4));
      const P = b.call('P', 'on', w, num(2), num(-5));
      b.call('k', 'conic', A, B, C, D, E);
      pascal(b, [A, B, C, D, E, P]);
    },
    required: ['k', 'P', 'X', 'Y', 'Z'],
    check: (f) => isCircle(f, 'k') && onConic(f, 'P', 'k') && XYZ(f),
  },
  {
    name: 'Brianchon: the diagonals of a hexagon circumscribed about a conic are concurrent',
    modes: ALL,
    build: (b, [A, B, C, D, E]) => {
      const k = b.call('k', 'conic', A, B, C, D, E);
      const P = b.call('P', 'on', k, num(2), num(-3));
      const t = [A, B, C, D, E, P].map((X, i) => b.call(`t_${String(i)}`, 'tangent', X, k));
      const V = t.map((l, i) => b.call(`V_${String(i)}`, 'intersect', l, t[(i + 1) % 6] ?? l));
      const [v0, v1, v2, v3, v4, v5] = V;
      if (v0 === undefined || v1 === undefined || v2 === undefined) return;
      if (v3 === undefined || v4 === undefined || v5 === undefined) return;
      b.call('M', 'intersect', call('line', [v0, v3]), call('line', [v1, v4]));
      b.call('d', 'line', v2, v5);
    },
    required: ['k', 'P', 'V_0', 'V_1', 'V_2', 'V_3', 'V_4', 'V_5', 'M', 'd'],
    check: (f) => onLine(f, 'M', 'd'),
  },
  {
    name: 'La Hire: P on the polar of F ⇒ F on the polar of P; pole(polar(F)) = F',
    modes: ALL,
    build: (b, [A, B, C, D, E, F]) => {
      const k = b.call('k', 'conic', A, B, C, D, E);
      const p = b.call('p', 'polar', F, k);
      const P = b.call('P', 'on', p, num('1/3'));
      b.call('q', 'polar', P, k);
      b.call('G', 'pole', p, k);
    },
    required: ['k', 'p', 'P', 'q', 'G'],
    check: (f) => onLine(f, 'F', 'q') && samePoints(f, 'G', 'F'),
  },
  {
    name: 'the conic through A, B, C, H and D is a rectangular hyperbola whose centre is on the nine-point circle',
    modes: ALL,
    build: (b, [A, B, C, D]) => {
      const H = b.call('H', 'orthocenter', A, B, C);
      const k = b.call('k', 'conic', A, B, C, H, D);
      b.call('K', 'conic_center', k);
      b.call('n', 'ninepoint_circle', A, B, C);
    },
    required: ['H', 'k', 'K', 'n'],
    check: <T>(f: Figure<T>) => {
      const K = asConic<T>(f.get('k'));
      const n = f.get('n');
      if (n.kind !== 'circle' || f.get('K').kind !== 'point') return false;
      const w = vSub(f.F, pt(f, 'K'), n.c);
      const gap = f.F.sub(f.F.add(f.F.mul(w.x, w.x), f.F.mul(w.y, w.y)), n.r2);
      return (
        f.F.isZero(f.F.add(K.a, K.c), 'dimensionless', f.ctx) && f.F.isZero(gap, 'area', f.ctx)
      );
    },
  },
  {
    name: 'conic_to_circle(k): k goes to a circle through the images, and four collinear points keep their cross ratio',
    // Exact only: in floats the image coefficients of a very eccentric conic lose accuracy (one
    // random figure in 200; STATUS.md, Known bugs); L3 compares floats with Q on its own figures.
    modes: ['rational'],
    build: (b, [A, B, C, D, E, F]) => {
      const k = b.call('k', 'conic', A, B, C, D, E);
      const g = b.call('g', 'conic_to_circle', k);
      b.call('k_1', 'apply', g, k);
      const P = b.call('P', 'divide', D, F, num('1/3'));
      const Q = b.call('Q', 'divide', D, F, num(-2));
      for (const [n, X] of [
        ['A_1', A],
        ['B_1', B],
        ['C_1', C],
        ['D_1', D],
        ['E_1', E],
        ['F_1', F],
        ['P_1', P],
        ['Q_1', Q],
      ] as const)
        b.call(n, 'apply', g, X);
    },
    required: ['k', 'g', 'k_1', 'A_1', 'B_1', 'C_1', 'D_1', 'E_1', 'F_1', 'P_1', 'Q_1'],
    check: (f) =>
      isCircle(f, 'k_1') &&
      ['A_1', 'B_1', 'C_1', 'D_1', 'E_1'].every((x) => onConic(f, x, 'k_1')) &&
      samePoints(f, 'A_1', 'A') &&
      collinear(f, pt(f, 'D_1'), pt(f, 'F_1'), pt(f, 'P_1')) &&
      sameCrossRatio(f, ['D', 'F', 'P', 'Q'], ['D_1', 'F_1', 'P_1', 'Q_1']),
  },
  {
    name: 'circle_to_centre(w, G): G goes to the centre, w to itself, four collinear points keep their cross ratio',
    modes: ['float'],
    build: (b, [A, B, C, D, E]) => {
      const w = b.call('w', 'circumcircle', A, B, C);
      const G = b.call('G', 'centroid', A, B, C);
      const t = b.call('t', 'circle_to_centre', w, G);
      b.call('O', 'center', w);
      const P = b.call('P', 'divide', D, E, num('1/3'));
      const Q = b.call('Q', 'divide', D, E, num(-2));
      for (const [n, X] of [
        ['G_1', G],
        ['A_1', A],
        ['D_1', D],
        ['E_1', E],
        ['P_1', P],
        ['Q_1', Q],
      ] as const)
        b.call(n, 'apply', t, X);
    },
    required: ['w', 't', 'G_1', 'A_1', 'D_1', 'E_1', 'P_1', 'Q_1'],
    check: (f) => {
      const w = f.get('w');
      if (w.kind !== 'circle') return false;
      const a = vSub(f.F, pt(f, 'A_1'), w.c);
      const gap = f.F.sub(f.F.add(f.F.mul(a.x, a.x), f.F.mul(a.y, a.y)), w.r2);
      return (
        samePoints(f, 'G_1', 'O') &&
        f.F.isZero(gap, 'area', f.ctx) &&
        collinear(f, pt(f, 'D_1'), pt(f, 'E_1'), pt(f, 'P_1')) &&
        sameCrossRatio(f, ['D', 'E', 'P', 'Q'], ['D_1', 'E_1', 'P_1', 'Q_1'])
      );
    },
  },
];

describe('conic theorems (Run 16b)', { timeout: LAW_TIMEOUT }, () => {
  theoremTests(THEOREMS, 1617);
});
