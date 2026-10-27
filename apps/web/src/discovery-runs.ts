/**
 * The discovery jobs of the page (ADR-0035, ADR-0036): "What is special?" (find), "Special
 * positions" (hunt) and the branch fixes of a claim (branchFix), each run by the worker host
 * (host.ts) with a fresh seed and stopped at a time budget (`stop`: the job ends with what it
 * has confirmed). A small external store, like test-runs.ts: progress re-renders the Claims
 * panel only. It also holds what the canvas shows for discovery: the objects of a hovered fact
 * (highlighted) and the document being viewed as a draft (a position or a branch fix: a render
 * override, never a document edit, ADR-0024, ADR-0029). Only the CURRENT job of a slot writes
 * it; every job's result keeps the document it ran on, so a result about an earlier figure is
 * marked as such and its edits are not offered.
 */
import type { BranchFixResult } from '@geomira/discovery/branch-fix';
import type { HuntResult } from '@geomira/discovery/hunt';
import type { DiscoveryJob, DiscoveryOutcome } from '@geomira/discovery/job';
import type { DiscoveryProgress, FindResult } from '@geomira/discovery/types';
import type { Document } from '@geomira/kernel/document';
import { exprEquals } from '@geomira/kernel/expr';
import { assertNever } from '@geomira/num/assert';
import type { DiscoveryCallbacks } from './worker/host';

/** What runs the jobs: the worker host, or a fake in tests. */
export interface DiscoveryHost {
  startDiscovery(job: DiscoveryJob, callbacks: DiscoveryCallbacks): number;
  cancel(id: number): void;
  stop(id: number): void;
}

/** A timer; returns its cancel (the browser's setTimeout, or a fake in tests). */
export type SetTimer = (f: () => void, ms: number) => () => void;

/** The time budget of each job (ms): then the page sends `stop` (ADR-0035 decision 10). */
export const FIND_MS = 20_000;
export const HUNT_MS = 20_000;
export const BRANCH_FIX_MS = 20_000;

/** Figures per local test of a found fact or a branch fix (the Test button's n). */
export const DISCOVERY_N = 200;

export type JobRun<R> =
  | {
      readonly status: 'running';
      readonly job: number;
      readonly doc: Document;
      readonly phase: string;
      readonly done: number;
      readonly total: number;
    }
  | { readonly status: 'done'; readonly doc: Document; readonly result: R }
  | { readonly status: 'cancelled'; readonly doc: Document }
  | { readonly status: 'failed'; readonly doc: Document; readonly message: string };

/** A document the canvas draws instead of the current one, until the view is closed. */
export interface DraftView {
  readonly doc: Document;
  /** What is viewed ("special position: A moves", "branch fix 1"). */
  readonly label: string;
  /** The objects to highlight in it. */
  readonly objects: readonly number[];
}

export interface DiscoverySnapshot {
  readonly find?: JobRun<FindResult>;
  readonly hunt?: JobRun<HuntResult>;
  /** Branch fixes per claim id. */
  readonly fixes: ReadonlyMap<number, JobRun<BranchFixResult>>;
  /** The objects of the hovered fact (the canvas rings them). */
  readonly highlight: readonly number[];
  readonly view: DraftView | null;
}

const EMPTY: DiscoverySnapshot = { fixes: new Map(), highlight: [], view: null };

/** Same objects with the same definitions: a result's object ids still mean the same. */
export function sameFigure(a: Document, b: Document): boolean {
  if (a === b || a.objects === b.objects) return true;
  return (
    a.objects.length === b.objects.length &&
    a.objects.every((o, i) => {
      const p = b.objects[i];
      return p !== undefined && p.id === o.id && exprEquals(p.def, o.def);
    })
  );
}

/** A fresh seed for each job (carried by its result). */
function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

type Slot = 'find' | 'hunt' | `fix:${string}`;

/** A cancelled or failed run (of any slot). */
function ended(doc: Document, r: DiscoveryOutcome): JobRun<never> {
  switch (r.kind) {
    case 'cancelled':
      return { status: 'cancelled', doc };
    case 'invalid':
      return { status: 'failed', doc, message: r.reason };
    case 'found':
    case 'positions':
    case 'fixes':
      return { status: 'failed', doc, message: `unexpected result ${r.kind}` };
    default:
      return assertNever(r, 'discovery outcome');
  }
}

function findRun(doc: Document, r: DiscoveryOutcome): JobRun<FindResult> {
  return r.kind === 'found' ? { status: 'done', doc, result: r } : ended(doc, r);
}

function huntRun(doc: Document, r: DiscoveryOutcome): JobRun<HuntResult> {
  return r.kind === 'positions' ? { status: 'done', doc, result: r } : ended(doc, r);
}

function fixRun(doc: Document, r: DiscoveryOutcome): JobRun<BranchFixResult> {
  return r.kind === 'fixes' ? { status: 'done', doc, result: r } : ended(doc, r);
}

function fixSlot(claim: number): Slot {
  return `fix:${String(claim)}`;
}

