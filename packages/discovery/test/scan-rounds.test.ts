/**
 * ADR-0052: the find job's schedule of the screen. The first look screens each searched kind's
 * first `firstLook` candidates (its count stops at FIRST_COUNT); a kind is settled when that is
 * all a single scan to the full budget would do; the long scan goes on from the first look,
 * skipping what it screened; the first round of local tests gets half the test budget.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry, type ClaimKinds } from '@geomira/claims/kind-registry';
import type { ClaimKindSpec } from '@geomira/claims/kind';
import { screenSteps } from '@geomira/claims/screen';
import type { Document } from '@geomira/kernel/document';
import { Figure } from '../../claims/test/helpers/build';
import { plainCandidates, poolsOf, type Candidate, type Pools } from '../src/candidates';
import { joined, type Confirmed } from '../src/confirm';
import { BATCH, scanKind, scanKinds } from '../src/scan';
import {
  allSettled,
  FIRST_COUNT,
  firstLook,
  firstTests,
  longScan,
  lookReports,
  newestFirst,
  type FirstLook,
  type RoundsBudget,
} from '../src/scan-rounds';
import { drain } from '../src/ticking';
import type { DiscoveryProgress, FoundFact, KindReport } from '../src/types';
import { REGISTRY, triangle } from './helpers';

const KINDS = claimKindRegistry();

function poolsOfDoc(doc: Document): Pools {
  const screen = drain(screenSteps(doc, REGISTRY, 9));
  if ('reason' in screen) throw new Error(screen.reason);
  return poolsOf(
    doc.objects.map((o) => o.id),
    screen.values,
    screen.ctx.scale,
  );
}

function only(...names: string[]): ClaimKinds {
  const kinds = names.map((n) => KINDS.get(n)).filter((k): k is ClaimKindSpec => k !== undefined);
  return { kinds, get: (name) => kinds.find((k) => k.name === name) };
}

/** Runs a generator to its end without commands; the progress it yielded, and its value. */
function steps<T>(g: Generator<DiscoveryProgress, T, unknown>): {
  value: T;
  progress: DiscoveryProgress[];
} {
  const progress: DiscoveryProgress[] = [];
  for (let r = g.next(); ; r = g.next()) {
    if (r.done === true) return { value: r.value, progress };
    progress.push(r.value);
  }
}

function look(
  kinds: ClaimKinds,
  pools: Pools,
  budget: RoundsBudget,
): { look: FirstLook; visited: Candidate[] } {
  const visited: Candidate[] = [];
  const r = steps(firstLook(kinds, pools, budget, (c) => visited.push(c)));
  return { look: r.value, visited };
}

/** 30 free points in general position: many six-point tuples. */
function thirtyPoints(): Document {
  const f = new Figure();
  for (let i = 0; i < 30; i++) f.point(`P_${String(i)}`, (i * 7) % 31, (i * i * 3 + 1) % 37);
  return f.doc;
}

