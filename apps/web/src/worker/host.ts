/**
 * The page's side of the test worker (SPEC §16): one Web Worker, started on first use,
 * running any number of jobs (one at a time inside the worker, in the order sent). Each job
 * reports progress and ends with its result, an error, or `cancelled`. The page never runs
 * a sampler on the main thread.
 */
import type { JobProgress, JobResult, TestClaimJob } from '@geomira/claims/job';
import { isFromWorker, type ToWorker } from './protocol';

export interface JobCallbacks {
  readonly progress: (p: JobProgress) => void;
  readonly result: (r: JobResult) => void;
  readonly error: (message: string) => void;
}

export class TestHost {
  private worker: Worker | null = null;
  private next = 1;
  private readonly jobs = new Map<number, JobCallbacks>();

  private ensure(): Worker {
    if (this.worker !== null) return this.worker;
    const w = new Worker(new URL('./test-worker.ts', import.meta.url), { type: 'module' });
    w.addEventListener('message', (e: MessageEvent<unknown>) => {
      const m = e.data;
      if (!isFromWorker(m)) return;
      const cb = this.jobs.get(m.id);
      if (cb === undefined) return;
      if (m.type === 'progress') {
        cb.progress(m.progress);
        return;
      }
      this.jobs.delete(m.id);
      if (m.type === 'result') cb.result(m.result);
      else cb.error(m.message);
    });
    w.addEventListener('error', (e) => {
      const message = e.message === '' ? 'the test worker failed' : e.message;
      for (const cb of this.jobs.values()) cb.error(message);
      this.jobs.clear();
      this.worker = null;
    });
    this.worker = w;
    return w;
  }

  /**
   * Starts the worker ahead of the first test (the page calls it once it is idle), so that
   * clicking Test does not pay for creating a thread and loading its module.
   */
  warm(): void {
    this.ensure();
  }

  /** Starts a job; returns its id (for cancel). */
  start(job: TestClaimJob, callbacks: JobCallbacks): number {
    const id = this.next++;
    this.jobs.set(id, callbacks);
    const m: ToWorker = { type: 'run', id, job };
    this.ensure().postMessage(m);
    return id;
  }

  cancel(id: number): void {
    if (!this.jobs.has(id)) return;
    const m: ToWorker = { type: 'cancel', id };
    this.worker?.postMessage(m);
  }
}
