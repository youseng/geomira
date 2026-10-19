import { describe, expect, it } from 'vitest';
import {
  cAbs2,
  cAdd,
  cConj,
  cDiv,
  cEq,
  cMul,
  cNeg,
  cPow,
  cScale,
  cSub,
  complex,
  type Complex,
} from '../src/complex';
import {
  allExact,
  inexact,
  isInexact,
  mapExact,
  withDivisorLog,
  withSqrtLog,
  type Field,
  type Inexact,
} from '../src/field';
import { FloatField } from '../src/float-field';
import { ModPField, P } from '../src/modp';
import { RationalField } from '../src/rational-field';
import { fromInteger, rational, type Rational } from '../src/rational';
import { createRng, uniformBigInt, type Rng } from '../src/rng';
import { toleranceContext } from '../src/tolerance';

/** What the generic suite needs to know about a field under test. */
interface Harness<T> {
  readonly F: Field<T>;
  /** A random element; `nonZero` keeps it away from zero (for divisors). */
  readonly sample: (rng: Rng, nonZero: boolean) => T;
  /** Equality for identities that are exact in exact fields and approximate in floats. */
  readonly close: (a: T, b: T) => boolean;
  /** The same for complex values (norm-scaled for floats, where components can cancel). */
  readonly closeC: (a: Complex<T>, b: Complex<T>) => boolean;
  readonly ordered: boolean;
  readonly sqrtOfSquares: boolean;
  readonly exactTrigAtZero: boolean;
}

const ctx = toleranceContext(1);

function unwrap<T>(x: T | Inexact): T {
  if (isInexact(x)) throw new Error(`unexpected Inexact: ${x.reason}`);
  return x;
}

const floatHarness: Harness<number> = {
  F: FloatField,
  sample: (rng, nonZero) => {
    const x = rng.uniform(-10, 10);
    return nonZero && Math.abs(x) < 0.1 ? x + 1 : x;
  },
  close: (a, b) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)),
  closeC: (a, b) =>
    Math.hypot(a.re - b.re, a.im - b.im) <=
    1e-12 * Math.max(1, Math.hypot(a.re, a.im), Math.hypot(b.re, b.im)),
  ordered: true,
  sqrtOfSquares: true,
  exactTrigAtZero: true,
};

const rationalHarness: Harness<Rational> = {
  F: RationalField,
  sample: (rng, nonZero) => {
    const num = rng.nextInt(201) - 100;
    const den = rng.nextInt(40) + 1;
    return rational(BigInt(nonZero && num === 0 ? 1 : num), BigInt(den));
  },
  close: (a, b) => RationalField.eq(a, b),
  closeC: (a, b) => cEq(RationalField, a, b),
  ordered: true,
  sqrtOfSquares: true,
  exactTrigAtZero: true,
};

const modpHarness: Harness<bigint> = {
  F: ModPField,
  sample: (rng, nonZero) => {
    const x = uniformBigInt(rng, P);
    return nonZero && x === 0n ? 1n : x;
  },
  close: (a, b) => a === b,
  closeC: (a, b) => cEq(ModPField, a, b),
  ordered: false,
  sqrtOfSquares: false,
  exactTrigAtZero: false,
};