describe('the first look (ADR-0052)', () => {
  const pools = poolsOfDoc(triangle().doc);
  const budget: RoundsBudget = { candidatesPerKind: 200, countLimit: 100_000, firstLook: 10 };

  it('the first round gets half the test budget, rounded up', () => {
    expect([60, 8, 7, 1, 0].map(firstTests)).toEqual([30, 4, 4, 1, 0]);
    expect(FIRST_COUNT).toBe(20_000);
  });

  it('screens at most firstLook candidates of each kind; a kind it covers is settled', () => {
    const { look: l, visited } = look(KINDS, pools, budget);
    expect(l.cmd).toBeUndefined();
    expect(l.notSearched.map((n) => n.kind)).toEqual([
      'ratio',
      'ratio_value',
      'cross_ratio',
      'cross_ratio_lines',
    ]);
    expect(l.looks).toHaveLength(KINDS.kinds.length - 4);
    for (const x of l.looks) {
      expect(x.report.checked, x.kind.name).toBeLessThanOrEqual(10);
      const covered = x.report.checked < 10;
      expect(x.seen === undefined, x.kind.name).toBe(covered);
      if (x.seen !== undefined) expect(x.seen.size).toBe(10);
      expect(x.report.stop, x.kind.name).not.toBe('time');
    }
    expect(visited.length).toBe(l.looks.reduce((n, x) => n + x.report.checked, 0));
    expect(allSettled(l.looks)).toBe(false);
    // Stopped before the long scan: only the kinds left to it stopped at the time.
    const reports = lookReports(l.looks);
    l.looks.forEach((x, i) => {
      expect(reports[i]?.stop).toBe(x.seen === undefined ? x.report.stop : 'time');
    });
  });

  it('a first look as large as the budget settles every kind: it is the single scan', () => {
    const { look: l, visited } = look(KINDS, pools, { ...budget, firstLook: 200 });
    expect(allSettled(l.looks)).toBe(true);
    const single: Candidate[] = [];
    const scan = steps(scanKinds('find', KINDS, pools, budget, (c) => single.push(c))).value;
    expect(visited.map((c) => c.key)).toEqual(single.map((c) => c.key));
    expect(l.looks.map((x) => x.report)).toEqual(scan.reports);
    expect(lookReports(l.looks)).toEqual(l.looks.map((x) => x.report));
    const capped = look(KINDS, pools, { ...budget, firstLook: 5_000 }).look;
    expect(capped.looks.map((x) => x.report)).toEqual(l.looks.map((x) => x.report));
  });

  it('a kind the oldest half covers has no newest half', () => {
    // Halves of 20: some kinds have fewer candidates.
    const b = { ...budget, firstLook: 40 };
    const phases = steps(firstLook(KINDS, pools, b, () => undefined)).progress.map((p) => p.phase);
    const l = look(KINDS, pools, b).look;
    for (const x of l.looks) {
      const newest = phases.includes(`screening ${x.kind.name} from the newest objects`);
      expect(newest, x.kind.name).toBe(x.report.checked >= 20);
    }
    expect(l.looks.some((x) => x.report.checked > 0 && x.report.checked < 20)).toBe(true);
    expect(l.looks.some((x) => x.report.checked > 20)).toBe(true);
  });

  it('a stop ends the first look at that kind; kinds after it have no look', () => {
    const g = firstLook(KINDS, pools, budget, () => undefined);
    let r = g.next();
    while (r.done !== true && r.value.phase !== 'screening concyclic') r = g.next();
    const end = g.next('stop');
    if (end.done !== true) throw new Error('not stopped');
    expect(end.value.cmd).toBe('stop');
    expect(end.value.looks.map((x) => x.kind.name)).toEqual(['collinear', 'concyclic']);
    expect(end.value.looks[1]?.report.stop).toBe('time');
  });

  it('the long scan goes on from the first look to the full budget, as one scan would', () => {
    const { look: l, visited } = look(KINDS, pools, budget);
    const more: Candidate[] = [];
    const long = steps(longScan(l.looks, pools, budget, (c) => more.push(c))).value;
    expect(long.cmd).toBeUndefined();
    const all = [...visited, ...more];
    expect(new Set(all.map((c) => c.key)).size).toBe(all.length);
    const single = look(KINDS, pools, { ...budget, firstLook: 200 });
    // A measure kind cut at its budget says so after a long scan (one scan's list just ends).
    const strip = (r: KindReport) =>
      KINDS.get(r.kind)?.finder?.measure === undefined ? r : { ...r, stop: undefined };
    expect(long.reports.map(strip)).toEqual(single.look.looks.map((x) => strip(x.report)));
    const keysOf = (cs: readonly Candidate[], kind: string) =>
      new Set(cs.filter((c) => c.kind.name === kind).map((c) => c.key));
    for (const r of long.reports) {
      const mine = keysOf(all, r.kind);
      expect(mine.size, r.kind).toBe(r.checked);
      // A kind within its budget: the same candidates; a larger one: its newest ones too.
      if (r.checked < 200) expect(mine, r.kind).toEqual(keysOf(single.visited, r.kind));
    }
  });

  it('newest first: the same candidates, by their last object, newest first', () => {
    const newest = newestFirst(pools);
    expect(newest.newestFirst).toBe(true);
    for (const name of ['collinear', 'concyclic', 'equal', 'on', 'conconic']) {
      const kind = KINDS.get(name);
      if (kind === undefined) throw new Error(name);
      const fwd = [...plainCandidates(kind, pools)];
      const back = [...plainCandidates(kind, newest)];
      expect(back.map((c) => c.key).sort(), name).toEqual(fwd.map((c) => c.key).sort());
      expect(back.length, name).toBeGreaterThan(1);
      const last = back.map((c) => {
        const a = c.args.at(-1);
        return a !== undefined && 'id' in a ? (pools.order.get(a.id) ?? -1) : -1;
      });
      for (let i = 1; i < last.length; i++)
        expect(last[i], name).toBeLessThanOrEqual(last[i - 1] ?? 0);
      expect(last[0]).toBe(Math.max(...last));
    }
  });

  it('a stop in the long scan: the kinds after it keep their first look, stopped at the time', () => {
    const l = look(KINDS, pools, budget).look;
    const g = longScan(l.looks, pools, budget, () => undefined);
    let r = g.next();
    while (r.done !== true && !r.value.phase.startsWith('screening concyclic')) r = g.next();
    const end = g.next('stop');
    if (end.done !== true) throw new Error('not stopped');
    expect(end.value.cmd).toBe('stop');
    const at = end.value.reports.findIndex((x) => x.kind === 'concyclic');
    expect(end.value.reports[at]?.stop).toBe('time');
    expect(end.value.reports.slice(at + 1)).toEqual(lookReports(l.looks.slice(at + 1)));
    expect(end.value.reports).toHaveLength(l.looks.length);
  });

  it('a count the first look cut is counted again by the long scan, even with nothing to screen', () => {
    const many = poolsOfDoc(thirtyPoints());
    const b: RoundsBudget = { candidatesPerKind: 50, countLimit: 2_000_000, firstLook: 50 };
    const l = look(only('conconic'), many, b).look;
    const first = l.looks[0];
    expect(first?.report).toMatchObject({ checked: 50, total: FIRST_COUNT, more: true });
    expect(first?.seen?.size).toBe(50);
    const long = steps(longScan(l.looks, many, b, () => undefined)).value;
    // C(30, 6) = 593,775 six-point tuples, none screened beyond the budget.
    expect(long.reports).toEqual([
      { kind: 'conconic', total: 593_775, more: false, exact: true, checked: 50, stop: 'budget' },
    ]);
    // With the count limit at FIRST_COUNT the first look's count is the full one: settled.
    const settledLook = look(only('conconic'), many, { ...b, countLimit: FIRST_COUNT }).look;
    expect(settledLook.looks[0]?.seen).toBeUndefined();
    expect(settledLook.looks[0]?.report.more).toBe(true);
  });
});

