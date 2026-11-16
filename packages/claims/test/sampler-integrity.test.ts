import { describe, expect, it } from 'vitest';
import { compare, mul, toNumber } from '@geomira/num/rational';
import { prepare } from '../src/prepare';
import { drawSample } from '../src/sampler';
import { readFree } from '../src/free';
import { testClaim, type JobResult } from '../src/job';
import { randomFigure, type RandomizeResult } from '../src/randomize';
import { c, Figure, n, q, REGISTRY } from './helpers/build';

function radiusFigure() {
  const f = new Figure()
    .point('O', 0, 0)
    .point('F', 1000, 0)
    .def('c', 'circle', 'O', n('0.01'))
    .def('d', 'circle', 'O', n('0.02'))
    .def('A', 'on', 'c', n(0))
    .def('B', 'on', 'd', n(0));
  const claim = f.claim('length', 'O', 'A', 'O', 'B', n(1));
  return { f, claim };
}

function radius(doc: Figure['doc'], name: string) {
  const def = doc.objects.find((o) => o.name === name)?.def;
  if (def?.kind !== 'call' || def.args[1]?.kind !== 'lit') throw new Error('radius missing');
  return def.args[1].value;
}

function expectRefusal(result: RandomizeResult | JobResult, reason: string) {
  expect(['refused', 'invalid']).toContain(result.kind);
  if (result.kind !== 'refused' && result.kind !== 'invalid') throw new Error('missing refusal');
  expect(result.reason).toContain(reason);
}

