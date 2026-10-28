/**
 * L12, Run 16a (ADR-0040): true statements about points at infinity and cross ratios, spread
 * into TRUE_THEOREMS (corpus-true.ts). Classical facts only.
 */
import { c } from './build';
import type { Entry } from './corpus';

const Q = 'exact over Q' as const;

export const PROJECTIVE_TRUE: readonly Entry[] = [
  {
    name: 'collinear(A, B, X∞): the point at infinity of AB lies on AB (ADR-0040)',
    rung: Q,
    build: (f) =>
      f
        .def('X', 'intersect', c('line', 'A', 'B'), c('parallel', 'C', c('line', 'A', 'B')))
        .claim('collinear', 'A', 'B', 'X'),
  },
  {
    name: 'collinear(C, X∞, C + AB): the parallel through C meets AB at infinity (ADR-0040)',
    rung: Q,
    build: (f) =>
      f
        .def('X', 'intersect', c('line', 'A', 'B'), c('parallel', 'C', c('line', 'A', 'B')))
        .claim('collinear', 'C', 'X', c('translate', 'C', 'A', 'B')),
  },
];
