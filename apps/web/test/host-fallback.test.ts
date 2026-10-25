import { describe, expect, it } from 'vitest';
import type { JobProgress, JobResult, TestClaimJob } from '@geomira/claims/job';
import { parse } from '@geomira/lang/parse';
import { TestHost, type WorkerLike } from '../src/worker/host';
import { InlineRunner, MAIN_SLICE_MS } from '../src/worker/inline-runner';
import type { FromWorker, ToWorker } from '../src/worker/protocol';
import type { SliceClock } from '../src/worker/slicer';
import { registry } from './helpers';

/**
 * Run 12, SPEC §16: without workers the page runs tests itself in time slices. The host uses
 * the worker when one starts (it says `ready`), and falls back to the page when the platform
 * has no Worker, the constructor throws, or the worker fails or stays silent before it is
 * ready; jobs already sent move to the page. A worker that fails AFTER it was ready is a real
 * failure, reported as before.
 */

class FakeWorker implements WorkerLike {
  readonly sent: ToWorker[] = [];
  terminated = false;
  private readonly onMessage: ((e: MessageEvent<unknown>) => void)[] = [];
  private readonly onError: ((e: ErrorEvent) => void)[] = [];
  postMessage(m: ToWorker): void {
    this.sent.push(m);
  }
  addEventListener(type: 'message' | 'error', f: (e: never) => void): void {
    if (type === 'message') this.onMessage.push(f as (e: MessageEvent<unknown>) => void);
    else this.onError.push(f as (e: ErrorEvent) => void);
  }
  terminate(): void {
    this.terminated = true;
  }
  emit(m: FromWorker): void {
    for (const f of this.onMessage) f({ data: m } as MessageEvent<unknown>);
  }
  fail(message = ''): void {
    for (const f of this.onError) f({ message } as ErrorEvent);
  }
}

