/**
 * ADR-0052: the find job's budget is fair to every claim kind. Run 16c's known bug: on a
 * 150-object figure with conics "What is special?" found 0 facts in its 20 s, because the job
 * screened every kind to its full budget before it tested anything, and the host's time budget
 * (`stop`) ran out in the last, long scan (conconic). Here the same figure in small (the
 * corpus's base figure, the maintainer's two conics and their fourth common point) with a
 * deterministic stop: the host's `stop` is sent while the job screens conconic beyond its first
 * look, not after a wall-clock time. The first look (the first `firstLook` candidates of every
 * searched kind) is screened and its facts are tested before any long scan.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import type { Document } from '@geomira/kernel/document';
import { baseFigure } from '../../claims/test/helpers/corpus';
import { Figure, type Sel } from '../../claims/test/helpers/build';
import { runFind } from '../src/find';
import type {
  DiscoveryCommand,
  DiscoveryProgress,
  FindBudget,
  FindJob,
  FindResult,
} from '../src/types';
import { REGISTRY } from './helpers';

const KINDS = claimKindRegistry();
const SEARCHED = KINDS.kinds.filter((k) => k.finder?.notSearched === undefined).map((k) => k.name);

/** The find jobs here run for seconds. */
const SLOW = { timeout: 120_000 };

/** other(A, B, C): the fourth common point of two conics through A, B, C (ADR-0043). */
const otherABC: Sel = {
  sel: (f) => ({ kind: 'other', p: f.expr('A'), rest: [f.expr('B'), f.expr('C')] }),
};

/** The base figure, kk = conic(A, B, C, D, E), mm = conic(A, B, C, D, F), X their fourth point. */
function conicsFigure(): Figure {
  return baseFigure()
    .def('kk', 'conic', 'A', 'B', 'C', 'D', 'E')
    .def('mm', 'conic', 'A', 'B', 'C', 'D', 'F')
    .def('X', 'intersect', 'kk', 'mm', otherABC);
}

const BUDGET: Partial<FindBudget> = { n: 10, tests: 8, candidatesPerKind: 400, firstLook: 20 };

interface Run {
  readonly result: FindResult;
  readonly phases: readonly DiscoveryProgress[];
}

/** Runs a find job; `stopAt` says at which progress the host sends `stop` (none: never). */
function run(
  doc: Document,
  budget: Partial<FindBudget>,
  stopAt: (p: DiscoveryProgress) => boolean = () => false,
): Run {
  const job: FindJob = { kind: 'find', doc, seed: 3, budget };
  const it = runFind(job, { registry: REGISTRY });
  const phases: DiscoveryProgress[] = [];
  let stopped = false;
  for (let r = it.next(); ;) {
    if (r.done === true) {
      if (r.value.kind !== 'found') throw new Error(JSON.stringify(r.value));
      return { result: r.value, phases };
    }
    phases.push(r.value);
    const cmd: DiscoveryCommand = !stopped && stopAt(r.value) ? 'stop' : undefined;
    stopped ||= cmd === 'stop';
    r = it.next(cmd);
  }
}

const isTesting = (p: DiscoveryProgress) => p.phase.startsWith('testing');
const screening = (kind: string) => (p: DiscoveryProgress) =>
  p.phase === `screening ${kind}` || p.phase.startsWith(`screening ${kind} `);

describe('the first look before the long scans (ADR-0052)', SLOW, () => {
  const doc = conicsFigure().doc;

  it('a stop during the conconic scan ends with the first look tested, not with nothing', () => {
    const { result } = run(
      doc,
      BUDGET,
      (p) => screening('conconic')(p) && p.done >= 2 * (BUDGET.firstLook ?? 0),
    );
    expect(result.stopped).toBe(true);
    expect(result.facts.length).toBeGreaterThan(0);
    for (const f of result.facts) expect(f.verdict.kind).toBe('holds');
    // Every searched kind with candidates was screened, and says how far.
    expect(result.kinds.map((k) => k.kind)).toEqual(SEARCHED);
    for (const k of result.kinds) if (k.total > 0) expect(k.checked, k.kind).toBeGreaterThan(0);
    const conconic = result.kinds.find((k) => k.kind === 'conconic');
    expect(conconic?.stop).toBe('time');
    expect(result.caps.some((c) => /conconic candidates: time budget$/u.test(c))).toBe(true);
    expect(result.caps).toContain('stopped at the time budget');
  });

  it('every searched kind is screened and the first facts tested before any long scan', () => {
    const { result, phases } = run(doc, BUDGET);
    const first = phases.findIndex(isTesting);
    expect(first).toBeGreaterThan(0);
    // A kind without candidates (no lines here: concurrent, parallel, …) has no step.
    const some = result.kinds.filter((k) => k.total > 0).map((k) => k.kind);
    expect(some).toContain('conconic');
    expect(some.length).toBeGreaterThan(8);
    for (const kind of some) expect(phases.slice(0, first).some(screening(kind)), kind).toBe(true);
    // The long scans come after the first tests; no screen of the first look checks more.
    expect(phases.slice(first).some((p) => p.phase.startsWith('screening'))).toBe(true);
    for (const p of phases.slice(0, first))
      if (p.phase.startsWith('screening')) expect(p.done).toBeLessThanOrEqual(20);
  });
});

