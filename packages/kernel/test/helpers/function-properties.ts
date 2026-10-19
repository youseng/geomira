/**
 * Property tests of sqrt, sin, cos and tan (ADR-0005), spread into tools.property.test.ts.
 * Exact over Q where the values are rational: √(area²) = area, and the angles of a right
 * angle and of a 45° angle built from the figure (the measures carry no exact value, so
 * these exercise each field's own decision). Over floats: sin² + cos² = 1, tan = sin / cos,
 * sin(180° − θ) = sin θ on the figure's angles.
 */
import { call } from '../../src/expr';
import type { Value } from '../../src/value';
import { num, q, type Builder } from './doc';
import { asNum, numIs, type Figure } from './figure';
import { FLOAT, type CircleProperty } from './circle-properties';

/** Whether two named numbers are equal up to the field's dimensionless zero test. */
function sameNum<T>(f: Figure<T>, a: string, b: string): boolean {
  return f.F.isZero(f.F.sub(asNum(f.get(a)), asNum(f.get(b))), 'dimensionless', f.ctx);
}

function exactIs<T>(v: Value<T>, text: string): boolean {
  const e = q(text);
  return v.kind === 'number' && v.exact?.num === e.num && v.exact.den === e.den;
}

/** n is Undefined with tan's 90° reason. */
function rightAngleTan<T>(f: Figure<T>, n: string): boolean {
  const v = f.get(n);
  return v.kind === 'undefined' && v.reason === 'tan is undefined at 90° (mod 180°)';
}

/** X = A + rot90(B − A) and M = the midpoint of BX: ∠BAX = 90°, ∠BAM = 45° exactly. */
function rightAndHalf(b: Builder, A: Parameters<CircleProperty['build']>[1][0], B: typeof A) {
  b.call('l', 'perp', A, call('line', [A, B]));
  b.call('X', 'on', b.ref('l'), num(1));
  b.call('M', 'midpoint', B, b.ref('X'));
  b.call('r', 'angle', B, A, b.ref('X'));
  b.call('h', 'angle', B, A, b.ref('M'));
}

function sinCosTan(b: Builder, theta: Parameters<Builder['call']>[2], suffix: string): void {
  b.call(`s${suffix}`, 'sin', theta);
  b.call(`c${suffix}`, 'cos', theta);
  b.call(`t${suffix}`, 'tan', theta);
}

export const FUNCTION_PROPERTIES: readonly CircleProperty[] = [
  {
    tools: ['sqrt', 'area', 'mul', 'neg'],
    name: 'sqrt: √(area²) = area exactly, √(−area²) is Undefined, √ of an exact square is exact',
    build: (b, [A, B, C]) => {
      b.call('a', 'area', A, B, C);
      b.call('s', 'sqrt', call('mul', [b.ref('a'), b.ref('a')]));
      b.call('n', 'sqrt', call('neg', [call('mul', [b.ref('a'), b.ref('a')])]));
      b.call('k', 'sqrt', call('mul', [num('49/16'), call('div', [num(9), num(4)])]));
    },
    required: ['s'],
    check: (f) =>
      sameNum(f, 's', 'a') &&
      (f.get('n').kind === 'undefined' || numIs(f, 'a', '0')) &&
      numIs(f, 'k', '21/8') &&
      exactIs(f.get('k'), '21/8'),
  },
  {
    tools: ['sin', 'cos', 'tan', 'perp', 'on', 'midpoint', 'angle'],
    name: 'sin/cos/tan at a constructed right angle and 45° angle: exact over Q, tan(90°) Undefined',
    build: (b, [A, B]) => {
      rightAndHalf(b, A, B);
      sinCosTan(b, b.ref('r'), '_r');
      sinCosTan(b, b.ref('h'), '_h');
      b.call('s_2', 'sin', call('mul', [num(2), b.ref('h')]));
      b.call('c_2', 'cos', call('add', [b.ref('h'), b.ref('h')]));
      b.call('t_3', 'tan', call('mul', [num(3), b.ref('h')]));
    },
    required: ['r', 'h'],
    check: (f) =>
      numIs(f, 'r', '90') &&
      numIs(f, 's_r', '1') &&
      numIs(f, 'c_r', '0') &&
      rightAngleTan(f, 't_r') &&
      numIs(f, 'h', '45') &&
      numIs(f, 't_h', '1') &&
      numIs(f, 's_2', '1') &&
      numIs(f, 'c_2', '0') &&
      numIs(f, 't_3', '-1') &&
      // sin 45° = cos 45° = √2/2: not rational, so Inexact exactly when the field is exact.
      (f.F.kind === 'float' ? sameNum(f, 's_h', 'c_h') : f.get('s_h').kind === 'inexact'),
  },
  {
    tools: ['sin', 'cos', 'tan'],
    name: 'exact angles carry exact values: sin 30° = 1/2, cos 120° = −1/2, tan 135° = −1',
    build: (b) => {
      b.call('s', 'sin', num(30));
      b.call('c', 'cos', call('add', [num(100), num(20)]));
      b.call('t', 'tan', call('neg', [num(-135)]));
    },
    required: ['s', 'c', 't'],
    check: (f) =>
      exactIs(f.get('s'), '1/2') &&
      exactIs(f.get('c'), '-1/2') &&
      exactIs(f.get('t'), '-1') &&
      numIs(f, 's', '1/2') &&
      numIs(f, 'c', '-1/2') &&
      numIs(f, 't', '-1'),
  },
  {
    tools: ['sin', 'cos', 'tan', 'angle', 'dangle', 'sub'],
    name: 'sin² + cos² = 1, tan = sin / cos and sin(180° − θ) = sin θ on the figure’s angles',
    build: (b, [A, B, C]) => {
      b.call('u', 'angle', B, A, C);
      b.call('w', 'dangle', C, B, A);
      sinCosTan(b, b.ref('u'), '_1');
      sinCosTan(b, b.ref('w'), '_2');
      b.call('s_3', 'sin', call('sub', [num(180), b.ref('u')]));
    },
    required: ['t_1', 't_2'],
    check: (f) => {
      const { F } = f;
      return ['_1', '_2'].every((k) => {
        const [s, c, t] = [`s${k}`, `c${k}`, `t${k}`].map((n) => asNum(f.get(n)));
        if (s === undefined || c === undefined || t === undefined) return false;
        const pyth = F.sub(F.add(F.mul(s, s), F.mul(c, c)), F.one);
        const ratio = F.sub(F.mul(t, c), s);
        return (
          F.isZero(pyth, 'dimensionless', f.ctx) &&
          F.isZero(ratio, 'dimensionless', f.ctx) &&
          sameNum(f, 's_3', 's_1')
        );
      });
    },
    fields: FLOAT,
  },
];
