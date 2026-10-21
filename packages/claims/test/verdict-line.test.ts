import { describe, expect, it } from 'vitest';
import { testClaim, type JobResult, type TestClaimJob } from '../src/job';
import type { Verdict } from '../src/verdict';
import { globalVerdict, localVerdict, newCollector, type Collector } from '../src/verdict';
import { verdictLine } from '../src/verdict-line';
import { Figure, n, orient, REGISTRY } from './helpers/build';

/** SPEC §10.5 wording of the verdict lines the web app shows (Run 8b, ADR-0013). */

function verdictOf(r: JobResult): Verdict {
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

function run(f: Figure, id: number, regime: 'local' | 'global', nSamples = 200): Verdict {
  const job: TestClaimJob = {
    kind: 'testClaim',
    regime,
    doc: f.doc,
    claim: id,
    seed: 5,
    n: nSamples,
  };
  return verdictOf(testClaim(job, { registry: REGISTRY }));
}

const COMMON = { seed: 3, n: 200, tested: 200, attempts: 200, hardToSatisfy: false };

function collector(t: number, f: number, rung: 'exact over Q' | 'numeric' = 'exact over Q') {
  const col: Collector = newCollector();
  col.tally.true = t;
  col.tally.false = f;
  col.rungs[rung] = t + f;
  return col;
}

const FORBIDDEN = /\bprov(ed|en|e|es|ing)\b|\bproof/iu;

describe('verdictLine: the wording of SPEC §10.5', () => {
  it('a claim exact over Q in all 200 figures: exactly the SPEC line', () => {
    const f = new Figure().point('A', 0, 0).point('B', 4, 2).def('M', 'midpoint', 'A', 'B');
    const id = f.claim('collinear', 'A', 'M', 'B');
    const line = verdictLine(run(f, id, 'local'));
    expect(line.text).toBe('Holds in this configuration (local test, n = 200, exact over Q)');
    expect(line.tone).toBe('holds');
    expect(line.detail).toContain('seed 5');
  });

  it('states mixed rungs with counts and fewer valid figures than tested', () => {
    const col = collector(150, 0);
    col.rungs = { 'exact over Q': 120, numeric: 30 };
    col.tally.degenerate = 50;
    const v = localVerdict(col, COMMON, { value: 'true', rung: 'exact over Q' });
    expect(verdictLine(v).text).toBe(
      'Holds in this configuration (local test, n = 200, exact over Q 120, numeric 30; 150 of 200 figures valid)',
    );
  });

  it('local FALSE, MIXED and INCONCLUSIVE', () => {
    const fal = localVerdict(collector(0, 200), COMMON, { value: 'true', rung: 'exact over Q' });
    expect(verdictLine(fal)).toMatchObject({
      text: 'False (local test, n = 200, exact over Q; true in the current figure only)',
      tone: 'false',
    });
    const mixed = localVerdict(collector(120, 80), COMMON, { value: 'true', rung: 'numeric' });
    expect(verdictLine(mixed)).toMatchObject({
      text: 'Mixed (local test, n = 200, exact over Q: 120 true, 80 false)',
      tone: 'mixed',
    });
    const none = newCollector();
    none.tally.degenerate = 200;
    none.reasons.set('degenerate: A and B coincide', 200);
    const inc = localVerdict(none, COMMON, { value: 'true', rung: 'numeric' });
    const line = verdictLine(inc);
    expect(line.text).toBe('Inconclusive (local test, n = 200: 0 of 200 figures valid)');
    expect(line.tone).toBe('inconclusive');
    expect(line.detail).toContain('degenerate: A and B coincide ×200');
  });

  it('global findings are information, never the colour of a failure', () => {
    const holds = globalVerdict(collector(200, 0), COMMON, { failing: 0, unrepaired: 0, k: 0 });
    const conf = globalVerdict(collector(150, 50), COMMON, { failing: 50, unrepaired: 50, k: 0 });
    const orient = globalVerdict(collector(150, 50), COMMON, {
      failing: 50,
      unrepaired: 0,
      k: 1,
      named: {
        object: 'P',
        selector: 'orient(+)',
        call: 'intersect(…)',
        advice: 'use same_side(…)',
      },
    });
    expect(verdictLine(holds).text).toBe(
      'Holds across the declared configuration (global test, n = 200, exact over Q; 0 mirrored)',
    );
    expect(verdictLine(conf).text).toBe(
      'Configuration-dependent (global test, n = 200, exact over Q: 50 of 200 fail; no orientation-dependent selector)',
    );
    expect(verdictLine(orient).text).toBe(
      "Orientation-dependent (global test, n = 200, exact over Q: 50 of 200 fail and hold with the selectors flipped; P's `orient(+)` encodes a side; use same_side(…))",
    );
    for (const v of [holds, conf, orient]) expect(verdictLine(v).tone).toBe('info');
  });

  it('hypotheses: rejected samples, a shortfall and "hard to satisfy" (unless the figure says why)', () => {
    const col = collector(40, 0);
    col.tally.rejected = 9960;
    const k = { ...COMMON, tested: 40, attempts: 10000, hardToSatisfy: true };
    const v = globalVerdict(col, k, { failing: 0, unrepaired: 0, k: 0 });
    expect(verdictLine(v).text).toBe(
      'Inconclusive (global test, n = 200: 40 of 40 figures valid; only 40 of 200 figures satisfied the hypotheses; hard to satisfy: few figures satisfy the hypotheses)',
    );
    expect(verdictLine(v, { figureExplains: true }).text).toBe(
      'Inconclusive (global test, n = 200: 40 of 40 figures valid; only 40 of 200 figures satisfied the hypotheses)',
    );
    const ok = collector(200, 0);
    ok.tally.rejected = 31;
    const g = globalVerdict(ok, { ...COMMON, attempts: 231 }, { failing: 0, unrepaired: 0, k: 0 });
    expect(verdictLine(g).text).toContain('31 samples rejected by hypotheses');
  });

  it('a real global run of an orientation-dependent claim (orient(+) on two circles)', () => {
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 4, 0)
      .point('P', 1, 3)
      .def('c1', 'circle', 'A', 'P')
      .def('c2', 'circle', 'B', 'P')
      .def('X', 'intersect', 'c1', 'c2', orient(1));
    const id = f.claim('equal', 'X', 'P');
    const v = run(f, id, 'global', 60);
    const line = verdictLine(v);
    expect(line.tone).toBe('info');
    expect(line.text.startsWith('Orientation-dependent (global test, n = 60')).toBe(true);
  });

  it('never uses the words reserved for the Phase 2 prover', () => {
    const lines = [
      localVerdict(collector(200, 0), COMMON, { value: 'true', rung: 'exact over Q' }),
      localVerdict(collector(0, 200), COMMON, { value: 'false', rung: 'exact over Q' }),
      globalVerdict(collector(200, 0), COMMON, { failing: 0, unrepaired: 0, k: 0 }),
    ].map((v) => verdictLine(v));
    for (const l of lines) expect(`${l.text} ${l.detail}`).not.toMatch(FORBIDDEN);
    expect(n(1).kind).toBe('lit');
  });
});
