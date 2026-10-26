/**
 * The `find` job (ADR-0035): "what is special about this figure?". Screens every searched
 * claim kind's candidates in the current figure (the numeric rung on shared perturbations),
 * sets construction facts aside (the closure), confirms the survivors with the LOCAL test
 * (claims' runJob, n = 200 by default) and reports only HOLDS IN THIS CONFIGURATION, ranked,
 * with the rungs used. Every bounded step yields progress; `cancel` ends with nothing, `stop`
 * (the host's time budget) ends with what is confirmed. Every cap is in the result.
 */
import { deriveSeed } from '@geomira/num/rng';
import type { Document } from '@geomira/kernel/document';
import { claimKindRegistry, type ClaimKinds } from '@geomira/claims/kind-registry';
import { runJob } from '@geomira/claims/job';
import { screenFigure, type Screen } from '@geomira/claims/screen';
import type { Verdict } from '@geomira/claims/verdict';
import { poolsOf, type Candidate, type Pools } from './candidates';
import { scanKinds } from './scan';
import { buildClosure, type Closure } from './closure';
import { lemmaTag } from './lemmas';
import { rankFacts } from './rank';
import { capLines, rungText } from './text';
import {
  CONSTRUCTION_SHOWN,
  DEFAULT_FIND_BUDGET,
  claimArgsOf,
  type DiscoveryCommand,
  type DiscoveryEnv,
  type DiscoveryProgress,
  type Fact,
  type FindBudget,
  type FindJob,
  type FindOutcome,
  type FoundFact,
  type KindReport,
  type Unconfirmed,
} from './types';

interface State {
  readonly budget: FindBudget;
  readonly kinds: ClaimKinds;
  readonly screen: Screen;
  readonly pools: Pools;
  readonly closure: Closure;
  readonly reports: KindReport[];
  readonly notSearched: { kind: string; reason: string }[];
  readonly survivors: Candidate[];
  readonly construction: Fact[];
  constructionCount: number;
}

function progress(phase: string, done: number, total: number): DiscoveryProgress {
  return { kind: 'progress', job: 'find', phase, done, total };
}

function asFact(c: Candidate): Fact {
  return { kind: c.kind.name, args: c.args, key: c.key, objects: c.objects };
}

/** Decides one screened candidate: a survivor, a construction fact, or nothing. */
function judge(s: State, c: Candidate): void {
  if (s.screen.decide(c.kind, c.args).kind !== 'true') return;
  if (s.closure.isConstruction({ kind: c.kind.name, args: c.args })) {
    s.constructionCount++;
    if (s.construction.length < CONSTRUCTION_SHOWN) s.construction.push(asFact(c));
  } else s.survivors.push(c);
}

/** The document with the fact as a claim, and the claim's id. */
export function withFact(
  doc: Document,
  f: { kind: string; args: Fact['args'] },
): { doc: Document; id: number } {
  const id = doc.nextId;
  return {
    doc: {
      ...doc,
      nextId: id + 1,
      claims: [...doc.claims, { id, kind: f.kind, args: claimArgsOf(f) }],
    },
    id,
  };
}

/** What a local test of a fact gave: its verdict, the host's command, or why it did not run. */
type Tested =
  | { readonly kind: 'verdict'; readonly verdict: Verdict }
  | { readonly kind: 'command'; readonly cmd: 'cancel' | 'stop' }
  | { readonly kind: 'failed'; readonly reason: string };

/** The local test of one surviving fact (its samples are the job's steps). */
function* testFact(
  job: FindJob,
  env: DiscoveryEnv,
  s: State,
  c: Candidate,
  index: number,
): Generator<DiscoveryProgress, Tested, DiscoveryCommand> {
  const w = withFact(job.doc, asFact(c));
  const it = runJob(
    {
      kind: 'testClaim',
      regime: 'local',
      doc: w.doc,
      claim: w.id,
      seed: deriveSeed(job.seed, index + 1),
      n: s.budget.n,
    },
    {
      registry: env.registry,
      kinds: s.kinds,
      ...(env.entropy === undefined ? {} : { entropy: env.entropy }),
    },
  );
  const total = Math.min(s.survivors.length, s.budget.tests);
  for (let r = it.next(); ; r = it.next()) {
    if (r.done === true) {
      const v = r.value;
      if (v.kind === 'verdict') return { kind: 'verdict', verdict: v.verdict };
      return { kind: 'failed', reason: v.kind === 'invalid' ? v.reason : 'cancelled' };
    }
    const cmd = yield progress(`testing ${String(index + 1)} of ${String(total)}`, index, total);
    if (cmd !== undefined) return { kind: 'command', cmd };
  }
}

