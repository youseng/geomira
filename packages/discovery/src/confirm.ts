/**
 * The find job's confirmation (ADR-0035 decision 11, ADR-0039): each unit (a fact, or a group
 * standing for several) is appended to the document as a claim and tested by claims' runJob in
 * the LOCAL regime; a class is tested check by check (group.ts), and when a check fails it is
 * rebuilt from the checks that hold (a numeric coincidence of the screen never sinks the facts
 * it was grouped with); an n-ary group that fails is tested part by part after the other units.
 * Only HOLDS IN THIS CONFIGURATION is reported, with the rungs used. Every runJob is one test of the budget; each
 * sample is one step of the job.
 */
import { deriveSeed } from '@geomira/num/rng';
import type { Document } from '@geomira/kernel/document';
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import { runJob } from '@geomira/claims/job';
import type { Verdict } from '@geomira/claims/verdict';
import type { Candidate } from './candidates';
import type { Unit } from './group';
import { rungText } from './text';
import {
  claimArgsOf,
  type DiscoveryCommand,
  type DiscoveryEnv,
  type DiscoveryProgress,
  type Fact,
  type FindJob,
  type FoundFact,
  type LemmaTag,
  type Unconfirmed,
} from './types';

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

export function asFact(c: Candidate): Fact {
  return { kind: c.kind.name, args: c.args, key: c.key, objects: c.objects };
}

/** What a local test of a unit gave: its verdicts, the host's command, or why it did not run. */
type Tested =
  | { readonly kind: 'verdicts'; readonly verdicts: readonly Verdict[] }
  | { readonly kind: 'command'; readonly cmd: 'cancel' | 'stop' }
  | { readonly kind: 'failed'; readonly reason: string }
  | { readonly kind: 'budget' };

export interface ConfirmEnv {
  readonly job: FindJob;
  readonly env: DiscoveryEnv;
  readonly kinds: ClaimKinds;
  readonly n: number;
  /** runJob runs allowed in all (the test budget). */
  readonly tests: number;
  readonly tag: (u: Unit) => LemmaTag | undefined;
  /** A class rebuilt from its construction members and the checks confirmed (keys). */
  readonly regroup: (u: Unit, ok: ReadonlySet<string>) => readonly Unit[];
  /** What follows from the construction and the facts confirmed so far (none: test all). */
  readonly known?: Known;
}

/**
 * The knowledge of the facts confirmed so far: a unit that follows from it is not tested (it is
 * listed with what it follows from after the ranking, find.ts), so the budget goes to new facts.
 */
export interface Known {
  follows(u: Unit): boolean;
  /** Learns a confirmed fact (the knowledge rebuilt in bounded steps). */
  learn(f: FoundFact): Generator<undefined, void, unknown>;
}

function progress(phase: string, done: number, total: number): DiscoveryProgress {
  return { kind: 'progress', job: 'find', phase, done, total };
}

/** One runJob of one claim; `run` numbers it (its seed and the progress line). */
function* testClaim(
  e: ConfirmEnv,
  c: Candidate,
  run: number,
  total: number,
): Generator<DiscoveryProgress, Tested, DiscoveryCommand> {
  const w = withFact(e.job.doc, asFact(c));
  const it = runJob(
    {
      kind: 'testClaim',
      regime: 'local',
      doc: w.doc,
      claim: w.id,
      seed: deriveSeed(e.job.seed, run + 1),
      n: e.n,
    },
    {
      registry: e.env.registry,
      kinds: e.kinds,
      ...(e.env.entropy === undefined ? {} : { entropy: e.env.entropy }),
    },
  );
  for (let r = it.next(); ; r = it.next()) {
    if (r.done === true) {
      const v = r.value;
      if (v.kind === 'verdict') return { kind: 'verdicts', verdicts: [v.verdict] };
      return { kind: 'failed', reason: v.kind === 'invalid' ? v.reason : 'cancelled' };
    }
    const cmd = yield progress(`testing ${String(run + 1)} of ${String(total)}`, run, total);
    if (cmd !== undefined) return { kind: 'command', cmd };
  }
}

