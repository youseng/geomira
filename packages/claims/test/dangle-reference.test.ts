/**
 * Directed angles in the complex form Im(z₁ⁿ·conj(z₂)) = 0 (SPEC §10.1) against an atan2
 * reference, for n = 1, 2, 3:
 *   - floats: the residual equals |sin(n·θ₁ − θ₂)| with θ = atan2(cross, dot), so it
 *     vanishes exactly when n·∡ABC ≡ ∡DEF (mod 180°);
 *   - exact: F − E is D − E turned by the n-th power of an exact rational rotation
 *     (Pythagorean), so the condition is exactly 0 over Q and mod p, and the atan2
 *     reference agrees; a perturbed F gives a non-zero condition and a non-zero sine.
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { add, div, mul, rational, sub, toNumber, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { claimKind } from '../src/kinds';
import { exactTruth, lit, pt } from './helpers/values';

const DANGLE = claimKind('dangle');
const DRAWS = 400;

function atanAngle(a: readonly number[], b: readonly number[], c: readonly number[]): number {
  const [ux, uy, vx, vy] = [
    (a[0] ?? 0) - (b[0] ?? 0),
    (a[1] ?? 0) - (b[1] ?? 0),
    (c[0] ?? 0) - (b[0] ?? 0),
    (c[1] ?? 0) - (b[1] ?? 0),
  ];
  return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
}

function floatPoints(rng: Rng): number[][] {
  return Array.from({ length: 6 }, () => [rng.uniform(-10, 10), rng.uniform(-10, 10)]);
}

function floatArgs(n: number, pts: readonly number[][]): Value<number>[] {
  return [
    { kind: 'number', v: n, exact: rational(BigInt(n)) },
    ...pts.map((p) => ({ kind: 'point' as const, x: p[0] ?? 0, y: p[1] ?? 0 })),
  ];
}

/** The exact rotation ((1 − t²) + 2t·i) / (1 + t²) as (re, im). */
function rotation(t: Rational): readonly [Rational, Rational] {
  const den = add(rational(1n), mul(t, t));
  return [div(sub(rational(1n), mul(t, t)), den), div(mul(rational(2n), t), den)];
}

function turn(
  v: readonly [Rational, Rational],
  r: readonly [Rational, Rational],
): [Rational, Rational] {
  return [sub(mul(v[0], r[0]), mul(v[1], r[1])), add(mul(v[0], r[1]), mul(v[1], r[0]))];
}

function small(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(41) - 20), BigInt(rng.nextInt(5) + 1));
}

const text = (r: Rational) => `${String(r.num)}/${String(r.den)}`;

describe('dangle against the atan2 reference', () => {
  for (const n of [1, 2, 3]) {
    it(`n = ${String(n)}: the residual is |sin(n·θ₁ − θ₂)| on random float figures`, () => {
      const rng = createRng(500 + n);
      for (let i = 0; i < DRAWS; i++) {
        const pts = floatPoints(rng);
        const [a, b, c, d, e, f] = pts as [
          number[],
          number[],
          number[],
          number[],
          number[],
          number[],
        ];
        const ref = Math.abs(Math.sin(n * atanAngle(a, b, c) - atanAngle(d, e, f)));
        expect(
          Math.abs((DANGLE?.residual(floatArgs(n, pts), { scale: 20 }) ?? NaN) - ref),
        ).toBeLessThan(1e-9);
      }
    });

    it(`n = ${String(n)}: exact constructions hold over Q and mod p, perturbed ones do not`, () => {
      const rng = createRng(600 + n);
      for (let i = 0; i < DRAWS / 4; i++) {
        const [B, E] = [
          [small(rng), small(rng)],
          [small(rng), small(rng)],
        ] as const;
        const arm1: [Rational, Rational] = [add(small(rng), rational(25n)), small(rng)];
        const arm2: [Rational, Rational] = [small(rng), add(small(rng), rational(25n))];
        const r = rotation(rational(BigInt(rng.nextInt(19) - 9), BigInt(rng.nextInt(4) + 1)));
        let rn: [Rational, Rational] = [rational(1n), rational(0n)];
        for (let k = 0; k < n; k++) rn = turn(rn, r);
        const C = [add(B[0], turn(arm1, r)[0]), add(B[1], turn(arm1, r)[1])];
        const scale = rational(BigInt(rng.nextInt(3) + 1), BigInt(rng.nextInt(3) + 1));
        const F = [
          add(E[0], mul(scale, turn(arm2, rn)[0])),
          add(E[1], mul(scale, turn(arm2, rn)[1])),
        ];
        const A = [add(B[0], arm1[0]), add(B[1], arm1[1])];
        const D = [add(E[0], arm2[0]), add(E[1], arm2[1])];
        const exact: readonly (readonly Rational[])[] = [A, B, C, D, E, F];
        const all = exact.map(
          (p) => [text(p[0] ?? rational(0n)), text(p[1] ?? rational(0n))] as const,
        );
        const args = <T>(G: import('@geomira/num/field').Field<T>, pts: typeof all) => [
          lit(G, n),
          ...pts.map((p) => pt(G, p)),
        ];
        expect(exactTruth(RationalField, DANGLE ?? fail(), args(RationalField, all))).toBe('true');
        expect(exactTruth(ModPField, DANGLE ?? fail(), args(ModPField, all))).toBe('true');
        const fl = exact.map((p) => p.map((x) => toNumber(x)));
        const [a, b, c, d, e, f] = fl as [
          number[],
          number[],
          number[],
          number[],
          number[],
          number[],
        ];
        expect(Math.abs(Math.sin(n * atanAngle(a, b, c) - atanAngle(d, e, f)))).toBeLessThan(1e-9);
        const bent = [
          ...all.slice(0, 5),
          [
            text(add(F[0] ?? rational(0n), rational(1n, 7n))),
            text(add(F[1] ?? rational(0n), rational(1n, 11n))),
          ] as const,
        ];
        expect(exactTruth(RationalField, DANGLE ?? fail(), args(RationalField, bent))).toBe(
          'false',
        );
      }
    });
  }

  it('the float residual is a sine: invariant under similarities of each triple', () => {
    const rng = createRng(77);
    for (let i = 0; i < 100; i++) {
      const pts = floatPoints(rng);
      const k = rng.uniform(0.01, 100);
      const moved = pts.map((p) => [(p[0] ?? 0) * k + 3, (p[1] ?? 0) * k - 1]);
      const r1 = DANGLE?.residual(floatArgs(2, pts), { scale: 20 }) ?? NaN;
      const r2 = DANGLE?.residual(floatArgs(2, moved), { scale: 20 * k }) ?? NaN;
      expect(Math.abs(r1 - r2)).toBeLessThan(1e-9);
      expect(FloatField.isZero(r1 - r2, 'dimensionless', { scale: 1 })).toBe(true);
    }
  });
});

function fail(): never {
  throw new Error('dangle is missing');
}
