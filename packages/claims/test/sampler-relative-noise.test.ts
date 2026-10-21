import { describe, expect, it } from 'vitest';
import { toNumber } from '@geomira/num/rational';
import { readFree } from '../src/free';
import { testClaim } from '../src/job';
import { prepare } from '../src/prepare';
import { drawSample } from '../src/sampler';
import { Figure, n, REGISTRY } from './helpers/build';

/**
 * Bug found in Run 9a (a Run 8b flow failed in CI): the LOCAL sampler added its noise
 * (σ = LOCAL_SIGMA·scale, in the user figure's units) AFTER the random similarity, which may
 * shrink the figure to half its size, so the noise relative to the sampled figure doubled and
 * its tails took the acute triangle A(1, 3), B(0, 0), C(4, 0) past a right angle at B in about
 * one sample in 4000: the local test of ∠BHC + ∠BAC = 180 (true in every acute triangle) said
 * "Mixed, exact over Q, 199 true, 1 false" for 14 of the seeds 0–299. The noise is now drawn
 * in the user's figure and mapped with it (ADR-0015).
 */
describe('LOCAL noise is relative to the sampled figure', () => {
  const f = new Figure().point('A', 1, 3).point('B', 0, 0).point('C', 4, 0);
  const id = f.claim('collinear', 'A', 'B', 'C');

  it('20,000 local samples of an acute triangle (largest angle 72°) are all acute', () => {
    const p = prepare(f.doc, id, REGISTRY);
    if (!p.ok) throw new Error(p.reason);
    const prep = p.prepared;
    let obtuse = 0;
    for (let s = 0; s < 20_000; s++) {
      const doc = drawSample(prep, 'local', s, false);
      const [a, b, c] = prep.free
        .filter((x) => x.kind === 'point')
        .map((x) => (readFree(doc, x) ?? []).map(toNumber));
      const corner = (u?: number[], v?: number[], w?: number[]) =>
        ((v?.[0] ?? 0) - (u?.[0] ?? 0)) * ((w?.[0] ?? 0) - (u?.[0] ?? 0)) +
          ((v?.[1] ?? 0) - (u?.[1] ?? 0)) * ((w?.[1] ?? 0) - (u?.[1] ?? 0)) <=
        0;
      if (corner(a, b, c) || corner(b, a, c) || corner(c, a, b)) obtuse++;
    }
    expect(obtuse).toBe(0);
  });

  it('the seeds that failed: the local test of ∠BHC + ∠BAC = 180 holds', () => {
    const g = new Figure().point('A', 1, 3).point('B', 0, 0).point('C', 4, 0);
    g.def('H', 'orthocenter', 'A', 'B', 'C');
    const claim = g.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180));
    for (const seed of [91, 98, 115, 123]) {
      const job = { kind: 'testClaim', regime: 'local', doc: g.doc, claim, seed, n: 200 } as const;
      const r = testClaim(job, { registry: REGISTRY });
      expect(r.kind === 'verdict' ? r.verdict.text : r.kind, String(seed)).toMatch(
        /^HOLDS IN THIS CONFIGURATION/u,
      );
    }
  });
});