/** A clock whose tasks run when the test drains them (time advances only by steps). */
class ManualClock implements SliceClock {
  t = 0;
  readonly tasks: (() => void)[] = [];
  now = (): number => this.t;
  later = (f: () => void): void => {
    this.tasks.push(f);
  };
  drain(): void {
    for (let i = 0; i < 1_000_000 && this.tasks.length > 0; i++) this.tasks.shift()?.();
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

const DOC = parse(
  '@version 1\nA = (1, 3)\nB = (0, 0)\nC = (4, 0)\nH = orthocenter(A, B, C)\nclaim ∠BHC + ∠BAC = 180',
  registry,
).doc;

function jobOf(regime: TestClaimJob['regime'] = 'local', n = 10): TestClaimJob {
  return { kind: 'testClaim', regime, doc: DOC, claim: DOC.claims[0]?.id ?? -1, seed: 7, n };
}

function recorder() {
  const r = { progress: [] as JobProgress[], result: [] as JobResult[], error: [] as string[] };
  return {
    r,
    callbacks: {
      progress: (p: JobProgress) => r.progress.push(p),
      result: (x: JobResult) => r.result.push(x),
      error: (m: string) => r.error.push(m),
    },
  };
}

function setup(createWorker: () => WorkerLike | null) {
  const clock = new ManualClock();
  const timers = new Timers();
  const host = new TestHost({
    createWorker,
    inline: () => new InlineRunner({ registry }, clock),
    setTimer: timers.set,
  });
  return { clock, timers, host };
}

describe('TestHost: worker or page', () => {
  it('without a Worker at all, runs the job on the page and says so', () => {
    const { clock, host } = setup(() => null);
    const { r, callbacks } = recorder();
    host.start(jobOf(), callbacks);
    expect(host.runner().kind).toBe('page');
    clock.drain();
    expect(r.result).toHaveLength(1);
    expect(r.result[0]?.kind).toBe('verdict');
    expect(r.error).toEqual([]);
  });

  it('a throwing Worker constructor falls back with its reason', () => {
    const { clock, host } = setup(() => {
      throw new Error('SecurityError: workers are blocked');
    });
    const { r, callbacks } = recorder();
    host.start(jobOf(), callbacks);
    const runner = host.runner();
    if (runner.kind !== 'page') throw new Error(`runner ${runner.kind}`);
    expect(runner.reason).toContain('workers are blocked');
    clock.drain();
    expect(r.result[0]?.kind).toBe('verdict');
  });

  it('uses the worker once it is ready; results come from it', () => {
    const w = new FakeWorker();
    const { host } = setup(() => w);
    const { r, callbacks } = recorder();
    const id = host.start(jobOf(), callbacks);
    w.emit({ type: 'ready', id: 0 });
    expect(host.runner().kind).toBe('worker');
    expect(w.sent).toEqual([{ type: 'run', id, job: jobOf() }]);
    const verdict: JobResult = { kind: 'invalid', reason: 'from the worker' };
    w.emit({ type: 'result', id, result: verdict });
    expect(r.result).toEqual([verdict]);
  });

  it('a worker that fails before it is ready hands its jobs to the page', () => {
    const w = new FakeWorker();
    const { clock, host } = setup(() => w);
    const a = recorder();
    const b = recorder();
    host.start(jobOf('local'), a.callbacks);
    host.start(jobOf('global'), b.callbacks);
    w.fail('blob: URL refused');
    expect(w.terminated).toBe(true);
    expect(host.runner()).toEqual({ kind: 'page', reason: 'blob: URL refused' });
    clock.drain();
    expect(a.r.result[0]?.kind).toBe('verdict');
    expect(b.r.result[0]?.kind).toBe('verdict');
    expect([...a.r.error, ...b.r.error]).toEqual([]);
  });

  it('a worker silent past the start-up time counts as unavailable', () => {
    const w = new FakeWorker();
    const { clock, timers, host } = setup(() => w);
    const { r, callbacks } = recorder();
    host.start(jobOf(), callbacks);
    timers.fireAll();
    expect(host.runner().kind).toBe('page');
    expect(w.terminated).toBe(true);
    clock.drain();
    expect(r.result[0]?.kind).toBe('verdict');
  });

  it('a worker failing after it was ready is an error of its jobs, not a fallback', () => {
    const w = new FakeWorker();
    const { host, timers } = setup(() => w);
    const { r, callbacks } = recorder();
    host.start(jobOf(), callbacks);
    w.emit({ type: 'ready', id: 0 });
    timers.fireAll();
    expect(host.runner().kind).toBe('worker');
    w.fail('out of memory');
    expect(r.error).toEqual(['out of memory']);
    expect(host.runner().kind).not.toBe('page');
  });

  it('cancel reaches the page runner after a fallback', () => {
    const { clock, host } = setup(() => null);
    const { r, callbacks } = recorder();
    const id = host.start(jobOf('local', 200), callbacks);
    host.cancel(id);
    clock.drain();
    expect(r.result).toHaveLength(1);
    expect(r.result[0]?.kind).toBe('cancelled');
  });

  it('subscribers hear the runner change', () => {
    const w = new FakeWorker();
    const { host } = setup(() => w);
    let heard = 0;
    host.subscribe(() => heard++);
    host.warm();
    expect(host.runner().kind).toBe('starting');
    expect(heard).toBe(1);
    w.emit({ type: 'ready', id: 0 });
    expect(heard).toBe(2);
    expect(host.runner().kind).toBe('worker');
  });
});

describe('InlineRunner', () => {
  it('delivers progress and the result in their own tasks, never inside a slice', () => {
    const clock = new ManualClock();
    const runner = new InlineRunner({ registry }, clock);
    const { r, callbacks } = recorder();
    runner.start(jobOf('local', 20), callbacks);
    // Nothing runs synchronously: the first slice is a task too.
    expect(r.progress).toEqual([]);
    expect(clock.tasks.length).toBe(1);
    clock.drain();
    expect(r.result).toHaveLength(1);
    const v = r.result[0];
    if (v?.kind !== 'verdict') throw new Error('no verdict');
    expect(v.verdict.text).toMatch(/^HOLDS IN THIS CONFIGURATION/u);
  });

  it('slices are at most 16 ms of the page (SPEC §16)', () => {
    expect(MAIN_SLICE_MS).toBeLessThanOrEqual(16);
  });

  it('gives the same verdict as the worker loop for the same job and seed', () => {
    const clock = new ManualClock();
    const runner = new InlineRunner({ registry }, clock);
    const { r, callbacks } = recorder();
    runner.start(jobOf('global', 30), callbacks);
    clock.drain();
    const v = r.result[0];
    if (v?.kind !== 'verdict') throw new Error('no verdict');
    expect(v.verdict.regime).toBe('global');
    expect(v.verdict.seed).toBe(7);
  });
});
