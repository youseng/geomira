/**
 * Found in the pre-beta review (bug-fix round, ADR-0028): `inverse` of a valid map with
 * |a| ≈ 10⁻¹⁶⁰ was Inexact. similarityProblem (ADR-0019 decision 3) accepted the map, since
 * |a|² = 10⁻³²⁰ is a positive (subnormal) double, but 1/|a|² overflows, and the inverse, with
 * |a'| = 10¹⁶⁰, is itself outside the range (its |a'|² overflows). So the valid maps were not
 * closed under inversion, against ADR-0019 decision 2 ("a product or inverse of valid maps is
 * valid"). A float map is now valid only when 1/|a|² is a finite double too, so every valid
 * map has a valid, accurately computed inverse (rescaled when |a|² is subnormal), and a map
 * whose inverse is not representable is Inexact where it is built.
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { inverseSimilarity, similarity, similarityProblem, transformOf } from '../src/similarity';
import type { Similarity, Value } from '../src/value';
import { REGISTRY, must } from './helpers/doc';

const CTX = { scale: 1 };

function direct(tool: string, args: readonly Value<number>[]): Value<number> {
  return must(REGISTRY.get(tool)).compute(FloatField, args, CTX);
}

/** z ↦ 10^e·(cos θ + i sin θ)·ẑ + (1 + 2i). */
function map(e: number, theta: number, anti: boolean): Similarity<number> {
  const r = 10 ** e;
  return similarity(anti, { re: r * Math.cos(theta), im: r * Math.sin(theta) }, { re: 1, im: 2 });
}

const BEYOND = 'the scale factor is beyond the double range';

describe('valid float maps are closed under inversion', () => {
  it('a map with |a| = 10⁻¹⁶⁰ is Inexact where it is used, not only its inverse', () => {
    const s = map(-160, 0, false);
    expect(similarityProblem(FloatField, s, 'apply')).toEqual({
      kind: 'inexact',
      reason: `apply: ${BEYOND}`,
    });
    expect(direct('inverse', [transformOf(s)])).toEqual({
      kind: 'inexact',
      reason: `inverse: ${BEYOND}`,
    });
    // compose builds it from two valid maps: Inexact there, with the same reason.
    const h = transformOf(map(-80, 0, false));
    expect(direct('compose', [h, h])).toEqual({ kind: 'inexact', reason: `compose: ${BEYOND}` });
  });

  it('every valid map has a valid inverse, and compose(T, inverse(T)) is the identity', () => {
    let valid = 0;
    for (let e = -170; e <= 170; e += 0.5) {
      for (const anti of [false, true]) {
        const s = map(e, e * 0.7, anti);
        if (similarityProblem(FloatField, s, 'x') !== undefined) continue;
        valid += 1;
        const inv = direct('inverse', [transformOf(s)]);
        if (inv.kind !== 'transform') throw new Error(`10^${String(e)}: ${JSON.stringify(inv)}`);
        expect(
          inv.t.type === 'similarity' ? similarityProblem(FloatField, inv.t, 'x') : 'a Möbius map',
          `10^${String(e)}`,
        ).toBeUndefined();
        const id = direct('compose', [transformOf(s), inv]);
        if (id.kind !== 'transform') throw new Error(`10^${String(e)}: ${JSON.stringify(id)}`);
        expect(Math.abs(id.t.a.re - 1), `10^${String(e)}`).toBeLessThan(1e-14);
        expect(Math.abs(id.t.a.im), `10^${String(e)}`).toBeLessThan(1e-14);
        expect(id.t.anti).toBe(false);
      }
    }
    // The valid range is about 10⁻¹⁵⁴ ≤ |a| ≤ 10¹⁵⁴.
    expect(valid).toBeGreaterThan(2 * 2 * 300);
  });

  it('a subnormal |a|² still gives an accurate inverse (no 1/|a|² of a subnormal)', () => {
    // |a| = 1.2·10⁻¹⁵⁴: |a|² ≈ 1.44·10⁻³⁰⁸ is subnormal, 1/|a|² is finite.
    for (const anti of [false, true]) {
      const s = similarity(anti, { re: 0.72e-154, im: 0.96e-154 }, { re: 0, im: 0 });
      expect(similarityProblem(FloatField, s, 'x')).toBeUndefined();
      const inv = inverseSimilarity(FloatField, s);
      // a' = conj(a)/|a|² (direct) or a/|a|² (anti); |a| = 1.2·10⁻¹⁵⁴.
      const k = 1 / 1.2e-154;
      const want = { re: 0.6 * k, im: (anti ? 0.8 : -0.8) * k };
      expect(Math.abs(inv.a.re / want.re - 1)).toBeLessThan(4 * Number.EPSILON);
      expect(Math.abs(inv.a.im / want.im - 1)).toBeLessThan(4 * Number.EPSILON);
    }
  });
});
