/**
 * Property (ADR-0005, the continuous sqrt): for a number without an exact value, FloatField's
 * sqrt is defined exactly on (−BAND, ∞), non-decreasing, and has no jump across
 * [−2·BAND, 10·BAND]. "No jump" is the ½-Hölder bound of √max(x, 0):
 *   |sqrt(y) − sqrt(x)| ≤ √|y − x|   for all defined x, y,
 * which fails for any step (the old "within the band counts as 0" rule stepped by √BAND at
 * x = BAND with |y − x| one ulp). Checked on seeded random arguments, a uniform grid, and
 * the doubles next to −BAND, 0, EPS and BAND, for adjacent and random pairs.
 */
import { FloatField } from '@geomira/num/float-field';
import { createRng } from '@geomira/num/rng';
import { BAND, EPS } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { numOf, type Value } from '../src/value';
import { REGISTRY, must } from './helpers/doc';

const LO = -2 * BAND;
const HI = 10 * BAND;
const SAMPLES = 4000;
const GRID = 1200;

/** The double next to x towards +∞ (dir 1) or −∞ (dir −1); x finite and non-zero. */
function next(x: number, dir: 1 | -1): number {
  const b = new Float64Array([x]);
  const bits = new BigInt64Array(b.buffer);
  const away = x > 0 === dir > 0;
  bits[0] = (bits[0] ?? 0n) + (away ? 1n : -1n);
  return b[0] ?? x;
}

function arguments_(seed: number): number[] {
  const rng = createRng(seed);
  const xs = Array.from({ length: SAMPLES }, () => rng.uniform(LO, HI));
  for (let i = 0; i <= GRID; i += 1) xs.push(LO + ((HI - LO) * i) / GRID);
  for (const e of [-BAND, BAND, EPS, -EPS, Number.MIN_VALUE, -Number.MIN_VALUE])
    xs.push(e, next(e, 1), next(e, -1));
  xs.push(0, -0, LO, HI);
  return xs.sort((a, b) => a - b);
}

function sqrtOf(x: number, scale: number): Value<number> {
  // No exact value: the argument is decided by FloatField's banded sign (a measure).
  return must(REGISTRY.get('sqrt')).compute(FloatField, [numOf(x)], { scale });
}

describe('sqrt of a measured number is continuous across the band (FloatField)', () => {
  for (const [seed, scale] of [
    [1, 1],
    [2, 1],
    [3, 1000],
  ] as const) {
    it(`seed ${String(seed)}, scale ${String(scale)}: defined on (−BAND, ∞), non-decreasing, ½-Hölder`, () => {
      const xs = arguments_(seed);
      const defined: (readonly [number, number])[] = [];
      for (const x of xs) {
        const y = sqrtOf(x, scale);
        if (x <= -BAND) {
          expect(y, String(x)).toEqual({ kind: 'undefined', reason: 'sqrt of a negative number' });
          continue;
        }
        if (y.kind !== 'number') throw new Error(`sqrt(${String(x)}) is ${y.kind}`);
        expect(y.v, String(x)).toBe(x > 0 ? Math.sqrt(x) : 0);
        defined.push([x, y.v]);
      }
      expect(defined.length).toBeGreaterThan(SAMPLES * 0.8);
      const holder = ([x, fx]: readonly [number, number], [y, fy]: readonly [number, number]) =>
        Math.abs(fy - fx) <= Math.sqrt(Math.abs(y - x)) * (1 + 1e-12);
      for (let i = 1; i < defined.length; i += 1) {
        const [a, b] = [defined[i - 1], defined[i]];
        if (a === undefined || b === undefined) continue;
        expect(b[1] >= a[1], `non-decreasing at ${String(a[0])} → ${String(b[0])}`).toBe(true);
        expect(holder(a, b), `no jump at ${String(a[0])} → ${String(b[0])}`).toBe(true);
      }
      const rng = createRng(seed + 100);
      for (let k = 0; k < 2000; k += 1) {
        const [a, b] = [defined[rng.nextInt(defined.length)], defined[rng.nextInt(defined.length)]];
        if (a !== undefined && b !== undefined) expect(holder(a, b)).toBe(true);
      }
    });
  }
});
