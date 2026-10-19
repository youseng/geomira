import { describe, expect, it } from 'vitest';
import {
  BAND,
  EPS,
  FALSE_ABS,
  FALSE_FACTOR,
  FLOOR_DELTA,
  FLOOR_MAX,
  FLOOR_MIN,
  FLOOR_SAMPLES,
  MAX_SCALE,
  TRUE_FACTOR,
  bandThreshold,
  classifyResidual,
  isZero,
  isZeroArea,
  isZeroDimless,
  isZeroLen,
  noiseFloor,
  residualThresholds,
  sign3,
  toleranceContext,
  zeroThreshold,
  type Dim,
  type ToleranceContext,
} from '../src/tolerance';
import { createRng } from '../src/rng';
import { nextDown, nextUp } from './helpers/ulp';

const DIAMETERS = [1e-3, 1, 1e3] as const;
const DIMS: readonly Dim[] = ['length', 'area', 'dimensionless'];
const POWER: Record<Dim, number> = { length: 1, area: 2, dimensionless: 0 };

function relClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-15 * Math.abs(b);
}

describe('SPEC §3.1 constants', () => {
  it('have the specified values', () => {
    expect(EPS).toBe(1e-9);
    expect(BAND).toBe(1e-7);
    expect(FLOOR_MIN).toBe(1e-14);
    expect(FLOOR_MAX).toBe(1e-6);
    expect(FLOOR_DELTA).toBe(1e-10);
    expect(FLOOR_SAMPLES).toBe(3);
    expect(TRUE_FACTOR).toBe(100);
    expect(FALSE_FACTOR).toBe(1e4);
    expect(FALSE_ABS).toBe(1e-8);
    expect(EPS).toBeLessThan(BAND);
    expect(FLOOR_MIN).toBeLessThan(FLOOR_MAX);
  });
});

describe('toleranceContext', () => {
  it('uses the diameter, clamped below at 1 (SPEC: scale ≥ 1)', () => {
    expect(toleranceContext(1e-3).scale).toBe(1);
    expect(toleranceContext(0).scale).toBe(1);
    expect(toleranceContext(1).scale).toBe(1);
    expect(toleranceContext(1e3).scale).toBe(1e3);
    expect(toleranceContext(MAX_SCALE).scale).toBe(MAX_SCALE);
    expect(isZeroLen(1, toleranceContext(MAX_SCALE))).toBe(true);
    expect(sign3(1, 'length', { scale: 1 })).toBe(1);
  });

  it('rejects negative, non-finite and absurdly large diameters', () => {
    for (const d of [-1, -0.5, Number.NaN, Infinity, -Infinity, nextUp(MAX_SCALE)]) {
      expect(() => toleranceContext(d)).toThrow(RangeError);
    }
  });

  it('thresholds reject a hand-made context with an invalid scale', () => {
    for (const scale of [0.5, 0, -1, Number.NaN, Infinity, nextUp(MAX_SCALE)]) {
      const ctx: ToleranceContext = { scale };
      expect(() => zeroThreshold('length', ctx)).toThrow(RangeError);
      expect(() => bandThreshold('area', ctx)).toThrow(RangeError);
      expect(() => isZeroLen(0, ctx)).toThrow(RangeError);
      expect(() => sign3(1, 'dimensionless', ctx)).toThrow(RangeError);
    }
  });
});

