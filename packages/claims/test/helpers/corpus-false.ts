/** L12: false claims (mutations of true theorems). Each must be FALSE or MIXED locally. */
import { c, n, orient, other } from './build';
import {
  butterfly,
  desargues,
  miquel,
  napoleon,
  onOmega,
  pascal,
  threeCircles,
  type Entry,
} from './corpus';
import { PROJECTIVE_FALSE } from './corpus-true-projective';

export const FALSE_CLAIMS: readonly Entry[] = [
  {
    name: 'O, G, I collinear',
    build: (f) => f.claim('collinear', 'O', 'G_c', c('incenter', 'A', 'B', 'C')),
  },
  { name: 'A, B, C, H concyclic', build: (f) => f.claim('concyclic', 'A', 'B', 'C', 'H') },
  {
    name: 'AO ⟂ BC',
    build: (f) => f.claim('perpendicular', c('line', 'A', 'O'), c('line', 'B', 'C')),
  },
  { name: 'AG = 3·GM_a', build: (f) => f.claim('length', 'A', 'G_c', 'G_c', 'M_a', n(3)) },
  {
    name: 'M_aM_b ∥ BC',
    build: (f) => f.claim('parallel', c('line', 'M_a', 'M_b'), c('line', 'B', 'C')),
  },
  { name: 'H on ω', build: (f) => f.claim('on', 'H', 'w') },
  { name: 'O = H', build: (f) => f.claim('equal', 'O', 'H') },
  {
    name: 'two medians and an altitude concurrent',
    build: (f) =>
      f.claim(
        'concurrent',
        c('line', 'A', 'M_a'),
        c('line', 'B', 'M_b'),
        c('perp', 'C', c('line', 'A', 'B')),
      ),
  },
  {
    name: 'foot of an altitude on ω',
    build: (f) => f.claim('on', c('foot', 'A', c('line', 'B', 'C')), 'w'),
  },
  { name: 'AH = 3·OM_a', build: (f) => f.claim('length', 'A', 'H', 'O', 'M_a', n(3)) },
  {
    name: 'incircle tangent to ω',
    build: (f) => f.claim('tangent', c('incircle', 'A', 'B', 'C'), 'w'),
  },
  {
    name: 'nine-point circle tangent to ω',
    build: (f) => f.claim('tangent', c('ninepoint_circle', 'A', 'B', 'C'), 'w'),
  },
  {
    name: '∡APB = ∡AOB (missing factor 2)',
    build: (f) => onOmega(f, 'P').claim('dangle', n(1), 'A', 'P', 'B', 'A', 'O', 'B'),
  },
  {
    name: '2∡APB = ∡AQB',
    build: (f) => onOmega(f, 'P', 'Q').claim('dangle', n(2), 'A', 'P', 'B', 'A', 'Q', 'B'),
  },
  {
    name: '∠BHC + ∠A = 90°',
    build: (f) => f.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(90)),
  },
  {
    name: '∠BHC = ∠A in an acute triangle',
    build: (f) => f.claim('angle_eq', 'B', 'H', 'C', 'B', 'A', 'C'),
  },
  {
    name: 'bisector theorem with the ratio inverted',
    build: (f) =>
      f
        .def('P', 'intersect', c('bisector', 'B', 'A', 'C'), c('line', 'B', 'C'))
        .claim('ratio', 'B', 'P', 'P', 'C', 'A', 'C', 'A', 'B'),
  },
  {
    name: 'Simson line of a point off ω',
    build: (f) =>
      f.claim(
        'collinear',
        c('foot', 'D', c('line', 'B', 'C')),
        c('foot', 'D', c('line', 'C', 'A')),
        c('foot', 'D', c('line', 'A', 'B')),
      ),
  },
  {
    name: 'Thales off the circle',
    build: (f) => f.claim('perpendicular', c('line', 'G', 'A'), c('line', 'G', 'B')),
  },
  {
    name: 'Miquel point on the wrong circle',
    build: (f) =>
      miquel(f)
        .def(
          'M',
          'intersect',
          c('circle', 'A', 'E_1', 'F_1'),
          c('circle', 'B', 'F_1', 'D_1'),
          other('F_1'),
        )
        .claim('on', 'M', c('circle', 'A', 'D_1', 'E_1')),
  },
  {
    name: 'Pascal with a wrong pairing',
    build: (f) =>
      pascal(f).claim(
        'collinear',
        'X',
        'Y',
        c('intersect', c('line', 'P_1', 'P_3'), c('line', 'P_4', 'P_6')),
      ),
  },
  {
    name: 'Desargues with a wrong pairing',
    build: (f) =>
      desargues(f).claim(
        'collinear',
        'X',
        'Y',
        c('intersect', c('line', 'A', 'C_1'), c('line', 'A_1', 'C')),
      ),
  },
  {
    name: 'Newton–Gauss with a wrong midpoint',
    build: (f) =>
      f
        .def('X', 'intersect', c('line', 'A', 'B'), c('line', 'C', 'D'))
        .claim(
          'collinear',
          c('midpoint', 'A', 'C'),
          c('midpoint', 'B', 'D'),
          c('midpoint', 'A', 'X'),
        ),
  },
  {
    name: 'Monge with an internal centre',
    build: (f) =>
      f.claim(
        'collinear',
        c('divide', 'A', 'B', n(-1)),
        c('divide', 'B', 'C', n(-2)),
        c('divide', 'A', 'C', n('1/4')),
      ),
  },
  {
    name: 'La Hire against another circle',
    build: (f) =>
      f
        .add('Q', c('on', c('polar', 'D', 'w'), n('1/2')))
        .claim('on', 'D', c('polar', 'Q', c('circle', 'O', 'M_a'))),
  },
  {
    name: 'butterfly with MK = 2·ML',
    build: (f) => butterfly(f).claim('length', 'M', 'K', 'M', 'L', n(2)),
  },
  {
    name: 'incircle tangent to the A-excircle',
    build: (f) => f.claim('tangent', c('incircle', 'A', 'B', 'C'), c('excircle', 'A', 'B', 'C')),
  },
  {
    name: 'Napoleon: N_aN_b = N_aA',
    build: (f) => napoleon(f).claim('length', 'N_a', 'N_b', 'N_a', 'A', n(1)),
  },
  { name: 'GH = 3·OG', build: (f) => f.claim('length', 'G_c', 'H', 'O', 'G_c', n(3)) },
  {
    name: 'nearly tangent: BC and the circle about O through 1.001·M_a (note B)',
    build: (f) =>
      f.claim(
        'tangent',
        c('line', 'B', 'C'),
        c('circle', 'O', c('divide', 'O', 'M_a', n('1001/1000'))),
      ),
  },
  {
    name: 'radical axis ⟂ AC',
    build: (f) =>
      threeCircles(f).claim('perpendicular', c('radical_axis', 'c_1', 'c_2'), c('line', 'A', 'C')),
  },
  {
    name: 'two radical axes and AB concurrent',
    build: (f) =>
      threeCircles(f).claim(
        'concurrent',
        c('radical_axis', 'c_1', 'c_2'),
        c('radical_axis', 'c_2', 'c_3'),
        c('line', 'A', 'B'),
      ),
  },
  { name: 'midline = BC', build: (f) => f.claim('length', 'M_b', 'M_c', 'B', 'C', n(1)) },
  {
    name: 'Varignon with adjacent sides',
    build: (f) =>
      f.claim(
        'parallel',
        c('line', c('midpoint', 'A', 'B'), c('midpoint', 'B', 'C')),
        c('line', c('midpoint', 'B', 'C'), c('midpoint', 'C', 'D')),
      ),
  },
  {
    name: 'midpoints of AC and BC coincide',
    build: (f) => f.claim('equal', c('midpoint', 'A', 'C'), c('midpoint', 'B', 'C')),
  },
  {
    name: 'intersecting chords with the wrong pairing',
    build: (f) =>
      onOmega(f, 'P', 'Q', 'R')
        .def('S', 'intersect', c('line', 'P', 'Q'), c('line', 'R', 'G'))
        .def('R_2', 'intersect', c('line', 'R', 'G'), 'w', other('R'))
        .claim('ratio', 'S', 'P', 'S', 'R', 'S', 'Q', 'S', 'R_2'),
  },
  {
    name: 'tangent–chord with the wrong chord',
    build: (f) =>
      onOmega(f, 'P')
        .add('T', c('on', c('tangent', 'A', 'w'), n(2)))
        .claim('dangle', n(1), 'T', 'A', 'B', 'A', 'P', 'C'),
  },
  {
    name: 'equal tangents compared with DA',
    build: (f) =>
      f
        .def('T_1', 'tangent_point', 'D', 'w', orient(1))
        .claim('length', 'D', 'T_1', 'D', 'A', n(1)),
  },
  {
    name: 'nine-point centre on ω',
    build: (f) => f.claim('on', c('ninepoint_center', 'A', 'B', 'C'), 'w'),
  },
  {
    name: '∡(BC, AB) = 90°',
    build: (f) => f.claim('dangle_lines', c('line', 'B', 'C'), c('line', 'A', 'B'), n(90)),
  },
  {
    name: 'derived layer: O* on ω',
    build: (f) =>
      f
        .def('t', 'reflect', c('line', 'B', 'C'))
        .derived('ref', 't')
        .claim('on', 'O*', 'w'),
  },
  {
    name: 'two internal bisectors and an external one concurrent',
    build: (f) =>
      f.claim(
        'concurrent',
        c('bisector', 'B', 'A', 'C'),
        c('bisector', 'A', 'B', 'C'),
        c('ext_bisector', 'A', 'C', 'B'),
      ),
  },
  {
    name: 'collinear(X∞, A, C) with X∞ the point at infinity of AB (ADR-0040)',
    build: (f) =>
      f
        .def('X', 'intersect', c('line', 'A', 'B'), c('parallel', 'C', c('line', 'A', 'B')))
        .claim('collinear', 'X', 'A', 'C'),
  },
  ...PROJECTIVE_FALSE,
];
