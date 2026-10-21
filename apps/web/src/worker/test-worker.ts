/**
 * The test worker (SPEC §16): runs packages/claims' runJob off the main thread. The
 * generator yields after every sample; the worker runs it in slices of SLICE_MS, then
 * yields to its own event loop so a `cancel` message is read between two samples, and posts
 * progress at most every PROGRESS_MS. Cryptographic entropy for the mod-p rung comes from
 * the host's Web Crypto through num's cryptoSource (ADR-0013).
 */
import { runJob, type JobProgress, type JobResult } from '@geomira/claims/job';
import { createRegistry } from '@geomira/kernel/registry';
import { cryptoSource } from '@geomira/num/rng';
import { isToWorker, PROGRESS_MS, SLICE_MS, type FromWorker } from './protocol';

const registry = createRegistry();
const entropy = cryptoSource((buffer) => crypto.getRandomValues(buffer));
const cancelled = new Set<number>();

function post(m: FromWorker): void {
  postMessage(m);
}

function run(id: number, it: Generator<JobProgress, JobResult, 'cancel' | undefined>): void {
  let lastPost = 0;
  const slice = () => {
    try {
      const start = performance.now();
      let r = it.next();
      while (r.done !== true && performance.now() - start < SLICE_MS) {
        if (cancelled.has(id)) break;
        r = it.next();
      }
      if (r.done !== true && cancelled.has(id)) r = it.next('cancel');
      if (r.done === true) {
        cancelled.delete(id);
        post({ type: 'result', id, result: r.value });
        return;
      }
      if (performance.now() - lastPost >= PROGRESS_MS) {
        lastPost = performance.now();
        post({ type: 'progress', id, progress: r.value });
      }
      setTimeout(slice, 0);
    } catch (e) {
      post({ type: 'error', id, message: e instanceof Error ? e.message : String(e) });
    }
  };
  slice();
}

addEventListener('message', (event: MessageEvent<unknown>) => {
  const m = event.data;
  if (!isToWorker(m)) return;
  if (m.type === 'cancel') {
    cancelled.add(m.id);
    return;
  }
  run(m.id, runJob(m.job, { registry, entropy }));
});
