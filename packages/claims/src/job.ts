/**
 * The worker job protocol (SPEC §16): `runJob(job, env)` is a pure generator that yields
 * progress after every sample, so a host can time-slice it (≤ 16 ms per slice) or run it
 * in a Web Worker, and can cancel it: `next('cancel')` (or `return()`) stops it. Jobs:
 * `{ kind: 'testClaim', regime: 'local' | 'global', doc, claim, seed, n }`.
 *
 * The job carries the parsed Document rather than its text: packages/claims may not
 * import packages/lang (SPEC §2: lang → claims), so the host parses first (ADR-0008).
 * Cryptographic randomness for the mod-p rung is supplied by the host (`env.entropy`,
 * e.g. num's cryptoSource over crypto.getRandomValues); without it the rung is skipped.
 *
 * Global jobs mirror every other tested figure (only when the figure's frame allows it:
 * frame.ts), count attempts and acceptances per orientation (so a low acceptance caused by
 * mirroring is not blamed on the hypotheses), and run the flip test on false figures and on
 * undefined ones (an undefined figure that holds flipped failed through an orientation
 * choice: law L16). Local jobs judge the current figure exactly as the live badge does.
 */
import { createRng, deriveSeed, type EntropySource, type Seed } from '@geomira/num/rng';
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import { isOrientationDependent } from '@geomira/kernel/selector';
import type { Value } from '@geomira/kernel/value';
import { EXACT_BUDGET_BITS, HARD_ACCEPTANCE, RETRY_FACTOR } from './constants';
import { CURRENT_FIGURE_SEED } from './current';
import { valueOf } from './eval-claim';
import { flipSelector } from './expr-path';
import { prepare, type Prepared, type SiteProbe } from './prepare';
import { withoutProbes } from './probes';
import { decideSample, floatValues, type SampleOutcome } from './rungs';
import { drawSample, type Regime } from './sampler';
import {
  globalVerdict,
  localVerdict,
  newCollector,
  record,
  type Collector,
  type Common,
  type FlipSummary,
  type NamedSelector,
  type Verdict,
} from './verdict';

export interface TestClaimJob {
  readonly kind: 'testClaim';
  readonly regime: Regime;
  readonly doc: Document;
  /** The id of the claim to test. */
  readonly claim: number;
  readonly seed: Seed;
  readonly n: number;
}

export interface JobEnv {
  readonly registry: Registry;
  readonly entropy?: EntropySource;
  readonly budgetBits?: number;
}

export interface JobProgress {
  readonly kind: 'progress';
  readonly regime: Regime;
  /** Figures tested so far (accepted by the hypotheses), of n. */
  readonly done: number;
  readonly n: number;
  readonly attempts: number;
}

export type JobResult =
  | { readonly kind: 'verdict'; readonly verdict: Verdict }
  | { readonly kind: 'cancelled'; readonly done: number; readonly attempts: number }
  | { readonly kind: 'invalid'; readonly reason: string };

export type JobCommand = 'cancel' | undefined;

/** The flip test's per-sample findings. */
interface FlipState {
  failing: number;
  unrepaired: number;
  unrepairedDoc?: Document;
  /** Undefined figures that held once flipped (counted in `failing` too). */
  undefinedRepaired: number;
  /** Site index → whether flipping it alone repaired every failing sample so far. */
  alone: Map<number, boolean>;
  k: Set<number>;
}

function newFlipState(): FlipState {
  return { failing: 0, unrepaired: 0, undefinedRepaired: 0, alone: new Map(), k: new Set() };
}

/** What flipping the orientation-dependent selectors of one figure gives. */
interface Flips {
  readonly sites: readonly number[];
  readonly all: boolean;
  readonly alone: readonly boolean[];
}

function chiralLine(
  values: ReadonlyMap<number, Value<number>> | undefined,
  s: SiteProbe,
): { chiral: boolean } | null {
  for (const id of s.argProbes) {
    const v = values?.get(id);
    if (v?.kind === 'line') return v;
  }
  return null;
}

