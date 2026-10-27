/**
 * Scanning every searched claim kind's candidates in steps (ADR-0035 decisions 8–10), shared by
 * the find and hunt jobs: each kind's candidates (plain or by measure), counted, visited in
 * order up to the per-kind budget, with progress between bounded batches. What a visit does
 * with a candidate (screen it, keep it) is the job's.
 */
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import type { ClaimKindSpec } from '@geomira/claims/kind';
import {
  countPlain,
  measureCandidates,
  plainCandidates,
  type Candidate,
  type Pools,
} from './candidates';
import type { DiscoveryCommand, DiscoveryJobKind, DiscoveryProgress, KindReport } from './types';

/** Candidates visited between two yields (each is screened and checked against the closure). */
export const BATCH = 16;

export interface ScanBudget {
  readonly candidatesPerKind: number;
  readonly countLimit: number;
}

export interface Scanned {
  readonly reports: KindReport[];
  readonly notSearched: { kind: string; reason: string }[];
  /** The host's command that ended the scan early, if any. */
  readonly cmd?: 'cancel' | 'stop';
}

function progress(
  job: DiscoveryJobKind,
  phase: string,
  done: number,
  total: number,
): DiscoveryProgress {
  return { kind: 'progress', job, phase, done, total };
}

/** The candidates of one kind as a lazy list, with its count (both computed in steps). */
function* candidatesOf(
  kind: ClaimKindSpec,
  pools: Pools,
  budget: ScanBudget,
): Generator<
  undefined,
  { it: Iterator<Candidate>; total: number; more: boolean; exact: boolean },
  unknown
> {
  const m = kind.finder?.measure;
  if (m !== undefined) {
    const r = yield* measureCandidates(kind, m, pools, budget.candidatesPerKind, budget.countLimit);
    // The count is of matches, symmetric twins included: an upper bound of the candidates.
    return { it: r.list[Symbol.iterator](), total: r.total, more: r.more, exact: false };
  }
  const n = yield* countPlain(kind, pools, budget.countLimit);
  return { it: plainCandidates(kind, pools), total: n.total, more: n.more, exact: n.exact };
}

/** Scans one kind; returns its report and the command that stopped it, if any. */
function* scanKind(
  job: DiscoveryJobKind,
  kind: ClaimKindSpec,
  pools: Pools,
  budget: ScanBudget,
  visit: (c: Candidate) => void,
): Generator<DiscoveryProgress, { report: KindReport; cmd?: 'cancel' | 'stop' }, DiscoveryCommand> {
  const phase = `screening ${kind.name}`;
  const ticks = candidatesOf(kind, pools, budget);
  let r = ticks.next();
  while (r.done !== true) {
    const cmd = yield progress(job, phase, 0, 0);
    if (cmd !== undefined)
      return {
        report: { kind: kind.name, checked: 0, total: 0, more: true, exact: false, stop: 'time' },
        cmd,
      };
    r = ticks.next();
  }
  const { it, total, more, exact } = r.value;
  const base = { kind: kind.name, total, more, exact };
  let checked = 0;
  for (let next = it.next(); next.done !== true; next = it.next()) {
    if (checked >= budget.candidatesPerKind)
      return { report: { ...base, checked, stop: 'budget' } };
    visit(next.value);
    checked++;
    if (checked % BATCH === 0) {
      const cmd = yield progress(job, phase, checked, Math.min(total, budget.candidatesPerKind));
      if (cmd !== undefined) return { report: { ...base, checked, stop: 'time' }, cmd };
    }
  }
  return { report: { ...base, checked, total: Math.max(total, checked) } };
}

/** Scans every searched kind in registry order (see the module comment). */
export function* scanKinds(
  job: DiscoveryJobKind,
  kinds: ClaimKinds,
  pools: Pools,
  budget: ScanBudget,
  visit: (c: Candidate) => void,
): Generator<DiscoveryProgress, Scanned, DiscoveryCommand> {
  const reports: KindReport[] = [];
  const notSearched: { kind: string; reason: string }[] = [];
  for (const kind of kinds.kinds) {
    if (kind.finder?.notSearched !== undefined) {
      notSearched.push({ kind: kind.name, reason: kind.finder.notSearched });
      continue;
    }
    const r = yield* scanKind(job, kind, pools, budget, visit);
    reports.push(r.report);
    if (r.cmd !== undefined) return { reports, notSearched, cmd: r.cmd };
  }
  return { reports, notSearched };
}
