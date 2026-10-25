/**
 * The test worker (SPEC §16): runs packages/claims' runJob off the main thread, in slices of
 * SLICE_MS through the loop the page's fallback shares (slicer.ts), yielding to its own event
 * loop between slices so a `cancel` message is read between two samples, and posting progress
 * at most every PROGRESS_MS. Cryptographic entropy for the mod-p rung comes from the host's Web
 * Crypto through num's cryptoSource (ADR-0013). It says `ready` once loaded (Run 12): until
 * then the page may still decide that workers are unavailable and run the tests itself.
 */
import { runJob } from '@geomira/claims/job';
import { createRegistry } from '@geomira/kernel/registry';
import { cryptoSource } from '@geomira/num/rng';
import { isToWorker, PROGRESS_MS, SLICE_MS, type FromWorker } from './protocol';
import { runSliced, type SliceClock } from './slicer';

const registry = createRegistry();
const entropy = cryptoSource((buffer) => crypto.getRandomValues(buffer));
const cancelled = new Set<number>();
const clock: SliceClock = {
  now: () => performance.now(),
  later: (f) => {
    setTimeout(f, 0);
  },
};

function post(m: FromWorker): void {
  postMessage(m);
}

addEventListener('message', (event: MessageEvent<unknown>) => {
  const m = event.data;
  if (!isToWorker(m)) return;
  const id = m.id;
  if (m.type === 'cancel') {
    cancelled.add(id);
    return;
  }
  runSliced(
    runJob(m.job, { registry, entropy }),
    { sliceMs: SLICE_MS, progressMs: PROGRESS_MS, cancelled: () => cancelled.has(id) },
    clock,
    {
      progress: (progress) => {
        post({ type: 'progress', id, progress });
      },
      result: (result) => {
        cancelled.delete(id);
        post({ type: 'result', id, result });
      },
      error: (message) => {
        post({ type: 'error', id, message });
      },
    },
  );
});

post({ type: 'ready', id: 0 });
