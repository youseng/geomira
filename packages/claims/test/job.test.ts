import { describe, expect, it } from 'vitest';
import { runJob, testClaim, type JobResult, type TestClaimJob } from '../src/job';
import type { Verdict } from '../src/verdict';
import { c, Figure, n, REGISTRY } from './helpers/build';

function orthocentreSum(assumeAcute: boolean): { f: Figure; id: number } {
  const f = new Figure()
    .point('A', 1, 3)
    .point('B', 0, 0)
    .point('C', 4, 0)
    .def('H', 'orthocenter', 'A', 'B', 'C');
  if (assumeAcute) f.assume('acute', 'A', 'B', 'C');
  return { f, id: f.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180)) };
}

function verdictOf(r: JobResult): Verdict {
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

function job(
  f: Figure,
  id: number,
  regime: 'local' | 'global',
  extra: Partial<TestClaimJob> = {},
): TestClaimJob {
  return { kind: 'testClaim', regime, doc: f.doc, claim: id, seed: 11, n: 60, ...extra };
}

describe('runJob: a pure generator with progress, cancellation and regimes', () => {
  it('yields progress after every sample and returns the verdict', () => {
    const { f, id } = orthocentreSum(false);
    const it = runJob(job(f, id, 'local'), { registry: REGISTRY });
    const done: number[] = [];
    let r = it.next();
    while (r.done !== true) {
      done.push(r.value.done);
      r = it.next();
    }
    expect(done).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    expect(verdictOf(r.value)).toMatchObject({
      kind: 'holds',
      rungs: { 'exact over Q': 60 },
      seed: 11,
      n: 60,
    });
  });

  it("stops on next('cancel') and on return()", () => {
    const { f, id } = orthocentreSum(false);
    const it = runJob(job(f, id, 'global'), { registry: REGISTRY });
    it.next();
    it.next();
    expect(it.next('cancel')).toEqual({
      done: true,
      value: { kind: 'cancelled', done: 2, attempts: 2 },
    });
    const it2 = runJob(job(f, id, 'global'), { registry: REGISTRY });
    it2.next();
    expect(it2.return({ kind: 'cancelled', done: 0, attempts: 0 }).done).toBe(true);
    expect(it2.next().done).toBe(true);
  });

  it('is reproducible from its seed, and different seeds draw different figures', () => {
    const { f, id } = orthocentreSum(false);
    const a = verdictOf(testClaim(job(f, id, 'global'), { registry: REGISTRY }));
    const b = verdictOf(testClaim(job(f, id, 'global'), { registry: REGISTRY }));
    const other = verdictOf(testClaim(job(f, id, 'global', { seed: 12 }), { registry: REGISTRY }));
    expect(a).toEqual(b);
    expect(a.counterexample).not.toEqual(other.counterexample);
  });

  it('the hypothesis test: with assume acute(A, B, C) HOLDS ACROSS, without it CONFIGURATION-DEPENDENT', () => {
    const plain = orthocentreSum(false);
    const g = verdictOf(
      testClaim(job(plain.f, plain.id, 'global', { n: 200 }), { registry: REGISTRY }),
    );
    expect(g.kind).toBe('configuration-dependent');
    expect(g.counterexample).toBeDefined();
    expect(g.text).toMatch(
      /^CONFIGURATION-DEPENDENT \(\d+ of 200 fail; no orientation-dependent selector\)/,
    );
    const acute = orthocentreSum(true);
    const h = verdictOf(
      testClaim(job(acute.f, acute.id, 'global', { n: 200 }), { registry: REGISTRY }),
    );
    expect(h.kind).toBe('holds-across');
    expect(h.tally.rejected).toBeGreaterThan(0);
    expect(h.text).toMatch(
      /^HOLDS ACROSS THE DECLARED CONFIGURATION \(exact over Q, 200\/200; \d+ samples rejected by hypotheses; 100 mirrored\)/,
    );
    expect(h.mirrored).toBe(100);
  });

  it('local verdicts: FALSE notes "true in the current figure only"; MIXED carries both documents', () => {
    // C is placed so that AB = AC exactly in the current figure only.
    const f = new Figure().point('A', 0, 3).point('B', -4, 0).point('C', 4, 0);
    const id = f.claim('length', 'A', 'B', 'A', 'C', n(1));
    const v = verdictOf(testClaim(job(f, id, 'local'), { registry: REGISTRY }));
    expect(v.kind).toBe('false');
    expect(v.text).toMatch(
      /^FALSE \(exact over Q, 60\/60 false; true in the current figure only\)/,
    );
    expect(v.current).toEqual({ value: 'true', rung: 'exact over Q' });
    // The foot of D on AB is B itself: local noise puts it inside the segment or outside.
    const g = new Figure().point('A', 0, 0).point('B', 4, 0).point('D', 4, 1);
    const mixed = g.claim('on', c('foot', 'D', c('line', 'A', 'B')), c('segment', 'A', 'B'));
    const m = verdictOf(testClaim(job(g, mixed, 'local'), { registry: REGISTRY }));
    expect(m.kind).toBe('mixed');
    expect(m.text).toMatch(/^MIXED \(exact over Q, \d+ true and \d+ false of 60\)/);
    expect(m.example?.objects.map((o) => o.name)).toEqual(['A', 'B', 'D']);
    expect(m.counterexample?.objects.map((o) => o.name)).toEqual(['A', 'B', 'D']);
    expect(m.example).not.toEqual(m.counterexample);
  });

  it('INCONCLUSIVE when fewer than half of the figures are valid, with reasons', () => {
    const f = new Figure().point('A', 1, 3).point('B', 0, 0).def('M', 'midpoint', 'B', 'B');
    const id = f.claim('collinear', 'A', 'B', 'M');
    const v = verdictOf(testClaim(job(f, id, 'local'), { registry: REGISTRY }));
    expect(v.kind).toBe('inconclusive');
    expect(v.reasons[0]).toEqual({ reason: 'degenerate: B and M coincide', count: 60 });
    expect(v.text).toMatch(
      /^INCONCLUSIVE \(0 of 60 figures valid; degenerate: B and M coincide ×60\)/,
    );
  });

  it('hypotheses that few figures satisfy are reported as hard to satisfy, never silently fewer figures', () => {
    const { f } = orthocentreSum(false);
    f.assume('less', c('angle', 'B', 'A', 'C'), n('0.5'));
    const id = f.claim('collinear', 'A', 'B', c('midpoint', 'A', 'B'));
    const v = verdictOf(testClaim(job(f, id, 'global', { n: 20 }), { registry: REGISTRY }));
    expect(v.hardToSatisfy).toBe(true);
    expect(v.attempts).toBe(1000);
    expect(v.text).toMatch(/hard to satisfy/);
    expect(v.text).toMatch(
      new RegExp(`only ${String(v.tested)} of 20 figures satisfied the hypotheses`),
    );
  });

  it('invalid jobs are reported', () => {
    const { f, id } = orthocentreSum(false);
    expect(testClaim(job(f, 999, 'local'), { registry: REGISTRY })).toEqual({
      kind: 'invalid',
      reason: 'there is no claim #999',
    });
    expect(testClaim(job(f, id, 'local', { n: 0 }), { registry: REGISTRY })).toEqual({
      kind: 'invalid',
      reason: 'n must be a positive integer',
    });
  });

  it('no verdict text uses the words reserved for the Phase 2 prover', () => {
    const { f, id } = orthocentreSum(true);
    for (const regime of ['local', 'global'] as const) {
      const v = verdictOf(testClaim(job(f, id, regime), { registry: REGISTRY }));
      expect(v.text).not.toMatch(/pro(ved|ven|of)/i);
    }
  });
});

/** 150 objects: 10 free points, then 140 constructions chained over them. */
function bigFigure(): { f: Figure; id: number } {
  const f = new Figure();
  const pts = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'K', 'L'];
  pts.forEach((p, i) => f.point(p, (i * 37) % 11, (i * 53) % 13));
  const names = [...pts];
  for (let i = 0; names.length < 150; i++) {
    const [a, b, d] = [
      names[names.length - 1] ?? 'A',
      names[(i * 7) % names.length] ?? 'B',
      names[(i * 3 + 1) % 10] ?? 'C',
    ];
    const name = `P_${String(i)}`;
    if (i % 3 === 0) f.def(name, 'midpoint', a, d);
    else if (i % 3 === 1) f.def(name, 'centroid', a, b, d);
    else f.def(name, 'divide', a, d, n('1/3'));
    names.push(name);
  }
  const last = names[names.length - 1] ?? 'A';
  return { f, id: f.claim('collinear', 'A', c('midpoint', 'A', last), last) };
}

describe('budget (SPEC §17): local test, N = 200, 150 objects', () => {
  it('runs in at most 1.5 s in Node', () => {
    const { f, id } = bigFigure();
    expect(f.doc.objects.length).toBe(150);
    const t0 = performance.now();
    const v = verdictOf(
      testClaim(
        { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed: 1, n: 200 },
        { registry: REGISTRY },
      ),
    );
    const ms = performance.now() - t0;
    console.warn(`budget: local N = 200, 150 objects: ${ms.toFixed(0)} ms; ${v.text}`);
    expect(v.kind).toBe('holds');
    expect(ms).toBeLessThan(1500);
  });
});
