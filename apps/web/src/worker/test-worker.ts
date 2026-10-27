/**
 * The test worker (SPEC §16): runs packages/claims' runJob off the main thread, in slices of
 * SLICE_MS through the loop the page's fallback shares (slicer.ts), yielding to its own event
 * loop between slices so a `cancel` message is read between two samples, and posting progress
 * at most every PROGRESS_MS. Cryptographic entropy for the mod-p rung comes from the host's Web
 * Crypto through num's cryptoSource (ADR-0013). It says `ready` once loaded (Run 12): until
 * then the page may still decide that workers are unavailable and run the tests itself.
 * Discovery jobs (ADR-0035, ADR-0036) run through the same loop, with the editor's GUI selector
 * choice as the branch-fix chooser and `stop` read like `cancel`.
 */
import { runJob } from '@geomira/claims/job';
import { runDiscoveryJob } from '@geomira/discovery/job';
import { branchChooser } from '@geomira/editor/discovery';
import { createRegistry } from '@geomira/kernel/registry';
import { assertNever } from '@geomira/num/assert';
import { cryptoSource } from '@geomira/num/rng';
import { isToWorker, PROGRESS_MS, SLICE_MS, type FromWorker } from './protocol';
import { runSliced, type SliceClock } from './slicer';

const registry = createRegistry();
const entropy = cryptoSource((buffer) => crypto.getRandomValues(buffer));
const cancelled = new Set<number>();
const stopped = new Set<number>();
const clock: SliceClock = {
  now: () => performance.now(),
  later: (f) => {
    setTimeout(f, 0);
  },
};

function post(m: FromWorker): void {
  postMessage(m);
}

function options(id: number) {
  return {
    sliceMs: SLICE_MS,
    progressMs: PROGRESS_MS,
    cancelled: () => cancelled.has(id),
    stopped: () => stopped.has(id),
  };
}

function forget(id: number): void {
  cancelled.delete(id);
  stopped.delete(id);
}

addEventListener('message', (event: MessageEvent<unknown>) => {
  const m = event.data;
  if (!isToWorker(m)) return;
  const id = m.id;
  const error = (message: string) => {
    post({ type: 'error', id, message });
  };
  switch (m.type) {
    case 'cancel':
      cancelled.add(id);
      return;
    case 'stop':
      stopped.add(id);
      return;
    case 'run':
      runSliced(runJob(m.job, { registry, entropy }), options(id), clock, {
        progress: (progress) => {
          post({ type: 'progress', id, progress });
        },
        result: (result) => {
          forget(id);
          post({ type: 'result', id, result });
        },
        error,
      });
      return;
    case 'discover':
      runSliced(
        runDiscoveryJob(m.job, { registry, entropy, choose: branchChooser }),
        options(id),
        clock,
        {
          progress: (progress) => {
            post({ type: 'found-progress', id, progress });
          },
          result: (result) => {
            forget(id);
            post({ type: 'found', id, result });
          },
          error,
        },
      );
      return;
    default:
      assertNever(m, 'message');
  }
});

post({ type: 'ready', id: 0 });
