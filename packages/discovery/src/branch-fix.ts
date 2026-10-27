/**
 * The `branchFix` job (ADR-0036): for a claim whose local verdict is MIXED or whose global
 * verdict is ORIENTATION-DEPENDENT, every assignment of its construction's branch choices
 * that makes the claim HOLD (in the regime of that verdict), in the order the brief fixes:
 * (1) keeping every drawn point (only the selectors change), (2) moving one point, later
 * construction steps first, then more flips; at most MAX_ASSIGNMENTS built and tested, the
 * cap stated. Each fix carries "what moves", the rewritten definitions (one batch of
 * redefinitions applies it) and its verdict. The current document is never changed.
 */
import { FloatField } from '@geomira/num/float-field';
import { deriveSeed, type Seed } from '@geomira/num/rng';
import { bandThreshold } from '@geomira/num/tolerance';
import { evalContextFor } from '@geomira/kernel/context';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import type { Expr } from '@geomira/kernel/expr';
import type { EvalContext } from '@geomira/kernel/tool';
import type { Value } from '@geomira/kernel/value';
import { runJob } from '@geomira/claims/job';
import type { TestClaimJob } from '@geomira/claims/job';
import type { Verdict } from '@geomira/claims/verdict';
import { assign, repeatsIn, sameDefinitions, sitesOf, type Site } from './branch-sites';
import { grouped, rungText } from './text';
import type {
  Cancelled,
  DiscoveryCommand,
  DiscoveryEnv,
  DiscoveryProgress,
  Invalid,
} from './types';

type Regime = TestClaimJob['regime'];

/** The most assignments built and tested (2^6: six branch choices in full). */
export const MAX_ASSIGNMENTS = 64;

export interface BranchFixJob {
  readonly kind: 'branchFix';
  readonly doc: Document;
  readonly claim: number;
  /** The regime of the verdict being fixed: local (MIXED) or global (ORIENTATION-DEPENDENT). */
  readonly regime: Regime;
  readonly seed: Seed;
  /** Figures per test (default 200). */
  readonly n?: number;
}

export interface Fix {
  /** The document with the assignment (preview it; apply `edits` as one batch). */
  readonly doc: Document;
  /** The sites flipped to their other candidate (object ids). */
  readonly flipped: readonly number[];
  /** The user objects whose value changes (object ids); empty: only selectors change. */
  readonly moves: readonly number[];
  /** The rewritten definitions. */
  readonly edits: readonly { readonly id: number; readonly def: Expr }[];
  readonly verdict: Verdict;
  readonly rungs: string;
  /**
   * Rewritten objects that would be the same construction as another object (the only
   * selectors that pick the candidate repeat its definition): applying it would leave two
   * objects with one construction (the language warns and says to delete one), so this fix is
   * shown and explained ("use R instead of X"), and the UI does not apply it.
   */
  readonly repeats: readonly { readonly object: number; readonly of: number }[];
}

export interface BranchFixResult {
  readonly kind: 'fixes';
  readonly seed: Seed;
  readonly regime: Regime;
  /** The branch sites (object ids, in construction order). */
  readonly sites: readonly number[];
  readonly fixes: readonly Fix[];
  /** Assignments tested, of 2^k. */
  readonly checked: number;
  readonly total: number;
  /** "checked 64 of 1,024 assignments: cap", or "no branch choice in this claim's construction". */
  readonly note?: string;
}

export type BranchFixOutcome = BranchFixResult | Cancelled | Invalid;

function progress(done: number, total: number): DiscoveryProgress {
  return {
    kind: 'progress',
    job: 'branchFix',
    phase: `testing assignment ${String(done + 1)}`,
    done,
    total,
  };
}

/** Subsets of k sites by size, later sites first within a size (decision 2), at most `cap`. */
export function assignmentOrder(k: number, cap: number): boolean[][] {
  const out: boolean[][] = [];
  const pick = (size: number, from: number, chosen: number[]): void => {
    if (out.length >= cap) return;
    if (chosen.length === size) {
      out.push(Array.from({ length: k }, (_, i) => chosen.includes(i)));
      return;
    }
    for (let i = from; i >= 0; i--) pick(size, i - 1, [...chosen, i]);
  };
  for (let size = 0; size <= k && out.length < cap; size++) pick(size, k - 1, []);
  return out;
}

/**
 * Whether a value moved beyond the band between two figures: points and circles by the length
 * band; a line by the length band for its offset and the dimensionless band for its turn (the
 * sine of the angle between the directions), so a turn is judged as a turn at any scale.
 */
export function valueChanged(
  a: Value<number> | undefined,
  b: Value<number> | undefined,
  ctx: EvalContext,
): boolean {
  const band = bandThreshold('length', ctx);
  if (a === undefined || b === undefined) return a !== b;
  if (a.kind !== b.kind) return true;
  if (a.kind === 'point' && b.kind === 'point')
    return Math.abs(a.x - b.x) > band || Math.abs(a.y - b.y) > band;
  if (a.kind === 'circle' && b.kind === 'circle')
    return (
      Math.abs(a.c.x - b.c.x) > band ||
      Math.abs(a.c.y - b.c.y) > band ||
      Math.abs(Math.sqrt(a.r2) - Math.sqrt(b.r2)) > band
    );
  if (a.kind === 'line' && b.kind === 'line') {
    const n = Math.hypot(b.d.x, b.d.y) * Math.hypot(a.d.x, a.d.y);
    const turn = Math.abs(a.d.x * b.d.y - a.d.y * b.d.x) / n;
    const off =
      Math.abs((b.p.x - a.p.x) * a.d.y - (b.p.y - a.p.y) * a.d.x) / Math.hypot(a.d.x, a.d.y);
    return turn > bandThreshold('dimensionless', ctx) || off > band;
  }
  return false;
}

