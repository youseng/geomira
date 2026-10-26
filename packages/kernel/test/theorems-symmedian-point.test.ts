/**
 * The symmedian (Lemoine) point K (ADR-0033) on random figures, over FloatField and exactly over
 * RationalField (helpers/theorem-runner.ts; ill-conditioned float figures are skipped and
 * counted): K is the isogonal conjugate of the centroid, and it lies on the symmedian from each
 * vertex.
 */
import { describe } from 'vitest';
import { call } from '../src/expr';
import { onLine } from './helpers/circle-properties';
import { samePoints } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import { ALL, theoremTests, type Theorem } from './helpers/theorem-runner';

const THEOREMS: readonly Theorem[] = [
  {
    name: 'symmedian_point is isogonal(centroid) and lies on the three symmedians',
    modes: ALL,
    build: (b, [A, B, C]) => {
      b.call('K', 'symmedian_point', A, B, C);
      b.call('X', 'isogonal', call('centroid', [A, B, C]), A, B, C);
      b.call('s_a', 'symmedian', A, B, C);
      b.call('s_b', 'symmedian', B, C, A);
      b.call('s_c', 'symmedian', C, A, B);
    },
    required: ['K', 'X'],
    check: (f) =>
      samePoints(f, 'K', 'X') &&
      onLine(f, 'K', 's_a') &&
      onLine(f, 'K', 's_b') &&
      onLine(f, 'K', 's_c'),
  },
];

describe('the symmedian point', { timeout: LAW_TIMEOUT }, () => {
  theoremTests(THEOREMS, 1933);
});