/** The local test runs a run's progress numbered ("testing 5 of 8" → 5), in order. */
const runsOf = (phases: readonly DiscoveryProgress[]) => [
  ...new Set(phases.filter(isTesting).map((p) => p.done + 1)),
];

const isLong = (p: DiscoveryProgress) => / beyond the first [\d,]+$/u.test(p.phase);

describe('the two rounds (ADR-0052)', SLOW, () => {
  const doc = conicsFigure().doc;
  const two = run(doc, BUDGET);
  // firstLook = candidatesPerKind: the first look settles every kind, one round as before.
  const one = run(doc, { ...BUDGET, firstLook: 400 });

  it('screen as many candidates of each kind as one scan to the full budget, same reports', () => {
    // A measure kind cut at its budget says so after a long scan; one scan's list ends there
    // silently (its count of matches is not over the count limit).
    const measured = (k: string) => KINDS.get(k)?.finder?.measure !== undefined;
    const without = (r: FindResult) =>
      r.kinds.map(({ stop, ...k }) => (measured(k.kind) ? k : { ...k, stop }));
    expect(without(two.result)).toEqual(without(one.result));
    for (const k of two.result.kinds)
      if (measured(k.kind) && k.stop === 'budget') expect(k.checked).toBe(400);
    expect(two.result.notSearched).toEqual(one.result.notSearched);
    expect(two.result.stopped).toBe(false);
  });

  it('a kind the first look covers has no long scan; a larger one goes on from its first look', () => {
    const long = new Set(two.phases.filter(isLong).map((p) => p.phase.split(' ')[1]));
    for (const k of two.result.kinds) {
      expect(long.has(k.kind), k.kind).toBe(k.checked > 20);
      if (k.checked > 20)
        expect(two.phases.some((p) => p.phase === `screening ${k.kind} beyond the first 20`)).toBe(
          true,
        );
    }
    expect(long.size).toBeGreaterThan(3);
    // The long scan starts its count where the first look ended.
    const firstLong = two.phases.find(isLong);
    expect(firstLong?.done).toBe(20);
    expect(one.phases.some(isLong)).toBe(false);
  });

  it('the first round runs half the test budget, rounded up; the second the rest, numbered on', () => {
    const at = two.phases.findIndex(isLong);
    const before = runsOf(two.phases.slice(0, at));
    const after = runsOf(two.phases.slice(at));
    expect(before.length).toBeGreaterThan(0);
    expect(Math.max(...before)).toBeLessThanOrEqual(4);
    expect(Math.min(...after)).toBe(Math.max(...before) + 1);
    expect(Math.max(...after)).toBeLessThanOrEqual(8);
    expect(two.result.testsRun).toBe(Math.max(...after));
    // One round may use the whole budget at once.
    const all = runsOf(one.phases);
    expect(Math.max(...all)).toBeGreaterThan(4);
    expect(one.result.testsRun).toBe(Math.max(...all));
  });

  it('reports each fact once: no confirmed fact twice, none both confirmed and unconfirmed', () => {
    const keys = two.result.facts.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    const bad = two.result.unconfirmed.map((u) => u.fact.key);
    expect(new Set(bad).size).toBe(bad.length);
    for (const k of keys) expect(bad).not.toContain(k);
    expect(two.result.facts.length).toBeGreaterThan(0);
  });

  it('lists a construction group once, though both groupings find it', () => {
    // B, C, M, N collinear by construction: a group of four, in collinear's first look.
    const f = new Figure().point('B', -3, 0).point('C', 4, 1);
    f.def('M', 'midpoint', 'B', 'C').def('N', 'midpoint', 'B', 'M');
    for (const [i, [x, y]] of [
      [1, 5],
      [6, 6],
      [-2, 4],
      [2, -3],
      [0, 7],
      [5, -2],
      [-4, -3],
      [3, 3],
    ].entries())
      f.point(`P_${String(i)}`, x ?? 0, y ?? 0);
    // Every kind's candidates fit the budget: both runs screen the same candidates.
    const r = run(f.doc, { ...BUDGET, candidatesPerKind: 100_000 });
    expect(r.phases.some(isLong)).toBe(true);
    const shown = r.result.construction.shown.map((x) => x.key);
    const four = shown.filter((k) => k.startsWith('collinear(') && k.split('|').length === 4);
    expect(four).toHaveLength(1);
    // No more repeats than one round lists (BM = CM is listed as a fact and as a class there).
    const one = run(f.doc, { ...BUDGET, candidatesPerKind: 100_000, firstLook: 100_000 });
    expect(r.result.kinds).toEqual(one.result.kinds);
    const keys = one.result.construction.shown.map((x) => x.key);
    const repeats = (ks: readonly string[]) => ks.filter((k, i) => ks.indexOf(k) !== i);
    expect(repeats(shown)).toEqual(repeats(keys));
    // The construction facts are counted once (the groups of the last grouping only).
    expect(r.result.construction.count).toBe(one.result.construction.count);
  });

  it('is deterministic for a seed', () => {
    const again = run(doc, BUDGET);
    expect(again.result.facts.map((f) => f.key)).toEqual(two.result.facts.map((f) => f.key));
    expect(again.phases).toEqual(two.phases);
  });
});

