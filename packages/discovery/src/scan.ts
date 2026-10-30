/**
 * Scanning every searched claim kind's candidates in steps (ADR-0035 decisions 8–10), shared by
 * the find and hunt jobs: each kind's candidates (plain or by measure), counted, visited in
 * order up to the per-kind budget, with progress between bounded batches. What a visit does
 * with a candidate (screen it, keep it) is the job's. The find job schedules its kinds' scans
 * in a first look and a long scan (scan-rounds.ts, ADR-0052); hunt scans each kind once.
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

/**
 * Candidates visited between two yields (each is screened and checked against the closure). A
 * cold visit of an angle kind takes up to about 1.5 ms, so 16 made page slices over 16 ms.
 */
export const BATCH = 4;

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

/**
 * One scan of one kind (ADR-0052): its candidate source's limits (`source`: the list's length
 * and the count), the candidates screened at most (`limit`, those in `seen` included), the
 * candidates screened by an earlier scan (`seen`: skipped here, already counted) and the
 * progress phase.
 */
export interface KindScan {
  readonly source: ScanBudget;
  readonly limit: number;
  readonly seen?: ReadonlySet<string>;
  readonly phase: string;
}

/**
 * Scans one kind; returns its report and the command that stopped it, if any. A candidate
 * screened before is skipped, but counts towards the step's batch like a visit, so skipping
 * the first look again never makes a long step.
 */
export function* scanKind(
  job: DiscoveryJobKind,
  kind: ClaimKindSpec,
  pools: Pools,
  scan: KindScan,
  visit: (c: Candidate) => void,
): Generator<DiscoveryProgress, { report: KindReport; cmd?: 'cancel' | 'stop' }, DiscoveryCommand> {
  const { phase, limit } = scan;
  const seen = scan.seen ?? new Set<string>();
  const ticks = candidatesOf(kind, pools, scan.source);
  let r = ticks.next();
  while (r.done !== true) {
    const cmd = yield progress(job, phase, seen.size, 0);
    if (cmd !== undefined) {
      const report = { kind: kind.name, checked: seen.size, total: 0, more: true, exact: false };
      return { report: { ...report, stop: 'time' }, cmd };
    }
    r = ticks.next();
  }
  const { it, total, more, exact } = r.value;
  const base = { kind: kind.name, total, more, exact };
  const shown = Math.min(total, limit);
  let checked = seen.size;
  let looked = 0;
  for (let next = it.next(); next.done !== true; next = it.next()) {
    const old = seen.has(next.value.key);
    if (!old && checked >= limit) return { report: { ...base, checked, stop: 'budget' } };
    if (!old) {
      visit(next.value);
      checked++;
    }
    if (++looked % BATCH === 0) {
      const cmd = yield progress(job, phase, checked, shown);
      if (cmd !== undefined) return { report: { ...base, checked, stop: 'time' }, cmd };
    }
  }
  const report = { ...base, checked, total: Math.max(total, checked) };
  // A part batch ends the step too, so the next kind's first batch starts a new one.
  if (looked % BATCH !== 0) {
    const cmd = yield progress(job, phase, checked, shown);
    if (cmd !== undefined) return { report, cmd };
  }
  return { report };
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
    const phase = `screening ${kind.name}`;
    const scan = { source: budget, limit: budget.candidatesPerKind, phase };
    const r = yield* scanKind(job, kind, pools, scan, visit);
    reports.push(r.report);
    if (r.cmd !== undefined) return { reports, notSearched, cmd: r.cmd };
  }
  return { reports, notSearched };
}