function claimOf(slot: `fix:${string}`): number {
  return Number(slot.slice(4));
}

export class DiscoveryRuns {
  private snapshot: DiscoverySnapshot = EMPTY;
  private readonly listeners = new Set<() => void>();
  /** The current job of each slot, and the cancel of its time budget. */
  private readonly current = new Map<Slot, { id: number; untime: () => void }>();

  constructor(
    private readonly host: DiscoveryHost,
    private readonly setTimer: SetTimer,
    private readonly onError: (message: string) => void,
  ) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): DiscoverySnapshot => this.snapshot;

  private set(patch: Partial<DiscoverySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  private setFix(claim: number, run: JobRun<BranchFixResult>): void {
    const fixes = new Map(this.snapshot.fixes);
    fixes.set(claim, run);
    this.set({ fixes });
  }

  /** Writes a run every slot can hold (running, cancelled, failed). */
  private writeAny(slot: Slot, run: JobRun<never>): void {
    if (slot === 'find') this.set({ find: run });
    else if (slot === 'hunt') this.set({ hunt: run });
    else this.setFix(claimOf(slot), run);
  }

  private run<R>(
    slot: Slot,
    job: DiscoveryJob,
    ms: number,
    settle: (doc: Document, r: DiscoveryOutcome) => JobRun<R>,
    write: (run: JobRun<R>) => void,
  ): void {
    this.cancel(slot);
    const doc = job.doc;
    const mine = () => this.current.get(slot)?.id === id;
    const finish = () => {
      this.current.get(slot)?.untime();
      this.current.delete(slot);
    };
    const id = this.host.startDiscovery(job, {
      progress: (p) => {
        if (mine()) this.writeAny(slot, { status: 'running', job: id, doc, ...phaseOf(p) });
      },
      result: (r) => {
        if (!mine()) return;
        finish();
        write(settle(doc, r));
      },
      error: (message) => {
        if (!mine()) return;
        finish();
        this.writeAny(slot, { status: 'failed', doc, message });
        this.onError(`a discovery job failed: ${message}`);
      },
    });
    const untime = this.setTimer(() => {
      if (mine()) this.host.stop(id);
    }, ms);
    this.current.set(slot, { id, untime });
    this.writeAny(slot, { status: 'running', job: id, doc, phase: 'starting', done: 0, total: 1 });
  }

  /** "What is special?": runs `find` on `doc`. */
  find(doc: Document): void {
    const job = { kind: 'find' as const, doc, seed: freshSeed(), budget: { n: DISCOVERY_N } };
    this.run('find', job, FIND_MS, findRun, (find) => {
      this.set({ find });
    });
  }

  /** "Special positions": runs `hunt` on `doc`. */
  hunt(doc: Document): void {
    const job = { kind: 'hunt' as const, doc, seed: freshSeed() };
    this.run('hunt', job, HUNT_MS, huntRun, (hunt) => {
      this.set({ hunt });
    });
  }

  /** The branch fixes of `claim` for its verdict in `regime` (MIXED: local; global). */
  branchFix(doc: Document, claim: number, regime: 'local' | 'global'): void {
    const job = {
      ...{ kind: 'branchFix' as const, doc, claim, regime },
      ...{ seed: freshSeed(), n: DISCOVERY_N },
    };
    this.run(fixSlot(claim), job, BRANCH_FIX_MS, fixRun, (run) => {
      this.setFix(claim, run);
    });
  }

  /** Cancels a running find (nothing is reported). */
  cancelFind(): void {
    this.cancel('find');
  }

  cancelHunt(): void {
    this.cancel('hunt');
  }

  cancelFix(claim: number): void {
    this.cancel(fixSlot(claim));
  }

  private cancel(slot: Slot): void {
    const c = this.current.get(slot);
    if (c === undefined) return;
    c.untime();
    this.current.delete(slot);
    this.host.cancel(c.id);
    const doc = this.runOf(slot)?.doc;
    if (doc !== undefined) this.writeAny(slot, { status: 'cancelled', doc });
  }

  private runOf(slot: Slot) {
    if (slot === 'find') return this.snapshot.find;
    if (slot === 'hunt') return this.snapshot.hunt;
    return this.snapshot.fixes.get(claimOf(slot));
  }

  /** The objects to ring on the canvas (a hovered fact), or none. */
  highlight(objects: readonly number[]): void {
    const h = this.snapshot.highlight;
    if (h.length === objects.length && h.every((x, i) => x === objects[i])) return;
    this.set({ highlight: objects });
  }

  /** Draws `view` on the canvas instead of the figure (null: the figure again). */
  setView(view: DraftView | null): void {
    if (view !== this.snapshot.view) this.set({ view });
  }

  /** Forgets every job and view (another figure was opened). */
  clear(): void {
    for (const slot of [...this.current.keys()]) this.cancel(slot);
    this.snapshot = EMPTY;
    for (const l of this.listeners) l();
  }
}

function phaseOf(p: DiscoveryProgress) {
  return { phase: p.phase, done: p.done, total: Math.max(1, p.total) };
}
