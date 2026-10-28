/** L12: degenerate claims. None may ever be called true or false, in any sample. */
import { c, n } from './build';
import type { Entry } from './corpus';
import { PROJECTIVE_DEGENERATE } from './corpus-true-projective';

export const DEGENERATE_CLAIMS: readonly Entry[] = [
  { name: 'collinear(A, A, B)', build: (f) => f.claim('collinear', 'A', 'A', 'B') },
  {
    name: 'collinear(A, midpoint(B, B), B)',
    build: (f) => f.claim('collinear', 'A', c('midpoint', 'B', 'B'), 'B'),
  },
  {
    name: 'concyclic with a repeated point',
    build: (f) => f.claim('concyclic', 'A', 'B', 'C', 'A'),
  },
  {
    name: 'concyclic: four collinear points',
    build: (f) => f.claim('concyclic', 'A', 'B', 'M_c', c('divide', 'A', 'B', n(3))),
  },
  {
    name: 'parallel(AB, BA): the same line',
    build: (f) => f.claim('parallel', c('line', 'A', 'B'), c('line', 'B', 'A')),
  },
  {
    name: 'concurrent with a repeated line',
    build: (f) =>
      f.claim('concurrent', c('line', 'A', 'B'), c('line', 'A', 'B'), c('line', 'B', 'C')),
  },
  {
    name: 'concurrent: three parallel lines',
    build: (f) =>
      f.claim(
        'concurrent',
        c('line', 'A', 'B'),
        c('parallel', 'C', c('line', 'A', 'B')),
        c('parallel', 'M_a', c('line', 'A', 'B')),
      ),
  },
  { name: 'AB = 1·CC', build: (f) => f.claim('length', 'A', 'B', 'C', 'C', n(1)) },
  { name: 'AB/CC = AC/BC', build: (f) => f.claim('ratio', 'A', 'B', 'C', 'C', 'A', 'C', 'B', 'C') },
  {
    name: 'AA/BC = BB/AC (0 = 0)',
    build: (f) => f.claim('ratio', 'A', 'A', 'B', 'C', 'B', 'B', 'A', 'C'),
  },
  { name: '∡AAB = ∡ABC', build: (f) => f.claim('dangle', n(1), 'A', 'A', 'B', 'A', 'B', 'C') },
  {
    name: 'angle(A, B, B) = angle(A, B, C)',
    build: (f) => f.claim('angle_eq', 'A', 'B', 'B', 'A', 'B', 'C'),
  },
  {
    name: 'angle(A, A, C) + angle(A, B, C) = 90°',
    build: (f) => f.claim('angle_sum', 'A', 'A', 'C', 'A', 'B', 'C', n(90)),
  },
  {
    name: 'tangent(ω, ω′) for the same circle',
    build: (f) => f.claim('tangent', 'w', c('circumcircle', 'B', 'C', 'A')),
  },
  {
    name: 'a claim on the intersection of parallel lines (Undefined)',
    build: (f) =>
      f
        .def('X', 'intersect', c('line', 'A', 'B'), c('parallel', 'C', c('line', 'A', 'B')))
        .claim('collinear', c('midpoint', 'X', 'A'), 'A', 'C'),
  },
  {
    name: 'on a circumcircle of collinear points (Undefined)',
    build: (f) => f.claim('on', 'C', c('circumcircle', 'A', 'B', 'M_c')),
  },
  { name: 'on line(B, B) (Undefined)', build: (f) => f.claim('on', 'A', c('line', 'B', 'B')) },
  {
    name: 'perpendicular to line(A, A) (Undefined)',
    build: (f) => f.claim('perpendicular', c('line', 'A', 'A'), c('line', 'B', 'C')),
  },
  {
    name: 'intersection of a line with itself (Undefined)',
    build: (f) => f.claim('equal', c('intersect', c('line', 'A', 'B'), c('line', 'A', 'B')), 'A'),
  },
  {
    name: 'tangent(AB, BC): two lines',
    build: (f) => f.claim('tangent', c('line', 'A', 'B'), c('line', 'B', 'C')),
  },
  { name: 'concyclic(H, A, A, B)', build: (f) => f.claim('concyclic', 'H', 'A', 'A', 'B') },
  {
    name: '∡(AB, AA) = 0 (Undefined line)',
    build: (f) => f.claim('dangle_lines', c('line', 'A', 'B'), c('line', 'A', 'A'), n(0)),
  },
  {
    name: 'derived layer under an Undefined map',
    build: (f) =>
      f
        .def('t', 'reflect', c('line', 'A', c('midpoint', 'A', 'A')))
        .derived('bad', 't')
        .claim('on', 'A*', 'w'),
  },
  ...PROJECTIVE_DEGENERATE,
];
