/**
 * The `find` job (ADR-0035, ADR-0039): "what is special about this figure?". Screens every
 * searched claim kind's candidates in the current figure (the numeric rung on shared
 * perturbations; the first look of every kind before any kind's long scan, ADR-0052), sets aside the facts that follow from the construction and the maps (the
 * knowledge of derive.ts), merges the rest into maximal facts (group.ts), confirms them with the
 * LOCAL test (claims' runJob, n = 200 by default) and reports only HOLDS IN THIS CONFIGURATION,
 * ranked; a confirmed fact that follows from the construction and the facts shown above it is
 * hidden and listed under the fact it follows from, as are the facts a group stands for. Every
 * bounded step yields progress; `cancel` ends with nothing, `stop` (the host's time budget) ends
 * with what is confirmed. Every cap is in the result. When the first look settles every kind
 * there is one round of tests; otherwise two (twoRounds).
 */
import { deriveSeed } from '@geomira/num/rng';
import { claimKindRegistry, type ClaimKinds } from '@geomira/claims/kind-registry';
import { screenSteps, type Screen } from '@geomira/claims/screen';
import { poolsOf, type Candidate, type Pools } from './candidates';
import {
  asFact,
  confirmUnits,
  joined,
  type ConfirmEnv,
  type Confirmed,
  type Known,
  withFact,
} from './confirm';
import { listHidden } from './consequences';
import { knowledgeSteps, type Knowledge } from './derive';
import { grouped, groupKind, type TrueFact, type Unit } from './group';
import { type Built, groupEnv, Learned, unitSteps } from './find-units';
import { rankFacts, type Ranked } from './rank';
import { allSettled, firstLook, firstTests, longScan, lookReports, type Look } from './scan-rounds';
import { capLines } from './text';
import { asSteps, drain } from './ticking';
import {
  CONSTRUCTION_SHOWN,
  DEFAULT_FIND_BUDGET,
  type DiscoveryCommand,
  type DiscoveryEnv,
  type DiscoveryProgress,
  type Fact,
  type FindBudget,
  type FindJob,
  type FindOutcome,
  type FindResult,
  type FoundFact,
  type KindReport,
  type LemmaTag,
} from './types';

export { withFact };

interface State {
  readonly budget: FindBudget & { readonly firstLook: number };
  readonly kinds: ClaimKinds;
  readonly screen: Screen;
  readonly pools: Pools;
  /** What follows from the construction and the maps. */
  readonly knowledge: Knowledge;
  readonly reports: KindReport[];
  readonly notSearched: { kind: string; reason: string }[];
  /** Screen-true facts of the grouped kinds, by kind (construction facts included). */
  readonly trueFacts: Map<string, TrueFact[]>;
  /** Screen-true facts of the other kinds that do not follow from the construction. */
  readonly singles: Candidate[];
  readonly construction: Fact[];
  constructionCount: number;
  /** Each kind's registry index (the test order). */
  readonly kindIndex: ReadonlyMap<string, number>;
  /** Each unit's lemma tag by its key (set while grouping). */
  readonly tags: Map<string, LemmaTag | undefined>;
}

function progress(phase: string, done: number, total: number): DiscoveryProgress {
  return { kind: 'progress', job: 'find', phase, done, total };
}

/** Decides one screened candidate: kept for grouping, a construction fact, a single, or nothing. */
function judge(s: State, c: Candidate): void {
  if (s.screen.decide(c.kind, c.args).kind !== 'true') return;
  const construction = s.knowledge.derives({ kind: c.kind.name, args: c.args }) !== undefined;
  if (construction) {
    s.constructionCount++;
    if (s.construction.length < CONSTRUCTION_SHOWN) s.construction.push(asFact(c));
  }
  if (grouped(c.kind.name)) {
    const list = s.trueFacts.get(c.kind.name) ?? [];
    list.push({ c, construction });
    s.trueFacts.set(c.kind.name, list);
  } else if (!construction) s.singles.push(c);
}

