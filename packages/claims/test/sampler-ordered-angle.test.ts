import { describe, expect, it } from 'vitest';
import { toNumber } from '@geomira/num/rational';
import { readFree } from '../src/free';
import { testClaim } from '../src/job';
import { prepare } from '../src/prepare';
import { drawSample } from '../src/sampler';
import { c, Figure, n, REGISTRY } from './helpers/build';

/**
 * Bug found in the Run 10 audit (SPEC §10.4: "'In order on' hypotheses whose points are all
 * gliders on one object are sampled ordered (sorted parameters)"): gliders by angle, on(c, θ)
 * on a circle without a known point such as circle(O, r), formed no ordered group, so six such
 * gliders in order were sampled by rejection: 2 of 5! = 120 cyclic orders are accepted, under
 * the 5% of SPEC's "hard to satisfy", and the global test tested fewer than N figures.
 */
function sixOnACircle(): { f: Figure; claim: number } {
  const f = new Figure().point('O', 0, 0).def('w', 'circle', 'O', n(5));
  const names = ['P', 'Q', 'R', 'S', 'T', 'U'];
  names.forEach((name, i) => f.add(name, c('on', 'w', n(20 + 50 * i))));
  f.assume('in_order', ...names, 'w');
  return { f, claim: f.claim('concyclic', 'P', 'Q', 'R', 'S', 'T') };
}

describe('in_order gliders by angle on one circle are sampled ordered (global)', () => {
  it('they form one ordered group, and every global sample has increasing angles', () => {
    const { f, claim } = sixOnACircle();
    const p = prepare(f.doc, claim, REGISTRY);
    if (!p.ok) throw new Error(p.reason);
    expect(p.prepared.ordered.map((g) => [g.form, g.inputs.length])).toEqual([['angle-glider', 6]]);
    for (let s = 0; s < 100; s++) {
      const doc = drawSample(p.prepared, 'global', s, s % 2 === 1);
      const thetas = p.prepared.free
        .filter((x) => x.kind === 'angle-glider')
        .map((x) => toNumber(readFree(doc, x)?.[0] ?? { num: -1n, den: 1n }));
      expect([...thetas].sort((a, b) => a - b)).toEqual(thetas);
      for (const t of thetas) expect(t >= 0 && t <= 360).toBe(true);
    }
  });

  it('the global test of the six points tests all N figures and is not "hard to satisfy"', () => {
    const { f, claim } = sixOnACircle();
    const job = { kind: 'testClaim', regime: 'global', doc: f.doc, claim, seed: 3, n: 60 } as const;
    const r = testClaim(job, { registry: REGISTRY });
    if (r.kind !== 'verdict') throw new Error(r.kind);
    expect(r.verdict.tested).toBe(60);
    // Every attempt is accepted: the sorted draw always satisfies the hypothesis.
    expect(r.verdict.attempts).toBe(60);
    expect(r.verdict.hardToSatisfy ?? false).toBe(false);
    expect(r.verdict.text).not.toMatch(/hard to satisfy/u);
    expect(r.verdict.text).toMatch(/^HOLDS ACROSS THE DECLARED CONFIGURATION/u);
  });
});
