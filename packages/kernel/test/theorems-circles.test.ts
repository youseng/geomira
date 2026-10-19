/**
 * Circle theorems (Run 3a, item 3), part 1, on random figures over FloatField and exactly
 * over RationalField where the construction is exact (helpers/theorem-runner.ts):
 *   - the nine-point circle passes through nine points;
 *   - the reflections of H in BC and in the midpoint of BC lie on the circumcircle;
 *   - the Simson line;  - Miquel's theorem;  - the radical axes of three circles concur;
 *   - the power of a point;  - polar reciprocity.
 */
import { describe } from 'vitest';
import { call } from '../src/expr';
import { vDot, vSub } from '../src/geom';
import { asCircle, asLine, onCircle, onLine, power } from './helpers/circle-properties';
import { num } from './helpers/doc';
import { asPoint } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import { ALL, FIGURES, collinear, theoremTests, type Theorem } from './helpers/theorem-runner';

const THEOREMS: readonly Theorem[] = [
  {
    name: 'the nine-point circle passes through the midpoints, the feet of the altitudes and the midpoints of AH, BH, CH',
    modes: ALL,
    build: (b, [A, B, C]) => {
      b.call('n', 'ninepoint_circle', A, B, C);
      const H = b.call('H', 'orthocenter', A, B, C);
      b.call('X_1', 'midpoint', A, B);
      b.call('X_2', 'midpoint', B, C);
      b.call('X_3', 'midpoint', C, A);
      b.call('X_4', 'foot', A, B, C);
      b.call('X_5', 'foot', B, C, A);
      b.call('X_6', 'foot', C, A, B);
      b.call('X_7', 'midpoint', A, H);
      b.call('X_8', 'midpoint', B, H);
      b.call('X_9', 'midpoint', C, H);
    },
    required: ['n'],
    check: (f) => [1, 2, 3, 4, 5, 6, 7, 8, 9].every((i) => onCircle(f, `X_${String(i)}`, 'n')),
  },
  {
    name: 'the reflections of H in BC and in the midpoint of BC lie on the circumcircle (the latter opposite A)',
    modes: ALL,
    build: (b, [A, B, C]) => {
      b.call('c', 'circumcircle', A, B, C);
      const H = b.call('H', 'orthocenter', A, B, C);
      b.call('H_a', 'divide', H, call('foot', [H, B, C]), num(2));
      b.call('H_m', 'divide', H, call('midpoint', [B, C]), num(2));
      b.call('A_2', 'divide', A, call('center', [b.ref('c')]), num(2));
    },
    required: ['c'],
    check: (f) => {
      const [hm, a2] = [asPoint(f.get('H_m')), asPoint(f.get('A_2'))];
      const same =
        f.F.isZero(f.F.sub(hm.x, a2.x), 'length', f.ctx) &&
        f.F.isZero(f.F.sub(hm.y, a2.y), 'length', f.ctx);
      return onCircle(f, 'H_a', 'c') && onCircle(f, 'H_m', 'c') && same;
    },
  },
  {
    name: 'Simson: the feet of P on the circumcircle on the three side lines are collinear',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const P = b.call('P', 'on', call('circumcircle', [A, B, C]), num(3), num(-2));
      b.call('F_a', 'foot', P, B, C);
      b.call('F_b', 'foot', P, C, A);
      b.call('F_c', 'foot', P, A, B);
    },
    required: ['P'],
    check: (f) => collinear(f, asPoint(f.get('F_a')), asPoint(f.get('F_b')), asPoint(f.get('F_c'))),
  },
  {
    name: 'Miquel: for D, E, F on BC, CA, AB the circles AEF, BFD, CDE share a point',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const D = b.call('D_1', 'divide', B, C, num('1/3'));
      const E = b.call('E_1', 'divide', C, A, num('3/5'));
      const F = b.call('F_1', 'divide', A, B, num('-1/4'));
      b.call('M', 'other', call('circle', [A, E, F]), call('circle', [B, F, D]), F);
      b.call('k', 'circle', C, D, E);
    },
    required: ['M', 'k'],
    check: (f) => onCircle(f, 'M', 'k'),
  },
  {
    name: 'the three radical axes of three circles are concurrent',
    modes: ALL,
    build: (b, [A, B, C, D, E, F]) => {
      const [c1, c2, c3] = [call('circle', [A, B]), call('circle', [C, D]), call('circle', [E, F])];
      const l = b.call('l', 'radical_axis', c1, c2);
      const m = b.call('m', 'radical_axis', c2, c3);
      b.call('n', 'radical_axis', c3, c1);
      b.call('X', 'intersect', l, m);
    },
    required: ['X', 'n'],
    check: (f) => onLine(f, 'X', 'n'),
  },
  {
    name: 'the power of a point: PX·PY is the same for every line through P meeting c at X, Y',
    modes: ALL,
    build: (b, [A, B, C, D]) => {
      const c = b.call('c', 'circle', A, B, C);
      for (const [i, u, v] of [
        [1, 3, -2],
        [2, -1, 5],
      ] as const) {
        const X = b.call(`X_${String(i)}`, 'on', c, num(u), num(v));
        b.call(`Y_${String(i)}`, 'other', call('line', [D, X]), c, X);
      }
    },
    required: ['c', 'Y_1', 'Y_2'],
    check: (f) => {
      const { F } = f;
      const P = asPoint(f.get('D'));
      const pw = power(F, P, asCircle(f.get('c')));
      return [1, 2].every((i) => {
        const [X, Y] = [asPoint(f.get(`X_${String(i)}`)), asPoint(f.get(`Y_${String(i)}`))];
        return F.isZero(F.sub(vDot(F, vSub(F, X, P), vSub(F, Y, P)), pw), 'area', f.ctx);
      });
    },
  },
  {
    name: 'polar reciprocity: Q on the polar of P ⟺ P on the polar of Q',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const c = b.call('c', 'circle', A, B);
      const Q = b.call('Q', 'on', call('polar', [C, c]), num('-7/3'));
      b.call('q', 'polar', Q, c);
    },
    required: ['q'],
    check: (f) => onLine(f, 'C', 'q') && asLine(f.get('q')).chiral,
  },
];

describe(
  `circle theorems on ${String(FIGURES)} random figures (part 1)`,
  { timeout: LAW_TIMEOUT },
  () => {
    theoremTests(THEOREMS, 3031);
  },
);
