/**
 * ADR-0035 decisions 10 and 16, ADR-0036: the page's discovery jobs. Each starts with a fresh
 * seed, reports progress, ends with its result kept with the document it ran on; only the
 * current job of a slot writes it; the time budget sends `stop`; cancel reports nothing; opening
 * another figure (the test runs' clear) forgets every job and view; the view and the highlight
 * are state of the canvas only, never of the document.
 */
import { describe, expect, it } from 'vitest';
import type { DiscoveryJob, DiscoveryOutcome } from '@geomira/discovery/job';
import { parse } from '@geomira/lang/parse';
import {
  BRANCH_FIX_MS,
  DiscoveryRuns,
  FIND_MS,
  sameFigure,
  type DiscoveryHost,
} from '../src/discovery-runs';
import { TestRuns, type JobHost } from '../src/test-runs';
import type { DiscoveryCallbacks } from '../src/worker/host';
import { registry } from './helpers';

class FakeHost implements DiscoveryHost {
  readonly jobs: { id: number; job: DiscoveryJob; cb: DiscoveryCallbacks }[] = [];
  readonly cancelled: number[] = [];
  readonly stopped: number[] = [];
  private next = 1;
  startDiscovery(job: DiscoveryJob, cb: DiscoveryCallbacks): number {
    const id = this.next++;
    this.jobs.push({ id, job, cb });
    return id;
  }
  cancel(id: number): void {
    this.cancelled.push(id);
  }
  stop(id: number): void {
    this.stopped.push(id);
  }
  last() {
    const j = this.jobs.at(-1);
    if (j === undefined) throw new Error('no job');
    return j;
  }
}

class Timers {
  readonly pending: { f: () => void; ms: number; cancelled: boolean }[] = [];
  set = (f: () => void, ms: number): (() => void) => {
    const t = { f, ms, cancelled: false };
    this.pending.push(t);
    return () => {
      t.cancelled = true;
    };
  };
  fireAll(): void {
    for (const t of this.pending.splice(0)) if (!t.cancelled) t.f();
  }
}

const DOC = parse('@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\n', registry).doc;

function found(doc = DOC): DiscoveryOutcome {
  return {
    kind: 'found',
    seed: 1,
    budget: { candidatesPerKind: 1, countLimit: 1, tests: 1, results: 1, n: 1 },
    facts: [],
    beyondResults: 0,
    construction: { count: 0, shown: [] },
    unconfirmed: [],
    untested: 0,
    kinds: [],
    notSearched: [],
    stopped: false,
    caps: [doc === DOC ? 'none' : 'other'],
  };
}

function setup() {
  const host = new FakeHost();
  const timers = new Timers();
  const errors: string[] = [];
  const runs = new DiscoveryRuns(host, timers.set, (m) => errors.push(m));
  return { host, timers, errors, runs };
}

describe('DiscoveryRuns', () => {
  it('find: progress, then the result with the document it ran on', () => {
    const { host, runs } = setup();
    runs.find(DOC);
    const { job, cb, id } = host.last();
    expect(job).toMatchObject({ kind: 'find', doc: DOC, budget: { n: 200 } });
    expect(runs.getSnapshot().find).toMatchObject({ status: 'running', job: id });
    cb.progress({ kind: 'progress', job: 'find', phase: 'screening on', done: 2, total: 5 });
    expect(runs.getSnapshot().find).toMatchObject({ phase: 'screening on', done: 2, total: 5 });
    cb.result(found());
    expect(runs.getSnapshot().find).toMatchObject({ status: 'done', doc: DOC });
  });

  it('a superseded job writes nothing; a new job cancels the old one', () => {
    const { host, runs } = setup();
    runs.find(DOC);
    const first = host.last();
    runs.find(DOC);
    expect(host.cancelled).toEqual([first.id]);
    first.cb.result(found());
    expect(runs.getSnapshot().find?.status).toBe('running');
  });

  it('the time budget sends stop to the current job only', () => {
    const { host, timers, runs } = setup();
    runs.find(DOC);
    expect(timers.pending.map((t) => t.ms)).toEqual([FIND_MS]);
    timers.fireAll();
    expect(host.stopped).toEqual([host.last().id]);
    runs.branchFix(DOC, 7, 'global');
    expect(timers.pending.at(-1)?.ms).toBe(BRANCH_FIX_MS);
    host.last().cb.result({ kind: 'invalid', reason: 'no claim #7' });
    timers.fireAll();
    expect(host.stopped).toHaveLength(1);
    expect(runs.getSnapshot().fixes.get(7)).toMatchObject({
      status: 'failed',
      message: 'no claim #7',
    });
  });

  it('cancel reports nothing; an error is reported to the page', () => {
    const { host, runs, errors } = setup();
    runs.hunt(DOC);
    runs.cancelHunt();
    expect(runs.getSnapshot().hunt?.status).toBe('cancelled');
    runs.hunt(DOC);
    host.last().cb.error('boom');
    expect(runs.getSnapshot().hunt).toMatchObject({ status: 'failed', message: 'boom' });
    expect(errors).toEqual(['a discovery job failed: boom']);
  });

  it('a result of another kind than the job is a failure, not a result', () => {
    const { host, runs } = setup();
    runs.hunt(DOC);
    host.last().cb.result(found());
    expect(runs.getSnapshot().hunt?.status).toBe('failed');
  });

  it('opening another figure forgets every job and the view', () => {
    const { host, runs } = setup();
    const testHost: JobHost = { start: () => 1, cancel: () => undefined, warm: () => undefined };
    const tests = new TestRuns(testHost, () => undefined);
    tests.onClear(() => {
      runs.clear();
    });
    runs.find(DOC);
    runs.setView({ doc: DOC, label: 'special position 1', objects: [1] });
    runs.highlight([1, 2]);
    tests.clear();
    expect(host.cancelled).toEqual([host.last().id]);
    expect(runs.getSnapshot().find).toBeUndefined();
    expect(runs.getSnapshot()).toMatchObject({ view: null, highlight: [] });
  });

  it('highlight and view are canvas state: setting the same again notifies nobody', () => {
    const { runs } = setup();
    let heard = 0;
    runs.subscribe(() => heard++);
    runs.highlight([3]);
    runs.highlight([3]);
    expect(heard).toBe(1);
    runs.setView(null);
    expect(heard).toBe(1);
  });

  it('sameFigure: the same objects and definitions; claims do not matter', () => {
    const withClaim = parse(
      '@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\nclaim collinear(A, B, C)\n',
      registry,
    ).doc;
    const moved = parse('@version 1\nA = (0, 1)\nB = (4, 0)\nC = (1, 3)\n', registry).doc;
    expect(sameFigure(DOC, withClaim)).toBe(true);
    expect(sameFigure(DOC, moved)).toBe(false);
  });
});

describe('the canvas snapshot', () => {
  it('changes with the view and the rings, never with a job’s progress', () => {
    const { host, runs } = setup();
    const before = runs.getCanvas();
    runs.find(DOC);
    host
      .last()
      .cb.progress({ kind: 'progress', job: 'find', phase: 'screening on', done: 1, total: 2 });
    expect(runs.getCanvas()).toBe(before);
    runs.highlight([1]);
    const ringed = runs.getCanvas();
    expect(ringed).not.toBe(before);
    expect(ringed.highlight).toEqual([1]);
    host
      .last()
      .cb.progress({ kind: 'progress', job: 'find', phase: 'screening on', done: 2, total: 2 });
    expect(runs.getCanvas()).toBe(ringed);
    runs.clear();
    expect(runs.getCanvas()).toEqual({ highlight: [], view: null });
  });
});