/** The claims a unit is tested as: a class's checks (group.ts), else itself. */
function claimsOf(u: Unit): readonly Candidate[] {
  return u.checks ?? [u];
}

/** The rungs of every link, as one text when they agree. */
function rungsOf(vs: readonly Verdict[]): { text: string; exact: boolean } {
  const rs = vs.map(rungText);
  const texts = [...new Set(rs.map((r) => r.text))];
  return { text: texts.join('; '), exact: rs.every((r) => r.exact) };
}

export interface Confirmed {
  readonly found: FoundFact[];
  readonly unconfirmed: Unconfirmed[];
  /** Keys of the units tested (confirmed or not). */
  readonly tested: ReadonlySet<string>;
  /** runJob runs made. */
  readonly runs: number;
  /** Parts of a class rebuilt from its confirmed members that hold by construction. */
  readonly construction: Unit[];
  /** Parts of failed n-ary groups queued to be tested on their own and not tested. */
  readonly retriesUntested: number;
  /** The unit each found fact is (a rebuilt class may carry its first class's key). */
  readonly unitOf: ReadonlyMap<string, Unit>;
  readonly cmd?: 'cancel' | 'stop';
}

/** What a unit's local tests gave, by claim key: HOLDS with its verdict, or why not. */
type Outcomes = Map<string, { readonly holds: Verdict } | { readonly not: string }>;

interface Progress {
  readonly found: FoundFact[];
  readonly unconfirmed: Unconfirmed[];
  readonly tested: Set<string>;
  readonly construction: Unit[];
  readonly unitOf: Map<string, Unit>;
  /** Units still to test (a failed n-ary group's parts join the end). */
  readonly queue: Unit[];
  runs: number;
  readonly total: number;
}

/** The local tests of one unit's claims (a class: every check; else up to the first failure). */
function* testUnit(
  e: ConfirmEnv,
  u: Unit,
  p: Progress,
): Generator<DiscoveryProgress, Outcomes | { cmd: 'cancel' | 'stop' }, DiscoveryCommand> {
  const out: Outcomes = new Map();
  for (const c of claimsOf(u)) {
    const t = yield* testClaim(e, c, p.runs, p.total);
    p.runs++;
    if (t.kind === 'command') return { cmd: t.cmd };
    const v = t.kind === 'verdicts' ? t.verdicts[t.verdicts.length - 1] : undefined;
    const o =
      v?.kind === 'holds'
        ? { holds: v }
        : {
            not:
              t.kind === 'failed' ? t.reason : t.kind === 'budget' ? 'budget' : (v?.kind ?? 'none'),
          };
    out.set(c.key, o);
    if ('not' in o && u.checks === undefined) break;
  }
  return out;
}

function found(p: Progress, u: Unit, f: FoundFact): void {
  p.found.push(f);
  p.unitOf.set(f.key, u);
}

/** The verdicts of a unit's claims when every one holds. */
function holding(u: Unit, out: Outcomes): Verdict[] | undefined {
  const vs: Verdict[] = [];
  for (const c of claimsOf(u)) {
    const o = out.get(c.key);
    if (o === undefined || !('holds' in o)) return undefined;
    vs.push(o.holds);
  }
  return vs;
}

/**
 * A unit whose claims did not all hold: a class is rebuilt from its construction members and
 * its confirmed checks (each failing check is unconfirmed on its own); an n-ary group is
 * unconfirmed and its parts are tested on their own after the other units.
 */
