/**
 * L12: true classical theorems (no contest problems: those come only from the
 * maintainer's docs/examples-source.md, which does not exist yet). Each must HOLD in the
 * local test for every seed.
 */
import { c, n, onArc, orient, other } from './build';
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

const Q = 'exact over Q' as const;
const NUM = 'numeric' as const;

export const TRUE_THEOREMS: readonly Entry[] = [
  {
    name: 'Euler line: O, G, H collinear',
    rung: Q,
    build: (f) => f.claim('collinear', 'O', 'G_c', 'H'),
  },
  {
    name: 'Euler line: GH = 2·OG',
    rung: Q,
    build: (f) => f.claim('length', 'G_c', 'H', 'O', 'G_c', n(2)),
  },
  {
    name: 'centroid: AG = 2·GM_a',
    rung: Q,
    build: (f) => f.claim('length', 'A', 'G_c', 'G_c', 'M_a', n(2)),
  },
  {
    name: 'medians concurrent',
    rung: Q,
    build: (f) =>
      f.claim('concurrent', c('line', 'A', 'M_a'), c('line', 'B', 'M_b'), c('line', 'C', 'M_c')),
  },
  {
    name: 'altitudes concurrent',
    rung: Q,
    build: (f) =>
      f.claim(
        'concurrent',
        c('perp', 'A', c('line', 'B', 'C')),
        c('perp', 'B', c('line', 'C', 'A')),
        c('perp', 'C', c('line', 'A', 'B')),
      ),
  },
  {
    name: 'perpendicular bisectors concurrent',
    rung: Q,
    build: (f) =>
      f.claim(
        'concurrent',
        c('perp_bisector', 'A', 'B'),
        c('perp_bisector', 'B', 'C'),
        c('perp_bisector', 'C', 'A'),
      ),
  },
  {
    name: 'internal bisectors concurrent',
    rung: NUM,
    build: (f) =>
      f.claim(
        'concurrent',
        c('bisector', 'B', 'A', 'C'),
        c('bisector', 'A', 'B', 'C'),
        c('bisector', 'A', 'C', 'B'),
      ),
  },
  {
    name: 'nine-point circle through the foot of an altitude',
    rung: Q,
    build: (f) =>
      f.claim('on', c('foot', 'A', c('line', 'B', 'C')), c('ninepoint_circle', 'A', 'B', 'C')),
  },
  {
    name: 'nine-point circle through the midpoint of AH',
    rung: Q,
    build: (f) => f.claim('on', c('midpoint', 'A', 'H'), c('ninepoint_circle', 'A', 'B', 'C')),
  },
  {
    name: 'reflection of H in BC on ω',
    rung: Q,
    build: (f) => f.claim('on', c('reflect', 'H', c('line', 'B', 'C')), 'w'),
  },
  {
    name: 'reflection of H in M_a on ω',
    rung: Q,
    build: (f) => f.claim('on', c('reflect', 'H', 'M_a'), 'w'),
  },
  { name: 'AH = 2·OM_a', rung: Q, build: (f) => f.claim('length', 'A', 'H', 'O', 'M_a', n(2)) },
  {
    name: 'Simson line',
    rung: Q,
    build: (f) => {
      onOmega(f, 'P');
      return f.claim(
        'collinear',
        c('foot', 'P', c('line', 'B', 'C')),
        c('foot', 'P', c('line', 'C', 'A')),
        c('foot', 'P', c('line', 'A', 'B')),
      );
    },
  },
  {
    name: 'the Simson line bisects PH',
    rung: Q,
    build: (f) => {
      onOmega(f, 'P');
      return f.claim(
        'collinear',
        c('foot', 'P', c('line', 'B', 'C')),
        c('foot', 'P', c('line', 'C', 'A')),
        c('midpoint', 'P', 'H'),
      );
    },
  },
  {
    name: 'Thales: a right angle on the diameter circle',
    rung: Q,
    build: (f) =>
      f
        .add('P', c('on', c('diameter_circle', 'A', 'B'), n(1), n(3)))
        .claim('perpendicular', c('line', 'P', 'A'), c('line', 'P', 'B')),
  },
  {
    name: 'inscribed angles: ∡APB = ∡AQB',
    rung: Q,
    build: (f) => onOmega(f, 'P', 'Q').claim('dangle', n(1), 'A', 'P', 'B', 'A', 'Q', 'B'),
  },
  {
    name: 'central angle: 2∡APB = ∡AOB',
    rung: Q,
    build: (f) => onOmega(f, 'P').claim('dangle', n(2), 'A', 'P', 'B', 'A', 'O', 'B'),
  },
  {
    name: 'tangent–chord angle',
    rung: Q,
    build: (f) =>
      onOmega(f, 'P')
        .add('T', c('on', c('tangent', 'A', 'w'), n(2)))
        .claim('dangle', n(1), 'T', 'A', 'B', 'A', 'P', 'B'),
  },
  {
    name: 'tangent ⟂ radius',
    rung: Q,
    build: (f) =>
      onOmega(f, 'P').claim('perpendicular', c('tangent', 'P', 'w'), c('line', 'O', 'P')),
  },
  {
    name: 'Miquel point',
    rung: Q,
    build: (f) =>
      miquel(f)
        .def(
          'M',
          'intersect',
          c('circle', 'A', 'E_1', 'F_1'),
          c('circle', 'B', 'F_1', 'D_1'),
          other('F_1'),
        )
        .claim('on', 'M', c('circle', 'C', 'D_1', 'E_1')),
  },
  {
    name: 'radical axes concurrent',
    rung: Q,
    build: (f) =>
      threeCircles(f).claim(
        'concurrent',
        c('radical_axis', 'c_1', 'c_2'),
        c('radical_axis', 'c_2', 'c_3'),
        c('radical_axis', 'c_3', 'c_1'),
      ),
  },
  {
    name: 'radical axis ⟂ line of centres',
    rung: Q,
    build: (f) =>
      threeCircles(f).claim('perpendicular', c('radical_axis', 'c_1', 'c_2'), c('line', 'A', 'B')),
  },
  {
    name: 'intersecting chords: SP·SQ = SR·SR′',
    rung: Q,
    build: (f) =>
      onOmega(f, 'P', 'Q', 'R')
        .def('S', 'intersect', c('line', 'P', 'Q'), c('line', 'R', 'G'))
        .def('R_2', 'intersect', c('line', 'R', 'G'), 'w', other('R'))
        .claim('ratio', 'S', 'P', 'S', 'R', 'S', 'R_2', 'S', 'Q'),
  },
  {
    name: 'midline ∥ BC',
    rung: Q,
    build: (f) => f.claim('parallel', c('line', 'M_b', 'M_c'), c('line', 'B', 'C')),
  },
  {
    name: 'midline = BC/2',
    rung: Q,
    build: (f) => f.claim('length', 'M_b', 'M_c', 'B', 'C', n('1/2')),
  },
  {
    name: 'Varignon parallelogram',
    rung: Q,
    build: (f) =>
      f.claim(
        'parallel',
        c('line', c('midpoint', 'A', 'B'), c('midpoint', 'B', 'C')),
        c('line', c('midpoint', 'C', 'D'), c('midpoint', 'D', 'A')),
      ),
  },
  {
    name: 'diagonals of a parallelogram bisect each other',
    rung: Q,
    build: (f) =>
      f
        .add('P', c('translate', 'C', 'B', 'A'))
        .claim('equal', c('midpoint', 'A', 'C'), c('midpoint', 'B', 'P')),
  },
  {
    name: 'butterfly theorem',
    rung: Q,
    build: (f) => butterfly(f).claim('length', 'M', 'K', 'M', 'L', n(1)),
  },
  {
    name: 'Pascal (hexagon in ω)',
    rung: Q,
    build: (f) => pascal(f).claim('collinear', 'X', 'Y', 'Z'),
  },
  { name: 'Desargues', rung: Q, build: (f) => desargues(f).claim('collinear', 'X', 'Y', 'Z') },
  {
    name: 'Pappus',
    rung: Q,
    build: (f) => {
      for (const [p, t] of [
        ['P_1', '1/3'],
        ['P_2', '3/2'],
        ['P_3', '-1/2'],
      ] as const)
        f.add(p, c('on', c('line', 'A', 'B'), n(t)));
      for (const [p, t] of [
        ['Q_1', '1/4'],
        ['Q_2', '2'],
        ['Q_3', '-3/4'],
      ] as const)
        f.add(p, c('on', c('line', 'C', 'D'), n(t)));
      const x = (a: string, b: string, d: string, e: string) =>
        c('intersect', c('line', a, b), c('line', d, e));
      return f.claim(
        'collinear',
        x('P_1', 'Q_2', 'P_2', 'Q_1'),
        x('P_1', 'Q_3', 'P_3', 'Q_1'),
        x('P_2', 'Q_3', 'P_3', 'Q_2'),
      );
    },
  },
  {
    name: 'Newton–Gauss line',
    rung: Q,
    build: (f) =>
      f
        .def('X', 'intersect', c('line', 'A', 'B'), c('line', 'C', 'D'))
        .def('Y', 'intersect', c('line', 'A', 'D'), c('line', 'B', 'C'))
        .claim(
          'collinear',
          c('midpoint', 'A', 'C'),
          c('midpoint', 'B', 'D'),
          c('midpoint', 'X', 'Y'),
        ),
  },
  {
    name: 'Monge: external centres of similitude collinear (radii 1, 2, 3)',
    rung: Q,
    build: (f) =>
      f.claim(
        'collinear',
        c('divide', 'A', 'B', n(-1)),
        c('divide', 'B', 'C', n(-2)),
        c('divide', 'A', 'C', n('-1/2')),
      ),
  },
  {
    name: 'La Hire: Q on the polar of D ⇒ D on the polar of Q',
    rung: Q,
    build: (f) =>
      f.add('Q', c('on', c('polar', 'D', 'w'), n('1/2'))).claim('on', 'D', c('polar', 'Q', 'w')),
  },
  {
    name: 'median to the hypotenuse is half of it',
    rung: Q,
    build: (f) =>
      f
        .add('P', c('on', c('diameter_circle', 'A', 'B'), n(2), n(1)))
        .claim('length', 'M_c', 'P', 'M_c', 'A', n(1)),
  },
  {
    name: 'incircle tangent to BC (note B)',
    rung: NUM,
    build: (f) => f.claim('tangent', c('incircle', 'A', 'B', 'C'), c('line', 'B', 'C')),
  },
  {
    name: 'Feuerbach: nine-point circle tangent to the incircle',
    rung: NUM,
    build: (f) =>
      f.claim('tangent', c('ninepoint_circle', 'A', 'B', 'C'), c('incircle', 'A', 'B', 'C')),
  },
  {
    name: 'Feuerbach: nine-point circle tangent to an excircle',
    rung: NUM,
    build: (f) =>
      f.claim('tangent', c('ninepoint_circle', 'A', 'B', 'C'), c('excircle', 'A', 'B', 'C')),
  },
  {
    name: 'angle bisector theorem',
    rung: NUM,
    build: (f) =>
      f
        .def('P', 'intersect', c('bisector', 'B', 'A', 'C'), c('line', 'B', 'C'))
        .claim('ratio', 'B', 'P', 'P', 'C', 'A', 'B', 'A', 'C'),
  },
  {
    name: 'Napoleon triangle is equilateral',
    rung: NUM,
    build: (f) => napoleon(f).claim('length', 'N_a', 'N_b', 'N_b', 'N_c', n(1)),
  },
  {
    name: 'equal tangents from an outside point',
    rung: NUM,
    build: (f) =>
      f
        .def('T_1', 'tangent_point', 'D', 'w', orient(1))
        .def('T_2', 'tangent_point', 'D', 'w', orient(-1))
        .claim('length', 'D', 'T_1', 'D', 'T_2', n(1)),
  },
  {
    name: 'acute triangle: ∠BHC + ∠A = 180°',
    rung: Q,
    build: (f) => f.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180)),
  },
  {
    name: 'derived layer: H* on ω under reflect(line(B, C)) (note C)',
    rung: Q,
    build: (f) =>
      f
        .def('t', 'reflect', c('line', 'B', 'C'))
        .derived('ref', 't')
        .claim('on', 'H*', 'w'),
  },
  {
    name: 'derived layer: ω* passes through H',
    rung: Q,
    build: (f) =>
      f
        .def('t', 'reflect', c('line', 'B', 'C'))
        .derived('ref', 't')
        .claim('on', 'H', 'w*'),
  },
  {
    name: 'exactly tangent: the tangent at P touches ω (note B)',
    rung: Q,
    build: (f) => onOmega(f, 'P').claim('tangent', c('tangent', 'P', 'w'), 'w'),
  },
  {
    name: 'exactly tangent: BC touches the circle about O through M_a (note B)',
    rung: Q,
    build: (f) => f.claim('tangent', c('line', 'B', 'C'), c('circle', 'O', 'M_a')),
  },
  {
    name: '∡(BC, altitude from A) = 90°',
    rung: Q,
    build: (f) =>
      f.claim('dangle_lines', c('line', 'B', 'C'), c('perp', 'A', c('line', 'B', 'C')), n(90)),
  },
  {
    name: 'arc midpoint on the bisector (on_arc)',
    rung: NUM,
    build: (f) =>
      f
        .def('X', 'intersect', c('perp_bisector', 'B', 'C'), 'w', onArc('B', 'C', 'A', true))
        .claim('angle_eq', 'B', 'A', 'X', 'X', 'A', 'C'),
  },
];
