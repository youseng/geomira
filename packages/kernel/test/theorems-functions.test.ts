/**
 * Theorems that use sqrt, sin, cos and tan (ADR-0005), on random triangles over FloatField
 * and, where the values are rational, exactly over RationalField:
 *   - Heron: area = √(s(s − a)(s − b)(s − c)) (exact on Heronian triangles);
 *   - Pythagoras through the foot of an altitude: AC = √(AH² + HC²);
 *   - the law of sines: BC = 2R·sin A;
 *   - the law of cosines: BC² = AB² + AC² − 2·AB·AC·cos A;
 *   - in a triangle without a right angle, tan A + tan B + tan C = tan A·tan B·tan C.
 */
import { isInexact } from '@geomira/num/field';
import { describe } from 'vitest';
import { call, type Expr } from '../src/expr';
import { abs } from '../src/geom';
import { num } from './helpers/doc';
import { asNum, type Figure } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import { SIDES, sameSize, theoremTests, type Theorem } from './helpers/theorem-runner';

const sq = (x: Expr): Expr => call('mul', [x, x]);

/** Two named numbers are equal relative to their size (exactly over Q). */
function sameNums<T>(f: Figure<T>, a: string, b: string): boolean {
  return sameSize(f, asNum(f.get(a)), asNum(f.get(b)));
}

/** x = y relative to |x| + |y| + 1, for dimensionless numbers that can be large (tan). */
function sameRelative<T>(f: Figure<T>, x: T, y: T): boolean {
  const { F } = f;
  const [ax, ay] = [abs(F, x, 'dimensionless', f.ctx), abs(F, y, 'dimensionless', f.ctx)];
  if (isInexact(ax) || isInexact(ay)) return false;
  const m = F.add(F.add(ax, ay), F.one);
  return F.isZero(F.div(F.sub(x, y), m), 'dimensionless', f.ctx);
}

const FLOAT_ONLY = ['float'] as const;

const THEOREMS: readonly Theorem[] = [
  {
    name: 'Heron: area = √(s(s − a)(s − b)(s − c))',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      b.call('a', 'dist', B, C);
      b.call('b', 'dist', C, A);
      b.call('c', 'dist', A, B);
      b.call('s', 'div', call('add', [call('add', [b.ref('a'), b.ref('b')]), b.ref('c')]), num(2));
      const factor = (x: string): Expr => call('sub', [b.ref('s'), b.ref(x)]);
      b.call(
        'h',
        'sqrt',
        call('mul', [
          call('mul', [b.ref('s'), factor('a')]),
          call('mul', [factor('b'), factor('c')]),
        ]),
      );
      b.call('S', 'area', A, B, C);
    },
    required: ['h'],
    check: (f) => sameNums(f, 'h', 'S'),
  },
  {
    name: 'Pythagoras through the foot of an altitude: AC = √(AH² + HC²)',
    modes: FLOAT_ONLY,
    build: (b, [A, B, C]) => {
      b.call('H', 'foot', C, A, B);
      b.call('d', 'dist', A, C);
      b.call(
        'r',
        'sqrt',
        call('add', [sq(call('dist', [A, b.ref('H')])), sq(call('dist', [b.ref('H'), C]))]),
      );
    },
    required: ['r'],
    check: (f) => sameNums(f, 'd', 'r'),
  },
  {
    name: 'the law of sines: BC = 2R·sin A',
    modes: FLOAT_ONLY,
    build: (b, [A, B, C]) => {
      b.call('O', 'circumcenter', A, B, C);
      b.call('a', 'dist', B, C);
      b.call(
        'x',
        'mul',
        call('mul', [num(2), call('dist', [b.ref('O'), A])]),
        call('sin', [call('angle', [B, A, C])]),
      );
    },
    required: ['x'],
    check: (f) => sameNums(f, 'a', 'x'),
  },
  {
    name: 'the law of cosines: BC² = AB² + AC² − 2·AB·AC·cos A',
    modes: FLOAT_ONLY,
    build: (b, [A, B, C]) => {
      const [c, bb] = [call('dist', [A, B]), call('dist', [A, C])];
      b.call('l', 'mul', call('dist', [B, C]), call('dist', [B, C]));
      const cross = call('mul', [
        call('mul', [num(2), call('mul', [c, bb])]),
        call('cos', [call('angle', [B, A, C])]),
      ]);
      b.call('r', 'sub', call('add', [sq(c), sq(bb)]), cross);
    },
    required: ['r'],
    check: (f) => sameNums(f, 'l', 'r'),
  },
  {
    name: 'tan A + tan B + tan C = tan A·tan B·tan C (no right angle)',
    modes: FLOAT_ONLY,
    build: (b, [A, B, C]) => {
      b.call('t_A', 'tan', call('angle', [B, A, C]));
      b.call('t_B', 'tan', call('angle', [C, B, A]));
      b.call('t_C', 'tan', call('angle', [A, C, B]));
      const [x, y, z] = [b.ref('t_A'), b.ref('t_B'), b.ref('t_C')];
      b.call('s', 'add', call('add', [x, y]), z);
      b.call('p', 'mul', call('mul', [x, y]), z);
    },
    required: ['s', 'p'],
    check: (f) => sameRelative(f, asNum(f.get('s')), asNum(f.get('p'))),
  },
];

describe('theorems with sqrt, sin, cos, tan', { timeout: LAW_TIMEOUT }, () => {
  theoremTests(THEOREMS, 20261021);
});
