/**
 * The samplers' spreads for every kind of free input (SPEC §10.4), measured over many seeds:
 * LOCAL moves each input by σ = LOCAL_SIGMA·size in its own unit (a param by LOCAL_SIGMA of its
 * range), GLOBAL spreads it over its whole range; params stay on their grid
 * min + (max − min)·k/2^10; a radius and an angle glider follow the random similarity. (Run 13:
 * the nightly's surviving mutants of sampler.ts.)
 */
import { compare, mul, rational, sub, toNumber, type Rational } from '@geomira/num/rational';
import type { Document } from '@geomira/kernel/document';
import { describe, expect, it } from 'vitest';
import { LOCAL_SIGMA } from '../src/constants';
import { readFree, type FreeKind } from '../src/free';
import { prepare, type Prepared } from '../src/prepare';
import { drawSample, figureSize } from '../src/sampler';
import { c, Figure, n, REGISTRY } from './helpers/build';

const SAMPLES = 400;

function prep(f: Figure, id: number): Prepared {
  const p = prepare(f.doc, id, REGISTRY);
  if (!p.ok) throw new Error(p.reason);
  return p.prepared;
}

/** The values of the first free input of `kind` in each sample. */
function draws(p: Prepared, regime: 'local' | 'global', kind: FreeKind): Rational[][] {
  const input = p.free.find((x) => x.kind === kind);
  if (input === undefined) throw new Error(`no free ${kind}`);
  const out: Rational[][] = [];
  for (let s = 0; s < SAMPLES; s++) {
    const doc: Document = drawSample(p, regime, s, false);
    out.push(readFree(doc, input) ?? []);
  }
  return out;
}

function points(p: Prepared, doc: Document): number[][] {
  return p.free
    .filter((x) => x.kind === 'point')
    .map((x) => (readFree(doc, x) ?? []).map(toNumber));
}

const std = (xs: readonly number[]): number => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

/** A param k in [1/3, 7/2] with v = 2, used by divide(A, B, k). */
function paramFigure(): { p: Prepared } {
  const f = new Figure().point('A', 0, 0).point('B', 4, 0).point('C', 0, 3);
  f.add('k', c('param', n('1/3'), n('7/2'), n(2)));
  f.def('X', 'divide', 'A', 'B', 'k');
  return { p: prep(f, f.claim('collinear', 'A', 'B', 'X')) };
}

describe('params', () => {
  const [lo, hi] = [rational(1n, 3n), rational(7n, 2n)];

  it('stay on the grid min + (max − min)·k/2^10, within [min, max]', () => {
    const { p } = paramFigure();
    for (const regime of ['local', 'global'] as const)
      for (const v of draws(p, regime, 'param')) {
        const x = v[2] ?? rational(-1n);
        expect(v.slice(0, 2)).toEqual([lo, hi]);
        expect(compare(x, lo) >= 0 && compare(x, hi) <= 0).toBe(true);
        // (v − min)·2^10 / (max − min) is a whole number.
        expect(mul(sub(x, lo), mul(rational(1024n), inv(sub(hi, lo)))).den).toBe(1n);
      }
  });

  it('LOCAL moves v by LOCAL_SIGMA of the range; GLOBAL spreads it over the range', () => {
    const { p } = paramFigure();
    const width = 7 / 2 - 1 / 3;
    const local = draws(p, 'local', 'param').map((v) => toNumber(v[2] ?? lo));
    expect(std(local) / (LOCAL_SIGMA * width)).toBeGreaterThan(0.8);
    expect(std(local) / (LOCAL_SIGMA * width)).toBeLessThan(1.25);
    const global = draws(p, 'global', 'param').map((v) => toNumber(v[2] ?? lo));
    expect(Math.max(...global) - Math.min(...global)).toBeGreaterThan(0.9 * width);
  });
});

function inv(r: Rational): Rational {
  return rational(r.den, r.num);
}

