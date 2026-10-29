/**
 * L12, Run 16b (ADR-0042): statements about conics, spread into TRUE_THEOREMS (corpus-true.ts),
 * FALSE_CLAIMS (corpus-false.ts) and DEGENERATE_CLAIMS (corpus-degenerate.ts). Classical named
 * results only (Pascal, Brianchon, La Hire's pole–polar reciprocity, the centre of a rectangular
 * hyperbola through a triangle's vertices on the nine-point circle); the false ones are
 * mutations of the true ones. k is the conic through the base figure's A, B, C, D, E.
 */
import { c, n, type Figure } from './build';
import type { Entry } from './corpus';

const Q = 'exact over Q' as const;

/** k = conic(A, B, C, D, E) and points P_1…P_n on it (gliders from its known point A). */
function onK(f: Figure, count: number): Figure {
  f.def('k', 'conic', 'A', 'B', 'C', 'D', 'E');
  const params: readonly (readonly [number, number])[] = [
    [2, 1],
    [-3, 1],
    [1, -2],
    [3, 4],
    [-1, -3],
    [5, -1],
  ];
  for (let i = 0; i < count; i++) {
    const [u, v] = params[i] ?? [1, 1];
    f.add(`P_${String(i + 1)}`, c('on', 'k', n(u), n(v)));
  }
  return f;
}

/** Pascal: the meets of opposite sides of the hexagon P_1…P_6 on k. */
function pascal(f: Figure): Figure {
  return onK(f, 6)
    .def('X', 'intersect', c('line', 'P_1', 'P_2'), c('line', 'P_4', 'P_5'))
    .def('Y', 'intersect', c('line', 'P_2', 'P_3'), c('line', 'P_5', 'P_6'))
    .def('Z', 'intersect', c('line', 'P_3', 'P_4'), c('line', 'P_6', 'P_1'));
}

/** Brianchon: the tangents at P_1…P_6 and the vertices V_i = t_i ∩ t_{i+1}. */
function brianchon(f: Figure): Figure {
  onK(f, 6);
  for (let i = 1; i <= 6; i++) f.def(`t_${String(i)}`, 'tangent', `P_${String(i)}`, 'k');
  for (let i = 1; i <= 6; i++)
    f.def(`V_${String(i)}`, 'intersect', `t_${String(i)}`, `t_${String((i % 6) + 1)}`);
  return f;
}

/** La Hire: P on the polar of G with respect to k. */
function laHire(f: Figure): Figure {
  f.def('k', 'conic', 'A', 'B', 'C', 'D', 'E');
  return f.def('p', 'polar', 'G', 'k').add('P', c('on', 'p', n('1/3')));
}

/** The conic through A, B, C, H and G (a rectangular hyperbola) and its centre K. */
function throughH(f: Figure): Figure {
  return f
    .def('h', 'conic', 'A', 'B', 'C', 'H', 'G')
    .def('K', 'conic_center', 'h')
    .def('n_9', 'ninepoint_circle', 'A', 'B', 'C');
}

export const CONIC_TRUE: readonly Entry[] = [
  {
    name: 'conconic(A, B, C, D, E, P): P a point of conic(A, B, C, D, E) (ADR-0042)',
    rung: Q,
    build: (f) => onK(f, 1).claim('conconic', 'A', 'B', 'C', 'D', 'E', 'P_1'),
  },
  {
    name: 'conconic of three defining points and three other points of one conic (ADR-0042)',
    rung: Q,
    build: (f) => onK(f, 3).claim('conconic', 'P_1', 'A', 'P_2', 'C', 'P_3', 'E'),
  },
  {
    name: 'Pascal on a conic: the meets of opposite sides of a hexagon on k are collinear (ADR-0042)',
    rung: Q,
    build: (f) => pascal(f).claim('collinear', 'X', 'Y', 'Z'),
  },
  {
    name: 'Brianchon: the diagonals of a hexagon circumscribed about k are concurrent (ADR-0042)',
    rung: Q,
    build: (f) =>
      brianchon(f).claim(
        'concurrent',
        c('line', 'V_1', 'V_4'),
        c('line', 'V_2', 'V_5'),
        c('line', 'V_3', 'V_6'),
      ),
  },
  {
    name: 'La Hire: P on the polar of G ⇒ G on the polar of P (ADR-0042)',
    rung: Q,
    build: (f) => laHire(f).claim('on', 'G', c('polar', 'P', 'k')),
  },
  {
    name: 'the pole T of chord AB: TA is tangent to k (ADR-0042)',
    rung: Q,
    build: (f) =>
      f
        .def('k', 'conic', 'A', 'B', 'C', 'D', 'E')
        .def('T', 'pole', c('line', 'A', 'B'), 'k')
        .claim('tangent', c('line', 'T', 'A'), 'k'),
  },
  {
    name: 'the centre of the conic through A, B, C, H, G lies on the nine-point circle (ADR-0042)',
    rung: Q,
    build: (f) => throughH(f).claim('on', 'K', 'n_9'),
  },
  {
    name: 'a reflection sends P on k onto the image of k (ADR-0042)',
    rung: Q,
    build: (f) =>
      onK(f, 1)
        .def('s', 'reflect', c('line', 'F', 'G'))
        .def('I_1', 'apply', 's', 'P_1')
        .claim('on', 'I_1', c('apply', 's', 'k')),
  },
];

export const CONIC_FALSE: readonly Entry[] = [
  {
    name: 'conconic(A, B, C, D, E, F): F is not on the conic through the other five (ADR-0042)',
    build: (f) => f.claim('conconic', 'A', 'B', 'C', 'D', 'E', 'F'),
  },
  {
    name: 'Pascal mutated: X, Y and P_1 collinear (ADR-0042)',
    build: (f) => pascal(f).claim('collinear', 'X', 'Y', 'P_1'),
  },
  {
    name: 'La Hire mutated: G on the polar of a point off its polar (ADR-0042)',
    build: (f) => laHire(f).claim('on', 'G', c('polar', 'F', 'k')),
  },
  {
    name: 'the secant AC is tangent to k (ADR-0042)',
    build: (f) =>
      f.def('k', 'conic', 'A', 'B', 'C', 'D', 'E').claim('tangent', c('line', 'A', 'C'), 'k'),
  },
  {
    name: 'the centre of the conic through A, B, C, H, G on the circumcircle (ADR-0042)',
    build: (f) => throughH(f).claim('on', 'K', 'w'),
  },
];

export const CONIC_DEGENERATE: readonly Entry[] = [
  {
    name: 'conconic with a repeated point (ADR-0042)',
    build: (f) => f.claim('conconic', 'A', 'B', 'C', 'D', 'E', 'A'),
  },
  {
    name: 'conconic with three collinear points: A, B and the midpoint of AB (ADR-0042)',
    build: (f) => f.claim('conconic', 'A', 'B', 'M_c', 'C', 'D', 'E'),
  },
];
