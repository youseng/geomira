/**
 * A property (or theorem) test for every tool (CLAUDE.md: every new tool comes with one),
 * on random figures, over RationalField (exact) and FloatField. A meta-test checks that
 * every registry tool is covered here or in theorems.test.ts.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { LAW_TIMEOUT } from './helpers/laws';
import { call } from '../src/expr';
import { REGISTRY, num, type Builder } from './helpers/doc';
import { asNum, forFigures, numIs, samePoints, type Figure, type Pts } from './helpers/figure';
import { CIRCLE_PROPERTIES } from './helpers/circle-properties';
import { CIRCLE_PROPERTIES_2 } from './helpers/circle-properties-2';
import { FUNCTION_PROPERTIES } from './helpers/function-properties';
import { GAP_PROPERTIES } from './helpers/gap-properties';
import { BRANCH_PROPERTIES } from './helpers/branch-properties';
import { TRANSFORM_PROPERTIES } from './helpers/transform-properties';
import { DISPLAY_PROPERTIES } from './helpers/display-properties';

interface Property {
  readonly tools: readonly string[];
  readonly name: string;
  readonly build: (b: Builder, p: Pts) => void;
  readonly required: readonly string[];
  readonly check: <T>(f: Figure<T>) => boolean;
  /** Fields to run over (default both). */
  readonly fields?: readonly Field<unknown>[];
}

const FIGURES = 60;
const BOTH = [RationalField, FloatField] as Field<unknown>[];
const FLOAT = [FloatField] as Field<unknown>[];

