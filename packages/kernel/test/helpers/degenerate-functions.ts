/**
 * The functions part of degenerate.test.ts's table (sqrt, sin, cos, tan; ADR-0005).
 * `area(…)` and `angle(…)` give numbers WITHOUT an exact value (measures never set one),
 * so they exercise the field's own decision; literals carry their exact value and are
 * decided exactly in every field.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import { num, pt } from './doc';
import { FIELDS, ORDERED, at, plain, reason } from './degenerate';

/** area of the right triangle (0, 0), (a, 0), (0, b): ab/2, with no exact value. */
function area(a: string | number, b: string | number): Expr {
  return call('area', [pt(0, 0), pt(a, 0), pt(0, b)]);
}

/** The angle ∠XOY of two axis directions: exactly 90°, with no exact value. */
const RIGHT_ANGLE = call('angle', [pt(1, 0), pt(0, 0), pt(0, 1)]);

/** 1/2 in F as a plain number (mod p: the symmetric representative of 2⁻¹). */
function half<T>(F: Field<T>): number {
  return F.toNumber(F.div(F.one, F.add(F.one, F.one)));
}

const NEGATIVE = 'undefined: sqrt of a negative number';
const RIGHT = 'undefined: tan is undefined at 90° (mod 180°)';

export const FUNCTION_CASES: Record<string, Record<string, () => void>> = {
  sqrt: {
    'x < 0 → Undefined (sqrt of a negative number)': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'sqrt', num(-4)))).toBe(NEGATIVE);
        expect(reason(at(F, 'sqrt', num('-2/3')))).toBe(NEGATIVE);
        // An exact negative is decided exactly, however small (no band).
        expect(reason(at(F, 'sqrt', num(-1e-30)))).toBe(NEGATIVE);
      }
      for (const F of ORDERED) {
        expect(reason(at(F, 'sqrt', call('neg', [area(1, 3)])))).toBe(NEGATIVE);
        expect(reason(at(F, 'sqrt', call('neg', [area('1/1000', '1/1000')])))).toBe(NEGATIVE);
      }
      // Without an exact value mod p has no order: the measure is already Inexact there.
      expect(at(ModPField, 'sqrt', call('neg', [area(1, 3)])).kind).toBe('inexact');
    },
    'x within the band of 0 counts as 0 → 0': () => {
      // Inside the band (BAND = 1e-7), either sign, → 0: 2^-42 ≈ 2.3e-13 and 2^-30 ≈ 9.3e-10
      // are within EPS (sign 0); 2^-26 ≈ 1.5e-8 is between EPS and BAND (sign 'ambiguous').
      for (const x of [
        area(2 ** -20, 2 ** -21),
        area(2 ** -15, 2 ** -14),
        area(2 ** -13, 2 ** -12),
      ]) {
        expect(plain(FloatField, at(FloatField, 'sqrt', x))).toBe(0);
        expect(plain(FloatField, at(FloatField, 'sqrt', call('neg', [x])))).toBe(0);
      }
      // Just outside the band (2^-22 ≈ 2.4e-7): the root itself.
      expect(plain(FloatField, at(FloatField, 'sqrt', area(2 ** -11, 2 ** -10)))).toBe(2 ** -11);
      // Over Q the sign is exact: no band.
      expect(plain(RationalField, at(RationalField, 'sqrt', area(2 ** -20, 2 ** -21)))).toBe(
        2 ** -21,
      );
      expect(reason(at(RationalField, 'sqrt', call('neg', [area(2 ** -20, 2 ** -21)])))).toBe(
        NEGATIVE,
      );
      // An exact argument has no float uncertainty: decided exactly, also in FloatField.
      expect(plain(FloatField, at(FloatField, 'sqrt', num('1/100000000')))).toBe(1e-4);
      expect(plain(FloatField, at(FloatField, 'sqrt', num(2 ** -42)))).toBe(2 ** -21);
      // Exactly zero.
      for (const F of FIELDS) expect(at(F, 'sqrt', num(0))).toMatchObject({ kind: 'number' });
      for (const F of ORDERED)
        expect(plain(F, at(F, 'sqrt', call('sub', [area(1, 3), area(3, 1)])))).toBe(0);
    },
    'x not the square of a rational → Inexact (over Q; mod p unless x is an exact square)': () => {
      expect(reason(at(RationalField, 'sqrt', num(2)))).toBe('inexact: √(2) is not rational');
      expect(reason(at(RationalField, 'sqrt', area(1, 4)))).toBe('inexact: √(2) is not rational');
      expect(plain(RationalField, at(RationalField, 'sqrt', area(2, 9)))).toBe(3);
      expect(plain(FloatField, at(FloatField, 'sqrt', num(2)))).toBe(Math.SQRT2);
      expect(reason(at(ModPField, 'sqrt', num(2)))).toBe(
        'inexact: square roots are not evaluable mod p',
      );
      // An exact square is a rational number: representable in every field.
      expect(at(ModPField, 'sqrt', num('9/4'))).toEqual({
        kind: 'number',
        v: ModPField.fromRational({ num: 3n, den: 2n }),
        exact: { num: 3n, den: 2n },
      });
    },
  },
  sin: {
    'off the angles where it is rational → Inexact (over Q; mod p unless the angle is exact)':
      () => {
        expect(reason(at(RationalField, 'sin', num(45)))).toBe('inexact: sin(45°) is not rational');
        expect(reason(at(RationalField, 'sin', num('1/2')))).toBe(
          'inexact: sin(1/2°) is not rational',
        );
        expect(plain(FloatField, at(FloatField, 'sin', num(45)))).toBeCloseTo(Math.SQRT1_2, 15);
        expect(reason(at(ModPField, 'sin', num(45)))).toBe(
          'inexact: trigonometry is not evaluable mod p',
        );
        expect(reason(at(ModPField, 'sin', RIGHT_ANGLE))).toMatch(/^inexact/);
        for (const F of FIELDS) expect(plain(F, at(F, 'sin', num(-150)))).toBe(-half(F));
        for (const F of ORDERED) expect(plain(F, at(F, 'sin', RIGHT_ANGLE))).toBe(1);
      },
  },
  cos: {
    'off the angles where it is rational → Inexact (over Q; mod p unless the angle is exact)':
      () => {
        expect(reason(at(RationalField, 'cos', num(30)))).toBe('inexact: cos(30°) is not rational');
        expect(plain(FloatField, at(FloatField, 'cos', num(30)))).toBeCloseTo(Math.sqrt(3) / 2, 15);
        expect(reason(at(ModPField, 'cos', num(30)))).toBe(
          'inexact: trigonometry is not evaluable mod p',
        );
        for (const F of FIELDS) expect(plain(F, at(F, 'cos', num(420)))).toBe(half(F));
        for (const F of ORDERED) expect(plain(F, at(F, 'cos', RIGHT_ANGLE))).toBe(0);
      },
  },
  tan: {
    'θ ≡ 90° (mod 180°) → Undefined': () => {
      for (const F of FIELDS) {
        for (const t of [90, -90, 270, 450, -630])
          expect(reason(at(F, 'tan', num(t))), String(t)).toBe(RIGHT);
      }
      for (const F of ORDERED) {
        expect(reason(at(F, 'tan', RIGHT_ANGLE))).toBe(RIGHT);
        expect(reason(at(F, 'tan', call('add', [RIGHT_ANGLE, num(180)])))).toBe(RIGHT);
      }
    },
    'cos θ within the band of 0 counts as 0 → Undefined': () => {
      // 90° + 1e-6°: cos ≈ −1.7e-8, inside the band.
      const near = call('add', [RIGHT_ANGLE, num(1e-6)]);
      expect(reason(at(FloatField, 'tan', near))).toBe(RIGHT);
      expect(reason(at(FloatField, 'tan', num(90 + 1e-6)))).toBe(RIGHT);
      // Over Q it is not 90°, and tan of it is not rational.
      expect(at(RationalField, 'tan', near).kind).toBe('inexact');
      expect(at(RationalField, 'tan', num(90 + 1e-6)).kind).toBe('inexact');
      // Outside the band: a large, finite value.
      const far = plain(FloatField, at(FloatField, 'tan', call('add', [RIGHT_ANGLE, num(1e-3)])));
      expect(far).toBeCloseTo(-1 / Math.tan((1e-3 * Math.PI) / 180), 3);
    },
    'tan θ not rational → Inexact (over Q; mod p unless θ is an exact multiple of 45°)': () => {
      expect(reason(at(RationalField, 'tan', num(30)))).toBe('inexact: cos(30°) is not rational');
      expect(reason(at(RationalField, 'tan', num(60)))).toBe('inexact: sin(60°) is not rational');
      expect(reason(at(RationalField, 'tan', num(15)))).toBe('inexact: sin(15°) is not rational');
      expect(reason(at(ModPField, 'tan', num(30)))).toBe(
        'inexact: trigonometry is not evaluable mod p',
      );
      // tan is rational at the multiples of 45° (other than 90° mod 180°): exact everywhere.
      for (const F of FIELDS) {
        for (const [t, v] of [
          [45, 1],
          [135, -1],
          [-45, -1],
          [225, 1],
          [180, 0],
        ] as const)
          expect(plain(F, at(F, 'tan', num(t))), String(t)).toBe(v);
      }
    },
  },
};
