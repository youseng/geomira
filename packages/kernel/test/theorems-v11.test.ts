/**
 * Theorems that use the v1.1 tools (Run 13, ADR-0031), on random figures over FloatField and
 * exactly over RationalField (helpers/theorem-runner.ts; ill-conditioned float figures are
 * skipped and counted):
 *   - the isogonal conjugate of the orthocenter is the circumcenter, of the incenter itself;
 *   - the tangents to the circumcircle at B and C meet on the A-symmedian, at the pole of BC;
 *   - the center of the spiral similarity taking AB to CD lies on the circles ABX and CDX,
 *     X = AC ∩ BD;
 *   - the radical center of the circles on the diameters AB, BC, CA is the orthocenter;
 *   - the midpoint of the arc BAC lies on the external bisector at A (the arc's range
 *     chooses it among the two points of the perpendicular bisector of BC on the circle).
 */
import { describe } from 'vitest';
import { call } from '../src/expr';
import { onCircle, onLine } from './helpers/circle-properties';
import { samePoints } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import { ALL, SIDES, theoremTests, type Theorem } from './helpers/theorem-runner';

const THEOREMS: readonly Theorem[] = [
  {
    name: 'isogonal(orthocenter) is the circumcenter',
    modes: ALL,
    build: (b, [A, B, C]) => {
      b.call('X', 'isogonal', call('orthocenter', [A, B, C]), A, B, C);
      b.call('O', 'circumcenter', A, B, C);
    },
    required: ['X', 'O'],
    check: (f) => samePoints(f, 'X', 'O'),
  },
  {
    name: 'isogonal(incenter) is the incenter',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      const I = b.call('I', 'incenter', A, B, C);
      b.call('X', 'isogonal', I, A, B, C);
    },
    required: ['I', 'X'],
    check: (f) => samePoints(f, 'X', 'I'),
  },
  {
    name: 'the tangents at B and C meet on the A-symmedian, at the pole of BC',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const c = b.call('c', 'circumcircle', A, B, C);
      b.call('T', 'intersect', call('tangent', [B, c]), call('tangent', [C, c]));
      b.call('s', 'symmedian', A, B, C);
      b.call('P', 'pole', call('line', [B, C]), c);
    },
    required: ['T', 's'],
    check: (f) => onLine(f, 'T', 's') && samePoints(f, 'T', 'P'),
  },
  {
    name: 'spiral_center(A, B, C, D) lies on the circles ABX and CDX, X = AC ∩ BD',
    modes: ALL,
    build: (b, [A, B, C, D]) => {
      const X = b.call('X', 'intersect', call('line', [A, C]), call('line', [B, D]));
      b.call('O', 'spiral_center', A, B, C, D);
      b.call('k_1', 'circle', A, B, X);
      b.call('k_2', 'circle', C, D, X);
    },
    required: ['O', 'k_1', 'k_2'],
    check: (f) => onCircle(f, 'O', 'k_1') && onCircle(f, 'O', 'k_2'),
  },
  {
    name: 'the radical center of the circles on the diameters AB, BC, CA is the orthocenter',
    modes: ALL,
    build: (b, [A, B, C]) => {
      b.call(
        'X',
        'radical_center',
        call('diameter_circle', [A, B]),
        call('diameter_circle', [B, C]),
        call('diameter_circle', [C, A]),
      );
      b.call('H', 'orthocenter', A, B, C);
    },
    required: ['X', 'H'],
    check: (f) => samePoints(f, 'X', 'H'),
  },
  {
    name: 'the midpoint of the arc BAC (on the perpendicular bisector of BC) lies on the external bisector at A',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      const a = b.call('a', 'arc', B, A, C);
      // Both points of the perpendicular bisector on the circle are candidates; the arc
      // keeps the one on BAC, whichever along(±) labels it.
      const m = call('perp_bisector', [B, C]);
      b.add('M_1', call('intersect', [m, a], [{ kind: 'along', sign: 1 }]));
      b.add('M_2', call('intersect', [m, a], [{ kind: 'along', sign: -1 }]));
      b.call('e', 'ext_bisector', B, A, C);
    },
    required: ['a', 'e'],
    check: (f) => {
      const kinds = ['M_1', 'M_2'].map((n) => f.get(n).kind);
      const on = kinds.filter((k) => k === 'point').length === 1;
      const M = kinds[0] === 'point' ? 'M_1' : 'M_2';
      return on && onLine(f, M, 'e') && onCircle(f, M, 'a');
    },
  },
];

describe('theorems with the v1.1 tools', { timeout: LAW_TIMEOUT }, () => {
  theoremTests(THEOREMS, 20261025);
});