/** Runs a find job (see the module comment). */
export function* runFind(
  job: FindJob,
  env: DiscoveryEnv,
): Generator<DiscoveryProgress, FindOutcome, DiscoveryCommand> {
  const kinds = env.kinds ?? claimKindRegistry();
  const budget = { ...DEFAULT_FIND_BUDGET, ...job.budget };
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
  const ids = job.doc.objects.map((o) => o.id);
  const pools = poolsOf(ids, screen.values, screen.ctx.scale);
  const built = yield* asSteps<Knowledge, DiscoveryProgress, DiscoveryCommand>(
    knowledgeSteps(job.doc, env.registry, kinds, { values: screen.values }),
    () => progress('collecting construction facts', 0, 1),
  );
  if ('cmd' in built)
    return built.cmd === 'cancel' ? { kind: 'cancelled' } : stoppedEarly(job, budget);
  const s: State = {
    budget,
    kinds,
    screen,
    pools,
    knowledge: built.value,
    reports: [],
    notSearched: [],
    trueFacts: new Map(),
    singles: [],
    kindIndex: new Map(kinds.kinds.map((k, i) => [k.name, i])),
    construction: [],
    constructionCount: 0,
    tags: new Map(),
  };
  const look = yield* firstLook(kinds, pools, budget, (c) => {
    judge(s, c);
  });
  if (look.cmd === 'cancel') return { kind: 'cancelled' };
  s.notSearched.push(...look.notSearched);
  // Once stopped, nothing more is tested: the job ends without another step.
  if (look.cmd === 'stop') {
    s.reports.push(...lookReports(look.looks));
    return yield* confirm(job, env, s, [], undefined);
  }
  const known = learned(job, env, s);
  if (!allSettled(look.looks)) return yield* twoRounds(job, env, s, known, look.looks);
  // The first look settled every kind: one round, the whole test budget.
  s.reports.push(...lookReports(look.looks));
  const { units, built: groups } = yield* grouping(s);
  if (units === 'cancel') return { kind: 'cancelled' };
  list(s, groups);
  if (units === 'stop') return yield* confirm(job, env, s, [], undefined);
  const t = yield* confirmUnits(confirmEnv(job, env, s, known, s.budget.tests, 0), units);
  return yield* confirm(job, env, s, units, t);
}

/**
 * Groups the true facts so far (find-units.ts) as job steps: the units, or the command that
 * stopped it, and the groups that hold by construction (`built`, listed by `list`).
 */
function* grouping(
  s: State,
): Generator<
  DiscoveryProgress,
  { readonly units: Unit[] | 'cancel' | 'stop'; readonly built: Built },
  DiscoveryCommand
> {
  const built: Built = { count: 0, shown: [] };
  const units = yield* asSteps<Unit[], DiscoveryProgress, DiscoveryCommand>(
    unitSteps(s, built),
    () => progress('grouping facts', 0, 1),
  );
  return { units: 'cmd' in units ? units.cmd : units.value, built };
}

/** Lists the construction groups of one grouping (the last complete one, ADR-0052). */
function list(s: State, built: Built): void {
  s.constructionCount += built.count;
  for (const f of built.shown) s.construction.unshift(f);
}

/**
 * ADR-0052: the first look's facts are grouped and tested with the first share of the test
 * budget; then the long scan; then every true fact is grouped again (without the facts the
 * first round did not confirm) and the units not tested yet are tested with the rest. A stop
 * ends the job with what is confirmed, its reports saying which kinds the time cut. The
 * construction groups listed are those of the last complete grouping (the second covers every
 * true fact the first did).
 */
function* twoRounds(
  job: FindJob,
  env: DiscoveryEnv,
  s: State,
  known: Known,
  looks: readonly Look[],
): Generator<DiscoveryProgress, FindOutcome, DiscoveryCommand> {
  const first = yield* grouping(s);
  if (first.units === 'cancel') return { kind: 'cancelled' };
  const units1 = first.units === 'stop' ? [] : first.units;
  const t1 =
    first.units === 'stop'
      ? undefined
      : yield* confirmUnits(confirmEnv(job, env, s, known, firstTests(s.budget.tests), 0), units1);
  if (t1 === undefined || t1.cmd !== undefined) {
    list(s, first.built);
    s.reports.push(...lookReports(looks));
    return yield* confirm(job, env, s, units1, t1);
  }
  const scan = yield* longScan(looks, s.pools, s.budget, (c) => {
    judge(s, c);
  });
  if (scan.cmd === 'cancel') return { kind: 'cancelled' };
  s.reports.push(...scan.reports);
  if (scan.cmd === 'stop') {
    list(s, first.built);
    return yield* confirm(job, env, s, units1, { ...t1, cmd: 'stop' });
  }
  const rejected = new Set(t1.unconfirmed.map((u) => u.fact.key));
  for (const [kind, list] of s.trueFacts)
    s.trueFacts.set(
      kind,
      list.filter((f) => !rejected.has(f.c.key)),
    );
  const second = yield* grouping(s);
  if (second.units === 'cancel') return { kind: 'cancelled' };
  if (second.units === 'stop') {
    list(s, first.built);
    return yield* confirm(job, env, s, units1, { ...t1, cmd: 'stop' });
  }
  list(s, second.built);
  const all = second.units;
  const fresh = all.filter((u) => !t1.tested.has(u.key));
  const e = confirmEnv(job, env, s, known, s.budget.tests, t1.runs);
  const t2 = yield* confirmUnits(e, fresh);
  return yield* confirm(job, env, s, all, joined(t1, t2));
}

