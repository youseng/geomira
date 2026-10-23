/**
 * Bug-fix round (ADR-0028; ADR-0013 decision 7): "Test globally" stamped the earlier LOCAL
 * verdict with the new document (`{ ...r, doc }`), so after an edit the stale note vanished
 * and the old local verdict was shown as the current figure's. Each run now keeps the
 * document it tested, and staleness is judged per run.
 */
import { describe, expect, it } from 'vitest';
import type { TestClaimJob } from '@geomira/claims/job';
import { parse } from '@geomira/lang/parse';
import { runDoc, runsFor, staleRuns, TestRuns, type JobHost } from '../src/test-runs';
import type { JobCallbacks } from '../src/worker/host';
import { registry } from './helpers';

class Host implements JobHost {
  readonly jobs: { job: TestClaimJob; cb: JobCallbacks }[] = [];
  start(job: TestClaimJob, cb: JobCallbacks): number {
    this.jobs.push({ job, cb });
    return this.jobs.length;
  }
  cancel(): void {}
  warm(): void {}
}

const docOf = (t: string) => parse(`@version 1\n${t}`, registry).doc;
const BEFORE = 'A = (0, 0)\nB = (4, 0)\nC = (1, 3)\nclaim distance(C, A) = distance(C, B)\n';

describe('each run keeps the document it tested', () => {
  it('a global test after an edit leaves the local verdict marked as of the earlier figure', () => {
    const host = new Host();
    const runs = new TestRuns(host, () => undefined);
    const doc1 = docOf(BEFORE);
    const claim = doc1.claims[0]?.id ?? -1;
    runs.start(doc1, claim, 'local');
    const doc2 = docOf(BEFORE.replace('C = (1, 3)', 'C = (2, 3)'));
    runs.start(doc2, claim, 'global');
    const r = runsFor(runs.getSnapshot(), doc2, claim);
    if (r === undefined) throw new Error('no runs');
    expect(runDoc(r, 'local')).toBe(doc1);
    expect(runDoc(r, 'global')).toBe(doc2);
    // The latest tested document is still the claim's (frozen tests read `doc`).
    expect(r.doc).toBe(doc2);
  });

  it('a local test after a global one replaces both, with its own document', () => {
    const host = new Host();
    const runs = new TestRuns(host, () => undefined);
    const doc1 = docOf(BEFORE);
    const claim = doc1.claims[0]?.id ?? -1;
    runs.start(doc1, claim, 'global');
    const doc2 = docOf(BEFORE.replace('C = (1, 3)', 'C = (2, 3)'));
    runs.start(doc2, claim, 'local');
    const r = runs.getSnapshot().get(claim);
    if (r === undefined) throw new Error('no runs');
    expect(r.global).toBeUndefined();
    expect(runDoc(r, 'local')).toBe(doc2);
  });

  it('a run of a different statement under the same id is not shown, the other run is', () => {
    const host = new Host();
    const runs = new TestRuns(host, () => undefined);
    const doc1 = docOf(BEFORE);
    const claim = doc1.claims[0]?.id ?? -1;
    runs.start(doc1, claim, 'local');
    const doc2 = docOf(BEFORE.replace('distance(C, B)', 'distance(A, B)'));
    expect(doc2.claims[0]?.id).toBe(claim);
    runs.start(doc2, claim, 'global');
    const shown = runsFor(runs.getSnapshot(), doc2, claim);
    expect(shown?.local).toBeUndefined();
    expect(shown?.global?.status).toBe('running');
  });

  it('staleness is per run: the repro (local false, edit, Test globally)', () => {
    const host = new Host();
    const runs = new TestRuns(host, () => undefined);
    const doc1 = docOf(BEFORE);
    const claim = doc1.claims[0]?.id ?? -1;
    runs.start(doc1, claim, 'local');
    const doc2 = docOf(BEFORE.replace('C = (1, 3)', 'C = (2, 3)'));
    const before = runs.getSnapshot().get(claim);
    if (before === undefined) throw new Error('no runs');
    expect(staleRuns(before, doc2)).toEqual({ local: true, global: false });
    runs.start(doc2, claim, 'global');
    const after = runs.getSnapshot().get(claim);
    if (after === undefined) throw new Error('no runs');
    expect(staleRuns(after, doc2)).toEqual({ local: true, global: false });
    expect(staleRuns(after, doc1)).toEqual({ local: false, global: true });
  });
});
