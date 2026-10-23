/**
 * The claim tests of the page (SPEC §10.5, §16): for each claim, its LOCAL run and its
 * GLOBAL run, each running in the worker (host.ts) or finished with a verdict. A local run
 * is followed automatically by a global run when the document has `assume` lines; a global
 * run can also be asked for. A small external store (useSyncExternalStore), so progress
 * re-renders the Claims panel only, never the canvas: the main thread stays free during a
 * test. Each run remembers the document it tested: a verdict about an earlier figure is
 * marked as such, never shown as the current one's. Only the CURRENT job of a claim and regime
 * writes its run: messages of a superseded job, or of any job after `clear()` (another figure
 * was opened), are ignored (Run 10 audit).
 */
import type { TestClaimJob } from '@geomira/claims/job';
import type { Verdict } from '@geomira/claims/verdict';
import type { Claim, Document } from '@geomira/kernel/document';
import { exprEquals } from '@geomira/kernel/expr';
import type { JobCallbacks } from './worker/host';

type Regime = TestClaimJob['regime'];

/** What runs the jobs: the Web Worker host (host.ts), or a fake in tests. */
export interface JobHost {
  start(job: TestClaimJob, callbacks: JobCallbacks): number;
  cancel(id: number): void;
  warm(): void;
}

/** Figures per test (SPEC §10.5: "n = 200"). */
export const TEST_N = 200;

export type Run =
  | { readonly status: 'running'; readonly job: number; readonly done: number; readonly n: number }
  | { readonly status: 'done'; readonly verdict: Verdict }
  | { readonly status: 'cancelled'; readonly done: number; readonly n: number }
  | { readonly status: 'failed'; readonly message: string };

export interface ClaimRuns {
  readonly doc: Document;
  readonly local?: Run;
  readonly global?: Run;
}

type Snapshot = ReadonlyMap<number, ClaimRuns>;

function sameStatement(a: Claim | undefined, b: Claim | undefined): boolean {
  if (a === undefined || b === undefined || a.kind !== b.kind) return false;
  return (
    a.args.length === b.args.length &&
    a.args.every((x, i) => {
      const y = b.args[i];
      return y !== undefined && exprEquals(x, y);
    })
  );
}

/**
 * The runs to show for claim `id` of `doc`: only when the tested document had the same
 * statement under that id. Undo rolls the id counter back, so a new claim can reuse the id of
 * an undone one, whose verdict must not appear on it (pre-beta review).
 */
export function runsFor(
  snapshot: ReadonlyMap<number, ClaimRuns>,
  doc: Document,
  id: number,
): ClaimRuns | undefined {
  const r = snapshot.get(id);
  const find = (d: Document) => d.claims.find((c) => c.id === id);
  return r !== undefined && sameStatement(find(r.doc), find(doc)) ? r : undefined;
}

/** A fresh seed for each run (reported with its verdict, SPEC §10.5). */
function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

export class TestRuns {
  private snapshot: Snapshot = new Map();
  private readonly listeners = new Set<() => void>();
  /** The current job of each claim and regime ("claim:regime" → job id). */
  private current = new Map<string, number>();

  constructor(
    private readonly host: JobHost,
    private readonly onError: (message: string) => void,
  ) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): Snapshot => this.snapshot;

  private set(claim: number, f: (r: ClaimRuns | undefined) => ClaimRuns): void {
    const next = new Map(this.snapshot);
    next.set(claim, f(this.snapshot.get(claim)));
    this.snapshot = next;
    for (const l of this.listeners) l();
  }

  private setRun(claim: number, regime: Regime, run: Run): void {
    this.set(claim, (r) => ({ ...(r ?? { doc: this.docOf(claim) }), [regime]: run }));
  }

  private docOf(claim: number): Document {
    const d = this.snapshot.get(claim)?.doc;
    if (d === undefined) throw new Error(`no test of claim #${String(claim)}`);
    return d;
  }

  /** Starts the worker before the first test. */
  warm(): void {
    this.host.warm();
  }

  /** Starts a test of `claim` in `doc`; a local run is followed by a global one when assumed. */
  start(doc: Document, claim: number, regime: Regime): void {
    this.cancel(claim);
    this.set(claim, (r) => (regime === 'local' ? { doc } : { ...r, doc }));
    const job: TestClaimJob = {
      kind: 'testClaim',
      regime,
      doc,
      claim,
      seed: freshSeed(),
      n: TEST_N,
    };
    const key = `${String(claim)}:${regime}`;
    const mine = () => this.current.get(key) === id;
    const id = this.host.start(job, {
      progress: (p) => {
        if (mine())
          this.setRun(claim, regime, { status: 'running', job: id, done: p.done, n: p.n });
      },
      result: (r) => {
        if (!mine()) return;
        if (r.kind === 'verdict') {
          this.setRun(claim, regime, { status: 'done', verdict: r.verdict });
          if (regime === 'local' && doc.assumptions.length > 0) this.start(doc, claim, 'global');
        } else if (r.kind === 'cancelled') {
          this.setRun(claim, regime, { status: 'cancelled', done: r.done, n: TEST_N });
        } else {
          this.setRun(claim, regime, { status: 'failed', message: r.reason });
        }
      },
      error: (message) => {
        if (!mine()) return;
        this.setRun(claim, regime, { status: 'failed', message });
        this.onError(`the test worker failed: ${message}`);
      },
    });
    this.current.set(key, id);
    this.setRun(claim, regime, { status: 'running', job: id, done: 0, n: TEST_N });
  }

  /** Cancels the running runs of `claim`. */
  cancel(claim: number): void {
    const r = this.snapshot.get(claim);
    for (const run of [r?.local, r?.global])
      if (run?.status === 'running') this.host.cancel(run.job);
  }

  /** Forgets every run (a new document was opened). */
  clear(): void {
    for (const id of this.snapshot.keys()) this.cancel(id);
    this.snapshot = new Map();
    this.current = new Map();
    for (const l of this.listeners) l();
  }
}
