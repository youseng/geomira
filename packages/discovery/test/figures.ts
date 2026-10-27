/**
 * Figures of the maintainer's request on trivial facts (ADR-0039), built as documents: an
 * inversion and a reflection with a derived layer, the incenter–excenter figure, the nine-point
 * circle figure. Used by the request's tests and by the soundness property tests.
 */
import { Figure, n } from '../../claims/test/helpers/build';

/** Styles one object [noimage] (the Figure builder has no style argument). */
export function noimage(f: Figure, name: string): Figure {
  f.doc = {
    ...f.doc,
    objects: f.doc.objects.map((o) =>
      o.name === name ? { ...o, style: { ...o.style, noimage: true } } : o,
    ),
  };
  return f;
}

/** O = (0, 0), A = (3, 0), w = circle(O, A) [noimage], f = inversion(w), B, C free, layer inv. */
export function inversionFigure(): Figure {
  const f = new Figure().point('O', 0, 0).point('A', 3, 0).def('w', 'circle', 'O', 'A');
  noimage(f, 'w');
  return f.def('f', 'inversion', 'w').point('B', 1, 2).point('C', -2, '1/2').derived('inv', 'f');
}

/** A, B free, l = line(A, B) [noimage], f = reflect(l), C, D free, layer ref. */
export function reflectionFigure(): Figure {
  const f = new Figure().point('A', 0, 0).point('B', 4, 1).def('l', 'line', 'A', 'B');
  noimage(f, 'l');
  return f.def('f', 'reflect', 'l').point('C', 1, 3).point('D', -1, 2).derived('ref', 'f');
}

/** Triangle ABC, its circumcircle w, I, I_a, and M = the second point of line AI on w. */
export function incenterExcenterFigure(): Figure {
  return new Figure()
    .point('A', 1, 5)
    .point('B', -3, 0)
    .point('C', 4, 1)
    .def('w', 'circumcircle', 'A', 'B', 'C')
    .def('I', 'incenter', 'A', 'B', 'C')
    .def('I_a', 'excenter', 'A', 'B', 'C')
    .def('l', 'line', 'A', 'I')
    .def('M', 'other', 'l', 'w', 'A');
}

/** Triangle ABC, H, the midpoints of the sides, the feet, the midpoints of AH, BH, CH. */
export function ninePointFigure(): Figure {
  return new Figure()
    .point('A', 1, 5)
    .point('B', -3, 0)
    .point('C', 4, 1)
    .def('H', 'orthocenter', 'A', 'B', 'C')
    .def('M_a', 'midpoint', 'B', 'C')
    .def('M_b', 'midpoint', 'C', 'A')
    .def('M_c', 'midpoint', 'A', 'B')
    .def('D', 'foot', 'A', 'B', 'C')
    .def('E', 'foot', 'B', 'C', 'A')
    .def('F', 'foot', 'C', 'A', 'B')
    .def('K_a', 'midpoint', 'A', 'H')
    .def('K_b', 'midpoint', 'B', 'H')
    .def('K_c', 'midpoint', 'C', 'H');
}

/** O, A, B, C free, f = rotate(O, 90) (exact over Q), layer rot. */
export function rotationFigure(): Figure {
  return new Figure()
    .point('O', 0, 0)
    .point('A', 3, 1)
    .point('B', 1, 4)
    .point('C', -2, 1)
    .def('f', 'rotate', 'O', n(90))
    .derived('rot', 'f');
}

/** O, A, B, C free, f = homothety(O, 2), layer hom. */
export function homothetyFigure(): Figure {
  return new Figure()
    .point('O', 0, 0)
    .point('A', 3, 1)
    .point('B', 1, 4)
    .point('C', -2, 1)
    .def('f', 'homothety', 'O', n(2))
    .derived('hom', 'f');
}

/** A, B, C, D free, f = spiral(A, B, C, D), X, Y free, layer sp. */
export function spiralFigure(): Figure {
  return new Figure()
    .point('A', 0, 0)
    .point('B', 4, 0)
    .point('C', 1, 3)
    .point('D', 3, 5)
    .def('f', 'spiral', 'A', 'B', 'C', 'D')
    .point('X', -1, 2)
    .point('Y', 2, -2)
    .derived('sp', 'f');
}

/**
 * O = (0, 0), A = (3, 0), w = circle(O, A) [noimage], f = inversion(w); B, C, D free, the line
 * BC and the circle BCD, layer inv: the images of a line and of a circle.
 */
export function inversionCurvesFigure(): Figure {
  const f = new Figure().point('O', 0, 0).point('A', 3, 0).def('w', 'circle', 'O', 'A');
  noimage(f, 'w');
  return f
    .def('f', 'inversion', 'w')
    .point('B', 1, 2)
    .point('C', -2, '1/2')
    .point('D', 2, -1)
    .def('l', 'line', 'B', 'C')
    .def('k', 'circle', 'B', 'C', 'D')
    .derived('inv', 'f');
}

/**
 * The incenter–excenter figure inverted in k = circle(M, B) [noimage] (layer inv over A and the
 * circumcircle w only): the circle through B, C, I, I_a centred at M.
 */
export function incenterInversionFigure(): Figure {
  const f = incenterExcenterFigure().def('k', 'circle', 'M', 'B');
  noimage(f, 'k');
  return f.def('f', 'inversion', 'k').derived('inv', 'f');
}