describe('sampling preserves fixed construction inputs (ADR-0073)', () => {
  it('uses one exact similarity for both small radii, irrespective of a distant point', () => {
    const { f, claim } = radiusFigure();
    const result = prepare(f.doc, claim, REGISTRY);
    if (!result.ok) throw new Error(result.reason);
    for (const regime of ['local', 'global'] as const) {
      for (let seed = 0; seed < 30; seed++) {
        const doc = drawSample(result.prepared, regime, seed, false);
        expect(radius(doc, 'c').num).toBeGreaterThan(0n);
        expect(compare(radius(doc, 'd'), mul(q(2), radius(doc, 'c')))).toBe(0);
        expect(drawSample(result.prepared, regime, seed, false)).toEqual(doc);
        expect(doc.objects.find((o) => o.name === 'F')?.def).not.toEqual(f.doc.objects[1]?.def);
      }
      const job = testClaim(
        { kind: 'testClaim', doc: f.doc, claim, regime, seed: 1, n: 200 },
        { registry: REGISTRY },
      );
      expect(job.kind).toBe('verdict');
      if (job.kind !== 'verdict') throw new Error('missing verdict');
      expect(job.verdict.tally.true).toBe(0);
      expect(job.verdict.tested).toBe(200);
      expect(job.verdict.tally.false).toBeGreaterThan(0);
    }
  });

  it('Randomize preserves exact radius ratios and the dependency graph', () => {
    const { f } = radiusFigure();
    for (let seed = 0; seed < 20; seed++) {
      const r = randomFigure(f.doc, REGISTRY, 'any', seed);
      if (r.kind !== 'figure') throw new Error(r.reason);
      expect(compare(radius(r.doc, 'd'), mul(q(2), radius(r.doc, 'c')))).toBe(0);
      expect(r.doc.claims).toEqual(f.doc.claims);
      for (const name of ['A', 'B']) {
        const before = f.doc.objects.find((o) => o.name === name)?.def;
        const after = r.doc.objects.find((o) => o.name === name)?.def;
        expect(before?.kind).toBe('call');
        expect(after?.kind).toBe('call');
        if (before?.kind === 'call' && after?.kind === 'call') {
          expect(after.tool).toBe(before.tool);
          expect(after.args[0]).toEqual(before.args[0]);
        }
      }
    }
  });

  for (const invalid of [0, -1]) {
    it(`refuses invalid literal radius ${String(invalid)} instead of manufacturing a circle`, () => {
      const f = new Figure()
        .point('O', 0, 0)
        .def('w', 'circle', 'O', n(invalid))
        .def('A', 'on', 'w', n(0));
      const claim = f.claim('on', 'A', 'w');
      expectRefusal(randomFigure(f.doc, REGISTRY, 'any', 1), 'radius');
      for (const regime of ['local', 'global'] as const)
        expectRefusal(
          testClaim(
            { kind: 'testClaim', doc: f.doc, claim, regime, seed: 1, n: 200 },
            { registry: REGISTRY },
          ),
          'radius',
        );
    });
  }

  for (const [min, max, value] of [
    [2, 1, 1],
    [1, 1, 1],
    [0, 1, 2],
  ]) {
    it(`refuses an invalid unrelated param(${String(min)},${String(max)},${String(value)}) without throwing`, () => {
      const f = new Figure()
        .point('A', 0, 0)
        .point('B', 1, 0)
        .def('M', 'midpoint', 'A', 'B')
        .add('p', c('param', n(min ?? 0), n(max ?? 0), n(value ?? 0)));
      const claim = f.claim('collinear', 'A', 'M', 'B');
      expectRefusal(randomFigure(f.doc, REGISTRY, 'any', 1), 'param');
      for (const regime of ['local', 'global'] as const)
        expectRefusal(
          testClaim(
            { kind: 'testClaim', doc: f.doc, claim, regime, seed: 1, n: 1 },
            { registry: REGISTRY },
          ),
          'param',
        );
    });
  }

  for (const r of ['1' + '0'.repeat(400), '1/' + '1' + '0'.repeat(400)]) {
    it(`refuses a nonrepresentable radius with ${String(r.length)} digits`, () => {
      const f = new Figure().point('O', 0, 0).def('w', 'circle', 'O', n(r));
      const claim = f.claim('equal', 'O', 'O');
      expect(randomFigure(f.doc, REGISTRY, 'any', 1).kind).toBe('refused');
      expect(
        testClaim(
          { kind: 'testClaim', doc: f.doc, claim, regime: 'global', seed: 1, n: 1 },
          { registry: REGISTRY },
        ).kind,
      ).toBe('invalid');
    });
  }

  it('refuses nonrepresentable and indistinguishable parameter bounds before uniform', () => {
    const lower = '1' + '0'.repeat(30);
    const next = lower.slice(0, -1) + '1';
    for (const [min, max] of [
      [n(0), n('1' + '0'.repeat(400))],
      [n(lower), n(next)],
    ]) {
      const f = new Figure()
        .point('O', 0, 0)
        .add('p', c('param', min ?? n(0), max ?? n(1), min ?? n(0)));
      const claim = f.claim('equal', 'O', 'O');
      expectRefusal(randomFigure(f.doc, REGISTRY, 'any', 1), 'param');
      expectRefusal(
        testClaim(
          { kind: 'testClaim', doc: f.doc, claim, regime: 'global', seed: 1, n: 1 },
          { registry: REGISTRY },
        ),
        'param',
      );
    }
  });

  it('does not repair a zero homogeneous glider pair', () => {
    const f = new Figure()
      .point('O', 0, 0)
      .point('P', 3, 0)
      .def('w', 'circle', 'O', 'P')
      .def('A', 'on', 'w', n(0), n(0));
    expectRefusal(randomFigure(f.doc, REGISTRY, 'any', 1), 'nonzero parameter pair');
  });

  it('never rounds a very small positive fixed radius to the figure grid or to zero', () => {
    const f = new Figure()
      .point('O', 0, 0)
      .point('F', 1000, 0)
      .def('w', 'circle', 'O', n('1/' + '1' + '0'.repeat(100)));
    const claim = f.claim('equal', 'O', 'F');
    const p = prepare(f.doc, claim, REGISTRY);
    if (!p.ok) throw new Error(p.reason);
    const input = p.prepared.free.find((x) => x.kind === 'radius');
    if (input === undefined) throw new Error('input missing');
    const sampled = readFree(drawSample(p.prepared, 'global', 1, false), input)?.[0];
    expect(sampled?.num).toBeGreaterThan(0n);
    expect(toNumber(sampled ?? q(1))).toBeLessThan(1e-90);
  });
});