/** The indices of the orientation-dependent sites in this figure (kernel's definition, SPEC §7). */
function dependentSites(prep: Prepared, doc: Document): number[] {
  const values = floatValues(prep, doc);
  return prep.sites.flatMap((s, i) =>
    isOrientationDependent({ kind: s.site.selector }, chiralLine(values, s)) ? [i] : [],
  );
}

function flipped(prep: Prepared, doc: Document, sites: readonly number[]): Document {
  let objects = doc.objects;
  for (const i of sites) {
    const s = prep.sites[i]?.site;
    if (s === undefined) continue;
    objects = objects.map((o) =>
      o.id === s.objectId ? { ...o, def: flipSelector(o.def, s.path, s.index) } : o,
    );
  }
  return { ...doc, objects };
}

/** k + 1 evaluations of a figure: all orientation-dependent selectors flipped, then each alone. */
function flipsOf(prep: Prepared, doc: Document, decide: (d: Document) => SampleOutcome): Flips {
  const sites = dependentSites(prep, doc);
  const all = sites.length > 0 && decide(flipped(prep, doc, sites)).kind === 'true';
  const alone = sites.map((i) =>
    sites.length === 1 ? all : decide(flipped(prep, doc, [i])).kind === 'true',
  );
  return { sites, all, alone };
}

/** Counts a failing figure (false, or undefined and repaired) in the flip state. */
function countFailing(state: FlipState, r: Flips): void {
  state.failing++;
  for (const i of r.sites) state.k.add(i);
  for (const [j, i] of r.sites.entries())
    state.alone.set(i, (state.alone.get(i) ?? state.failing === 1) && r.alone[j] === true);
  for (const i of state.alone.keys()) if (!r.sites.includes(i)) state.alone.set(i, false);
}

/** The flip test of a FALSE figure (SPEC §10.5). */
function flipTest(
  prep: Prepared,
  doc: Document,
  state: FlipState,
  decide: (d: Document) => SampleOutcome,
): void {
  const r = flipsOf(prep, doc, decide);
  countFailing(state, r);
  if (!r.all && !r.alone.some(Boolean)) {
    state.unrepaired++;
    state.unrepairedDoc ??= withoutProbes(doc);
  }
}

/**
 * The flip test of an UNDEFINED (degenerate, ambiguous) figure: when flipping the
 * orientation-dependent selectors makes the claim hold, the figure failed through an
 * orientation choice (law L16) and counts as a repaired failure; otherwise it stays a figure
 * that is not valid, as before.
 */
function flipUndefined(
  prep: Prepared,
  doc: Document,
  state: FlipState,
  decide: (d: Document) => SampleOutcome,
): void {
  if (prep.sites.length === 0) return;
  const r = flipsOf(prep, doc, decide);
  if (!r.all && !r.alone.some(Boolean)) return;
  countFailing(state, r);
  state.undefinedRepaired++;
}

function isUndefinedOutcome(o: SampleOutcome): boolean {
  return o.kind === 'undefined' || o.kind === 'degenerate' || o.kind === 'ambiguous';
}

function advice(s: SiteProbe['site']): string {
  return s.selector === 'orient'
    ? 'use same_side(…) or on_arc(…), which keep their meaning when the figure is mirrored'
    : `${s.callText} measures along a chiral line; use same_side(…), between(…) or on_arc(…) instead`;
}