/** Runs a find job (see the module comment). */
export function* runFind(
  job: FindJob,
  env: DiscoveryEnv,
): Generator<DiscoveryProgress, FindOutcome, DiscoveryCommand> {
  const kinds = env.kinds ?? claimKindRegistry();
  const screen = screenFigure(job.doc, env.registry, deriveSeed(job.seed, 0));
  if ('reason' in screen) return { kind: 'invalid', reason: screen.reason };
  const budget = { ...DEFAULT_FIND_BUDGET, ...job.budget };
  const ids = job.doc.objects.map((o) => o.id);
  const pools = poolsOf(ids, screen.values, screen.ctx.scale);
  const closure = buildClosure(job.doc, env.registry, kinds, { values: screen.values });
  const s: State = {
    budget,
    kinds,
    screen,
    pools,
    closure,
    reports: [],
    notSearched: [],
    survivors: [],
    construction: [],
    constructionCount: 0,
  };
  const scanned = yield* scanKinds('find', kinds, pools, budget, (c) => {
    judge(s, c);
  });
  if (scanned.cmd === 'cancel') return { kind: 'cancelled' };
  s.reports.push(...scanned.reports);
  s.notSearched.push(...scanned.notSearched);
  const stopped = scanned.cmd === 'stop';
  return yield* confirm(job, env, s, stopped);
}

/**
 * The order survivors are tested in (the test budget cuts the end): fewer distinct objects
 * first, then the kind's registry order, then the newest objects first (ADR-0035 decision 12's
 * criteria that need no verdict), then the claim key.
 */
function testOrder(s: State): Candidate[] {
  const kindIndex = new Map(s.kinds.kinds.map((k, i) => [k.name, i]));
  const latest = (c: Candidate) =>
    Math.max(-1, ...c.objects.map((id) => s.pools.order.get(id) ?? -1));
  return [...s.survivors].sort(
    (a, b) =>
      a.objects.length - b.objects.length ||
      (kindIndex.get(a.kind.name) ?? 0) - (kindIndex.get(b.kind.name) ?? 0) ||
      latest(b) - latest(a) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

/** The confirmed facts, and why testing ended. */
interface Confirmed {
  readonly found: FoundFact[];
  readonly unconfirmed: Unconfirmed[];
  readonly tested: number;
  readonly cmd?: 'cancel' | 'stop';
}

/** Phase two: the local tests of the survivors, in screening order, up to the test budget. */
function* testAll(
  job: FindJob,
  env: DiscoveryEnv,
  s: State,
): Generator<DiscoveryProgress, Confirmed, DiscoveryCommand> {
  const found: FoundFact[] = [];
  const unconfirmed: Unconfirmed[] = [];
  let tested = 0;
  for (const [i, c] of testOrder(s).entries()) {
    if (i >= s.budget.tests) break;
    const t = yield* testFact(job, env, s, c, i);
    if (t.kind === 'command') return { found, unconfirmed, tested, cmd: t.cmd };
    tested++;
    if (t.kind === 'failed') unconfirmed.push({ fact: asFact(c), verdict: t.reason });
    else if (t.verdict.kind !== 'holds')
      unconfirmed.push({ fact: asFact(c), verdict: t.verdict.kind });
    else {
      const tag = lemmaTag(s.closure, { kind: c.kind.name, args: c.args });
      const r = rungText(t.verdict);
      found.push({
        ...asFact(c),
        verdict: t.verdict,
        rungs: r.text,
        exact: r.exact,
        ...(tag === undefined ? {} : { tag }),
      });
    }
  }
  return { found, unconfirmed, tested };
}

/** Phase two and three: confirm, rank, the result. */
function* confirm(
  job: FindJob,
  env: DiscoveryEnv,
  s: State,
  stoppedBefore: boolean,
): Generator<DiscoveryProgress, FindOutcome, DiscoveryCommand> {
  const t: Confirmed = stoppedBefore
    ? { found: [], unconfirmed: [], tested: 0 }
    : yield* testAll(job, env, s);
  if (t.cmd === 'cancel') return { kind: 'cancelled' };
  const ranking = rankFacts(t.found, {
    doc: job.doc,
    registry: env.registry,
    kinds: s.kinds,
    values: s.screen.values,
    order: s.pools.order,
  });
  let r = ranking.next();
  while (r.done !== true) {
    const cmd = yield progress('ranking', 0, t.found.length);
    if (cmd === 'cancel') return { kind: 'cancelled' };
    r = ranking.next();
  }
  const facts = r.value.slice(0, s.budget.results);
  const result = {
    kind: 'found' as const,
    seed: job.seed,
    budget: s.budget,
    facts,
    beyondResults: r.value.length - facts.length,
    construction: { count: s.constructionCount, shown: s.construction },
    unconfirmed: t.unconfirmed,
    untested: s.survivors.length - t.tested,
    kinds: s.reports,
    notSearched: s.notSearched,
    stopped: stoppedBefore || t.cmd === 'stop',
  };
  return { ...result, caps: capLines(result) };
}

/** Runs a find job to completion (tests; hosts that need no slicing). */
export function find(job: FindJob, env: DiscoveryEnv): FindOutcome {
  const it = runFind(job, env);
  for (;;) {
    const r = it.next();
    if (r.done === true) return r.value;
  }
}