describe('the first look covers the oldest and the newest objects (ADR-0052)', SLOW, () => {
  const f = conicsFigure();

  it('X = D (the newest point) is found and tested before any long scan', () => {
    // Two conics through A, B, C, D: their fourth common point other(A, B, C) is D. The pair
    // (D, X) is among the last of equal's 91 candidates in construction order.
    const { result, phases } = run(f.doc, BUDGET, (p) => isLong(p));
    expect(phases.some(isLong)).toBe(true);
    expect(result.stopped).toBe(true);
    const dx = result.facts.find(
      (x) => x.kind === 'equal' && [f.id('D'), f.id('X')].every((id) => x.objects.includes(id)),
    );
    expect(dx?.verdict.kind).toBe('holds');
  });

  it('half the first look from each end: the first screens of a kind name early objects', () => {
    const { phases } = run(f.doc, BUDGET);
    expect(phases.some((p) => p.phase === 'screening equal from the newest objects')).toBe(true);
    const first = phases.findIndex(isTesting);
    expect(first).toBeGreaterThan(0);
    for (const p of phases.slice(0, first)) expect(isLong(p)).toBe(false);
  });
});

describe('a stop or a cancel at each point of the two rounds (ADR-0052)', SLOW, () => {
  const doc = conicsFigure().doc;
  const nth =
    (n: number, f: (p: DiscoveryProgress) => boolean): ((p: DiscoveryProgress) => boolean) =>
    (p) =>
      f(p) && --n === 0;
  /** The second grouping: a "grouping facts" step after the long scan. */
  const regrouping = (): ((p: DiscoveryProgress) => boolean) => {
    let long = false;
    return (p) => {
      long ||= isLong(p);
      return long && p.phase === 'grouping facts';
    };
  };

  it('in the first round: the kinds left to the long scan stopped at the time, the rest did not', () => {
    const { result, phases } = run(doc, BUDGET, nth(3, isTesting));
    expect(phases.some(isLong)).toBe(false);
    expect(result.stopped).toBe(true);
    for (const k of result.kinds)
      if (k.checked >= 20 && k.total > 20) expect(k.stop, k.kind).toBe('time');
      else expect(k.stop, k.kind).toBeUndefined();
    expect(result.kinds.some((k) => k.stop === 'time')).toBe(true);
  });

  it('in the long scan: kinds scanned keep their reports, kinds not reached their first look', () => {
    const { result } = run(doc, BUDGET, nth(1, isLong));
    const [cut, ...rest] = result.kinds.filter((k) => k.stop === 'time');
    expect(cut?.checked).toBe(20);
    expect(rest.length).toBeGreaterThan(0);
    for (const k of rest) expect(k.checked, k.kind).toBe(20);
    expect(result.facts.length).toBeGreaterThan(0);
  });

  it('while grouping the second time: the first round is the result, every kind fully screened', () => {
    const { result, phases } = run(doc, BUDGET, regrouping());
    expect(phases.some(isLong)).toBe(true);
    expect(result.stopped).toBe(true);
    expect(result.kinds.every((k) => k.stop !== 'time')).toBe(true);
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.testsRun ?? 0).toBeLessThanOrEqual(4);
  });

  it('cancel ends with nothing at every point', () => {
    const points: ((p: DiscoveryProgress) => boolean)[] = [
      nth(1, isTesting),
      nth(1, isLong),
      regrouping(),
      nth(6, isTesting),
    ];
    for (const at of points) {
      const it = runFind({ kind: 'find', doc, seed: 3, budget: BUDGET }, { registry: REGISTRY });
      let r = it.next();
      while (r.done !== true && !at(r.value)) r = it.next();
      expect(r.done).toBe(false);
      expect(it.next('cancel')).toEqual({ done: true, value: { kind: 'cancelled' } });
    }
  });
});
