import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import {
  abs,
  half,
  isZeroNormalized,
  isZeroVec,
  signNormalized,
  two,
  vLerp,
  vRot90,
  vec,
} from '../src/geom';

const ctx = { scale: 1 };

describe('field-generic geometry helpers', () => {
  it('abs: exact, banded and mod p', () => {
    expect(abs(FloatField, -3, 'length', ctx)).toBe(3);
    expect(abs(FloatField, 3, 'length', ctx)).toBe(3);
    expect(abs(FloatField, -1e-8, 'length', ctx)).toBe(1e-8);
    expect(abs(FloatField, -1e-12, 'length', ctx)).toBe(1e-12);
    expect(abs(RationalField, rational(-2n, 3n), 'area', ctx)).toEqual(rational(2n, 3n));
    expect(abs(RationalField, rational(0n), 'area', ctx)).toEqual(rational(0n));
    expect(abs(ModPField, 5n, 'area', ctx)).toEqual({
      kind: 'inexact',
      reason: 'absolute values need an order, which ModPField lacks',
    });
    expect(() =>
      abs({ ...FloatField, sign: () => 'bogus' } as unknown as Field<number>, 1, 'area', ctx),
    ).toThrow(/unexpected field sign/);
  });

  it('isZeroVec is the max-norm test against EPS·scale', () => {
    expect(isZeroVec(FloatField, vec(1e-9, -1e-9), ctx)).toBe(true);
    expect(isZeroVec(FloatField, vec(1e-9, 2e-9), ctx)).toBe(false);
    expect(isZeroVec(FloatField, vec(1e-8, 0), { scale: 100 })).toBe(true);
    expect(isZeroVec(RationalField, vec(rational(0n), rational(1n, 10n ** 30n)), ctx)).toBe(false);
  });

  it('normalized zero and sign tests measure x / √n (exact fields test x itself)', () => {
    // sin θ = 2e-10 between two unit directions is zero; 2e-8 is in the band.
    expect(isZeroNormalized(FloatField, 2e-10, 1, 'dimensionless', ctx)).toBe(true);
    expect(signNormalized(FloatField, 2e-8, 1, 'dimensionless', ctx)).toBe('ambiguous');
    // The same angle between short directions (|u||v| = 1e-10) scales with the norm.
    expect(isZeroNormalized(FloatField, 1e-12, 1e-20, 'dimensionless', ctx)).toBe(false);
    expect(signNormalized(FloatField, -1e-12, 1e-20, 'dimensionless', ctx)).toBe(-1);
    // √n not representable → exact test of x.
    expect(
      isZeroNormalized(RationalField, rational(1n, 10n ** 20n), rational(2n), 'dimensionless', ctx),
    ).toBe(false);
    expect(isZeroNormalized(RationalField, rational(0n), rational(2n), 'dimensionless', ctx)).toBe(
      true,
    );
    expect(signNormalized(RationalField, rational(-3n), rational(4n), 'dimensionless', ctx)).toBe(
      -1,
    );
    expect(signNormalized(ModPField, 3n, 4n, 'dimensionless', ctx)).toBe('none');
    // A zero norm (never produced by the tools) falls back to the raw test.
    expect(isZeroNormalized(FloatField, 1, 0, 'dimensionless', ctx)).toBe(false);
  });

  it('constants and vector helpers', () => {
    expect([two(FloatField), half(FloatField)]).toEqual([2, 0.5]);
    expect((half(ModPField) * 2n) % ((1n << 61n) - 1n)).toBe(1n);
    expect(vRot90(FloatField, vec(1, 2))).toEqual({ x: -2, y: 1 });
    expect(vLerp(FloatField, vec(0, 0), vec(4, 8), 0.25)).toEqual({ x: 1, y: 2 });
  });
});
