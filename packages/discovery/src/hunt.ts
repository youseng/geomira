/**
 * The `hunt` job (ADR-0035 decision 13): special positions of the free inputs, where a fact
 * that is false now becomes true (a right angle, an isosceles triangle, a concurrence). The
 * nearest false candidates (smallest residual) are solved one free input at a time (solve.ts),
 * rounded to the coarsest decimal grid at which the claim tester says the fact holds there, and
 * kept only when every `assume` line holds there and nothing that is defined now becomes
 * undefined (a degenerate position is undefined, never a finding). Each position is a complete
 * Document; the job never changes the current one.
 */
import { deriveSeed, type Seed } from '@geomira/num/rng';
import type { Document } from '@geomira/kernel/document';
import { figureDiameter } from '@geomira/kernel/figure-size';
import { claimKindRegistry, type ClaimKinds } from '@geomira/claims/kind-registry';
import { evalClaim } from '@geomira/claims/eval-claim';
import { screenSteps, type Screen } from '@geomira/claims/screen';
import { poolsOf, type Candidate, type Pools } from './candidates';
import { closureSteps, type Closure } from './closure';
import { asSteps } from './ticking';
import { withFact } from './find';
import { scanKinds, type Scanned } from './scan';
import { keeps, rounded, units } from './position';
import { closureIds, solve, type FreeInput, type Problem } from './solve';
import type {
  Cancelled,
  DiscoveryCommand,
  DiscoveryEnv,
  DiscoveryProgress,
  Fact,
  Invalid,
} from './types';

export interface HuntBudget {
  readonly candidatesPerKind: number;
  readonly countLimit: number;
  /** False candidates solved for (the nearest). */
  readonly targets: number;
  /** Positions reported. */
  readonly positions: number;
}

export const DEFAULT_HUNT_BUDGET: HuntBudget = Object.freeze({
  candidatesPerKind: 4_000,
  countLimit: 200_000,
  targets: 24,
  positions: 12,
});

export interface HuntJob {
  readonly kind: 'hunt';
  readonly doc: Document;
  readonly seed: Seed;
  readonly budget?: Partial<HuntBudget>;
}

/** A special position: a complete document and what is new there. */
export interface Position {
  readonly doc: Document;
  /** The object whose definition holds the moved input, and the input's path in it. */
  readonly object: number;
  readonly path: readonly number[];
  /** The fact solved for (true here, false in the current figure). */
  readonly target: Fact;
  /** Every target true here, the solved one first. */
  readonly facts: readonly Fact[];
  /** The rung the claim tester decided the target with here. */
  readonly rung: string;
}

export interface Skipped {
  readonly hypotheses: number;
  readonly degenerate: number;
  readonly notFound: number;
  readonly repeated: number;
}

export interface HuntResult {
  readonly kind: 'positions';
  readonly seed: Seed;
  readonly budget: HuntBudget;
  readonly positions: readonly Position[];
  /** Targets solved for, of the false candidates screened. */
  readonly targets: number;
  readonly falseCandidates: number;
  readonly skipped: Skipped;
  readonly stopped: boolean;
}

export type HuntOutcome = HuntResult | Cancelled | Invalid;

interface Target {
  readonly c: Candidate;
  readonly residual: number;
}

function progress(phase: string, done: number, total: number): DiscoveryProgress {
  return { kind: 'progress', job: 'hunt', phase, done, total };
}

function asFact(c: Candidate): Fact {
  return { kind: c.kind.name, args: c.args, key: c.key, objects: c.objects };
}

/**
 * Keeps the best `n` targets: the simplest facts first (fewest objects: a right angle, an
 * isosceles triangle, a collinearity), the nearest (smallest residual) among equals.
 */
function nearest(targets: Target[], t: Target, n: number): void {
  const before = (a: Target, b: Target) =>
    a.c.objects.length < b.c.objects.length ||
    (a.c.objects.length === b.c.objects.length && a.residual < b.residual);
  const i = targets.findIndex((x) => before(t, x));
  targets.splice(i < 0 ? targets.length : i, 0, t);
  if (targets.length > n) targets.pop();
}

interface Hunt {
  readonly job: HuntJob;
  readonly env: DiscoveryEnv;
  readonly kinds: ClaimKinds;
  readonly screen: Screen;
  readonly budget: HuntBudget;
  readonly size: number;
  readonly targets: Target[];
  readonly positions: Position[];
  readonly seen: Set<string>;
  readonly skipped: { hypotheses: number; degenerate: number; notFound: number; repeated: number };
}

/** Solves one target for one input; records a position or the reason it was skipped. */
function* tryInput(h: Hunt, t: Target, input: FreeInput): Generator<undefined, void, unknown> {
  const u = units(h.screen, input, h.size, h.job.doc);
  if (u === undefined) return;
  const p: Problem = {
    doc: h.job.doc,
    registry: h.env.registry,
    ctx: h.screen.ctx,
    kind: t.c.kind,
    args: t.c.args,
    input,
    units: u,
    size: h.size,
  };
  const x = solve(p);
  yield undefined;
  const r = x === undefined ? undefined : yield* rounded(p, x, asFact(t.c), h.env, h.kinds);
  if (r === undefined) {
    h.skipped.notFound++;
    return;
  }
  const k = keeps(r.doc, h.screen, h.env);
  if (k !== 'ok') {
    h.skipped[k]++;
    return;
  }
  const others = h.targets
    .filter((o) => o !== t)
    .filter((o) => {
      const w = withFact(r.doc, asFact(o.c));
      return evalClaim(w.doc, w.id, h.env.registry, { kinds: h.kinds }).value === 'true';
    });
  const facts = [asFact(t.c), ...others.map((o) => asFact(o.c))];
  // The same input making the same facts true is the same special position.
  const key = `${String(input.id)}:${input.path.join('.')}:${facts
    .map((f) => f.key)
    .sort()
    .join(';')}`;
  if (h.seen.has(key)) {
    h.skipped.repeated++;
    return;
  }
  h.seen.add(key);
  h.positions.push({
    doc: r.doc,
    object: input.id,
    path: input.path,
    target: asFact(t.c),
    facts,
    rung: r.rung,
  });
}

