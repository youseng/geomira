import { describe, expect, it } from 'vitest';
import {
  testClaim,
  type JobProgress,
  type JobResult,
  type TestClaimJob,
} from '@geomira/claims/job';
import { parse } from '@geomira/lang/parse';
import { TEST_N, TestRuns, type JobHost } from '../src/test-runs';
import type { JobCallbacks } from '../src/worker/host';
import { isFromWorker, isToWorker } from '../src/worker/protocol';
import { registry } from './helpers';

/** The page's test runs (SPEC §16) over a fake host that runs jobs synchronously on demand. */
class FakeHost implements JobHost {
  readonly jobs: { id: number; job: TestClaimJob; cb: JobCallbacks }[] = [];
  readonly cancelled: number[] = [];
  warmed = 0;
  start(job: TestClaimJob, cb: JobCallbacks): number {
    const id = this.jobs.length + 1;
    this.jobs.push({ id, job, cb });
    return id;
  }
  cancel(id: number): void {
    this.cancelled.push(id);
  }
  warm(): void {
    this.warmed++;
  }
  /** Runs job `i` to completion, as the worker would, with a small n. */
  finish(i: number, n = 20): JobResult {
    const j = this.jobs[i];
    if (j === undefined) throw new Error(`no job ${String(i)}`);
    const progress: JobProgress = {
      kind: 'progress',
      regime: j.job.regime,
      done: 1,
      n,
      attempts: 1,
    };
    j.cb.progress(progress);
    const r = testClaim({ ...j.job, n }, { registry });
    j.cb.result(r);
    return r;
  }
}

function docOf(text: string) {
  return parse(`@version 1\n${text}`, registry).doc;
}

const ORTHO = 'A = (1, 3)\nB = (0, 0)\nC = (4, 0)\nH = orthocenter(A, B, C)\n';

describe('TestRuns', () => {
  it('a local test, then by itself a global one when the document has assume lines', () => {
    const host = new FakeHost();
    const runs = new TestRuns(host, () => undefined);
    const doc = docOf(`${ORTHO}assume acute(A, B, C)\nclaim ∠BHC + ∠BAC = 180`);
    const claim = doc.claims[0]?.id ?? -1;
    let notified = 0;
    runs.subscribe(() => notified++);
    runs.start(doc, claim, 'local');
    expect(host.jobs[0]?.job).toMatchObject({
      kind: 'testClaim',
      regime: 'local',
      claim,
      n: TEST_N,
    });
    expect(host.jobs[0]?.job.doc).toBe(doc);
    expect(runs.getSnapshot().get(claim)?.local).toMatchObject({ status: 'running', done: 0 });
    host.finish(0);
    expect(runs.getSnapshot().get(claim)?.local).toMatchObject({ status: 'done' });
    expect(host.jobs[1]?.job.regime).toBe('global');
    host.finish(1);
    expect(runs.getSnapshot().get(claim)?.global).toMatchObject({ status: 'done' });
    expect(runs.getSnapshot().get(claim)?.doc).toBe(doc);
    expect(notified).toBeGreaterThan(3);
  });

  it('without assume lines the global test runs only when asked; seeds differ', () => {
    const host = new FakeHost();
    const runs = new TestRuns(host, () => undefined);
    const doc = docOf(`${ORTHO}claim ∠BHC + ∠BAC = 180`);
    const claim = doc.claims[0]?.id ?? -1;
    runs.start(doc, claim, 'local');
    host.finish(0);
    expect(host.jobs).toHaveLength(1);
    runs.start(doc, claim, 'global');
    expect(host.jobs[1]?.job.seed).not.toBe(host.jobs[0]?.job.seed);
    expect(Number.isSafeInteger(host.jobs[1]?.job.seed)).toBe(true);
  });

  it('cancel and clear reach the host; worker errors are reported', () => {
    const host = new FakeHost();
    const errors: string[] = [];
    const runs = new TestRuns(host, (m) => errors.push(m));
    const doc = docOf(`${ORTHO}claim ∠BHC + ∠BAC = 180`);
    const claim = doc.claims[0]?.id ?? -1;
    runs.start(doc, claim, 'local');
    runs.cancel(claim);
    expect(host.cancelled).toEqual([1]);
    host.jobs[0]?.cb.result({ kind: 'cancelled', done: 3, attempts: 3 });
    expect(runs.getSnapshot().get(claim)?.local).toEqual({
      status: 'cancelled',
      done: 3,
      n: TEST_N,
    });
    runs.start(doc, claim, 'global');
    host.jobs[1]?.cb.error('boom');
    expect(runs.getSnapshot().get(claim)?.global).toEqual({ status: 'failed', message: 'boom' });
    expect(errors).toEqual(['the test worker failed: boom']);
    runs.warm();
    expect(host.warmed).toBe(1);
    runs.clear();
    expect(runs.getSnapshot().size).toBe(0);
  });
});

describe('worker messages', () => {
  it('accept what the host and the worker send, refuse anything else', () => {
    const doc = docOf('A = (0, 0)');
    const job: TestClaimJob = { kind: 'testClaim', regime: 'local', doc, claim: 1, seed: 1, n: 2 };
    expect(isToWorker({ type: 'run', id: 1, job })).toBe(true);
    expect(isToWorker({ type: 'cancel', id: 1 })).toBe(true);
    for (const bad of [
      null,
      1,
      {},
      { type: 'run', id: 1 },
      { type: 'run', id: '1', job },
      { type: 'x', id: 1 },
    ])
      expect(isToWorker(bad)).toBe(false);
    const progress = { kind: 'progress', regime: 'local', done: 1, n: 2, attempts: 1 };
    expect(isFromWorker({ type: 'progress', id: 1, progress })).toBe(true);
    expect(isFromWorker({ type: 'result', id: 1, result: { kind: 'invalid', reason: 'r' } })).toBe(
      true,
    );
    expect(isFromWorker({ type: 'error', id: 1, message: 'm' })).toBe(true);
    for (const bad of [
      undefined,
      { type: 'error', id: 1 },
      { type: 'progress', id: 1 },
      { type: 'y', id: 2 },
    ])
      expect(isFromWorker(bad)).toBe(false);
  });
});
