/**
 * The page's side of the claim tests (SPEC §16): one Web Worker, started on first use, running
 * any number of jobs (one at a time inside the worker, in the order sent). Each job reports
 * progress and ends with its result, an error, or `cancelled`.
 *
 * Without workers the page runs the jobs itself, in slices of at most 16 ms (inline-runner.ts,
 * Run 12). Workers count as unavailable when the platform has no Worker, when creating one
 * throws (a page from file:// in some browsers), or when the worker fails or stays silent for
 * READY_MS before it says `ready`; the jobs already sent then move to the page. A worker that
 * fails after it was ready is a real failure of its jobs, reported as before.
 */
import type { JobResult, TestClaimJob } from '@geomira/claims/job';
import { createRegistry } from '@geomira/kernel/registry';
import { cryptoSource } from '@geomira/num/rng';
import { InlineRunner, pageClock } from './inline-runner';
import { isFromWorker, READY_MS, type ToWorker } from './protocol';
import type { JobCallbacks } from './slicer';
import { spawnTestWorker } from './spawn';

export type { JobCallbacks } from './slicer';

/** What the host needs of a Worker (a fake in tests). */
export interface WorkerLike {
  postMessage(m: ToWorker): void;
  addEventListener(type: 'message', f: (e: MessageEvent<unknown>) => void): void;
  addEventListener(type: 'error', f: (e: ErrorEvent) => void): void;
  terminate(): void;
}

export interface HostDeps {
  /** Creates the test worker; null (or a throw) when the platform has none. */
  readonly createWorker: () => WorkerLike | null;
  /** The page's own runner, made on the first fallback. */
  readonly inline: () => InlineRunner;
  /** A timer; returns its cancel. */
  readonly setTimer: (f: () => void, ms: number) => () => void;
}

/** Where tests run: not decided yet, in the worker, or on the page (with the reason). */
export type Runner =
  | { readonly kind: 'idle' | 'starting' | 'worker' }
  | { readonly kind: 'page'; readonly reason: string };

interface Pending {
  readonly job: TestClaimJob;
  readonly callbacks: JobCallbacks;
  /** The page runner's id, after a fallback. */
  inline?: number;
}

/** The browser's: a module worker (or the single-file build's inlined one) and Web Crypto. */
export function browserDeps(): HostDeps {
  return {
    createWorker: () => (typeof Worker === 'undefined' ? null : spawnTestWorker()),
    inline: () =>
      new InlineRunner(
        {
          registry: createRegistry(),
          entropy: cryptoSource((b) => crypto.getRandomValues(b)),
        },
        pageClock(),
      ),
    setTimer: (f, ms) => {
      const id = setTimeout(f, ms);
      return () => {
        clearTimeout(id);
      };
    },
  };
}

function messageOf(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message !== '') return e.message;
  return typeof e === 'string' && e !== '' ? e : fallback;
}

export class TestHost {
  private worker: WorkerLike | null = null;
  private page: InlineRunner | null = null;
  private state: Runner = { kind: 'idle' };
  private cancelReady: (() => void) | null = null;
  private next = 1;
  private readonly jobs = new Map<number, Pending>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: HostDeps = browserDeps()) {}

  /** Where tests run now (the Help panel says it; e2e tests read it). */
  runner(): Runner {
    return this.state;
  }

  readonly subscribe = (f: () => void): (() => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };

  private set(state: Runner): void {
    this.state = state;
    for (const f of this.listeners) f();
  }

  private ensure(): void {
    if (this.state.kind !== 'idle') return;
    let w: WorkerLike | null;
    try {
      w = this.deps.createWorker();
    } catch (e) {
      this.fallback(messageOf(e, 'the browser refused to start a worker'));
      return;
    }
    if (w === null) {
      this.fallback('this browser has no Web Workers');
      return;
    }
    this.worker = w;
    this.set({ kind: 'starting' });
    w.addEventListener('message', (e) => {
      this.onMessage(e.data);
    });
    w.addEventListener('error', (e) => {
      this.onError(e.message);
    });
    this.cancelReady = this.deps.setTimer(() => {
      if (this.state.kind === 'starting')
        this.fallback(`the worker did not start within ${String(READY_MS / 1000)} s`);
    }, READY_MS);
  }

  private onMessage(m: unknown): void {
    if (!isFromWorker(m)) return;
    if (m.type === 'ready') {
      this.cancelReady?.();
      if (this.state.kind === 'starting') this.set({ kind: 'worker' });
      return;
    }
    const p = this.jobs.get(m.id);
    if (p === undefined || p.inline !== undefined) return;
    if (m.type === 'progress') {
      p.callbacks.progress(m.progress);
      return;
    }
    this.jobs.delete(m.id);
    if (m.type === 'result') p.callbacks.result(m.result);
    else p.callbacks.error(m.message);
  }

  private onError(message: string): void {
    if (this.state.kind === 'starting') {
      this.fallback(message === '' ? 'the worker failed to start' : message);
      return;
    }
    const failure = message === '' ? 'the test worker failed' : message;
    for (const p of this.jobs.values()) p.callbacks.error(failure);
    this.jobs.clear();
    this.worker = null;
    this.set({ kind: 'idle' });
  }

  /** From now on the page runs every job; jobs already sent move to it. */
  private fallback(reason: string): void {
    this.cancelReady?.();
    this.worker?.terminate();
    this.worker = null;
    this.set({ kind: 'page', reason });
    for (const p of this.jobs.values()) this.runOnPage(p);
  }

  private runOnPage(p: Pending): void {
    this.page ??= this.deps.inline();
    p.inline = this.page.start(p.job, p.callbacks);
  }

  /** Starts the worker ahead of the first test (the page calls it once it is idle). */
  warm(): void {
    this.ensure();
  }

  /** Starts a job; returns its id (for cancel). */
  start(job: TestClaimJob, callbacks: JobCallbacks): number {
    const id = this.next++;
    const done = (r: JobResult) => {
      this.jobs.delete(id);
      callbacks.result(r);
    };
    const failed = (message: string) => {
      this.jobs.delete(id);
      callbacks.error(message);
    };
    const p: Pending = {
      job,
      callbacks: { progress: callbacks.progress, result: done, error: failed },
    };
    this.jobs.set(id, p);
    this.ensure();
    // A fallback inside ensure() already moved this job to the page.
    if (this.state.kind === 'page') {
      if (p.inline === undefined) this.runOnPage(p);
    } else this.worker?.postMessage({ type: 'run', id, job });
    return id;
  }

  cancel(id: number): void {
    const p = this.jobs.get(id);
    if (p === undefined) return;
    if (p.inline !== undefined) this.page?.cancel(p.inline);
    else this.worker?.postMessage({ type: 'cancel', id });
  }
}
