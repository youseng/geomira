import { describe, expect, it } from 'vitest';
import { toNumber, type Rational } from '@geomira/num/rational';
import type { Document } from '@geomira/kernel/document';
import { prepareFigure } from '../src/figure-prep';
import { readFree } from '../src/free';
import { testClaim } from '../src/job';
import { prepare, type Prepared } from '../src/prepare';
import { randomFigure } from '../src/randomize';
import { drawSample } from '../src/sampler';
import { Figure, n, REGISTRY } from './helpers/build';

/**
 * Bug found in the Run 10 audit (the Run 9a bug class, ADR-0015): the samplers drew their
 * noise, translation and rounding grid from the evaluation context's `scale`, which SPEC §3.1
 * clamps to at least 1. For a figure smaller than one unit the LOCAL noise was therefore not
 * 0.02 of the figure but 0.02 absolute: for the acute triangle A(0.01, 0.03), B(0, 0),
 * C(0.04, 0) (the triangle of ADR-0015 at 1/100 of its size) it is half the figure, and the
 * grid of 2^−10 rounds its coordinates to about 2% of its size. The local test then called a
 * statement that is true in every acute triangle "MIXED". The samplers now measure the figure
 * itself (ADR-0017).
 */
function prep(f: Figure, id: number): Prepared {
  const p = prepare(f.doc, id, REGISTRY);
  if (!p.ok) throw new Error(p.reason);
  return p.prepared;
}

function points(p: Prepared, doc: Document): number[][] {
  return p.free
    .filter((x) => x.kind === 'point')
    .map((x) => (readFree(doc, x) ?? []).map(toNumber));
}

function obtuseOrRight(pts: number[][]): boolean {
  const [a, b, c] = pts;
  const corner = (u?: number[], v?: number[], w?: number[]) =>
    ((v?.[0] ?? 0) - (u?.[0] ?? 0)) * ((w?.[0] ?? 0) - (u?.[0] ?? 0)) +
      ((v?.[1] ?? 0) - (u?.[1] ?? 0)) * ((w?.[1] ?? 0) - (u?.[1] ?? 0)) <=
    0;
  return corner(a, b, c) || corner(b, a, c) || corner(c, a, b);
}

const isPow2 = (d: bigint) => d > 0n && (d & (d - 1n)) === 0n;

