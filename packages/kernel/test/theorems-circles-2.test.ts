/**
 * Circle theorems (Run 3a, item 3), part 2. The side-length tools (incenter, excenter,
 * incircle, excircle, bisectors) run over FloatField and exactly over RationalField on
 * Heronian triangles (rational side lengths, helpers/theorem-runner.ts):
 *   - other() consistency (line–circle and circle–circle) and tangency → the double point;
 *   - the radical axis of two intersecting circles passes through both common points;
 *   - the incenter–excenter lemma;  - Feuerbach: |NI| = R/2 − r and |NI_A| = R/2 + r_A;
 *   - Euler: OI² = R² − 2Rr;  - the incircle and excircle touch the side lines;
 *   - the excenter lies on one internal and two external bisectors;
 *   - the angle bisector theorem.
 */
import type { Field } from '@geomira/num/field';
import { describe } from 'vitest';
import { call } from '../src/expr';
import { vCross, vDot, vSub } from '../src/geom';
import type { Vec } from '../src/value';
import { asCircle, asLine, onCircle, onLine, perpendicular } from './helpers/circle-properties';
import { num } from './helpers/doc';
import { asPoint, samePoints, type Figure } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import {
  ALL,
  FIGURES,
  SIDES,
  d2,
  nearPoints,
  root,
  sameSize,
  theoremTests,
  type Theorem,
} from './helpers/theorem-runner';

/** The squared distance from P to the carrier line of l equals r2 of circle c. */
function touches<T>(f: Figure<T>, P: Vec<T>, l: string, c: string): boolean {
  const { F } = f;
  const L = asLine(f.get(l));
  const cross = vCross(F, vSub(F, P, L.p), L.d);
  const lhs = F.div(F.mul(cross, cross), vDot(F, L.d, L.d));
  return sameSize(f, lhs, asCircle(f.get(c)).r2);
}

/** The radius √r2 of circle `c` (rational on Heronian triangles). */
function radius<T>(f: Figure<T>, c: string): T {
  return root(f.F, asCircle(f.get(c)).r2);
}

function sameD2<T>(_F: Field<T>, f: Figure<T>, x: T, y: T): boolean {
  return sameSize(f, x, y);
}

const SIDE_LINES = (
  b: Parameters<Theorem['build']>[0],
  [A, B, C]: Parameters<Theorem['build']>[1],
) => {
  b.call('l_a', 'line', B, C);
  b.call('l_b', 'line', C, A);
  b.call('l_c', 'line', A, B);
};

