/**
 * L12, Run 16a (ADR-0040): statements about points at infinity and cross ratios, spread into
 * TRUE_THEOREMS (corpus-true.ts), FALSE_CLAIMS (corpus-false.ts) and DEGENERATE_CLAIMS
 * (corpus-degenerate.ts). Classical facts only; the false ones are mutations of the true ones.
 */
import { c, n, other, type Figure } from './build';
import { onOmega, type Entry } from './corpus';

const Q = 'exact over Q' as const;

/** The point at infinity of AB, as the meet of AB and the parallel through C. */
const AB_INFINITY = () =>
  c('intersect', c('line', 'A', 'B'), c('parallel', 'C', c('line', 'A', 'B')));

/** P = A + (1/3)(B − A), Q = A − 2(B − A): (A, B; P, Q) = (1/3)(−3) / ((−2/3)(−2)) = −3/4. */
function fourOnAB(f: Figure): Figure {
  return f.def('P', 'divide', 'A', 'B', n('1/3')).def('Q', 'divide', 'A', 'B', n(-2));
}

/** The complete quadrilateral ABCD: E₁ = AB ∩ CD, F₁ = AD ∩ BC, P = AC ∩ BD, X = AC ∩ E₁F₁. */
function quadrilateral(f: Figure): Figure {
  return f
    .def('E_1', 'intersect', c('line', 'A', 'B'), c('line', 'C', 'D'))
    .def('F_1', 'intersect', c('line', 'A', 'D'), c('line', 'B', 'C'))
    .def('P', 'intersect', c('line', 'A', 'C'), c('line', 'B', 'D'))
    .def('X', 'intersect', c('line', 'A', 'C'), c('line', 'E_1', 'F_1'));
}

/** P on ω, T the meet of the tangents at A and C, D₁ the second point of TP on ω. */
function harmonicQuadrilateral(f: Figure): Figure {
  onOmega(f, 'P');
  return f
    .def('T', 'pole', c('line', 'A', 'C'), 'w')
    .def('D_1', 'intersect', c('line', 'T', 'P'), 'w', other('P'));
}

/** The images of A, B, P, Q under the projective map taking A, B, C, D to E, F, G, O. */
function projected(f: Figure): Figure {
  fourOnAB(f).def('T', 'projective', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'O');
  for (const x of ['A', 'B', 'P', 'Q']) f.def(`${x}_1`, 'apply', 'T', x);
  return f;
}

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
  {
    name: 'harmonic(A, B; P, harmonic_conjugate(A, B, P))',
    rung: Q,
    build: (f) =>
      fourOnAB(f).claim('harmonic', 'A', 'B', 'P', c('harmonic_conjugate', 'A', 'B', 'P')),
  },
  {
    name: 'cross_ratio(A, B, P, Q) = −3/4 on line AB',
    rung: Q,
    build: (f) => fourOnAB(f).claim('cross_ratio', 'A', 'B', 'P', 'Q', n('-3/4')),
  },
  {
    name: 'a projective map keeps the cross ratio: (A′, B′; P′, Q′) = −3/4',
    rung: Q,
    build: (f) => projected(f).claim('cross_ratio', 'A_1', 'B_1', 'P_1', 'Q_1', n('-3/4')),
  },
  {
    name: 'send_to_infinity(DE) keeps (A, B; M_c, X∞) = −1 (the images are finite points)',
    rung: Q,
    build: (f) =>
      f
        .def('X', 'intersect', c('line', 'A', 'B'), c('parallel', 'C', c('line', 'A', 'B')))
        .def('T', 'send_to_infinity', c('line', 'D', 'E'))
        .claim(
          'harmonic',
          c('apply', 'T', 'A'),
          c('apply', 'T', 'B'),
          c('apply', 'T', 'M_c'),
          c('apply', 'T', 'X'),
        ),
  },
  {
    name: 'the complete quadrilateral: (A, C; P, X) = −1',
    rung: Q,
    build: (f) => quadrilateral(f).claim('harmonic', 'A', 'C', 'P', 'X'),
  },
  {
    name: 'the complete quadrilateral: the pencil from F₁ to A, B, P, E₁ is harmonic',
    rung: Q,
    build: (f) =>
      quadrilateral(f).claim(
        'harmonic_lines',
        c('line', 'F_1', 'A'),
        c('line', 'F_1', 'B'),
        c('line', 'F_1', 'P'),
        c('line', 'F_1', 'E_1'),
      ),
  },
  {
    name: 'the tangents at A and C meet on PD₁: (A, C; P, D₁) = −1 on ω',
    rung: Q,
    build: (f) => harmonicQuadrilateral(f).claim('harmonic', 'A', 'C', 'P', 'D_1'),
  },
];