/** The result of a job stopped before its screen began: nothing checked, said so. */
function stoppedEarly(job: FindJob, budget: FindBudget): FindResult {
  const result = {
    kind: 'found' as const,
    seed: job.seed,
    budget,
    facts: [],
    beyondResults: 0,
    construction: { count: 0, shown: [] },
    unconfirmed: [],
    untested: 0,
    testsRun: 0,
    consequenceCount: 0,
    kinds: [],
    notSearched: [],
    stopped: true,
  };
  return { ...result, caps: capLines(result) };
}

/** The knowledge of the construction and of the facts confirmed so far, shared by the rounds. */
function learned(job: FindJob, env: DiscoveryEnv, s: State): Known {
  return new Learned(s.knowledge, {
    doc: job.doc,
    registry: env.registry,
    kinds: s.kinds,
    values: s.screen.values,
  });
}

/**
 * What the local tests need: the budget (`tests` runs in all, `before` of them made by an
 * earlier round), the tags, the knowledge, and how a class is rebuilt (group.ts).
 */
function confirmEnv(
  job: FindJob,
  env: DiscoveryEnv,
  s: State,
  known: Known,
  tests: number,
  before: number,
): ConfirmEnv {
  const groups = groupEnv(s.knowledge.closure, s.pools);
  return {
    job,
    env,
    kinds: s.kinds,
    n: s.budget.n,
    tests,
    before,
    tag: (u) => s.tags.get(u.key),
    known,
    regroup: (u, ok) =>
      u.members === undefined
        ? []
        : drain(
            groupKind(
              u.kind,
              u.members.filter((m) => m.construction || ok.has(m.c.key)),
              groups,
            ),
          ),
  };
}

/**
 * The end: what the local tests confirmed (`tested`; none: stopped before any test), ranked, and
 * what is hidden listed; the result.
 */
function* confirm(
  job: FindJob,
  env: DiscoveryEnv,
  s: State,
  units: readonly Unit[],
  tested: Confirmed | undefined,
): Generator<DiscoveryProgress, FindOutcome, DiscoveryCommand> {
  const stoppedBefore = tested === undefined;
  const t: Confirmed = tested ?? {
    found: [],
    unconfirmed: [],
    tested: new Set(),
    runs: 0,
    construction: [],
    retriesUntested: 0,
    unitOf: new Map(),
    cmd: 'stop',
  };
  if (t.cmd === 'cancel') return { kind: 'cancelled' };
  for (const u of t.construction) {
    s.constructionCount += u.parts.length;
    s.construction.unshift(asFact(u));
  }
  // A stop while ranking or listing ends the "follows" checks and the steps: the job then ends
  // without another yield, stopped.
  const halt = { stopped: stoppedBefore || t.cmd === 'stop' };
  const ranked = yield* rank(job, env, s, t.found, halt);
  if (ranked === 'cancel') return { kind: 'cancelled' };
  const listed = yield* listHidden(s.construction, units, t, ranked, halt);
  if (listed === 'cancel') return { kind: 'cancelled' };
  const facts = listed.listing.facts().slice(0, s.budget.results);
  const result = {
    kind: 'found' as const,
    seed: job.seed,
    budget: s.budget,
    facts,
    beyondResults: ranked.shown.length - facts.length,
    construction: {
      count: s.constructionCount + listed.listing.constructionCount,
      shown: s.construction,
    },
    unconfirmed: t.unconfirmed,
    untested: listed.untested + t.retriesUntested,
    testsRun: t.runs,
    consequenceCount: listed.listing.consequenceCount,
    kinds: s.reports,
    notSearched: s.notSearched,
    stopped: halt.stopped,
  };
  return { ...result, caps: capLines(result) };
}

/** Ranks the confirmed facts (rank.ts) as job steps; a stop ends the steps (see confirm). */
function* rank(
  job: FindJob,
  env: DiscoveryEnv,
  s: State,
  found: readonly FoundFact[],
  halt: { stopped: boolean },
): Generator<DiscoveryProgress, Ranked | 'cancel', DiscoveryCommand> {
  const ranking = rankFacts(
    found,
    {
      doc: job.doc,
      registry: env.registry,
      kinds: s.kinds,
      values: s.screen.values,
      order: s.pools.order,
      terms: s.knowledge.closure.terms,
    },
    s.knowledge,
    () => halt.stopped,
  );
  let r = ranking.next();
  while (r.done !== true) {
    const cmd = halt.stopped ? undefined : yield progress('ranking', 0, found.length);
    if (cmd === 'cancel') return 'cancel';
    if (cmd === 'stop') halt.stopped = true;
    r = ranking.next();
  }
  return r.value;
}

/** Runs a find job to completion (tests; hosts that need no slicing). */
export function find(job: FindJob, env: DiscoveryEnv): FindOutcome {
  const it = runFind(job, env);
  for (;;) {
    const r = it.next();
    if (r.done === true) return r.value;
  }
}
