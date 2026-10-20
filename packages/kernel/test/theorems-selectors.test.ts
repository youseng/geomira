/**
 * Theorems that need branch selection (Run 3b, ≥ 10 asked), on 200 random figures each,
 * over FloatField and, where the construction is exact (other(P) is Vieta; touch points of
 * tangents from a point on a tangent are rational; arc midpoints of a Heronian triangle's
 * circumcircle are rational), exactly over RationalField:
 *   1. the incenter–excenter lemma with M = intersect(line(A, I), Γ, other(A));
 *   2. the bisector at A, the perpendicular bisector of BC (on_arc(B, C, not A), and
 *      opposite_side(A, BC)) meet Γ at the same arc midpoint;
 *   3. the antipode intersect(line(A, O), Γ, far_from(A)) is 2O − A and the reflection of H
 *      in the midpoint of BC;
 *   4. Thales: X = intersect(line(A, D), diameter_circle(A, B), other(A)) sees AB at 90°;
 *   5. equal tangents: the touch points B and tangent_point(P, c, other(B)) from a point P of
 *      the tangent at B; OT ⟂ PT; one of the orient(±) choices;
 *   6. tangent–secant: (X − P)·(Y − P) = PB² = power(P, c) for X, Y = along(±);
 *   7. the chord of contact is the polar; tangent_from passes through P and touches at T;
 *   8. the common chord of two circles (orient(±)) is perpendicular to the line of centres
 *      and lies on the radical axis;
 *   9. intersecting chords: (X₊ − P)·(X₋ − P) = (Y₊ − P)·(Y₋ − P) = power(P, c);
 *  10. the butterfly theorem;
 *  11. Reim's theorem;
 *  12. tangent lengths from A: s − a to the incircle, s to the excircle opposite A;
 *  13. (tangency without a selector) intersect(line(B, C), incircle) is the double point,
 *      the touch point, and the excircle's touch point is its mirror image in the midpoint
 *      of BC.
 */
import { describe } from 'vitest';
import { call, type Expr, type Selector } from '../src/expr';
import { vAdd, vCross, vDot, vSub } from '../src/geom';
import type { Vec } from '../src/value';
import { asLine, onCircle, onLine } from './helpers/circle-properties';
import { num } from './helpers/doc';
import { asNum, asPoint, type Figure } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import {
  ALL,
  FIGURES,
  SIDES,
  d2,
  nearPoints,
  sameSize,
  theoremTests,
  type Theorem,
} from './helpers/theorem-runner';

const other = (p: Expr): Selector => ({ kind: 'other', p });
const along = (sign: 1 | -1): Selector => ({ kind: 'along', sign });
const orient = (sign: 1 | -1): Selector => ({ kind: 'orient', sign });

const pts = <T>(f: Figure<T>, ...names: string[]): Vec<T>[] => names.map((n) => asPoint(f.get(n)));
const same = <T>(f: Figure<T>, a: string, b: string): boolean => {
  const [p, q] = pts(f, a, b);
  return p !== undefined && q !== undefined && nearPoints(f, p, q);
};
const dot = <T>(f: Figure<T>, a: Vec<T>, b: Vec<T>, c: Vec<T>): T =>
  vDot(f.F, vSub(f.F, a, c), vSub(f.F, b, c));
const zeroArea = <T>(f: Figure<T>, x: T): boolean => sameSize(f, x, f.F.zero);

/** P on the tangent at B to c = circle(A, B), from line(C, D): B is a touch point from P. */
function tangentPoint(b: Parameters<Theorem['build']>[0], [A, B, C, D]: readonly Expr[]): void {
  if (A === undefined || B === undefined || C === undefined || D === undefined) return;
  b.call('c', 'circle', A, B);
  b.add('P', call('intersect', [call('tangent', [B, b.ref('c')]), call('line', [C, D])]));
}