describe.each(DIAMETERS)('zero tests and sign3 at figure diameter %s', (diameter) => {
  const ctx = toleranceContext(diameter);
  const s = ctx.scale;

  it.each(DIMS)('thresholds scale as EPS·scale^k and BAND·scale^k (%s)', (dim) => {
    expect(relClose(zeroThreshold(dim, ctx), EPS * s ** POWER[dim])).toBe(true);
    expect(relClose(bandThreshold(dim, ctx), BAND * s ** POWER[dim])).toBe(true);
    expect(zeroThreshold(dim, ctx)).toBeLessThan(bandThreshold(dim, ctx));
  });

  it.each(DIMS)('isZero is inclusive at the EPS threshold (%s)', (dim) => {
    const t = zeroThreshold(dim, ctx);
    for (const sgn of [1, -1]) {
      expect(isZero(sgn * t, dim, ctx)).toBe(true);
      expect(isZero(sgn * nextDown(t), dim, ctx)).toBe(true);
      expect(isZero(sgn * nextUp(t), dim, ctx)).toBe(false);
      expect(isZero(sgn * 2 * t, dim, ctx)).toBe(false);
    }
    expect(isZero(0, dim, ctx)).toBe(true);
    expect(isZero(-0, dim, ctx)).toBe(true);
  });

  it('isZeroLen / isZeroArea / isZeroDimless agree with isZero', () => {
    for (const dim of DIMS) {
      const t = zeroThreshold(dim, ctx);
      for (const x of [0, t, nextUp(t), -t, -nextUp(t), 1, -1, 1e-12, 1e-6]) {
        const expected = isZero(x, dim, ctx);
        if (dim === 'length') expect(isZeroLen(x, ctx)).toBe(expected);
        if (dim === 'area') expect(isZeroArea(x, ctx)).toBe(expected);
        if (dim === 'dimensionless') expect(isZeroDimless(x)).toBe(expected);
      }
    }
  });

  it.each(DIMS)('sign3: 0 up to EPS, ambiguous inside BAND, a sign from BAND on (%s)', (dim) => {
    const z = zeroThreshold(dim, ctx);
    const b = bandThreshold(dim, ctx);
    expect(sign3(0, dim, ctx)).toBe(0);
    expect(sign3(-0, dim, ctx)).toBe(0);
    for (const sgn of [1, -1] as const) {
      expect(sign3(sgn * z, dim, ctx)).toBe(0);
      expect(sign3(sgn * nextUp(z), dim, ctx)).toBe('ambiguous');
      expect(sign3((sgn * (z + b)) / 2, dim, ctx)).toBe('ambiguous');
      expect(sign3(sgn * nextDown(b), dim, ctx)).toBe('ambiguous');
      expect(sign3(sgn * b, dim, ctx)).toBe(sgn);
      expect(sign3(sgn * nextUp(b), dim, ctx)).toBe(sgn);
      expect(sign3(sgn * 1e6, dim, ctx)).toBe(sgn);
    }
  });

  it('a decision never flips without passing through ambiguous (scan)', () => {
    const b = bandThreshold('length', ctx);
    let previous: ReturnType<typeof sign3> = -1;
    for (let i = -400; i <= 400; i++) {
      const x = (i / 200) * b;
      const current = sign3(x, 'length', ctx);
      if (current !== previous) {
        const jump = new Set([previous, current]);
        expect(jump.has(-1) && jump.has(1)).toBe(false);
        expect(jump.has('ambiguous') || jump.has(0)).toBe(true);
      }
      previous = current;
    }
  });
});

describe('zero tests are scale-relative', () => {
  it('a length of 5e-7 is zero at diameter 1e3 but not at diameter 1', () => {
    expect(isZeroLen(5e-7, toleranceContext(1e3))).toBe(true);
    expect(isZeroLen(5e-7, toleranceContext(1))).toBe(false);
    expect(isZeroLen(5e-7, toleranceContext(1e-3))).toBe(false);
  });

  it('an area of 5e-4 is zero at diameter 1e3 (EPS·scale² = 1e-3)', () => {
    expect(isZeroArea(5e-4, toleranceContext(1e3))).toBe(true);
    expect(isZeroArea(5e-4, toleranceContext(1))).toBe(false);
  });

  it('dimensionless quantities ignore the scale', () => {
    for (const d of DIAMETERS) {
      const ctx = toleranceContext(d);
      expect(isZero(5e-10, 'dimensionless', ctx)).toBe(true);
      expect(isZero(5e-9, 'dimensionless', ctx)).toBe(false);
      expect(sign3(5e-8, 'dimensionless', ctx)).toBe('ambiguous');
    }
  });

  it('rescaling a figure keeps every decision (property, away from thresholds)', () => {
    const rng = createRng(11);
    for (let i = 0; i < 2000; i++) {
      const x = (rng.nextFloat() - 0.5) * 4e-6;
      const k = 10 ** rng.uniform(0, 3);
      const base = toleranceContext(1);
      const scaled = toleranceContext(k);
      const z = zeroThreshold('length', base);
      const b = bandThreshold('length', base);
      const margin = 1e-6;
      const nearEdge = [z, b].some((t) => Math.abs(Math.abs(x) - t) <= margin * t);
      if (nearEdge) continue;
      expect(sign3(x * k, 'length', scaled)).toBe(sign3(x, 'length', base));
      expect(sign3(x * k * k, 'area', scaled)).toBe(sign3(x, 'area', base));
    }
  });
});