/** The user objects whose values differ between two figures. */
function movesBetween(a: Document, b: Document, env: DiscoveryEnv): number[] {
  const c = evalContextFor(a);
  if (!c.ok) return [];
  const [va, vb] = [
    evaluate(a, env.registry, FloatField, c.ctx).values,
    evaluate(b, env.registry, FloatField, c.ctx).values,
  ];
  return a.objects
    .filter((o) => o.managedBy === undefined && valueChanged(va.get(o.id), vb.get(o.id), c.ctx))
    .map((o) => o.id);
}

function holds(v: Verdict, regime: Regime): boolean {
  return regime === 'local' ? v.kind === 'holds' : v.kind === 'holds-across';
}

/** Runs a branch-fix job (see the module comment). */
/** The test of one assignment: its verdict, or the host's command (its samples are steps). */
function* testOne(
  job: BranchFixJob,
  env: DiscoveryEnv,
  doc: Document,
  i: number,
  count: number,
): Generator<DiscoveryProgress, Verdict | 'cancel' | 'stop' | undefined, DiscoveryCommand> {
  const it = runJob(
    {
      kind: 'testClaim',
      regime: job.regime,
      doc,
      claim: job.claim,
      seed: deriveSeed(job.seed, i),
      n: job.n ?? 200,
    },
    {
      registry: env.registry,
      ...(env.kinds === undefined ? {} : { kinds: env.kinds }),
      ...(env.entropy === undefined ? {} : { entropy: env.entropy }),
    },
  );
  for (let r = it.next(); ; r = it.next()) {
    if (r.done === true) return r.value.kind === 'verdict' ? r.value.verdict : undefined;
    const c = yield progress(i, count);
    if (c !== undefined) return c;
  }
}

function fixOf(
  job: BranchFixJob,
  env: DiscoveryEnv,
  doc: Document,
  sites: readonly Site[],
  flips: readonly boolean[],
  verdict: Verdict,
): Fix {
  const edits = doc.objects.flatMap((o) => {
    const old = job.doc.objects.find((x) => x.id === o.id);
    return old !== undefined && old.def !== o.def ? [{ id: o.id, def: o.def }] : [];
  });
  return {
    doc,
    flipped: sites.filter((_, k) => flips[k] === true).map((s) => s.object),
    moves: movesBetween(job.doc, doc, env),
    edits,
    verdict,
    rungs: rungText(verdict).text,
    repeats: repeatsIn(job.doc, doc, env.registry),
  };
}

/** Runs a branch-fix job (see the module comment). */
export function* runBranchFix(
  job: BranchFixJob,
  env: DiscoveryEnv,
): Generator<DiscoveryProgress, BranchFixOutcome, DiscoveryCommand> {
  const claim = job.doc.claims.find((c) => c.id === job.claim);
  if (claim === undefined)
    return { kind: 'invalid', reason: `there is no claim #${String(job.claim)}` };
  const sites: Site[] = sitesOf(job.doc, env.registry, claim.args);
  const total = 2 ** sites.length;
  const base = {
    kind: 'fixes' as const,
    seed: job.seed,
    regime: job.regime,
    sites: sites.map((s) => s.object),
  };
  if (sites.length === 0)
    return {
      ...base,
      fixes: [],
      checked: 0,
      total: 1,
      note: "no branch choice in this claim's construction",
    };
  const order = assignmentOrder(sites.length, MAX_ASSIGNMENTS);
  const fixes: Fix[] = [];
  const timed = (i: number): BranchFixResult => ({
    ...base,
    fixes,
    checked: i,
    total,
    note: `checked ${grouped(i)} of ${grouped(total)} assignments: time budget`,
  });
  for (const [i, flips] of order.entries()) {
    const doc = assign(job.doc, env.registry, sites, flips, env.choose);
    const cmd = yield progress(i, order.length);
    if (cmd === 'cancel') return { kind: 'cancelled' };
    if (cmd === 'stop') return timed(i);
    if (doc === undefined || sameDefinitions(doc, job.doc)) continue;
    const v = yield* testOne(job, env, doc, i, order.length);
    if (v === 'cancel') return { kind: 'cancelled' };
    if (v === 'stop') return timed(i);
    if (v !== undefined && holds(v, job.regime)) fixes.push(fixOf(job, env, doc, sites, flips, v));
  }
  const capped = order.length < total;
  return {
    ...base,
    fixes,
    checked: order.length,
    total,
    ...(capped
      ? { note: `checked ${grouped(order.length)} of ${grouped(total)} assignments: cap` }
      : {}),
  };
}

/** Runs a branch-fix job to completion (tests). */
export function branchFix(job: BranchFixJob, env: DiscoveryEnv): BranchFixOutcome {
  const it = runBranchFix(job, env);
  for (;;) {
    const r = it.next();
    if (r.done === true) return r.value;
  }
}
