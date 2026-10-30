/**
 * The find job's fair schedule of the screen (ADR-0052). The FIRST LOOK screens the first
 * `firstLook` candidates of every searched kind, in registry order, each from a source whose
 * count stops at FIRST_COUNT; the job tests what it found before any LONG SCAN, which then
 * screens every kind the first look did not settle up to its full budget, skipping what the
 * first look screened. So no kind's long scan (counting millions of six-point tuples, measuring
 * every angle) can use the host's whole time budget before the other kinds' first candidates
 * are screened and their facts tested. Every kind's report says how far it got and why it
 * stopped, as the single scan's did (ADR-0035 decision 10).
 */
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import type { ClaimKindSpec } from '@geomira/claims/kind';
import type { Candidate, Pools } from './candidates';
import { scanKind, type ScanBudget, type Scanned } from './scan';
import { grouped } from './text';
import type { DiscoveryCommand, DiscoveryProgress, KindReport } from './types';

/**
 * Tuples (or measured groups and matches) a kind's first look counts at most: a bounded part
 * of the 2,000,000 the long scan may count.
 */
export const FIRST_COUNT = 20_000;

/** The find budget's parts the schedule reads. */
export interface RoundsBudget extends ScanBudget {
  /** Candidates per kind in the first look (at most candidatesPerKind). */
  readonly firstLook: number;
}

/**
 * One kind after the first look: its report, and the keys it screened when the long scan must
 * go on (`seen`); a kind without `seen` is settled: its report is the one a single scan to the
 * full budget gives.
 */
export interface Look {
  readonly kind: ClaimKindSpec;
  readonly report: KindReport;
  readonly seen?: ReadonlySet<string>;
}

export interface FirstLook {
  readonly looks: readonly Look[];
  readonly notSearched: { kind: string; reason: string }[];
  /** The host's command that ended the first look early (kinds not reached have no look). */
  readonly cmd?: 'cancel' | 'stop';
}

/** The local test runs of the first round: half of the test budget, rounded up. */
export function firstTests(tests: number): number {
  return Math.ceil(tests / 2);
}

/**
 * Whether a first look's scan is final: its count was not cut short of the full count limit,
 * and it either screened every candidate (fewer than the look's limit) or the look's limit is
 * the kind's whole budget.
 */
function settled(report: KindReport, look: ScanBudget, budget: RoundsBudget): boolean {
  const cut = report.more && look.countLimit < budget.countLimit;
  return (
    !cut &&
    (report.checked < look.candidatesPerKind || look.candidatesPerKind === budget.candidatesPerKind)
  );
}

/** The first look (see the module comment), with progress between bounded steps. */
export function* firstLook(
  kinds: ClaimKinds,
  pools: Pools,
  budget: RoundsBudget,
  visit: (c: Candidate) => void,
): Generator<DiscoveryProgress, FirstLook, DiscoveryCommand> {
  const looks: Look[] = [];
  const notSearched: { kind: string; reason: string }[] = [];
  const source = {
    candidatesPerKind: Math.min(budget.firstLook, budget.candidatesPerKind),
    countLimit: Math.min(FIRST_COUNT, budget.countLimit),
  };
  for (const kind of kinds.kinds) {
    if (kind.finder?.notSearched !== undefined) {
      notSearched.push({ kind: kind.name, reason: kind.finder.notSearched });
      continue;
    }
    const seen = new Set<string>();
    const scan = { source, limit: source.candidatesPerKind, phase: `screening ${kind.name}` };
    const r = yield* scanKind('find', kind, pools, scan, (c) => {
      seen.add(c.key);
      visit(c);
    });
    if (r.cmd !== undefined) {
      looks.push({ kind, report: r.report });
      return { looks, notSearched, cmd: r.cmd };
    }
    const done = settled(r.report, source, budget);
    looks.push(done ? { kind, report: r.report } : { kind, report: r.report, seen });
  }
  return { looks, notSearched };
}

/** The reports when the job stops before a kind's long scan: that kind stopped at the time. */
export function lookReports(looks: readonly Look[]): KindReport[] {
  return looks.map((l) => (l.seen === undefined ? l.report : { ...l.report, stop: 'time' }));
}

/** Whether the first look settled every kind (then there is no long scan and one round). */
export function allSettled(looks: readonly Look[]): boolean {
  return looks.every((l) => l.seen === undefined);
}

/**
 * The long scan: every kind the first look did not settle, in registry order, to its full
 * budget, skipping the candidates its first look screened (they count as checked).
 */
export function* longScan(
  looks: readonly Look[],
  pools: Pools,
  budget: RoundsBudget,
  visit: (c: Candidate) => void,
): Generator<DiscoveryProgress, Omit<Scanned, 'notSearched'>, DiscoveryCommand> {
  const reports: KindReport[] = [];
  for (const [i, l] of looks.entries()) {
    if (l.seen === undefined) {
      reports.push(l.report);
      continue;
    }
    const kind = l.kind;
    const phase = `screening ${kind.name} beyond the first ${grouped(l.seen.size)}`;
    const scan = { source: budget, limit: budget.candidatesPerKind, seen: l.seen, phase };
    const r = yield* scanKind('find', kind, pools, scan, visit);
    reports.push(r.report);
    if (r.cmd !== undefined)
      return { reports: [...reports, ...lookReports(looks.slice(i + 1))], cmd: r.cmd };
  }
  return { reports };
}
