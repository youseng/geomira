/**
 * Found in the Run 10 audit: TestRuns took every message of every job it ever started.
 *   - Opening another figure (Examples, Restore previous figure) while a test ran cleared the
 *     runs but kept the job's callbacks; the worker's answer to the cancel then reached setRun,
 *     which threw "no test of claim #N" inside the worker's message listener: an internal-error
 *     banner each time.
 *   - A late message of a superseded job (its verdict raced the cancel, or its 'cancelled'
 *     reply) was stored as the run of the NEWER job: a verdict about the old figure shown as
 *     the current one's, and the newer job, still running, could no longer be cancelled.
 * Only the current job of a claim and regime may write its run.
 */
import { describe, expect, it } from 'vitest';
import { testClaim, type JobResult, type TestClaimJob } from '@geomira/claims/job';
import { encodeShare } from '@geomira/editor/share';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { openLaterLink } from '../src/hooks';
import { EditorStore } from '../src/store';
import { TestRuns, type JobHost } from '../src/test-runs';
import type { JobCallbacks } from '../src/worker/host';
import { registry } from './helpers';

class FakeHost implements JobHost {
  readonly jobs: { id: number; job: TestClaimJob; cb: JobCallbacks }[] = [];
  readonly cancelled: number[] = [];
  start(job: TestClaimJob, cb: JobCallbacks): number {
    const id = this.jobs.length + 1;
    this.jobs.push({ id, job, cb });
    return id;
  }
  cancel(id: number): void {
    this.cancelled.push(id);
  }
  warm(): void {
    // nothing to start
  }
  cb(i: number): JobCallbacks {
    const j = this.jobs[i];
    if (j === undefined) throw new Error('no job');
    return j.cb;
  }
  verdict(i: number): JobResult {
    const j = this.jobs[i];
    if (j === undefined) throw new Error('no job');
    return testClaim({ ...j.job, n: 10 }, { registry });
  }
}

const TEXT =
  '@version 1\nA = (1, 3)\nB = (0, 0)\nC = (4, 0)\nH = orthocenter(A, B, C)\nclaim ∠BHC + ∠BAC = 180\n';
const docOf = (t: string) => parse(t, registry).doc;

describe('TestRuns ignores the messages of jobs that are no longer current', () => {
  it("after clear() (another figure opened), the cancelled job's replies are ignored, not thrown", () => {
    const host = new FakeHost();
    const errors: string[] = [];
    const runs = new TestRuns(host, (m) => errors.push(m));
    const doc = docOf(TEXT);
    const claim = doc.claims[0]?.id ?? -1;
    runs.start(doc, claim, 'local');
    runs.clear();
    expect(host.cancelled).toEqual([1]);
    expect(() => {
      host.cb(0).progress({ kind: 'progress', regime: 'local', done: 1, n: 200, attempts: 1 });
      host.cb(0).result({ kind: 'cancelled', done: 3, attempts: 3 });
      host.cb(0).error('late');
    }).not.toThrow();
    expect(runs.getSnapshot().size).toBe(0);
    expect(errors).toEqual([]);
  });

  it('a verdict of the old figure that raced the cancel is not shown as the new figure’s', () => {
    const host = new FakeHost();
    const runs = new TestRuns(host, () => undefined);
    const doc1 = docOf(TEXT);
    const claim = doc1.claims[0]?.id ?? -1;
    runs.start(doc1, claim, 'local');
    const doc2 = docOf(TEXT.replace('A = (1, 3)', 'A = (2, 5)'));
    runs.start(doc2, claim, 'local');
    host.cb(0).result(host.verdict(0));
    const r = runs.getSnapshot().get(claim);
    expect(r?.doc).toBe(doc2);
    expect(r?.local).toEqual({ status: 'running', job: 2, done: 0, n: 200 });
    // The current job's own verdict is recorded.
    host.cb(1).result(host.verdict(1));
    expect(runs.getSnapshot().get(claim)?.local?.status).toBe('done');
  });

  it("the old job's late 'cancelled' reply leaves the new job running and cancellable", () => {
    const host = new FakeHost();
    const runs = new TestRuns(host, () => undefined);
    const doc = docOf(TEXT);
    const claim = doc.claims[0]?.id ?? -1;
    runs.start(doc, claim, 'local');
    runs.start(doc, claim, 'local');
    host.cb(0).result({ kind: 'cancelled', done: 3, attempts: 3 });
    expect(runs.getSnapshot().get(claim)?.local?.status).toBe('running');
    runs.cancel(claim);
    expect(host.cancelled).toEqual([1, 2]);
    // ...and its own 'cancelled' reply is shown.
    host.cb(1).result({ kind: 'cancelled', done: 4, attempts: 4 });
    expect(runs.getSnapshot().get(claim)?.local).toEqual({ status: 'cancelled', done: 4, n: 200 });
  });
});

describe('a share link opened while the page runs forgets the old figure’s tests', () => {
  it('hashchange to a valid link clears the runs; a damaged link leaves them', () => {
    const store = new EditorStore({ registry }, () => undefined);
    store.openText(TEXT, 'new');
    const host = new FakeHost();
    const runs = new TestRuns(host, () => undefined);
    const claim = store.current().doc.claims[0]?.id ?? -1;
    runs.start(store.current().doc, claim, 'local');
    expect(openLaterLink(store, runs, '#s=damaged')).not.toBeNull();
    expect(runs.getSnapshot().size).toBe(1);
    const other = docOf(TEXT.replace('A = (1, 3)', 'A = (2, 5)'));
    expect(openLaterLink(store, runs, encodeShare(other))).toBeNull();
    expect(runs.getSnapshot().size).toBe(0);
    expect(host.cancelled).toEqual([1]);
    expect(print(store.current().doc)).toContain('A = (2, 5)');
  });
});
