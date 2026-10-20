/**
 * The float decision (SPEC §3.1) on synthetic evidence: a test kind whose residual is the
 * number it is given, and whose gap is the second number (a length).
 */
import { BAND, EPS, FALSE_ABS, FLOOR_MAX, FLOOR_MIN, FLOOR_SAMPLES } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { floatDecide } from '../src/decide';
import type { ClaimKindSpec, FloatTest } from '../src/kind';

function testKind(test: FloatTest): ClaimKindSpec {
  return {
    name: 'synthetic',
    params: ['number', 'number'],
    polynomial: true,
    test,
    doc: '',
    algebra: () => ({ conditions: [], ndg: [], order: [] }),
    residual: (args) => (args[0]?.kind === 'number' ? args[0].v : Infinity),
    gap: (args) => (args[1]?.kind === 'number' ? args[1].v : Infinity),
  };
}

const num = (v: number): Value<number> => ({ kind: 'number', v });
const ev = (r: number, perturbed: readonly number[], gap = 1) => ({
  args: [num(r), num(gap)],
  perturbed: perturbed.map((p) => [num(p), num(gap)]),
});
const CTX = { scale: 1 };

describe('floatDecide: the noise floor of SPEC §3.1', () => {
  it('uses three perturbations', () => {
    expect(FLOOR_SAMPLES).toBe(3);
  });

  it('TRUE below 100·floor, with floor = max |r(x + δ_k) − r(x)|', () => {
    const k = testKind('floor');
    expect(floatDecide(k, ev(5e-9, [5e-9, 5.2e-9, 4.9e-9]), CTX)).toEqual({ kind: 'true' });
    expect(floatDecide(k, ev(0, [0, 0, 0]), CTX)).toEqual({ kind: 'true' });
  });

  it('FLOOR_MIN keeps an exact-looking 0 < 100·0 from failing; 1e-10 is never FALSE', () => {
    const k = testKind('floor');
    expect(
      floatDecide(k, ev(50 * FLOOR_MIN, [50 * FLOOR_MIN, 50 * FLOOR_MIN, 50 * FLOOR_MIN]), CTX),
    ).toEqual({ kind: 'true' });
    const d = floatDecide(k, ev(1e-10, [1e-10, 1e-10, 1e-10]), CTX);
    expect(d.kind).toBe('ambiguous');
    expect(
      floatDecide(k, ev(2 * FALSE_ABS, [2 * FALSE_ABS, 2 * FALSE_ABS, 2 * FALSE_ABS]), CTX).kind,
    ).toBe('false');
  });

  it('FALSE needs the residual above max(1e4·floor, FALSE_ABS)', () => {
    const k = testKind('floor');
    expect(floatDecide(k, ev(1e-3, [1e-3 + 1e-8, 1e-3, 1e-3]), CTX).kind).toBe('false');
    expect(floatDecide(k, ev(1e-3, [1e-3 + 1e-6, 1e-3, 1e-3]), CTX).kind).toBe('ambiguous');
  });

  it('a floor above FLOOR_MAX, or an undefined perturbation, is ILL-CONDITIONED (invalid, not false)', () => {
    const k = testKind('floor');
    expect(floatDecide(k, ev(0.5, [0.5 + 2 * FLOOR_MAX, 0.5, 0.5]), CTX).kind).toBe(
      'ill-conditioned',
    );
    const undefinedPerturbation = {
      args: [num(0.5), num(1)],
      perturbed: [{ kind: 'undefined' as const, reason: 'gone' }],
    };
    expect(floatDecide(k, undefinedPerturbation, CTX).kind).toBe('ill-conditioned');
  });

  it('incidence: a gap within EPS·scale is on (true); off the band the floor must agree to say false', () => {
    const k = testKind('incidence');
    expect(floatDecide(k, ev(1e-3, [1e-3, 1e-3, 1e-3], 0.5 * EPS), CTX)).toEqual({ kind: 'true' });
    expect(floatDecide(k, ev(1e-3, [1e-3, 1e-3, 1e-3], 2 * BAND), CTX).kind).toBe('false');
    // Off by the band but the floor says true: never true when the construction says off.
    expect(floatDecide(k, ev(1e-15, [1e-15, 1e-15, 1e-15], 2 * BAND), CTX).kind).toBe('ambiguous');
    // Inside the band: true only when the floor says so, never false.
    expect(floatDecide(k, ev(1e-15, [1e-15, 1e-15, 1e-15], 3 * EPS), CTX)).toEqual({
      kind: 'true',
    });
    expect(floatDecide(k, ev(1e-3, [1e-3, 1e-3, 1e-3], 3 * EPS), CTX).kind).toBe('ambiguous');
  });

  it('tangency: a gap inside the band touches (as the kernel counts one double point)', () => {
    const k = testKind('tangency');
    expect(floatDecide(k, ev(1e-3, [1e-3, 1e-3, 1e-3], 0.5 * BAND), CTX)).toEqual({ kind: 'true' });
    expect(floatDecide(k, ev(1e-3, [1e-3, 1e-3, 1e-3], -0.5 * BAND), CTX)).toEqual({
      kind: 'true',
    });
    expect(floatDecide(k, ev(1e-3, [1e-3, 1e-3, 1e-3], 2 * BAND), CTX).kind).toBe('false');
  });
});