function settleFailed(e: ConfirmEnv, u: Unit, out: Outcomes, p: Progress): void {
  if (u.checks === undefined) {
    const bad = [...out.values()].find((o) => 'not' in o);
    p.unconfirmed.push({
      fact: asFact(u),
      verdict: bad !== undefined && 'not' in bad ? bad.not : 'none',
    });
    if (u.parts.length > 1)
      p.queue.push(...u.parts.map((c) => ({ ...c, parts: [c], construction: false })));
    return;
  }
  const ok = new Set<string>();
  for (const c of u.checks) {
    const o = out.get(c.key);
    if (o !== undefined && 'holds' in o) ok.add(c.key);
    else
      p.unconfirmed.push({
        fact: asFact(c),
        verdict: o !== undefined && 'not' in o ? o.not : 'none',
      });
  }
  for (const v of e.regroup(u, ok)) {
    p.tested.add(v.key);
    if (v.construction) p.construction.push(v);
    else {
      const vs = holding(v, out);
      const last = vs?.[vs.length - 1];
      if (vs !== undefined && last !== undefined)
        found(p, v, foundFact(v, last, rungsOf(vs), e.tag(v)));
    }
  }
}

/** Learns a confirmed fact as job steps; the host's command, if one came. */
function* learn(
  e: ConfirmEnv,
  f: FoundFact,
  p: Progress,
): Generator<DiscoveryProgress, 'cancel' | 'stop' | undefined, DiscoveryCommand> {
  if (e.known === undefined) return undefined;
  const g = e.known.learn(f);
  for (let r = g.next(); r.done !== true; r = g.next()) {
    const cmd = yield progress('learning the facts confirmed', p.runs, p.total);
    if (cmd !== undefined) return cmd;
  }
  return undefined;
}

/** The local tests of the units, in order, while runJob runs remain in the budget. */
export function* confirmUnits(
  e: ConfirmEnv,
  units: readonly Unit[],
): Generator<DiscoveryProgress, Confirmed, DiscoveryCommand> {
  const p: Progress = {
    found: [],
    unconfirmed: [],
    tested: new Set(),
    construction: [],
    unitOf: new Map(),
    queue: [...units],
    runs: 0,
    total: Math.min(
      e.tests,
      units.reduce((n, u) => n + claimsOf(u).length, 0),
    ),
  };
  const done = (cmd?: 'cancel' | 'stop'): Confirmed => ({
    found: p.found,
    unconfirmed: p.unconfirmed,
    tested: p.tested,
    runs: p.runs,
    construction: p.construction,
    unitOf: p.unitOf,
    retriesUntested: p.queue.slice(units.length).filter((u) => !p.tested.has(u.key)).length,
    ...(cmd === undefined ? {} : { cmd }),
  });
  for (let i = 0; i < p.queue.length; i++) {
    const u = p.queue[i];
    // A unit that does not fit in the runs left stays untested; smaller ones after it may fit.
    if (u === undefined || p.runs + claimsOf(u).length > e.tests) continue;
    if (e.known?.follows(u) === true) continue;
    const out = yield* testUnit(e, u, p);
    if ('cmd' in out) return done(out.cmd);
    p.tested.add(u.key);
    const before = p.found.length;
    const vs = holding(u, out);
    const last = vs?.[vs.length - 1];
    if (vs !== undefined && last !== undefined)
      found(p, u, foundFact(u, last, rungsOf(vs), e.tag(u)));
    else settleFailed(e, u, out, p);
    for (const f of p.found.slice(before)) {
      const cmd = yield* learn(e, f, p);
      if (cmd !== undefined) return done(cmd);
    }
  }
  return done();
}

function foundFact(
  u: Unit,
  v: Verdict,
  r: { text: string; exact: boolean },
  tag: LemmaTag | undefined,
): FoundFact {
  return {
    ...asFact(u),
    verdict: v,
    rungs: r.text,
    exact: r.exact,
    standsFor: Math.max(1, u.parts.length),
    ...(u.chain === undefined ? {} : { chain: u.chain.map(asFact) }),
    ...(tag === undefined ? {} : { tag }),
  };
}