describe('non-finite input to zero tests is a caller bug, never a silent answer', () => {
  const ctx = toleranceContext(1);
  it.each([Number.NaN, Infinity, -Infinity])('%s throws RangeError', (x) => {
    expect(() => isZero(x, 'length', ctx)).toThrow(RangeError);
    expect(() => isZeroLen(x, ctx)).toThrow(RangeError);
    expect(() => isZeroArea(x, ctx)).toThrow(RangeError);
    expect(() => isZeroDimless(x)).toThrow(RangeError);
    expect(() => sign3(x, 'area', ctx)).toThrow(RangeError);
  });
});

describe('a dimension outside the Dim union', () => {
  it('throws instead of guessing a power of the scale', () => {
    const escaped = 'volume' as Dim;
    expect(() => zeroThreshold(escaped, toleranceContext(1))).toThrow(TypeError);
    expect(() => isZero(0, escaped, toleranceContext(1))).toThrow(/unexpected dimension/);
  });
});

describe('residualThresholds', () => {
  it('clamps the floor at FLOOR_MIN, including floor = 0', () => {
    expect(residualThresholds(0).floor).toBe(FLOOR_MIN);
    expect(residualThresholds(FLOOR_MIN / 2).floor).toBe(FLOOR_MIN);
    expect(residualThresholds(1e-12).floor).toBe(1e-12);
  });

  it('TRUE below 100·floor, FALSE above max(1e4·floor, FALSE_ABS)', () => {
    for (const floor of [0, 1e-14, 1e-13, 1e-12, 1e-11, 1e-10, 1e-8, 1e-6]) {
      const t = residualThresholds(floor);
      const f = Math.max(floor, 1e-14);
      expect(relClose(t.trueBelow, 100 * f)).toBe(true);
      expect(relClose(t.falseAbove, Math.max(1e4 * f, 1e-8))).toBe(true);
      expect(t.trueBelow).toBeLessThan(t.falseAbove);
    }
  });
});