export const PROJECTIVE_FALSE: readonly Entry[] = [
  {
    name: 'harmonic(A, P; B, harmonic_conjugate(A, B, P)): the pairs mixed (ADR-0040)',
    build: (f) =>
      fourOnAB(f).claim('harmonic', 'A', 'P', 'B', c('harmonic_conjugate', 'A', 'B', 'P')),
  },
  {
    name: 'cross_ratio(A, B, P, Q) = 3/4: the sign wrong (ADR-0040)',
    build: (f) => fourOnAB(f).claim('cross_ratio', 'A', 'B', 'P', 'Q', n('3/4')),
  },
  {
    name: 'a projective map and (A′, B′; Q′, P′) = −3/4: two points exchanged (ADR-0040)',
    build: (f) => projected(f).claim('cross_ratio', 'A_1', 'B_1', 'Q_1', 'P_1', n('-3/4')),
  },
  {
    name: 'the complete quadrilateral: (A, P; C, X) = −1, the pairs mixed (ADR-0040)',
    build: (f) => quadrilateral(f).claim('harmonic', 'A', 'P', 'C', 'X'),
  },
  {
    name: 'the pencil from F₁ to A, P, B, E₁: the pairs mixed (ADR-0040)',
    build: (f) =>
      quadrilateral(f).claim(
        'harmonic_lines',
        c('line', 'F_1', 'A'),
        c('line', 'F_1', 'P'),
        c('line', 'F_1', 'B'),
        c('line', 'F_1', 'E_1'),
      ),
  },
  {
    name: 'the harmonic quadrilateral on ω: (A, P; C, D₁) = −1, the pairs mixed (ADR-0040)',
    build: (f) => harmonicQuadrilateral(f).claim('harmonic', 'A', 'P', 'C', 'D_1'),
  },
  {
    name: 'harmonic(A, B, C, D) of four points on neither a line nor a circle (ADR-0040)',
    build: (f) => f.claim('harmonic', 'A', 'B', 'C', 'D'),
  },
];

export const PROJECTIVE_DEGENERATE: readonly Entry[] = [
  {
    name: 'harmonic(A, A; B, C): a repeated point (ADR-0040)',
    build: (f) => f.claim('harmonic', 'A', 'A', 'B', 'C'),
  },
  {
    name: 'cross_ratio(A, B, P, P) = 1: a repeated point (ADR-0040)',
    build: (f) => fourOnAB(f).claim('cross_ratio', 'A', 'B', 'P', 'P', n(1)),
  },
  {
    name: 'harmonic_lines with two parallel lines (ADR-0040)',
    build: (f) =>
      f.claim(
        'harmonic_lines',
        c('line', 'A', 'B'),
        c('parallel', 'C', c('line', 'A', 'B')),
        c('line', 'A', 'C'),
        c('line', 'B', 'C'),
      ),
  },
  {
    name: 'harmonic(A, B, M_c, X∞): a point at infinity is not an argument of harmonic (ADR-0040)',
    build: (f) => f.claim('harmonic', 'A', 'B', 'M_c', AB_INFINITY()),
  },
];