function conformance<T>(h: Harness<T>): void {
  const { F, close } = h;
  const N = 300;

  describe(`${F.name}: field axioms`, () => {
    it('addition: commutative, associative, identity, inverse', () => {
      const rng = createRng(101);
      for (let i = 0; i < N; i++) {
        const [a, b, c] = [h.sample(rng, false), h.sample(rng, false), h.sample(rng, false)];
        expect(F.eq(F.add(a, b), F.add(b, a))).toBe(true);
        expect(close(F.add(F.add(a, b), c), F.add(a, F.add(b, c)))).toBe(true);
        expect(F.eq(F.add(a, F.zero), a)).toBe(true);
        expect(F.eq(F.add(a, F.neg(a)), F.zero)).toBe(true);
        expect(F.eq(F.sub(a, b), F.add(a, F.neg(b)))).toBe(true);
        expect(F.eq(F.neg(F.neg(a)), a)).toBe(true);
      }
    });

    it('multiplication: commutative, associative, identity, distributive', () => {
      const rng = createRng(102);
      for (let i = 0; i < N; i++) {
        const [a, b, c] = [h.sample(rng, false), h.sample(rng, false), h.sample(rng, false)];
        expect(F.eq(F.mul(a, b), F.mul(b, a))).toBe(true);
        expect(close(F.mul(F.mul(a, b), c), F.mul(a, F.mul(b, c)))).toBe(true);
        expect(F.eq(F.mul(a, F.one), a)).toBe(true);
        expect(F.eq(F.mul(a, F.zero), F.zero) || F.isZero(F.mul(a, F.zero), 'area', ctx)).toBe(
          true,
        );
        expect(close(F.mul(a, F.add(b, c)), F.add(F.mul(a, b), F.mul(a, c)))).toBe(true);
      }
    });

    it('multiplicative inverse: a/a = 1, (a/b)·b = a; division by zero throws', () => {
      const rng = createRng(103);
      for (let i = 0; i < N; i++) {
        const a = h.sample(rng, true);
        const b = h.sample(rng, true);
        expect(F.eq(F.div(a, a), F.one)).toBe(true);
        expect(close(F.mul(F.div(a, b), b), a)).toBe(true);
        expect(close(F.div(F.one, F.div(F.one, a)), a)).toBe(true);
      }
      expect(() => F.div(F.one, F.zero)).toThrow(RangeError);
    });

    it('zero and one: isZero, sign, distinctness', () => {
      expect(F.isZero(F.zero, 'length', ctx)).toBe(true);
      expect(F.isZero(F.one, 'length', ctx)).toBe(false);
      expect(F.eq(F.zero, F.one)).toBe(false);
      expect(F.sign(F.zero, 'length', ctx)).toBe(h.ordered ? 0 : 'none');
      expect(F.sign(F.one, 'length', ctx)).toBe(h.ordered ? 1 : 'none');
      expect(F.sign(F.neg(F.one), 'length', ctx)).toBe(h.ordered ? -1 : 'none');
    });

    it('fromRational is a ring homomorphism on small rationals', () => {
      const rng = createRng(104);
      expect(F.eq(unwrap(F.fromRational(fromInteger(0))), F.zero)).toBe(true);
      expect(F.eq(unwrap(F.fromRational(fromInteger(1))), F.one)).toBe(true);
      for (let i = 0; i < N; i++) {
        const r = rational(BigInt(rng.nextInt(41) - 20), BigInt(rng.nextInt(9) + 1));
        const s = rational(BigInt(rng.nextInt(41) - 20), BigInt(rng.nextInt(9) + 1));
        const fr = unwrap(F.fromRational(r));
        const fs = unwrap(F.fromRational(s));
        const sum = rational(r.num * s.den + s.num * r.den, r.den * s.den);
        const prod = rational(r.num * s.num, r.den * s.den);
        expect(close(unwrap(F.fromRational(sum)), F.add(fr, fs))).toBe(true);
        expect(close(unwrap(F.fromRational(prod)), F.mul(fr, fs))).toBe(true);
      }
    });

    it('toNumber is finite and preserves small integers', () => {
      for (let k = -5; k <= 5; k++) {
        expect(F.toNumber(unwrap(F.fromRational(fromInteger(k))))).toBe(k);
      }
    });
  });

  describe(`${F.name}: partial operations and Inexact`, () => {
    it('sqrt of a square succeeds exactly where the field has square roots', () => {
      const rng = createRng(105);
      for (let i = 0; i < N; i++) {
        const a = h.sample(rng, false);
        const root = F.sqrt(F.mul(a, a));
        if (h.sqrtOfSquares) {
          const value = unwrap(root);
          expect(close(F.mul(value, value), F.mul(a, a))).toBe(true);
        } else {
          expect(isInexact(root)).toBe(true);
        }
      }
    });

    it('sin(0) = 0 and cos(0) = 1 exactly, or Inexact where the field has no trig', () => {
      const s = F.sin(F.zero);
      const c = F.cos(F.zero);
      const a = F.atan2(F.zero, F.one);
      if (h.exactTrigAtZero) {
        expect(F.eq(unwrap(s), F.zero)).toBe(true);
        expect(F.eq(unwrap(c), F.one)).toBe(true);
        expect(F.eq(unwrap(a), F.zero)).toBe(true);
      } else {
        expect([s, c, a].every(isInexact)).toBe(true);
      }
    });

    it('Inexact propagates through mapExact and allExact with its first reason', () => {
      const two = F.add(F.one, F.one);
      const chained = mapExact(F.sqrt(two), (r) => F.sqrt(F.add(r, F.one)));
      const all = allExact([F.sqrt(two), F.one, F.sqrt(F.add(two, F.one))]);
      if (F.kind === 'float') {
        expect(isInexact(chained)).toBe(false);
        expect(isInexact(all)).toBe(false);
      } else {
        expect(isInexact(chained)).toBe(true);
        expect(isInexact(all)).toBe(true);
        const first = F.sqrt(two);
        if (isInexact(first) && isInexact(chained) && isInexact(all)) {
          expect(chained.reason).toBe(first.reason);
          expect(all.reason).toBe(first.reason);
        }
      }
      expect(mapExact(inexact('given'), () => F.one)).toEqual(inexact('given'));
      expect(allExact([F.one, F.zero])).toEqual([F.one, F.zero]);
    });
  });

  describe(`${F.name}: divisor and square-root logs`, () => {
    it('withDivisorLog records every divisor in order, results unchanged', () => {
      const rng = createRng(106);
      const { field, divisors } = withDivisorLog(F);
      const expected: T[] = [];
      for (let i = 0; i < 20; i++) {
        const a = h.sample(rng, false);
        const b = h.sample(rng, true);
        expect(F.eq(field.div(a, b), F.div(a, b))).toBe(true);
        expected.push(b);
        expect(F.eq(field.add(a, b), F.add(a, b))).toBe(true);
      }
      expect(divisors.length).toBe(20);
      divisors.forEach((d, i) => {
        expect(F.eq(d, expected[i] ?? F.zero)).toBe(true);
      });
      expect(field.kind).toBe(F.kind);
      expect(() => field.div(F.one, F.zero)).toThrow(RangeError);
      expect(divisors.length).toBe(21);
    });

    it('withSqrtLog records every request with its outcome; logs compose', () => {
      const divLog = withDivisorLog(F);
      const sqrtLog = withSqrtLog(divLog.field);
      const four = unwrap(F.fromRational(fromInteger(4)));
      const two = unwrap(F.fromRational(fromInteger(2)));
      const r4 = sqrtLog.field.sqrt(four);
      const r2 = sqrtLog.field.sqrt(two);
      sqrtLog.field.div(F.one, two);
      expect(sqrtLog.requests.map((r) => r.arg)).toEqual([four, two]);
      expect(sqrtLog.requests.map((r) => r.result)).toEqual([r4, r2]);
      expect(divLog.divisors).toEqual([two]);
      if (F.kind === 'rational') {
        expect(isInexact(r4)).toBe(false);
        expect(isInexact(r2)).toBe(true);
      }
    });
  });

  describe(`${F.name}: Complex<T>`, () => {
    const sampleC = (rng: Rng, nonZero: boolean): Complex<T> =>
      complex(h.sample(rng, nonZero), h.sample(rng, false));
    const { closeC } = h;

    it('ring laws, conjugation and the multiplicative norm', () => {
      const rng = createRng(107);
      for (let i = 0; i < N; i++) {
        const [a, b, c] = [sampleC(rng, false), sampleC(rng, false), sampleC(rng, false)];
        expect(cEq(F, cMul(F, a, b), cMul(F, b, a))).toBe(true);
        expect(closeC(cMul(F, cMul(F, a, b), c), cMul(F, a, cMul(F, b, c)))).toBe(true);
        expect(closeC(cMul(F, a, cAdd(F, b, c)), cAdd(F, cMul(F, a, b), cMul(F, a, c)))).toBe(true);
        expect(cEq(F, cSub(F, a, b), cAdd(F, a, cNeg(F, b)))).toBe(true);
        expect(closeC(cConj(F, cMul(F, a, b)), cMul(F, cConj(F, a), cConj(F, b)))).toBe(true);
        expect(close(cAbs2(F, cMul(F, a, b)), F.mul(cAbs2(F, a), cAbs2(F, b)))).toBe(true);
        expect(cEq(F, cScale(F, a, F.one), a)).toBe(true);
        expect(cEq(F, a, cAdd(F, a, complex(F.zero, F.one)))).toBe(false);
      }
    });

    it('division inverts multiplication; division by 0 throws', () => {
      const rng = createRng(108);
      for (let i = 0; i < N; i++) {
        const a = sampleC(rng, false);
        const b = sampleC(rng, true);
        expect(closeC(cDiv(F, cMul(F, a, b), b), a)).toBe(true);
      }
      expect(() => cDiv(F, complex(F.one, F.one), complex(F.zero, F.zero))).toThrow(RangeError);
    });

    it('cPow(z, n) is repeated multiplication; n must be a non-negative integer', () => {
      const rng = createRng(109);
      for (let i = 0; i < 100; i++) {
        const z = sampleC(rng, false);
        let acc = complex(F.one, F.zero);
        for (let n = 0; n <= 6; n++) {
          expect(closeC(cPow(F, z, n), acc)).toBe(true);
          acc = cMul(F, acc, z);
        }
      }
      const z = complex(F.one, F.one);
      for (const n of [-1, 1.5, Number.NaN]) expect(() => cPow(F, z, n)).toThrow(RangeError);
    });
  });
}

conformance(floatHarness);
conformance(rationalHarness);
conformance(modpHarness);