const THEOREMS: readonly Theorem[] = [
  {
    name: 'the incenter–excenter lemma with other(A)',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      b.call('Γ', 'circumcircle', A, B, C);
      b.call('I', 'incenter', A, B, C);
      b.call('J', 'excenter', A, B, C);
      b.add('M', call('intersect', [call('line', [A, b.ref('I')]), b.ref('Γ')], [other(A)]));
    },
    required: ['M', 'J'],
    check: (f) => {
      const [M, B, C, I, J] = pts(f, 'M', 'B', 'C', 'I', 'J');
      if (!M || !B || !C || !I || !J) return false;
      const m = d2(f.F, M, B);
      return [C, I, J].every((X) => sameSize(f, d2(f.F, M, X), m));
    },
  },
  {
    name: 'the arc midpoint: bisector ∩ Γ (other(A)) = perp_bisector ∩ Γ (on_arc(B, C, not A), opposite_side(A, BC))',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      b.call('Γ', 'circumcircle', A, B, C);
      b.add('M', call('intersect', [call('bisector', [B, A, C]), b.ref('Γ')], [other(A)]));
      const pb = b.call('m', 'perp_bisector', B, C);
      b.add(
        'M_1',
        call('intersect', [pb, b.ref('Γ')], [{ kind: 'on_arc', b: B, c: C, a: A, not: true }]),
      );
      b.add(
        'M_2',
        call(
          'intersect',
          [pb, b.ref('Γ')],
          [{ kind: 'opposite_side', q: A, l: call('line', [B, C]) }],
        ),
      );
    },
    required: ['M', 'M_1', 'M_2'],
    check: (f) => same(f, 'M', 'M_1') && same(f, 'M', 'M_2'),
  },
  {
    name: 'the antipode intersect(line(A, O), Γ, far_from(A)) = 2O − A = the reflection of H in the midpoint of BC',
    modes: ALL,
    build: (b, [A, B, C]) => {
      b.call('O', 'circumcenter', A, B, C);
      b.call('Γ', 'circumcircle', A, B, C);
      b.add(
        'A_2',
        call(
          'intersect',
          [call('line', [A, b.ref('O')]), b.ref('Γ')],
          [{ kind: 'far_from', p: A }],
        ),
      );
      b.add('A_3', call('divide', [A, b.ref('O'), num(2)]));
      b.add(
        'A_4',
        call('divide', [call('orthocenter', [A, B, C]), call('midpoint', [B, C]), num(2)]),
      );
    },
    required: ['A_2'],
    check: (f) => same(f, 'A_2', 'A_3') && same(f, 'A_2', 'A_4'),
  },
  {
    name: 'Thales: X = intersect(line(A, D), diameter_circle(A, B), other(A)) sees AB at a right angle',
    modes: ALL,
    build: (b, [A, B, , D]) => {
      b.add(
        'X',
        call('intersect', [call('line', [A, D]), call('diameter_circle', [A, B])], [other(A)]),
      );
    },
    required: ['X'],
    check: (f) => {
      const [X, A, B] = pts(f, 'X', 'A', 'B');
      return X !== undefined && A !== undefined && B !== undefined && zeroArea(f, dot(f, A, B, X));
    },
  },
  {
    name: 'equal tangents: B and tangent_point(P, c, other(B)); OT ⟂ PT; one of the orient(±) choices',
    modes: ALL,
    build: (b, p) => {
      tangentPoint(b, p);
      b.add('T', call('tangent_point', [b.ref('P'), b.ref('c')], [other(p[1])]));
      b.add('T_1', call('tangent_point', [b.ref('P'), b.ref('c')], [orient(1)]));
      b.add('T_2', call('tangent_point', [b.ref('P'), b.ref('c')], [orient(-1)]));
    },
    required: ['T', 'T_1', 'T_2'],
    check: (f) => {
      const [T, P, B, A] = pts(f, 'T', 'P', 'B', 'A');
      if (!T || !P || !B || !A) return false;
      return (
        onCircle(f, 'T', 'c') &&
        sameSize(f, d2(f.F, P, T), d2(f.F, P, B)) &&
        zeroArea(f, dot(f, A, P, T)) &&
        same(f, 'T', 'T_1') !== same(f, 'T', 'T_2')
      );
    },
  },
  {
    name: 'tangent–secant: (X − P)·(Y − P) = PB² = power(P, c) for X, Y = along(±)',
    modes: ['float'],
    build: (b, p) => {
      tangentPoint(b, p);
      const s = call('line', [b.ref('P'), call('midpoint', [p[0], p[1]])]);
      b.add('X', call('intersect', [s, b.ref('c')], [along(1)]));
      b.add('Y', call('intersect', [s, b.ref('c')], [along(-1)]));
      b.call('w', 'power', b.ref('P'), b.ref('c'));
    },
    required: ['X', 'Y'],
    check: (f) => {
      const [X, Y, P, B] = pts(f, 'X', 'Y', 'P', 'B');
      if (!X || !Y || !P || !B) return false;
      const xy = dot(f, X, Y, P);
      return sameSize(f, xy, d2(f.F, P, B)) && sameSize(f, xy, asNum(f.get('w')));
    },
  },
  {
    name: 'the chord of contact is the polar; tangent_from(P, c, orient(±)) passes through P and touches c at T±',
    modes: ALL,
    build: (b, p) => {
      tangentPoint(b, p);
      for (const [k, s] of [
        ['1', 1],
        ['2', -1],
      ] as const) {
        b.add(`T_${k}`, call('tangent_point', [b.ref('P'), b.ref('c')], [orient(s)]));
        b.add(`t_${k}`, call('tangent_from', [b.ref('P'), b.ref('c')], [orient(s)]));
      }
      b.call('q', 'polar', b.ref('P'), b.ref('c'));
    },
    required: ['T_1', 'T_2', 't_1', 't_2'],
    check: (f) => {
      const A = asPoint(f.get('A'));
      return ['1', '2'].every((k) => {
        const [T, l] = [asPoint(f.get(`T_${k}`)), asLine(f.get(`t_${k}`))];
        return (
          onLine(f, `T_${k}`, 'q') &&
          onLine(f, 'P', `t_${k}`) &&
          nearPoints(f, l.p, T) &&
          zeroArea(f, vDot(f.F, l.d, vSub(f.F, T, A)))
        );
      });
    },
  },
  {
    name: 'the common chord (orient(±)) is perpendicular to the line of centres and lies on the radical axis',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const [c1, c2] = [b.call('c_1', 'circle', A, B), b.call('c_2', 'circle', C, B)];
      b.add('X_1', call('intersect', [c1, c2], [orient(1)]));
      b.add('X_2', call('intersect', [c1, c2], [orient(-1)]));
      b.call('r', 'radical_axis', c1, c2);
    },
    required: ['X_1', 'X_2'],
    check: (f) => {
      const [X1, X2, A, C] = pts(f, 'X_1', 'X_2', 'A', 'C');
      if (!X1 || !X2 || !A || !C) return false;
      const AC = vSub(f.F, C, A);
      return (
        zeroArea(f, vDot(f.F, vSub(f.F, X1, X2), AC)) &&
        onLine(f, 'X_1', 'r') &&
        onLine(f, 'X_2', 'r') &&
        f.F.sign(vCross(f.F, AC, vSub(f.F, X1, A)), 'area', f.ctx) === 1
      );
    },
  },
  {
    name: 'intersecting chords: (X₊ − P)·(X₋ − P) = (Y₊ − P)·(Y₋ − P) = power(P, c)',
    modes: ['float'],
    build: (b, [A, B, C, D]) => {
      b.call('c', 'circle', A, B);
      const P = b.call('P', 'divide', A, B, num('1/3'));
      for (const [n, Q] of [
        ['X', C],
        ['Y', D],
      ] as const) {
        b.add(`${n}_1`, call('intersect', [call('line', [P, Q]), b.ref('c')], [along(1)]));
        b.add(`${n}_2`, call('intersect', [call('line', [P, Q]), b.ref('c')], [along(-1)]));
      }
      b.call('w', 'power', P, b.ref('c'));
    },
    required: ['X_1', 'X_2', 'Y_1', 'Y_2'],
    check: (f) => {
      const [X1, X2, Y1, Y2, P] = pts(f, 'X_1', 'X_2', 'Y_1', 'Y_2', 'P');
      if (!X1 || !X2 || !Y1 || !Y2 || !P) return false;
      const w = asNum(f.get('w'));
      return sameSize(f, dot(f, X1, X2, P), w) && sameSize(f, dot(f, Y1, Y2, P), w);
    },
  },
  {
    name: 'the butterfly theorem: M is the midpoint of XY',
    modes: ['float'],
    build: (b, [A, B, C, D]) => {
      b.call('c', 'circle', A, B);
      const M = b.call('M', 'divide', A, B, num('1/3'));
      const pq = b.call('m', 'perp', M, call('line', [A, B]));
      for (const [n, Q] of [
        ['K', C],
        ['L', D],
      ] as const) {
        b.add(`${n}_1`, call('intersect', [call('line', [M, Q]), b.ref('c')], [along(1)]));
        b.add(`${n}_2`, call('intersect', [call('line', [M, Q]), b.ref('c')], [along(-1)]));
      }
      b.add('X', call('intersect', [call('line', [b.ref('K_1'), b.ref('L_1')]), pq]));
      b.add('Y', call('intersect', [call('line', [b.ref('K_2'), b.ref('L_2')]), pq]));
    },
    required: ['X', 'Y'],
    check: (f) => {
      const [X, Y, M] = pts(f, 'X', 'Y', 'M');
      return (
        X !== undefined &&
        Y !== undefined &&
        M !== undefined &&
        nearPoints(f, vAdd(f.F, X, Y), vAdd(f.F, M, M))
      );
    },
  },
  {
    name: "Reim's theorem: KK′ ∥ LL′",
    modes: ALL,
    build: (b, [A, B, C, D, E]) => {
      const [c1, c2] = [b.call('c_1', 'circle', A, B), b.call('c_2', 'circle', C, B)];
      const X = b.add('X', call('intersect', [c1, c2], [other(B)]));
      const [l, m] = [call('line', [B, D]), call('line', [X, E])];
      b.add('K', call('intersect', [l, c1], [other(B)]));
      b.add('L', call('intersect', [l, c2], [other(B)]));
      b.add("K'", call('intersect', [m, c1], [other(X)]));
      b.add("L'", call('intersect', [m, c2], [other(X)]));
    },
    required: ['K', 'L', "K'", "L'"],
    check: (f) => {
      const [K, L, K2, L2] = pts(f, 'K', 'L', "K'", "L'");
      return (
        K !== undefined &&
        L !== undefined &&
        K2 !== undefined &&
        L2 !== undefined &&
        zeroArea(f, vCross(f.F, vSub(f.F, K2, K), vSub(f.F, L2, L)))
      );
    },
  },
  {
    name: 'tangent lengths from A: s − a to the incircle, s to the excircle opposite A, touching the lines AB and AC',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      b.call('ω', 'incircle', A, B, C);
      b.call('Ω', 'excircle', A, B, C);
      for (const [n, c] of [
        ['T', 'ω'],
        ['U', 'Ω'],
      ] as const) {
        b.add(`${n}_1`, call('tangent_point', [A, b.ref(c)], [orient(1)]));
        b.add(`${n}_2`, call('tangent_point', [A, b.ref(c)], [orient(-1)]));
      }
      b.call('a', 'dist', B, C);
      b.call('b_1', 'dist', C, A);
      b.call('c_1', 'dist', A, B);
      b.call('l_b', 'line', A, C);
      b.call('l_c', 'line', A, B);
    },
    required: ['T_1', 'T_2', 'U_1', 'U_2'],
    check: (f) => {
      const { F } = f;
      const [a, b, c] = [asNum(f.get('a')), asNum(f.get('b_1')), asNum(f.get('c_1'))];
      const s = F.div(F.add(F.add(a, b), c), F.add(F.one, F.one));
      const A = asPoint(f.get('A'));
      const len = (x: string, t: unknown): boolean => {
        const T = asPoint(f.get(x));
        const want = t === 'in' ? F.sub(s, a) : s;
        return (
          sameSize(f, d2(F, A, T), F.mul(want, want)) &&
          (onLine(f, x, 'l_b') || onLine(f, x, 'l_c'))
        );
      };
      return len('T_1', 'in') && len('T_2', 'in') && len('U_1', 'ex') && len('U_2', 'ex');
    },
  },
  {
    name: 'intersect(line(B, C), incircle) with no selector is the double point (the touch point); the excircle touch point is its mirror in the midpoint of BC',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      b.call('l', 'line', B, C);
      b.add('K', call('intersect', [b.ref('l'), call('incircle', [A, B, C])]));
      b.add('K_1', call('intersect', [b.ref('l'), call('excircle', [A, B, C])]));
      b.add('K_2', call('foot', [call('incenter', [A, B, C]), b.ref('l')]));
    },
    required: ['K', 'K_1'],
    check: (f) => {
      const [D, D1, B, C] = pts(f, 'K', 'K_1', 'B', 'C');
      return (
        D !== undefined &&
        D1 !== undefined &&
        B !== undefined &&
        C !== undefined &&
        same(f, 'K', 'K_2') &&
        nearPoints(f, vAdd(f.F, D, D1), vAdd(f.F, B, C))
      );
    },
  },
];

describe(
  `theorems with selectors (${String(FIGURES)} figures each)`,
  { timeout: LAW_TIMEOUT },
  () => {
    theoremTests(THEOREMS, 9090);
  },
);