function summary(prep: Prepared, state: FlipState): FlipSummary {
  const namedIndex = [...state.alone.entries()].find(([, ok]) => ok)?.[0];
  const site = namedIndex === undefined ? undefined : prep.sites[namedIndex]?.site;
  const named: NamedSelector | undefined =
    site === undefined
      ? undefined
      : {
          object: site.objectName,
          selector: site.text,
          call: site.callText,
          advice: advice(site),
          ...(site.inClaim ? { inClaim: true } : {}),
        };
  return {
    failing: state.failing,
    unrepaired: state.unrepaired,
    k: state.k.size,
    ...(state.undefinedRepaired > 0 ? { undefinedRepaired: state.undefinedRepaired } : {}),
    ...(state.unrepairedDoc === undefined ? {} : { unrepairedDoc: state.unrepairedDoc }),
    ...(named === undefined ? {} : { named }),
  };
}

/** Runs a testClaim job (see the module comment). */
export function* runJob(
  job: TestClaimJob,
  env: JobEnv,
): Generator<JobProgress, JobResult, JobCommand> {
  const p = prepare(job.doc, job.claim, env.registry);
  if (!p.ok) return { kind: 'invalid', reason: p.reason };
  if (!(Number.isSafeInteger(job.n) && job.n > 0))
    return { kind: 'invalid', reason: 'n must be a positive integer' };
  const prep = p.prepared;
  const budgetBits = env.budgetBits ?? EXACT_BUDGET_BITS;
  const c: Collector = newCollector();
  const flips = newFlipState();
  const parity = {
    unmirrored: { attempts: 0, accepted: 0 },
    mirrored: { attempts: 0, accepted: 0 },
  };
  const maxAttempts = RETRY_FACTOR * job.n;
  let [done, attempts] = [0, 0];
  while (done < job.n && attempts < maxAttempts) {
    const mirrored = job.regime === 'global' && prep.frame.mirror && done % 2 === 1;
    const side = mirrored ? parity.mirrored : parity.unmirrored;
    const seed = deriveSeed(job.seed, attempts);
    attempts++;
    side.attempts++;
    const doc = drawSample(prep, job.regime, seed, mirrored);
    const decide = (d: Document) =>
      decideSample(prep, d, {
        budgetBits,
        rng: createRng(deriveSeed(seed, 1)),
        hypotheses: true,
        ...(env.entropy === undefined ? {} : { entropy: env.entropy }),
      });
    const o = decide(doc);
    record(c, o, () => withoutProbes(doc));
    if (o.kind !== 'rejected') {
      done++;
      side.accepted++;
      if (mirrored) c.mirrored++;
      if (job.regime === 'global' && o.kind === 'false') flipTest(prep, doc, flips, decide);
      if (job.regime === 'global' && isUndefinedOutcome(o)) flipUndefined(prep, doc, flips, decide);
    }
    const cmd = yield { kind: 'progress', regime: job.regime, done, n: job.n, attempts };
    if (cmd === 'cancel') return { kind: 'cancelled', done, attempts };
  }
  const common: Common = {
    seed: job.seed,
    n: job.n,
    tested: done,
    attempts,
    hardToSatisfy: done / attempts < HARD_ACCEPTANCE,
    frame: prep.frame,
    ...(job.regime === 'global' ? { parity } : {}),
  };
  return { kind: 'verdict', verdict: finalVerdict(job.regime, prep, c, common, flips, budgetBits) };
}

/** The verdict of a finished job. */
function finalVerdict(
  regime: Regime,
  prep: Prepared,
  c: Collector,
  common: Common,
  flips: FlipState,
  budgetBits: number,
): Verdict {
  if (regime === 'global') return globalVerdict(c, common, summary(prep, flips));
  // The current figure is judged exactly as the live badge judges it (evalClaim's seed).
  const current = valueOf(
    decideSample(prep, prep.doc, {
      budgetBits,
      rng: createRng(CURRENT_FIGURE_SEED),
      hypotheses: false,
    }),
  );
  return localVerdict(c, common, current);
}

/** Runs a job to completion (tests, hosts without workers that do not need slicing). */
export function testClaim(job: TestClaimJob, env: JobEnv): JobResult {
  const it = runJob(job, env);
  for (;;) {
    const r = it.next();
    if (r.done === true) return r.value;
  }
}
