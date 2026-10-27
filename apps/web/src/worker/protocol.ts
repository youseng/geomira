/**
 * Messages between the page and the test worker (SPEC §16). The page sends the PARSED
 * document in the job (ADR-0008: packages/claims cannot parse text) and the worker runs
 * packages/claims' runJob on it, reporting progress at most every PROGRESS_MS and the result
 * once. `cancel` stops a job between two samples. Discovery jobs (find, hunt, branchFix:
 * ADR-0035, ADR-0036) run in the same worker under `discover`, with `stop` for the page's time
 * budget (the job ends with what it has confirmed).
 */
import type { JobProgress, JobResult, TestClaimJob } from '@geomira/claims/job';
import type { DiscoveryJob, DiscoveryOutcome } from '@geomira/discovery/job';
import type { DiscoveryProgress } from '@geomira/discovery/types';

export type ToWorker =
  | { readonly type: 'run'; readonly id: number; readonly job: TestClaimJob }
  | { readonly type: 'discover'; readonly id: number; readonly job: DiscoveryJob }
  | { readonly type: 'cancel'; readonly id: number }
  | { readonly type: 'stop'; readonly id: number };

/** The progress and the outcome of a discovery job, from the worker. */
export type FromWorkerDiscovery =
  | { readonly type: 'found-progress'; readonly id: number; readonly progress: DiscoveryProgress }
  | { readonly type: 'found'; readonly id: number; readonly result: DiscoveryOutcome };

export type FromWorker =
  /** Sent once when the worker's module has loaded (Run 12: until then the page may fall back). */
  | { readonly type: 'ready'; readonly id: 0 }
  | { readonly type: 'progress'; readonly id: number; readonly progress: JobProgress }
  | { readonly type: 'result'; readonly id: number; readonly result: JobResult }
  | { readonly type: 'error'; readonly id: number; readonly message: string }
  | FromWorkerDiscovery;

/** The worker reports progress at most this often (ms), so the page renders little. */
export const PROGRESS_MS = 100;

/** The worker runs the generator for at most this long (ms) before reading its messages. */
export const SLICE_MS = 12;

/**
 * A worker that has neither said `ready` nor failed this long after it was created (ms) counts
 * as unavailable, and the page runs the tests itself (Run 12).
 */
export const READY_MS = 5000;

function record(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

const DISCOVERY_KINDS: readonly unknown[] = ['find', 'hunt', 'branchFix'];

/** A message the page may have sent (its own typed ToWorker; checked, not trusted blindly). */
export function isToWorker(x: unknown): x is ToWorker {
  if (!record(x) || typeof x['id'] !== 'number') return false;
  if (x['type'] === 'cancel' || x['type'] === 'stop') return true;
  const job = x['job'];
  if (!record(job) || !record(job['doc'])) return false;
  if (x['type'] === 'run') return job['kind'] === 'testClaim';
  return x['type'] === 'discover' && DISCOVERY_KINDS.includes(job['kind']);
}

/** A message the worker may have sent. */
export function isFromWorker(x: unknown): x is FromWorker {
  if (!record(x) || typeof x['id'] !== 'number') return false;
  switch (x['type']) {
    case 'ready':
      return true;
    case 'progress':
    case 'found-progress':
      return record(x['progress']);
    case 'result':
    case 'found':
      return record(x['result']);
    case 'error':
      return typeof x['message'] === 'string';
    default:
      return false;
  }
}
