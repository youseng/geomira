/**
 * Runs a job's generator in time slices (SPEC §16), for the Web Worker (test-worker.ts) and
 * for the page itself when workers are unavailable (inline-runner.ts, Run 12): one loop, so
 * both run a job identically.
 *
 * A slice runs generator steps until the next step would end past `sliceMs`, judged by the
 * longest of the last RECENT_STEPS steps (a step is one figure of the tester; the first step
 * also prepares the job and is not used for the prediction, the last also forms the verdict);
 * it always runs at least one step. Then it yields to
 * the event loop through `later`, so messages (a cancel) and, on the page, input and drawing
 * get their turn. So a slice is at most `sliceMs`, unless a single step is longer than the
 * recent ones (then by at most that step). Progress is reported at most every `progressMs`; a cancel is read between two
 * steps and answered by the generator itself (`next('cancel')`).
 */
import type { JobProgress, JobResult } from '@geomira/claims/job';

/** Where a job's reports go (the worker host's callbacks, re-exported by host.ts). */
export interface JobCallbacks {
  readonly progress: (p: JobProgress) => void;
  readonly result: (r: JobResult) => void;
  readonly error: (message: string) => void;
}

/** The clock and the scheduler of a slice loop (the platform's, or a fake in tests). */
export interface SliceClock {
  /** Milliseconds, monotonic. */
  readonly now: () => number;
  /** Runs `f` in a later task of the event loop. */
  readonly later: (f: () => void) => void;
}

export interface SliceOptions {
  readonly sliceMs: number;
  readonly progressMs: number;
  /** True once the job should stop (read between two steps). */
  readonly cancelled?: () => boolean;
}

/** How many recent steps predict the next one. */
export const RECENT_STEPS = 16;

export type JobGenerator = Generator<JobProgress, JobResult, 'cancel' | undefined>;

/** Starts the slice loop; the first slice runs now unless `deferStart`. */
export function runSliced(
  it: JobGenerator,
  options: SliceOptions,
  clock: SliceClock,
  sink: JobCallbacks,
  start: { readonly deferStart?: boolean } = {},
): void {
  const cancelled = options.cancelled ?? (() => false);
  let lastPost: number | null = null;
  let first = true;
  const recent: number[] = [];
  const predicted = () => Math.max(0, ...recent);
  const step = (cmd?: 'cancel'): IteratorResult<JobProgress, JobResult> => {
    const t0 = clock.now();
    const r = it.next(cmd);
    if (!first) recent.push(clock.now() - t0);
    if (recent.length > RECENT_STEPS) recent.shift();
    first = false;
    return r;
  };
  const slice = (): void => {
    try {
      const begin = clock.now();
      let r = step();
      while (
        r.done !== true &&
        !cancelled() &&
        clock.now() - begin + predicted() <= options.sliceMs
      )
        r = step();
      if (r.done !== true && cancelled()) r = step('cancel');
      if (r.done === true) {
        sink.result(r.value);
        return;
      }
      const now = clock.now();
      if (lastPost === null || now - lastPost >= options.progressMs) {
        lastPost = now;
        sink.progress(r.value);
      }
      clock.later(slice);
    } catch (e) {
      sink.error(e instanceof Error ? e.message : String(e));
    }
  };
  if (start.deferStart === true) clock.later(slice);
  else slice();
}
