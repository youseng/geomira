/**
 * The `find` job (ADR-0035, ADR-0039): "what is special about this figure?". Screens every
 * searched claim kind's candidates in the current figure (the numeric rung on shared
 * perturbations), sets aside the facts that follow from the construction and the maps (the
 * knowledge of derive.ts), merges the rest into maximal facts (group.ts), confirms them with the
 * LOCAL test (claims' runJob, n = 200 by default) and reports only HOLDS IN THIS CONFIGURATION,
 * ranked; a confirmed fact that follows from the construction and the facts shown above it is
 * hidden and listed under the fact it follows from, as are the facts a group stands for. Every
 * bounded step yields progress; `cancel` ends with nothing, `stop` (the host's time budget) ends
 * with what is confirmed. Every cap is in the result.
 */
import { deriveSeed } from '@geomira/num/rng';
import { claimKindRegistry, type ClaimKinds } from '@geomira/claims/kind-registry';
import { screenSteps, type Screen } from '@geomira/claims/screen';
import { poolsOf, type Candidate, type Pools } from './candidates';
import { asFact, confirmUnits, type ConfirmEnv, type Confirmed, withFact } from './confirm';
import { Listing } from './consequences';
import { knowledgeSteps, type Knowledge } from './derive';
import { grouped, groupKind, type TrueFact, type Unit } from './group';
import { groupEnv, Learned, tagUnit } from './find-units';
import { lemmaTagger } from './lemmas';
import { rankFacts, type Ranked } from './rank';
import { scanKinds } from './scan';
import { capLines } from './text';
import { asSteps, drain, TICK } from './ticking';
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
  readonly budget: FindBudget;
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
  const scanned = yield* scanKinds('find', kinds, pools, budget, (c) => {
    judge(s, c);
  });
  if (scanned.cmd === 'cancel') return { kind: 'cancelled' };
  s.reports.push(...scanned.reports);
  s.notSearched.push(...scanned.notSearched);
  // Once stopped, nothing more is tested: the job ends without another step.
  if (scanned.cmd === 'stop') return yield* confirm(job, env, s, [], true);
  const units = yield* asSteps<Unit[], DiscoveryProgress, DiscoveryCommand>(unitSteps(s), () =>
    progress('grouping facts', 0, 1),
  );
  if ('cmd' in units && units.cmd === 'cancel') return { kind: 'cancelled' };
  const list = 'cmd' in units ? [] : units.value;
  return yield* confirm(job, env, s, list, 'cmd' in units);
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

/**
 * The order units are tested in (the test budget cuts the end): tagged first, then fewer
 * distinct objects (a group counts as one fact of its kind: an n-ary group the kind's arity, a
 * class its first link), a group standing for more facts first, the kind's registry order, the
 * newest objects first (ADR-0035 decision 12's criteria that need no verdict), then the key.
 */
