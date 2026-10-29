/**
 * ADR-0035 decision 15, ADR-0036 decision 6: discovery jobs take the test jobs' path. In the
 * worker they are sent as `discover` and answered by `found-progress` / `found`; without a
 * worker the page runs them in time slices (ADR-0030) with every task within its budget; `stop`
 * (the page's time budget) ends a job with what it has confirmed; the protocol check accepts
 * exactly the discovery job kinds.
 */
import { describe, expect, it } from 'vitest';
import type { DiscoveryJob, DiscoveryOutcome } from '@geomira/discovery/job';
import type { DiscoveryProgress } from '@geomira/discovery/types';
import { parse } from '@geomira/lang/parse';
import { TestHost, type WorkerLike } from '../src/worker/host';
import { InlineRunner, MAIN_SLICE_MS } from '../src/worker/inline-runner';
import { isFromWorker, isToWorker, type FromWorker, type ToWorker } from '../src/worker/protocol';
import type { SliceClock } from '../src/worker/slicer';
import { registry } from './helpers';

class FakeWorker implements WorkerLike {
  readonly sent: ToWorker[] = [];
  private readonly onMessage: ((e: MessageEvent<unknown>) => void)[] = [];
  postMessage(m: ToWorker): void {
    this.sent.push(m);
  }
  addEventListener(type: 'message' | 'error', f: (e: never) => void): void {
    if (type === 'message') this.onMessage.push(f as (e: MessageEvent<unknown>) => void);
  }
  terminate(): void {
    // Nothing to stop in the fake.
  }
  emit(m: FromWorker): void {
    for (const f of this.onMessage) f({ data: m } as MessageEvent<unknown>);
  }
}

/** Real time: each task's duration is measured (the page's budget is about wall time). */
// A task counts the shorter of its wall time and its thread's CPU time (ADR-0044): under CPU load
// the wall time also counts the time the machine gave other processes, which no slicer controls.
const threadMs = (): number => {
  const u = process.threadCpuUsage();
  return (u.user + u.system) / 1000;
};

class TaskClock implements SliceClock {
  readonly tasks: (() => void)[] = [];
  readonly durations: number[] = [];
  now = (): number => performance.now();
  later = (f: () => void): void => {
    this.tasks.push(f);
  };
  drain(): void {
    for (let i = 0; i < 1_000_000 && this.tasks.length > 0; i++) {
      const f = this.tasks.shift();
      const t0 = performance.now();
      const c0 = threadMs();
      f?.();
      const wall = performance.now() - t0;
      this.durations.push(Math.min(wall, threadMs() - c0));
    }
  }
}

const DOC = parse(
  '@version 1\nA = (1, 5)\nB = (-3, 0)\nC = (4, 1)\nO = circumcenter(A, B, C)\nH = orthocenter(A, B, C)\nG = centroid(A, B, C)\n',
  registry,
).doc;

const FIND: DiscoveryJob = { kind: 'find', doc: DOC, seed: 5, budget: { n: 20 } };

function recorder() {
  const r = {
    progress: [] as DiscoveryProgress[],
    result: [] as DiscoveryOutcome[],
    error: [] as string[],
  };
  return {
    r,
    callbacks: {
      progress: (p: DiscoveryProgress) => r.progress.push(p),
      result: (x: DiscoveryOutcome) => r.result.push(x),
      error: (m: string) => r.error.push(m),
    },
  };
}

function setup(createWorker: () => WorkerLike | null) {
  const clock = new TaskClock();
  const host = new TestHost({
    createWorker,
    inline: () => new InlineRunner({ registry }, clock),
    setTimer: () => () => undefined,
  });
  return { clock, host };
}

describe('discovery jobs in the worker host', () => {
  it('the worker gets `discover`, `cancel` and `stop`; its answers reach the job', () => {
    const w = new FakeWorker();
    const { host } = setup(() => w);
    const { r, callbacks } = recorder();
    const id = host.startDiscovery(FIND, callbacks);
    w.emit({ type: 'ready', id: 0 });
    host.stop(id);
    host.cancel(id);
    expect(w.sent).toEqual([
      { type: 'discover', id, job: FIND },
      { type: 'stop', id },
      { type: 'cancel', id },
    ]);
    const progress: DiscoveryProgress = {
      kind: 'progress',
      job: 'find',
      phase: 'screening collinear',
      done: 1,
      total: 9,
    };
    w.emit({ type: 'found-progress', id, progress });
    // A claim test's messages for this id are not this job's.
    w.emit({
      type: 'progress',
      id,
      progress: { kind: 'progress', regime: 'local', done: 1, n: 2, attempts: 1 },
    });
    w.emit({ type: 'found', id, result: { kind: 'cancelled' } });
    expect(r.progress).toEqual([progress]);
    expect(r.result).toEqual([{ kind: 'cancelled' }]);
  });

  it('without a worker the page finds the Euler line in slices within its budget', () => {
    const { clock, host } = setup(() => null);
    const { r, callbacks } = recorder();
    host.startDiscovery(FIND, callbacks);
    clock.drain();
    expect(r.error).toEqual([]);
    const out = r.result[0];
    if (out?.kind !== 'found') throw new Error(JSON.stringify(out));
    const euler = out.facts.find((f) => f.kind === 'collinear' && f.tag?.name === 'Euler line');
    expect(euler).toBeDefined();
    // The page's slices: MAIN_SLICE_MS plus at most one step beyond the prediction. The
    // first slice (screen and closure) is allowed one step; the rest stay near the budget.
    const late = clock.durations.slice(2).filter((d) => d > 16);
    expect(late.length, clock.durations.map((d) => d.toFixed(1)).join(' ')).toBeLessThanOrEqual(
      Math.ceil(clock.durations.length / 50),
    );
    expect(MAIN_SLICE_MS).toBeLessThan(16);
  });

  it('stop on the page ends the job with what it has (stopped at the time budget)', () => {
    const { clock, host } = setup(() => null);
    const { r, callbacks } = recorder();
    const id = host.startDiscovery(FIND, callbacks);
    host.stop(id);
    clock.drain();
    const out = r.result[0];
    if (out?.kind !== 'found') throw new Error(JSON.stringify(out));
    expect(out.stopped).toBe(true);
    expect(out.caps).toContain('stopped at the time budget');
  });

  it('the protocol check accepts the discovery messages and no other job kind', () => {
    for (const kind of ['find', 'hunt', 'branchFix'])
      expect(isToWorker({ type: 'discover', id: 1, job: { kind, doc: DOC } })).toBe(true);
    expect(isToWorker({ type: 'discover', id: 1, job: { kind: 'testClaim', doc: DOC } })).toBe(
      false,
    );
    expect(isToWorker({ type: 'run', id: 1, job: { kind: 'find', doc: DOC } })).toBe(false);
    expect(isToWorker({ type: 'stop', id: 1 })).toBe(true);
    expect(isFromWorker({ type: 'found', id: 1, result: { kind: 'cancelled' } })).toBe(true);
    expect(isFromWorker({ type: 'found-progress', id: 1 })).toBe(false);
  });
});