describe('scanKind with candidates seen before (ADR-0052)', () => {
  const pools = poolsOfDoc(triangle().doc);
  const kind = KINDS.get('collinear');
  if (kind === undefined) throw new Error('no collinear');
  const source = { candidatesPerKind: 200, countLimit: 100_000 };

  it('skips them, counts them as checked, and ends a step every BATCH candidates looked at', () => {
    const all: Candidate[] = [];
    steps(scanKind('find', kind, pools, { source, limit: 200, phase: 'p' }, (c) => all.push(c)));
    expect(all.length).toBeGreaterThan(30);
    const seen = new Set(all.slice(0, 9).map((c) => c.key));
    const visited: Candidate[] = [];
    const g = scanKind('find', kind, pools, { source, limit: 20, seen, phase: 'p' }, (c) =>
      visited.push(c),
    );
    // Visits between two yields: never more than BATCH.
    const between: number[] = [];
    const progress: DiscoveryProgress[] = [];
    let before = 0;
    let r = g.next();
    for (; r.done !== true; r = g.next()) {
      progress.push(r.value);
      between.push(visited.length - before);
      before = visited.length;
    }
    expect(BATCH).toBe(4);
    for (const p of progress) expect(p.phase).toBe('p');
    expect(visited.map((c) => c.key)).toEqual(all.slice(9, 20).map((c) => c.key));
    expect(r.value.report).toMatchObject({ checked: 20, stop: 'budget' });
    // The 9 seen are looked at BATCH at a time (two steps, then one with the 10th to 12th).
    const counts = progress.filter((p) => p.total > 0).map((p) => [p.done, p.total]);
    expect(counts).toEqual([
      [9, 20],
      [9, 20],
      [12, 20],
      [16, 20],
      [20, 20],
    ]);
    expect(Math.max(...between)).toBe(BATCH);
  });

  it('with every candidate seen, nothing is visited and nothing is over budget', () => {
    const all: Candidate[] = [];
    steps(scanKind('find', kind, pools, { source, limit: 200, phase: 'p' }, (c) => all.push(c)));
    const seen = new Set(all.map((c) => c.key));
    const visited: Candidate[] = [];
    const out = steps(
      scanKind('find', kind, pools, { source, limit: all.length, seen, phase: 'p' }, (c) =>
        visited.push(c),
      ),
    );
    expect(visited).toEqual([]);
    const report: KindReport = out.value.report;
    expect(report.checked).toBe(all.length);
    expect(report.stop).toBeUndefined();
  });
});