describe('classifyResidual', () => {
  it('floor = 0 is clamped: an exact-looking residual 0 is TRUE, not "0 < 100·0" false', () => {
    expect(classifyResidual(0, 0)).toBe('true');
    expect(classifyResidual(5e-13, 0)).toBe('true');
    expect(classifyResidual(1e-9, 0)).toBe('ambiguous');
    expect(classifyResidual(2e-8, 0)).toBe('false');
  });

  it.each([0, 1e-14, 3e-13, 1e-12, 1e-11, 1e-10, 1e-8, 1e-7, 1e-6])(
    'is exact at and around each threshold (floor %s)',
    (floor) => {
      const { trueBelow, falseAbove } = residualThresholds(floor);
      expect(classifyResidual(nextDown(trueBelow), floor)).toBe('true');
      expect(classifyResidual(trueBelow, floor)).toBe('ambiguous');
      expect(classifyResidual(nextUp(trueBelow), floor)).toBe('ambiguous');
      expect(classifyResidual(nextDown(falseAbove), floor)).toBe('ambiguous');
      expect(classifyResidual(falseAbove, floor)).toBe('ambiguous');
      expect(classifyResidual(nextUp(falseAbove), floor)).toBe('false');
    },
  );

  it('FALSE_ABS dominates small floors: 1e-10 is ambiguous at the minimum floor', () => {
    expect(residualThresholds(1e-14).falseAbove).toBe(FALSE_ABS);
    expect(classifyResidual(1e-10, 1e-14)).toBe('ambiguous');
    expect(classifyResidual(1e-10, 0)).toBe('ambiguous');
  });

  it('1e4·floor dominates large floors', () => {
    expect(classifyResidual(5e-8, 1e-11)).toBe('ambiguous');
    expect(classifyResidual(2e-7, 1e-11)).toBe('false');
  });

  it('law: a residual of 1e-10 is never FALSE, whatever the floor estimate', () => {
    const rng = createRng(3);
    for (let i = 0; i < 5000; i++) {
      const floor = 10 ** rng.uniform(-20, -6);
      expect(classifyResidual(1e-10, floor)).not.toBe('false');
    }
    expect(classifyResidual(1e-10, FLOOR_MAX)).not.toBe('false');
  });

  it('law: for a fixed floor the class is monotone in the residual (true → ambiguous → false)', () => {
    const rng = createRng(5);
    const rank = { true: 0, ambiguous: 1, false: 2, 'ill-conditioned': 3 } as const;
    for (let i = 0; i < 200; i++) {
      const floor = 10 ** rng.uniform(-16, -6);
      let previous = 0;
      for (let e = -20; e <= 0; e += 0.25) {
        const r = rank[classifyResidual(10 ** e, floor)];
        expect(r).toBeGreaterThanOrEqual(previous);
        expect(r).toBeLessThanOrEqual(2);
        previous = r;
      }
    }
  });

  it('a floor above FLOOR_MAX is ILL-CONDITIONED, whatever the residual', () => {
    expect(classifyResidual(0, FLOOR_MAX)).toBe('true');
    expect(classifyResidual(0, nextUp(FLOOR_MAX))).toBe('ill-conditioned');
    expect(classifyResidual(1, nextUp(FLOOR_MAX))).toBe('ill-conditioned');
    expect(classifyResidual(1, 1)).toBe('ill-conditioned');
  });

  it('a non-finite residual or floor is ILL-CONDITIONED (an invalid sample, not false)', () => {
    for (const bad of [Number.NaN, Infinity]) {
      expect(classifyResidual(bad, 1e-12)).toBe('ill-conditioned');
      expect(classifyResidual(1e-3, bad)).toBe('ill-conditioned');
    }
  });

  it('a negative residual or floor is a caller bug', () => {
    expect(() => classifyResidual(-1e-12, 1e-12)).toThrow(RangeError);
    expect(() => classifyResidual(1e-12, -1e-12)).toThrow(RangeError);
    expect(() => classifyResidual(-Infinity, 1e-12)).toThrow(RangeError);
    expect(() => residualThresholds(-1)).toThrow(RangeError);
  });
});

describe('noiseFloor', () => {
  it('is the largest deviation of the perturbed residuals, clamped at FLOOR_MIN', () => {
    expect(noiseFloor(1e-9, [1.5e-9, 0.2e-9, 1e-9])).toBeCloseTo(0.8e-9, 20);
    expect(noiseFloor(0, [0, 0, 0])).toBe(FLOOR_MIN);
    expect(noiseFloor(2e-15, [3e-15])).toBe(FLOOR_MIN);
  });

  it('feeds classifyResidual: a noisy evaluation is ill-conditioned, a quiet one decides', () => {
    expect(classifyResidual(1e-9, noiseFloor(1e-9, [5e-6, 1e-9, 2e-9]))).toBe('ill-conditioned');
    expect(classifyResidual(3e-16, noiseFloor(3e-16, [1e-16, 4e-16, 2e-16]))).toBe('true');
  });

  it('a NaN perturbed residual yields an ILL-CONDITIONED sample', () => {
    expect(classifyResidual(0, noiseFloor(0, [0, Number.NaN, 0]))).toBe('ill-conditioned');
  });

  it('needs at least one perturbation', () => {
    expect(() => noiseFloor(0, [])).toThrow(RangeError);
  });
});
