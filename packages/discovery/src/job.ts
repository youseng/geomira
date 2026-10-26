/**
 * The discovery jobs behind one entry point (ADR-0035 decision 15, ADR-0036 decision 6), for
 * the worker and the page's time-sliced fallback: `find`, `hunt` and `branchFix`, each a pure
 * generator with SPEC §16's protocol (progress after every bounded step; `cancel`; `stop` for
 * the host's time budget).
 */
import { assertNever } from '@geomira/num/assert';
import { runBranchFix, type BranchFixJob, type BranchFixOutcome } from './branch-fix';
import { runFind } from './find';
import { runHunt, type HuntJob, type HuntOutcome } from './hunt';
import type {
  DiscoveryCommand,
  DiscoveryEnv,
  DiscoveryProgress,
  FindJob,
  FindOutcome,
} from './types';

export type DiscoveryJob = FindJob | HuntJob | BranchFixJob;

export type DiscoveryOutcome = FindOutcome | HuntOutcome | BranchFixOutcome;

/** Runs any discovery job. */
export function runDiscoveryJob(
  job: DiscoveryJob,
  env: DiscoveryEnv,
): Generator<DiscoveryProgress, DiscoveryOutcome, DiscoveryCommand> {
  switch (job.kind) {
    case 'find':
      return runFind(job, env);
    case 'hunt':
      return runHunt(job, env);
    case 'branchFix':
      return runBranchFix(job, env);
    default:
      return assertNever(job, 'discovery job');
  }
}