describe('two rounds of local tests as one (ADR-0052)', () => {
  const fact = (key: string) => ({ kind: 'collinear', args: [], key, objects: [] });
  const found = (key: string) =>
    ({ ...fact(key), rungs: 'r', exact: true }) as unknown as FoundFact;
  const unit = (key: string) => ({ ...fact(key), parts: [], construction: true }) as never;
  const a: Confirmed = {
    found: [found('f1')],
    unconfirmed: [{ fact: fact('u1'), verdict: 'false' }],
    tested: new Set(['f1', 'u1']),
    runs: 3,
    construction: [unit('c1')],
    retriesUntested: 1,
    unitOf: new Map([['f1', unit('f1')]]),
  };
  const b: Confirmed = {
    found: [found('f2')],
    unconfirmed: [
      { fact: fact('u1'), verdict: 'mixed' },
      { fact: fact('u2'), verdict: 'false' },
    ],
    tested: new Set(['f2', 'u2']),
    runs: 7,
    construction: [unit('c2')],
    retriesUntested: 2,
    unitOf: new Map([['f2', unit('f2')]]),
    cmd: 'stop',
  };

  it('keeps both rounds in order, counts runs once, lists an unconfirmed fact once', () => {
    const j = joined(a, b);
    expect(j.found.map((f) => f.key)).toEqual(['f1', 'f2']);
    expect(j.unconfirmed.map((u) => [u.fact.key, u.verdict])).toEqual([
      ['u1', 'false'],
      ['u2', 'false'],
    ]);
    expect([...j.tested]).toEqual(['f1', 'u1', 'f2', 'u2']);
    expect(j.runs).toBe(7);
    expect(j.construction.map((u) => u.key)).toEqual(['c1', 'c2']);
    expect(j.retriesUntested).toBe(3);
    expect([...j.unitOf.keys()]).toEqual(['f1', 'f2']);
    expect(j.cmd).toBe('stop');
    const done: Confirmed = { ...a, found: [], unconfirmed: [], runs: 4 };
    expect('cmd' in joined(a, done)).toBe(false);
    expect(joined(a, done).runs).toBe(4);
  });
});