describe('a line glider', () => {
  // |d| = 1 while the figure is about 10 across: the glider's t moves by σ / |d|.
  function figure(): Prepared {
    const f = new Figure().point('A', 0, 0).point('B', 1, 0).point('C', 0, 10);
    f.def('l', 'line', 'A', 'B');
    f.add('X', c('on', 'l', n('1/2')));
    return prep(f, f.claim('collinear', 'A', 'B', 'X'));
  }

  it('LOCAL: t moves by σ / |d|; GLOBAL: t covers t0 ± 2·size / |d|', () => {
    const p = figure();
    const size = figureSize(p);
    const local = draws(p, 'local', 'line-glider').map((v) => toNumber(v[0] ?? rational(0n)));
    const sigmaT = LOCAL_SIGMA * size;
    expect(std(local) / sigmaT).toBeGreaterThan(0.8);
    expect(std(local) / sigmaT).toBeLessThan(1.25);
    const global = draws(p, 'global', 'line-glider').map((v) => toNumber(v[0] ?? rational(0n)));
    expect(Math.min(...global)).toBeLessThan(0.5 - 1.5 * size);
    expect(Math.max(...global)).toBeGreaterThan(0.5 + 1.5 * size);
    expect(Math.min(...global)).toBeGreaterThanOrEqual(0.5 - 2 * size);
    expect(Math.max(...global)).toBeLessThanOrEqual(0.5 + 2 * size);
  });
});

describe('circle gliders', () => {
  it('LOCAL: a stereographic glider moves by σ / r in angle; GLOBAL covers the circle', () => {
    const f = new Figure().point('O', 0, 0).point('A', 5, 0).point('B', 0, 1);
    f.def('w', 'circle', 'O', 'A');
    f.add('X', c('on', 'w', n(1), n(1)));
    const p = prep(f, f.claim('collinear', 'O', 'B', 'X'));
    const size = figureSize(p);
    const phi = (v: Rational[]) =>
      2 * Math.atan2(toNumber(v[1] ?? v[0] ?? rational(0n)), toNumber(v[0] ?? rational(1n)));
    const local = draws(p, 'local', 'stereo').map(phi);
    // r = 5: the angle moves by LOCAL_SIGMA·size / 5 radians (plus the grid).
    expect(std(local) / ((LOCAL_SIGMA * size) / 5)).toBeGreaterThan(0.8);
    expect(std(local) / ((LOCAL_SIGMA * size) / 5)).toBeLessThan(1.25);
    const global = draws(p, 'global', 'stereo').map(
      (v) => ((phi(v) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
    );
    expect(Math.max(...global) - Math.min(...global)).toBeGreaterThan(1.8 * Math.PI);
  });

  it('LOCAL: an angle glider turns with the figure and moves by σ / r in angle', () => {
    const f = new Figure().point('O', 0, 0).point('A', 0, 4).point('B', 3, 0);
    f.add('w', c('circle', 'O', n(2)));
    f.add('X', c('on', 'w', n(90)));
    const p = prep(f, f.claim('collinear', 'O', 'A', 'X'));
    const size = figureSize(p);
    const angles: number[] = [];
    for (let s = 0; s < SAMPLES; s++) {
      const doc = drawSample(p, 'local', s, false);
      const input = p.free.find((x) => x.kind === 'angle-glider');
      const theta = toNumber((input && readFree(doc, input)?.[0]) ?? rational(0n));
      const [O, A] = points(p, doc);
      const dirA =
        (Math.atan2((A?.[1] ?? 0) - (O?.[1] ?? 0), (A?.[0] ?? 0) - (O?.[0] ?? 0)) * 180) / Math.PI;
      // X stays near the ray OA (both at 90° in the user's figure), whatever the rotation.
      angles.push(((((theta - dirA + 540) % 360) + 360) % 360) - 180);
    }
    // r = 2 (the similarity scales r and the noise alike).
    const stepDeg = ((LOCAL_SIGMA * size) / 2) * (180 / Math.PI);
    expect(Math.max(...angles.map(Math.abs))).toBeLessThan(8 * stepDeg);
    expect(std(angles)).toBeGreaterThan(0.5 * stepDeg);
  });

  it('a literal radius scales with the similarity', () => {
    const f = new Figure().point('O', 0, 0).point('A', 6, 0).point('B', 0, 6);
    f.add('w', c('circle', 'O', n(3)));
    const p = prep(f, f.claim('on', 'A', 'w'));
    const input = p.free.find((x) => x.kind === 'radius');
    for (let s = 0; s < 100; s++) {
      const doc = drawSample(p, 'local', s, false);
      const r = toNumber((input && readFree(doc, input)?.[0]) ?? rational(0n));
      const [O, A] = points(p, doc);
      const oa = Math.hypot((A?.[0] ?? 0) - (O?.[0] ?? 0), (A?.[1] ?? 0) - (O?.[1] ?? 0));
      // r / |OA| = 1/2 up to the local noise (σ ≈ 0.17 on |OA| ≈ 6 times the scale).
      expect(Math.abs(r / oa - 0.5)).toBeLessThan(0.1);
    }
  });
});