const PROPERTIES: readonly Property[] = [
  {
    tools: ['point', 'param'],
    name: 'point(param(…), y) reproduces its coordinates',
    build: (b) => {
      b.add('t', call('param', [num(-3), num(5), num('7/4')]));
      b.add('P', call('point', [b.ref('t'), num('-2/3')]));
      b.add('Q', call('point', [num('7/4'), num('-2/3')]));
    },
    required: ['P'],
    check: (f) => samePoints(f, 'P', 'Q') && numIs(f, 't', '7/4'),
  },
  {
    tools: ['midpoint', 'divide', 'ratio'],
    name: 'midpoint(A, B) = divide(A, B, 1/2) and MA = MB',
    build: (b, [A, B]) => {
      b.call('M', 'midpoint', A, B);
      b.call('M_2', 'divide', A, B, num('1/2'));
      b.call('r', 'ratio', b.ref('M'), A, b.ref('M'), B);
    },
    required: ['r'],
    check: (f) => samePoints(f, 'M', 'M_2') && numIs(f, 'r', '1'),
  },
  {
    tools: ['divide', 'area'],
    name: 'divide(A, B, t) is on line AB, with divide(A, B, 0) = A and divide(A, B, 1) = B',
    build: (b, [A, B]) => {
      b.call('P', 'divide', A, B, num('-5/3'));
      b.call('P_0', 'divide', A, B, num(0));
      b.call('P_1', 'divide', A, B, num(1));
      b.call('s', 'area', A, B, b.ref('P'));
    },
    required: [],
    check: (f) => samePoints(f, 'P_0', 'A') && samePoints(f, 'P_1', 'B') && numIs(f, 's', '0'),
  },
  {
    tools: ['foot', 'angle', 'line'],
    name: 'foot(C, A, B) is on AB, foot(C, line(A, B)) agrees, and angle C F A is 90°',
    build: (b, [A, B, C]) => {
      b.call('F', 'foot', C, A, B);
      b.call('F_2', 'foot', C, call('line', [A, B]));
      b.call('F_3', 'foot', b.ref('F'), A, B);
      b.call('a', 'angle', C, b.ref('F'), A);
    },
    required: ['a'],
    check: (f) => samePoints(f, 'F', 'F_2') && samePoints(f, 'F', 'F_3') && numIs(f, 'a', '90'),
  },
  {
    tools: ['intersect', 'line', 'foot'],
    name: 'intersect(l, m) lies on both lines and is symmetric',
    build: (b, [A, B, C, D]) => {
      const [l, m] = [b.call('l', 'line', A, B), b.call('m', 'line', C, D)];
      b.call('X', 'intersect', l, m);
      b.call('Y', 'intersect', m, l);
      b.call('X_l', 'foot', b.ref('X'), l);
      b.call('X_m', 'foot', b.ref('X'), m);
    },
    required: ['X'],
    check: (f) => samePoints(f, 'X', 'Y') && samePoints(f, 'X', 'X_l') && samePoints(f, 'X', 'X_m'),
  },
  {
    tools: ['circumcenter', 'ratio'],
    name: 'the circumcenter is equidistant from the vertices',
    build: (b, [A, B, C]) => {
      const O = b.call('O', 'circumcenter', A, B, C);
      b.call('r_1', 'ratio', O, A, O, B);
      b.call('r_2', 'ratio', O, A, O, C);
    },
    required: ['O'],
    check: (f) => numIs(f, 'r_1', '1') && numIs(f, 'r_2', '1'),
  },
  {
    tools: ['segment', 'perp_bisector', 'intersect', 'midpoint'],
    name: 'segment AB meets its perpendicular bisector at its midpoint',
    build: (b, [A, B]) => {
      b.call('X', 'intersect', call('segment', [A, B]), call('perp_bisector', [A, B]));
      b.call('M', 'midpoint', A, B);
    },
    required: ['X'],
    check: (f) => samePoints(f, 'X', 'M'),
  },
  {
    tools: ['perp_bisector', 'foot', 'ratio'],
    name: 'points of the perpendicular bisector are equidistant from A and B',
    build: (b, [A, B, C]) => {
      const X = b.call('X', 'foot', C, call('perp_bisector', [A, B]));
      b.call('r', 'ratio', X, A, X, B);
    },
    required: ['r'],
    check: (f) => numIs(f, 'r', '1'),
  },
  {
    tools: ['ray', 'perp', 'intersect', 'divide'],
    name: 'a ray meets the perpendicular at B, never the one behind A',
    build: (b, [A, B]) => {
      const r = b.call('r', 'ray', A, B);
      b.call('X', 'intersect', r, call('perp', [B, call('line', [A, B])]));
      const behind = b.call('Z', 'divide', A, B, num(-1));
      b.call('Y', 'intersect', r, call('perp', [behind, call('line', [A, B])]));
    },
    required: ['X'],
    check: (f) => samePoints(f, 'X', 'B') && f.get('Y').kind === 'undefined',
  },
  {
    tools: ['parallel', 'intersect'],
    name: 'parallel(C, AB) never meets AB, and parallel(A, AB) coincides with it',
    build: (b, [A, B, C]) => {
      const l = b.call('l', 'line', A, B);
      b.call('X', 'intersect', l, call('parallel', [C, l]));
      b.call('Y', 'intersect', l, call('parallel', [A, l]));
    },
    required: [],
    check: (f) => {
      const [x, y] = [f.get('X'), f.get('Y')];
      return (
        x.kind === 'undefined' &&
        /parallel|coincident/.test(x.reason) &&
        y.kind === 'undefined' &&
        y.reason === 'coincident lines'
      );
    },
  },
  {
    tools: ['perp', 'angle', 'intersect'],
    name: 'perp(C, AB) meets AB at a right angle',
    build: (b, [A, B, C]) => {
      const l = b.call('l', 'line', A, B);
      const X = b.call('X', 'intersect', l, call('perp', [C, l]));
      b.call('a', 'angle', A, X, C);
    },
    required: ['a'],
    check: (f) => numIs(f, 'a', '90'),
  },
  {
    tools: ['centroid', 'divide', 'midpoint'],
    name: 'centroid(A, B, C) = divide(A, midpoint(B, C), 2/3)',
    build: (b, [A, B, C]) => {
      b.call('G', 'centroid', A, B, C);
      b.call('G_2', 'divide', A, call('midpoint', [B, C]), num('2/3'));
    },
    required: [],
    check: (f) => samePoints(f, 'G', 'G_2'),
  },
  {
    tools: ['orthocenter', 'angle'],
    name: 'AH ⟂ BC: the angle between AH and BC at their intersection is 90°',
    build: (b, [A, B, C]) => {
      const H = b.call('H', 'orthocenter', A, B, C);
      const X = b.call('X', 'intersect', call('line', [A, H]), call('line', [B, C]));
      b.call('a', 'angle', A, X, C);
    },
    required: ['a'],
    check: (f) => numIs(f, 'a', '90'),
  },
  {
    tools: ['polygon', 'area', 'midpoint'],
    name: 'area(polygon(A, B, C)) = area(A, B, C) = 2·area(A, B, M_a), any vertex order',
    build: (b, [A, B, C]) => {
      b.call('s', 'area', call('polygon', [A, B, C]));
      b.call('s_2', 'area', C, A, B);
      b.call('s_3', 'area', A, C, B);
      b.call('h', 'area', A, B, call('midpoint', [B, C]));
      b.call('k', 'div', b.ref('s'), b.ref('h'));
    },
    required: ['k'],
    check: (f) => {
      const [s, t, u] = [asNum(f.get('s')), asNum(f.get('s_2')), asNum(f.get('s_3'))];
      return (
        f.F.isZero(f.F.sub(s, t), 'area', f.ctx) &&
        f.F.isZero(f.F.sub(s, u), 'area', f.ctx) &&
        numIs(f, 'k', '2')
      );
    },
  },
  {
    tools: ['dist', 'foot'],
    name: 'Pythagoras: AC² = AF² + FC² with F = foot(C, AB); dist(C, AB) = FC',
    build: (b, [A, B, C]) => {
      const F = b.call('F', 'foot', C, A, B);
      for (const [n, x, y] of [
        ['ac', A, C],
        ['af', A, F],
        ['fc', F, C],
      ] as const)
        b.call(n, 'dist', x, y);
      b.call('h', 'dist', C, call('line', [A, B]));
    },
    required: ['fc'],
    check: (f) => {
      const sq = (n: string) => f.F.mul(asNum(f.get(n)), asNum(f.get(n)));
      const pyth = f.F.sub(sq('ac'), f.F.add(sq('af'), sq('fc')));
      return (
        f.F.isZero(pyth, 'area', f.ctx) &&
        f.F.isZero(f.F.sub(asNum(f.get('h')), asNum(f.get('fc'))), 'length', f.ctx)
      );
    },
    fields: FLOAT,
  },
  {
    tools: ['ratio', 'mul'],
    name: 'ratio(A, B, C, D) · ratio(C, D, A, B) = 1',
    build: (b, [A, B, C, D]) => {
      b.call('p', 'mul', call('ratio', [A, B, C, D]), call('ratio', [C, D, A, B]));
    },
    required: ['p'],
    check: (f) => numIs(f, 'p', '1'),
    fields: FLOAT,
  },
  {
    tools: ['angle', 'add'],
    name: 'the angles of a triangle add up to 180°',
    build: (b, [A, B, C]) => {
      b.call(
        's',
        'add',
        call('add', [call('angle', [B, A, C]), call('angle', [A, B, C])]),
        call('angle', [A, C, B]),
      );
    },
    required: ['s'],
    check: (f) => numIs(f, 's', '180'),
    fields: FLOAT,
  },
  {
    tools: ['dangle', 'add'],
    name: 'directed angles: ∡BAC + ∡CBA + ∡ACB ≡ 0 and ∡ABC + ∡CBA ≡ 0 (mod 180°)',
    build: (b, [A, B, C]) => {
      b.call(
        's',
        'add',
        call('add', [call('dangle', [B, A, C]), call('dangle', [C, B, A])]),
        call('dangle', [A, C, B]),
      );
      b.call('t', 'add', call('dangle', [A, B, C]), call('dangle', [C, B, A]));
    },
    required: ['s', 't'],
    check: (f) =>
      ['s', 't'].every((n) => numIs(f, n, '0') || numIs(f, n, '180') || numIs(f, n, '360')),
    fields: FLOAT,
  },
  ...CIRCLE_PROPERTIES,
  ...CIRCLE_PROPERTIES_2,
  ...FUNCTION_PROPERTIES,
  ...GAP_PROPERTIES,
  ...BRANCH_PROPERTIES,
  ...TRANSFORM_PROPERTIES,
  ...DISPLAY_PROPERTIES,
  {
    tools: ['add', 'sub', 'mul', 'div', 'neg'],
    name: 'arithmetic: a − b = a + (−b), (a·b)/b = a, exact values carried',
    build: (b) => {
      const [x, y] = [num('7/3'), num('-5/4')];
      b.call('d_1', 'sub', x, y);
      b.call('d_2', 'add', x, call('neg', [y]));
      b.call('q', 'div', call('mul', [x, y]), y);
    },
    required: [],
    check: (f) => {
      const [d1, d2] = [f.get('d_1'), f.get('d_2')];
      return (
        d1.kind === 'number' &&
        d2.kind === 'number' &&
        JSON.stringify(d1.exact, (_k, v: unknown) => (typeof v === 'bigint' ? String(v) : v)) ===
          '{"num":"43","den":"12"}' &&
        numIs(f, 'd_2', '43/12') &&
        numIs(f, 'q', '7/3')
      );
    },
  },
];

describe('tool properties on random figures', { timeout: LAW_TIMEOUT }, () => {
  it('every registry tool has a property or theorem test', () => {
    const covered = new Set(PROPERTIES.flatMap((p) => p.tools));
    expect(REGISTRY.tools.map((t) => t.name).filter((n) => !covered.has(n))).toEqual([]);
  });

  for (const p of PROPERTIES) {
    for (const F of p.fields ?? BOTH) {
      it(`${p.name} (${F.name})`, () => {
        const used = forFigures(F, FIGURES, p.build, p.required, (fig, i) => {
          expect(p.check(fig), `figure ${String(i)}`).toBe(true);
        });
        expect(used).toBeGreaterThan(FIGURES * 0.8);
      });
    }
  }
});