/** Scans every kind and keeps the nearest false candidates that are not construction facts. */
function* collectTargets(
  h: Hunt,
  pools: Pools,
  closure: Closure,
): Generator<DiscoveryProgress, Scanned & { falseCandidates: number }, DiscoveryCommand> {
  let falseCandidates = 0;
  const scanned = yield* scanKinds('hunt', h.kinds, pools, h.budget, (c) => {
    if (h.screen.decide(c.kind, c.args).kind !== 'false') return;
    if (closure.isConstruction({ kind: c.kind.name, args: c.args })) return;
    const a = h.screen.argValues(c.kind, c.args);
    if (!Array.isArray(a)) return;
    falseCandidates++;
    nearest(h.targets, { c, residual: c.kind.residual(a, h.screen.ctx) }, h.budget.targets);
  });
  return { ...scanned, falseCandidates };
}

/** Solves the targets, nearest first, one input at a time; the host's command, if any. */
function* solveTargets(h: Hunt): Generator<DiscoveryProgress, DiscoveryCommand, DiscoveryCommand> {
  for (const [i, t] of h.targets.entries()) {
    const keep = closureIds(h.job.doc, t.c.objects);
    const inputs = h.screen.free.filter((f) => keep.has(f.id)).reverse();
    const before = h.positions.length;
    for (const input of inputs) {
      if (h.positions.length >= h.budget.positions) return undefined;
      // One position per target: the latest construction step that reaches it.
      if (h.positions.length > before) break;
      const phase = `solving ${String(i + 1)} of ${String(h.targets.length)}`;
      const steps = tryInput(h, t, input);
      for (let r = steps.next(); ; r = steps.next()) {
        const cmd = yield progress(phase, i, h.targets.length);
        if (cmd !== undefined) return cmd;
        if (r.done === true) break;
      }
    }
  }
  return undefined;
}

/** The result of a hunt stopped before its scan began: nothing searched, said so. */
function stoppedEarly(job: HuntJob, budget: HuntBudget): HuntResult {
  return {
    ...{ kind: 'positions', seed: job.seed, budget, positions: [], targets: 0 },
    ...{ falseCandidates: 0, skipped: { hypotheses: 0, degenerate: 0, notFound: 0, repeated: 0 } },
    stopped: true,
  };
}

/** Runs a hunt job (see the module comment). */
export function* runHunt(
  job: HuntJob,
  env: DiscoveryEnv,
): Generator<DiscoveryProgress, HuntOutcome, DiscoveryCommand> {
  const kinds = env.kinds ?? claimKindRegistry();
  const budget = { ...DEFAULT_HUNT_BUDGET, ...job.budget };
  const screened = yield* asSteps<
    Screen | { readonly reason: string },
    DiscoveryProgress,
    DiscoveryCommand
  >(screenSteps(job.doc, env.registry, deriveSeed(job.seed, 0)), () =>
    progress('evaluating the figure', 0, 1),
  );
  if ('cmd' in screened)
    return screened.cmd === 'cancel' ? { kind: 'cancelled' } : stoppedEarly(job, budget);
  const screen = screened.value;
  if ('reason' in screen) return { kind: 'invalid', reason: screen.reason };
  const pools = poolsOf(
    job.doc.objects.map((o) => o.id),
    screen.values,
    screen.ctx.scale,
  );
  const built = yield* asSteps<Closure, DiscoveryProgress, DiscoveryCommand>(
    closureSteps(job.doc, env.registry, kinds, { values: screen.values }),
    () => progress('collecting construction facts', 0, 1),
  );
  if ('cmd' in built)
    return built.cmd === 'cancel' ? { kind: 'cancelled' } : stoppedEarly(job, budget);
  const closure = built.value;
  const h: Hunt = {
    job,
    env,
    kinds,
    screen,
    budget,
    size: figureSize(job.doc, screen),
    targets: [],
    positions: [],
    seen: new Set(),
    skipped: { hypotheses: 0, degenerate: 0, notFound: 0, repeated: 0 },
  };
  const scanned = yield* collectTargets(h, pools, closure);
  if (scanned.cmd === 'cancel') return { kind: 'cancelled' };
  const solved = scanned.cmd === 'stop' ? 'stop' : yield* solveTargets(h);
  if (solved === 'cancel') return { kind: 'cancelled' };
  const stopped = solved === 'stop';
  return {
    kind: 'positions',
    seed: job.seed,
    budget,
    positions: h.positions,
    targets: h.targets.length,
    falseCandidates: scanned.falseCandidates,
    skipped: h.skipped,
    stopped,
  };
}

/**
 * The figure's size for the search's units: its diameter, as the samplers measure it
 * (ADR-0017: not the clamped scale, so a small figure is searched relative to itself); the
 * scale when that is 0 or undefined.
 */
function figureSize(doc: Document, screen: Screen): number {
  const d = figureDiameter(doc);
  return d !== undefined && Number.isFinite(d) && d > 0 ? d : screen.ctx.scale;
}

/** Runs a hunt job to completion (tests). */
export function hunt(job: HuntJob, env: DiscoveryEnv): HuntOutcome {
  const it = runHunt(job, env);
  for (;;) {
    const r = it.next();
    if (r.done === true) return r.value;
  }
}
