/**
 * Runs test jobs on the page itself when workers are unavailable (SPEC §16: "without workers,
 * the page runs them in ≤ 16 ms slices"; Run 12). The same slice loop as the worker
 * (slicer.ts) with a budget of MAIN_SLICE_MS, every slice in its own task, and every progress
 * report and result delivered in a task of its own, so the Claims panel's re-render never
 * lengthens a slice. Tasks are queued through a MessageChannel (no 4 ms timer clamp), so the
 * page's input and drawing run between two slices.
 */
import { runJob, type TestClaimJob } from '@geomira/claims/job';
import type { Registry } from '@geomira/kernel/registry';
import type { EntropySource } from '@geomira/num/rng';
import { PROGRESS_MS } from './protocol';
import { runSliced, type JobCallbacks, type SliceClock } from './slicer';

/**
 * The page's slice budget (ms). Below SPEC §16's 16 ms, leaving room for the task's own
 * overhead and for a step a little longer than predicted (slicer.ts).
 */
export const MAIN_SLICE_MS = 8;

export interface InlineEnv {
  readonly registry: Registry;
  readonly entropy?: EntropySource;
}

/** The page's clock: performance.now, and later tasks through one MessageChannel. */
export function pageClock(): SliceClock {
  const queue: (() => void)[] = [];
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    queue.shift()?.();
  };
  return {
    now: () => performance.now(),
    later: (f) => {
      queue.push(f);
      channel.port2.postMessage(0);
    },
  };
}

export class InlineRunner {
  private next = 1;
  private readonly cancelled = new Set<number>();

  constructor(
    private readonly env: InlineEnv,
    private readonly clock: SliceClock,
  ) {}

  /** Starts a job (its first slice is a later task); returns its id. */
  start(job: TestClaimJob, callbacks: JobCallbacks): number {
    const id = this.next++;
    const later = this.clock.later;
    const jobEnv = {
      registry: this.env.registry,
      ...(this.env.entropy === undefined ? {} : { entropy: this.env.entropy }),
    };
    runSliced(
      runJob(job, jobEnv),
      { sliceMs: MAIN_SLICE_MS, progressMs: PROGRESS_MS, cancelled: () => this.cancelled.has(id) },
      this.clock,
      {
        progress: (p) => {
          later(() => {
            callbacks.progress(p);
          });
        },
        result: (r) => {
          this.cancelled.delete(id);
          later(() => {
            callbacks.result(r);
          });
        },
        error: (m) => {
          later(() => {
            callbacks.error(m);
          });
        },
      },
      { deferStart: true },
    );
    return id;
  }

  cancel(id: number): void {
    this.cancelled.add(id);
  }
}