function testBefore(s: State, a: Unit, b: Unit): number {
  const latest = (c: Candidate) =>
    Math.max(-1, ...c.objects.map((id) => s.pools.order.get(id) ?? -1));
  const untagged = (u: Unit) => (s.tags.get(u.key) === undefined ? 1 : 0);
  const size = (u: Unit) =>
    u.chain?.[0]?.objects.length ??
    (u.parts.length > 1 ? Math.min(u.objects.length, u.kind.params.length) : u.objects.length);
  return (
    untagged(a) - untagged(b) ||
    size(a) - size(b) ||
    b.parts.length - a.parts.length ||
    (s.kindIndex.get(a.kind.name) ?? 0) - (s.kindIndex.get(b.kind.name) ?? 0) ||
    latest(b) - latest(a) ||
    (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  );
}

/** The units to test, in test order: groups of the grouped kinds, and the single facts. */
function* unitSteps(s: State): Generator<undefined, Unit[], unknown> {
  const env = groupEnv(s.knowledge.closure, s.pools);
  const out: Unit[] = [];
  for (const kind of s.kinds.kinds) {
    const facts = s.trueFacts.get(kind.name);
    if (facts === undefined) continue;
    for (const u of yield* groupKind(kind, facts, env)) {
      if (!u.construction) {
        out.push(u);
        continue;
      }
      s.constructionCount += u.parts.length;
      if (u.objects.length > kind.params.length || u.parts.length > 0)
        s.construction.unshift(asFact(u));
    }
    yield undefined;
  }
  for (const [i, c] of s.singles.entries()) {
    out.push({ ...c, parts: [c], construction: false });
    if (i % TICK === TICK - 1) yield undefined;
  }
  const tagger = lemmaTagger(s.knowledge.closure);
  for (const [i, u] of out.entries()) {
    s.tags.set(u.key, tagUnit(tagger, u));
    if (i % TICK === TICK - 1) yield undefined;
  }
  return out.sort((a, b) => testBefore(s, a, b));
}

/** What the local tests need: the budget, the tags, and how a class is rebuilt (group.ts). */
function confirmEnv(job: FindJob, env: DiscoveryEnv, s: State): ConfirmEnv {
  const groups = groupEnv(s.knowledge.closure, s.pools);
  return {
    job,
    env,
    kinds: s.kinds,
    n: s.budget.n,
    tests: s.budget.tests,
    tag: (u) => s.tags.get(u.key),
    known: new Learned(s.knowledge, {
      doc: job.doc,
      registry: env.registry,
      kinds: s.kinds,
      values: s.screen.values,
    }),
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

/** Phases two and three: confirm, rank, list what is hidden, the result. */
function* confirm(
  job: FindJob,
  env: DiscoveryEnv,
  s: State,
  units: readonly Unit[],
  stoppedBefore: boolean,
): Generator<DiscoveryProgress, FindOutcome, DiscoveryCommand> {
  const t: Confirmed = stoppedBefore
    ? {
        found: [],
        unconfirmed: [],
        tested: new Set(),
        runs: 0,
        construction: [],
        retriesUntested: 0,
        unitOf: new Map(),
      }
    : yield* confirmUnits(confirmEnv(job, env, s), units);
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
  const listed = yield* listHidden(s, units, t, ranked, halt);
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

/**
 * Lists every hidden fact under what it follows from (consequences.ts): the confirmed facts the
 * ranking hid, the parts of shown groups, and the untested units that follow from the facts
 * shown; units that do not follow stay untested (counted).
 */
function* listHidden(
  s: State,
  units: readonly Unit[],
  t: Confirmed,
  ranked: Ranked,
  halt: { stopped: boolean },
): Generator<
  DiscoveryProgress,
  { listing: Listing; untested: number } | 'cancel',
  DiscoveryCommand
> {
  const listing = new Listing(ranked.shown, s.construction);
  // A found fact's own unit first: a class rebuilt from its confirmed checks may carry the key
  // of the class it came from, whose parts include the member that failed.
  const byKey = new Map([...units.map((u) => [u.key, u] as const), ...t.unitOf]);
  const snaps = ranked.snapshots;
  const ruleAt = (at: number, f: Fact & { readonly chain?: readonly Fact[] }) =>
    snaps.list[at]?.derives(f.chain?.[0] ?? f) ?? 'incidence';
  for (const h of ranked.hidden) {
    listing.add(h.fact, h.at, ruleAt(h.at, h.fact));
    for (const p of byKey.get(h.fact.key)?.parts ?? []) listing.add(asFact(p), h.at, 'part');
  }
  ranked.shown.forEach((f, i) => {
    for (const p of byKey.get(f.key)?.parts ?? [])
      if (p.key !== f.key) listing.add(asFact(p), i + 1, 'part');
  });
  let untested = 0;
  for (const [i, u] of units.entries()) {
    if (!halt.stopped && i % TICK === TICK - 1) {
      const cmd = yield progress('listing consequences', i, units.length);
      if (cmd === 'cancel') return 'cancel';
      if (cmd === 'stop') halt.stopped = true;
    }
    if (t.tested.has(u.key)) continue;
    const uf = { ...asFact(u), ...(u.chain === undefined ? {} : { chain: u.chain.map(asFact) }) };
    const at = halt.stopped ? undefined : snaps.trigger(uf);
    if (at === undefined) {
      untested++;
      continue;
    }
    listing.add(uf, at, ruleAt(at, uf));
    for (const p of u.parts) listing.add(asFact(p), at, 'part');
  }
  return { listing, untested };
}

/** Runs a find job to completion (tests; hosts that need no slicing). */
export function find(job: FindJob, env: DiscoveryEnv): FindOutcome {
  const it = runFind(job, env);
  for (;;) {
    const r = it.next();
    if (r.done === true) return r.value;
  }
}
