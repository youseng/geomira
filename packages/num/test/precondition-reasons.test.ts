/**
 * Every precondition of num names its cause (ADR-0002: "preconditions throw RangeError", a
 * caller bug that must say which call and which input), and every Inexact says why the
 * number is not representable: these reasons reach the debug report and the Undefined and
 * Inexact reasons the user reads. The tests check the cause each reason names, not its
 * wording. Field names appear in those reasons ("…needs an order, which ModPField lacks").
 * (Run 13: the nightly's surviving StringLiteral mutants.)
 */
import { describe, expect, it } from 'vitest';
import { bitLength, isqrt, modInverse } from '../src/bigint';
import { cPow } from '../src/complex';
import { isInexact } from '../src/field';
import { FloatField } from '../src/float-field';
import { ModPField } from '../src/modp';
import { div, fromInteger, fromNumber, rational, sqrtExact, toNumber } from '../src/rational';
import { RationalField } from '../src/rational-field';
import { createRng, restoreRng, uniformBigInt } from '../src/rng';
import {
  classifyResidual,
  isZero,
  isZeroDimless,
  noiseFloor,
  residualThresholds,
  sign3,
  toleranceContext,
} from '../src/tolerance';

const CTX = toleranceContext(1);

function reasonOf(v: unknown): string {
  return isInexact(v) ? v.reason : `not Inexact: ${String(v)}`;
}

describe('precondition errors name their cause', () => {
  it('bigint helpers', () => {
    expect(() => bitLength(-1n)).toThrow(/bitLength.*negative/u);
    expect(() => isqrt(-4n)).toThrow(/isqrt.*negative/u);
    expect(() => modInverse(4n, 8n)).toThrow(/no inverse/u);
  });

  it('rationals', () => {
    expect(() => rational(1n, 0n)).toThrow(/zero denominator/u);
    expect(() => fromInteger(0.5)).toThrow(/safe integer.*0\.5/u);
    expect(() => div(rational(1n), rational(0n))).toThrow(/division by zero/u);
    expect(() => sqrtExact(rational(-4n))).toThrow(/square root of a negative/u);
    expect(() => toNumber(rational(10n ** 400n))).toThrow(/beyond the double range/u);
    expect(() => fromNumber(Number.NaN)).toThrow(/not a finite number: NaN/u);
  });

  it('complex powers', () => {
    expect(() => cPow(RationalField, { re: rational(1n), im: rational(0n) }, -1)).toThrow(
      /exponent.*non-negative integer.*-1/u,
    );
  });

  it('FloatField', () => {
    expect(() => FloatField.sin(Number.POSITIVE_INFINITY)).toThrow(/non-finite/u);
    expect(() => FloatField.atan2(Number.NaN, 1)).toThrow(/atan2 of a non-finite/u);
    expect(() => FloatField.atan2(1, Number.NaN)).toThrow(/atan2 of a non-finite/u);
    expect(() => FloatField.atan2(0, 0)).toThrow(/atan2\(0, 0\)/u);
    expect(() => FloatField.div(1, 0)).toThrow(/division by zero/u);
    expect(() => FloatField.sqrt(-1)).toThrow(/sqrt of -1/u);
  });

  it('RationalField', () => {
    expect(() => RationalField.atan2(rational(0n), rational(0n))).toThrow(/atan2\(0, 0\)/u);
  });

  it('seeds, streams and draws', () => {
    expect(() => createRng(-1)).toThrow(/seed.*-1/u);
    expect(() => createRng(1).nextInt(0)).toThrow(/nextInt bound.*0/u);
    expect(() => createRng(1).uniform(2, 1)).toThrow(/lo ≤ hi.*2, 1/u);
    expect(() => restoreRng(1, [1, 2, 3, 2 ** 32])).toThrow(/uint32/u);
    expect(() => restoreRng(1, [0, 0, 0, 0])).toThrow(/all zero/u);
    expect(() => uniformBigInt(createRng(1), 0n)).toThrow(/uniformBigInt bound.*0/u);
    expect(() => uniformBigInt(createRng(1), -3n)).toThrow(/uniformBigInt bound.*-3/u);
  });

  it('tolerances', () => {
    expect(() => toleranceContext(-1)).toThrow(/figure diameter.*-1/u);
    expect(() => isZero(0, 'length', { scale: 0.5 })).toThrow(/ctx\.scale.*0\.5/u);
    expect(() => isZero(Number.NaN, 'length', CTX)).toThrow(/isZero: non-finite/u);
    expect(() => isZeroDimless(Number.NaN)).toThrow(/isZeroDimless: non-finite/u);
    expect(() => sign3(Number.NaN, 'length', CTX)).toThrow(/sign3: non-finite/u);
    expect(() => noiseFloor(0, [])).toThrow(/at least one perturbation/u);
    expect(() => residualThresholds(-1)).toThrow(/noise floor.*-1/u);
    // classifyResidual names both inputs, also when only the floor is negative.
    expect(() => classifyResidual(0.5, -1)).toThrow(/residual and floor.*0\.5, -1/u);
  });
});

describe('Inexact reasons and field names', () => {
  it('each field names itself', () => {
    expect([FloatField.name, RationalField.name, ModPField.name]).toEqual([
      'FloatField',
      'RationalField',
      'ModPField',
    ]);
  });

  it('a number beyond the double range, a denominator divisible by p, an irrational angle', () => {
    expect(reasonOf(FloatField.fromRational(rational(10n ** 400n)))).toMatch(
      /beyond the double range/u,
    );
    const p = 2n ** 61n - 1n;
    expect(reasonOf(ModPField.fromRational(rational(1n, p)))).toMatch(/divisible by p/u);
    expect(reasonOf(RationalField.atan2(rational(1n), rational(2n)))).toMatch(
      /atan2\(1, 2\) is not a rational number of degrees/u,
    );
  });
});