const THEOREMS: readonly Theorem[] = [
  {
    name: 'other() consistency: X on a line and a circle → other(l, c, X) on both; two circles likewise; both are involutions',
    modes: ALL,
    build: (b, [A, B, C, D]) => {
      const c = b.call('c', 'circle', A, B, C);
      const X = b.call('X', 'on', c, num(2), num(7));
      const l = b.call('l', 'line', X, D);
      const Y = b.call('Y', 'other', l, c, X);
      b.call('X_2', 'other', l, c, Y);
      const k = b.call('k', 'circle', D, X);
      const Z = b.call('Z', 'other', c, k, X);
      b.call('X_3', 'other', k, c, Z);
    },
    required: ['Y', 'Z', 'X_2', 'X_3'],
    check: (f) =>
      onCircle(f, 'Y', 'c') &&
      onLine(f, 'Y', 'l') &&
      onCircle(f, 'Z', 'c') &&
      onCircle(f, 'Z', 'k') &&
      samePoints(f, 'X_2', 'X') &&
      samePoints(f, 'X_3', 'X'),
  },
  {
    name: 'tangency: tangent(P, c) ⟂ OP and other(tangent(P, c), c, P) = P (the double point)',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const c = b.call('c', 'circle', A, B, C);
      const P = b.call('P', 'on', c, num(-4), num(9));
      const t = b.call('t', 'tangent', P, c);
      b.call('Q', 'other', t, c, P);
    },
    required: ['Q'],
    check: (f) => {
      const radius = vSub(f.F, asPoint(f.get('P')), asCircle(f.get('c')).c);
      return samePoints(f, 'Q', 'P') && perpendicular(f, asLine(f.get('t')).d, radius);
    },
  },
  {
    name: 'the radical axis of two intersecting circles passes through both common points',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const [c1, c2] = [b.call('c_1', 'circle', A, C), b.call('c_2', 'circle', B, C)];
      b.call('r', 'radical_axis', c1, c2);
      b.call('Q', 'other', c1, c2, C);
    },
    required: ['r', 'Q'],
    check: (f) => onLine(f, 'C', 'r') && onLine(f, 'Q', 'r'),
  },
  {
    name: 'incenter–excenter lemma: M = AI ∩ circumcircle is equidistant from B, C, I, I_A and is the midpoint of I I_A',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      const I = b.call('I', 'incenter', A, B, C);
      b.call('J', 'excenter', A, B, C);
      b.call('M', 'other', call('line', [A, I]), call('circumcircle', [A, B, C]), A);
      b.call('M_2', 'midpoint', I, b.ref('J'));
    },
    required: ['M'],
    check: (f) => {
      const { F } = f;
      const M = asPoint(f.get('M'));
      const r = d2(F, M, asPoint(f.get('B')));
      return (
        ['C', 'I', 'J'].every((p) => sameD2(F, f, d2(F, M, asPoint(f.get(p))), r)) &&
        nearPoints(f, M, asPoint(f.get('M_2')))
      );
    },
  },
  {
    name: 'Feuerbach: |NI| = R/2 − r and |NI_A| = R/2 + r_A',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      b.call('N', 'center', call('ninepoint_circle', [A, B, C]));
      b.call('o', 'circumcircle', A, B, C);
      b.call('i', 'incircle', A, B, C);
      b.call('e', 'excircle', A, B, C);
    },
    required: ['N', 'i'],
    check: (f) => {
      const { F } = f;
      const N = asPoint(f.get('N'));
      const halfR = F.div(radius(f, 'o'), F.add(F.one, F.one));
      const inner = F.sub(halfR, radius(f, 'i'));
      const outer = F.add(halfR, radius(f, 'e'));
      return (
        sameD2(F, f, d2(F, N, asCircle(f.get('i')).c), F.mul(inner, inner)) &&
        sameD2(F, f, d2(F, N, asCircle(f.get('e')).c), F.mul(outer, outer))
      );
    },
  },
  {
    name: 'Euler: OI² = R² − 2Rr',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      b.call('o', 'circumcircle', A, B, C);
      b.call('i', 'incircle', A, B, C);
    },
    required: ['i'],
    check: (f) => {
      const { F } = f;
      const [o, i] = [asCircle(f.get('o')), asCircle(f.get('i'))];
      const rhs = F.sub(o.r2, F.mul(F.add(F.one, F.one), F.mul(radius(f, 'o'), radius(f, 'i'))));
      return sameD2(F, f, d2(F, o.c, i.c), rhs);
    },
  },
  {
    name: 'the incircle and the excircle opposite A touch the three side lines, at their anchors on BC',
    modes: SIDES,
    build: (b, p) => {
      SIDE_LINES(b, p);
      const [A, B, C] = p;
      b.call('i', 'incircle', A, B, C);
      b.call('e', 'excircle', A, B, C);
    },
    required: ['i', 'e'],
    check: (f) =>
      ['i', 'e'].every((c) => {
        const k = asCircle(f.get(c));
        const T = k.anchor;
        return (
          T !== undefined &&
          ['l_a', 'l_b', 'l_c'].every((l) => touches(f, k.c, l, c)) &&
          sameSize(f, d2(f.F, T, k.c), k.r2) &&
          f.F.isZero(
            vCross(f.F, vSub(f.F, T, asLine(f.get('l_a')).p), asLine(f.get('l_a')).d),
            'area',
            f.ctx,
          )
        );
      }),
  },
  {
    name: 'the excenter opposite A lies on the internal bisector at A and the external bisectors at B and C',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      b.call('J', 'excenter', A, B, C);
      b.call('b_a', 'bisector', B, A, C);
      b.call('e_b', 'ext_bisector', A, B, C);
      b.call('e_c', 'ext_bisector', A, C, B);
      b.call('I', 'intersect', b.ref('b_a'), call('bisector', [A, B, C]));
      b.call('I_2', 'incenter', A, B, C);
    },
    required: ['J', 'I'],
    check: (f) =>
      ['b_a', 'e_b', 'e_c'].every((l) => onLine(f, 'J', l)) && samePoints(f, 'I', 'I_2'),
  },
  {
    name: 'the angle bisector theorem: the bisector at A meets BC at D with BD/DC = AB/AC',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      b.call('D_1', 'intersect', call('bisector', [B, A, C]), call('line', [B, C]));
    },
    required: ['D_1'],
    check: (f) => {
      const { F } = f;
      const [A, B, C, D] = ['A', 'B', 'C', 'D_1'].map((n) => asPoint(f.get(n)));
      if (A === undefined || B === undefined || C === undefined || D === undefined) return false;
      const lhs = F.div(d2(F, B, D), d2(F, D, C));
      const rhs = F.div(d2(F, A, B), d2(F, A, C));
      return F.isZero(F.sub(lhs, rhs), 'dimensionless', f.ctx);
    },
  },
];

describe(
  `circle theorems on ${String(FIGURES)} random figures (part 2)`,
  { timeout: LAW_TIMEOUT },
  () => {
    theoremTests(THEOREMS, 3032);
  },
);