describe('the samplers measure the figure, not the clamped scale (ADR-0017)', () => {
  for (const k of ['1/100', '1/1000']) {
    it(`20,000 local samples of the acute triangle at ${k} of its size are all acute`, () => {
      const s = toNumber({ num: 1n, den: BigInt(k.slice(2)) });
      const f = new Figure()
        .point('A', s, 3 * s)
        .point('B', 0, 0)
        .point('C', 4 * s, 0);
      const p = prep(f, f.claim('collinear', 'A', 'B', 'C'));
      let bad = 0;
      for (let seed = 0; seed < 20_000; seed++)
        if (obtuseOrRight(points(p, drawSample(p, 'local', seed, false)))) bad++;
      expect(bad).toBe(0);
    });
  }

  it('the grid of a small figure is 2^−10 of the figure: coordinates keep three significant bits more than the figure', () => {
    const f = new Figure().point('A', '0.01', '0.03').point('B', 0, 0).point('C', '0.04', 0);
    const p = prep(f, f.claim('collinear', 'A', 'B', 'C'));
    // diameter 0.05: the grid is 2^(⌊log2 0.05⌋ − 10) = 2^−15, so denominators reach 2^15.
    let finest = 1n;
    for (let seed = 0; seed < 200; seed++)
      for (const x of p.free.flatMap((i) => readFree(drawSample(p, 'local', seed, false), i) ?? []))
        if (x.den > finest) finest = x.den;
    expect(isPow2(finest)).toBe(true);
    expect(finest).toBe(1n << 15n);
  });

  it('the local test of ∠BHC + ∠BAC = 180 holds in the small acute triangle', () => {
    const g = new Figure().point('A', '0.01', '0.03').point('B', 0, 0).point('C', '0.04', 0);
    g.def('H', 'orthocenter', 'A', 'B', 'C');
    const claim = g.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180));
    for (const seed of [1, 2, 3]) {
      const job = { kind: 'testClaim', regime: 'local', doc: g.doc, claim, seed, n: 200 } as const;
      const r = testClaim(job, { registry: REGISTRY });
      expect(r.kind === 'verdict' ? r.verdict.text : r.kind, String(seed)).toMatch(
        /^HOLDS IN THIS CONFIGURATION/u,
      );
    }
  });

  it('a figure and the same figure at 1/100 of its size get the same samples, scaled', () => {
    const big = new Figure().point('A', 1, 3).point('B', 0, 0).point('C', 4, 0);
    const small = new Figure().point('A', '0.01', '0.03').point('B', 0, 0).point('C', '0.04', 0);
    const pb = prep(big, big.claim('collinear', 'A', 'B', 'C'));
    const ps = prep(small, small.claim('collinear', 'A', 'B', 'C'));
    for (const regime of ['local', 'global'] as const)
      for (let seed = 0; seed < 50; seed++) {
        const b = points(pb, drawSample(pb, regime, seed, seed % 2 === 1)).flat();
        const s = points(ps, drawSample(ps, regime, seed, seed % 2 === 1)).flat();
        // The grids differ by the factor (2^−3 vs 2^−10 of the figure's power of two), so
        // compare to the coarser of the two grids.
        for (const [i, x] of s.entries())
          expect(Math.abs(x * 100 - (b[i] ?? NaN))).toBeLessThan(2 ** -3);
      }
  });

  it('a figure with one free point (diameter 0) samples at the scale 1 (noise and grid)', () => {
    const f = new Figure().point('A', 2, 3);
    const p = prep(f, f.claim('equal', 'A', 'A'));
    for (let seed = 0; seed < 100; seed++) {
      const xy: Rational[] = p.free.flatMap(
        (x) => readFree(drawSample(p, 'local', seed, false), x) ?? [],
      );
      expect(xy.length).toBe(2);
      for (const x of xy) {
        expect(isPow2(x.den) && x.den <= 1024n).toBe(true);
        expect(Number.isFinite(toNumber(x))).toBe(true);
      }
      // translation within ±1/2 and noise 0.02 around (2, 3)
      expect(Math.abs(toNumber(xy[0] ?? { num: 0n, den: 1n }) - 2)).toBeLessThan(0.7);
    }
  });

  it('an explicit radius alone sets the size (circle(O, 1/50) with O the only free point)', () => {
    const f = new Figure().point('O', 0, 0).def('w', 'circle', 'O', n('1/50'));
    const p = prep(f, f.claim('on', 'O', 'w'));
    for (let seed = 0; seed < 100; seed++) {
      const doc = drawSample(p, 'local', seed, false);
      const [r]: Rational[] = p.free
        .filter((x) => x.kind === 'radius')
        .flatMap((x) => readFree(doc, x) ?? []);
      const [ox, oy] = points(p, doc)[0] ?? [];
      // Size 0.04: the similarity's translation is at most 0.02 per axis, the radius in [1/100, 1/25].
      expect(Math.abs(ox ?? 1)).toBeLessThan(0.03);
      expect(Math.abs(oy ?? 1)).toBeLessThan(0.03);
      expect(toNumber(r ?? { num: 0n, den: 1n })).toBeGreaterThan(0.0099);
      expect(toNumber(r ?? { num: 1n, den: 1n })).toBeLessThan(0.0401);
    }
  });
});

describe('Randomize keeps a small figure small (ADR-0017)', () => {
  it('an acute triangle of diameter 0.05 is redrawn at about its size, on decimals of its size', () => {
    const f = new Figure().point('A', '0.01', '0.03').point('B', 0, 0).point('C', '0.04', 0);
    // 10^(⌊log10 0.05⌋ − 2) = 10^−4: four decimals, where the clamped scale gave two.
    const fine: Rational[] = [];
    for (let seed = 0; seed < 20; seed++) {
      const r = randomFigure(f.doc, REGISTRY, 'acute', seed);
      if (r.kind !== 'figure') throw new Error(r.reason);
      const p = prepareFigure(r.doc, REGISTRY);
      if (!p.ok) throw new Error(p.reason);
      const exact = p.figure.free.flatMap((x) => readFree(r.doc, x) ?? []);
      for (const x of exact) expect(10_000n % x.den, `${String(x.num)}/${String(x.den)}`).toBe(0n);
      fine.push(...exact.filter((x) => 100n % x.den !== 0n));
      const pts = p.figure.free.map((x) => (readFree(r.doc, x) ?? []).map(toNumber));
      const xs = pts.map((v) => v[0] ?? NaN);
      const ys = pts.map((v) => v[1] ?? NaN);
      const d = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      expect(d, String(seed)).toBeGreaterThan(0.005);
      expect(d, String(seed)).toBeLessThan(0.5);
      expect(obtuseOrRight(pts)).toBe(false);
    }
    expect(fine.length).toBeGreaterThan(30);
  });
});
