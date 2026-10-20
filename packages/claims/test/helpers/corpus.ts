/**
 * Corpus entries (law L12): a construction on a fixed scalene acute triangle and one claim.
 * `rung` is the rung every valid sample must use: 'exact over Q' wherever the closure is
 * exact over Q, 'numeric' where it needs square roots or trigonometry.
 */
import type { RungName } from '../../src/rungs';
import { c, Figure, n, other } from './build';

export interface Entry {
  readonly name: string;
  readonly rung?: RungName;
  /** Adds the construction to the base figure and returns the claim id. */
  readonly build: (f: Figure) => number;
}

/** A = (1, 5), B = (−3, 0), C = (4, 1): acute and scalene; D, E, F, G spare free points. */
export function baseFigure(): Figure {
  return new Figure()
    .point('A', 1, 5)
    .point('B', -3, 0)
    .point('C', 4, 1)
    .point('D', 6, 6)
    .point('E', -2, 4)
    .point('F', 2, -3)
    .point('G', '1/2', 2)
    .def('O', 'circumcenter', 'A', 'B', 'C')
    .def('H', 'orthocenter', 'A', 'B', 'C')
    .def('G_c', 'centroid', 'A', 'B', 'C')
    .def('M_a', 'midpoint', 'B', 'C')
    .def('M_b', 'midpoint', 'C', 'A')
    .def('M_c', 'midpoint', 'A', 'B')
    .def('w', 'circumcircle', 'A', 'B', 'C');
}

/** Three points on the circumcircle ω (gliders from its anchor A). */
export function onOmega(f: Figure, ...names: string[]): Figure {
  const params: readonly (readonly [number, number])[] = [
    [2, 1],
    [-3, 1],
    [1, -2],
    [3, 4],
    [-1, -3],
    [5, -1],
  ];
  names.forEach((name, i) => {
    const [u, v] = params[i] ?? [1, 1];
    f.add(name, c('on', 'w', n(u), n(v)));
  });
  return f;
}

/** Three circles centred at A, B, C through D, E, F. */
export function threeCircles(f: Figure): Figure {
  return f
    .def('c_1', 'circle', 'A', 'D')
    .def('c_2', 'circle', 'B', 'E')
    .def('c_3', 'circle', 'C', 'F');
}

/** Miquel: D', E', F' on BC, CA, AB, and the second intersection M of circles AE'F' and BF'D'. */
export function miquel(f: Figure): Figure {
  return f
    .add('D_1', c('on', c('line', 'B', 'C'), n('1/3')))
    .add('E_1', c('on', c('line', 'C', 'A'), n('2/5')))
    .add('F_1', c('on', c('line', 'A', 'B'), n('3/4')));
}

/** Pascal: six points of ω and the three intersections of opposite sides. */
export function pascal(f: Figure): Figure {
  onOmega(f, 'P_1', 'P_2', 'P_3', 'P_4', 'P_5', 'P_6');
  return f
    .def('X', 'intersect', c('line', 'P_1', 'P_2'), c('line', 'P_4', 'P_5'))
    .def('Y', 'intersect', c('line', 'P_2', 'P_3'), c('line', 'P_5', 'P_6'))
    .def('Z', 'intersect', c('line', 'P_3', 'P_4'), c('line', 'P_6', 'P_1'));
}

/** Desargues: triangles ABC and A'B'C' perspective from G. */
export function desargues(f: Figure): Figure {
  return f
    .add('A_1', c('on', c('line', 'G', 'A'), n('3/2')))
    .add('B_1', c('on', c('line', 'G', 'B'), n('7/10')))
    .add('C_1', c('on', c('line', 'G', 'C'), n('11/5')))
    .def('X', 'intersect', c('line', 'A', 'B'), c('line', 'A_1', 'B_1'))
    .def('Y', 'intersect', c('line', 'B', 'C'), c('line', 'B_1', 'C_1'))
    .def('Z', 'intersect', c('line', 'C', 'A'), c('line', 'C_1', 'A_1'));
}

/** Butterfly: chord PQ of ω with midpoint M, chords X₁Y₁ and X₂Y₂ through M. */
export function butterfly(f: Figure): Figure {
  onOmega(f, 'P', 'Q', 'X_1', 'X_2');
  return f
    .def('M', 'midpoint', 'P', 'Q')
    .def('Y_1', 'intersect', c('line', 'X_1', 'M'), 'w', other('X_1'))
    .def('Y_2', 'intersect', c('line', 'X_2', 'M'), 'w', other('X_2'))
    .def('K', 'intersect', c('line', 'X_1', 'Y_2'), c('line', 'P', 'Q'))
    .def('L', 'intersect', c('line', 'Y_1', 'X_2'), c('line', 'P', 'Q'));
}

/** Napoleon: equilateral triangles on the sides (all turned the same way) and their centroids. */
export function napoleon(f: Figure): Figure {
  return f
    .add('X_a', c('rotate', 'C', 'B', n(60)))
    .add('X_b', c('rotate', 'A', 'C', n(60)))
    .add('X_c', c('rotate', 'B', 'A', n(60)))
    .def('N_a', 'centroid', 'B', 'C', 'X_a')
    .def('N_b', 'centroid', 'C', 'A', 'X_b')
    .def('N_c', 'centroid', 'A', 'B', 'X_c');
}
