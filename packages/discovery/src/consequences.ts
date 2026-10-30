/**
 * Where each hidden fact is listed (ADR-0039): nothing hidden is lost. A fact that follows from
 * the construction alone goes to the construction facts; one that follows once a shown fact is
 * known is listed under that fact ("12 consequences of A, B, C, M concyclic"), with its rule and
 * its parents (that fact and the facts shown above it); a part of a shown group is listed under
 * the group. Each list keeps its count and its first CONSEQUENCES_SHOWN facts.
 */
import { asFact, type Confirmed } from './confirm';
import type { Unit } from './group';
import type { Ranked } from './rank';
import {
  CONSTRUCTION_SHOWN,
  type DeriveRule,
  type DiscoveryCommand,
  type DiscoveryProgress,
  type Fact,
  type FoundFact,
  type HiddenFact,
} from './types';

/** Untested units checked against the facts shown between two yields (find.ts's steps). */
const UNITS_PER_STEP = 16;

/** Consequences listed under each shown fact (the rest are counted). */
export const CONSEQUENCES_SHOWN = 100;

export class Listing {
  /** Consequences by the shown fact's index. */
  private readonly under = new Map<number, { count: number; shown: HiddenFact[] }>();
  private readonly seen = new Set<string>();
  constructionCount = 0;
  constructionGroups: Fact[] = [];

  constructor(
    readonly shown: readonly FoundFact[],
    readonly construction: Fact[],
  ) {}

  /** Lists `f`, which follows from snapshot `at` (0: the construction; i: the first i shown facts). */
  add(f: Fact, at: number, rule: DeriveRule): void {
    if (this.seen.has(f.key)) return;
    this.seen.add(f.key);
    if (at <= 0) {
      this.constructionCount++;
      if (this.construction.length < CONSTRUCTION_SHOWN) this.construction.push(f);
      return;
    }
    const parents = this.shown.slice(0, at).map((x) => x.key);
    const list = this.under.get(at - 1) ?? { count: 0, shown: [] };
    list.count++;
    if (list.shown.length < CONSEQUENCES_SHOWN)
      list.shown.push({
        kind: f.kind,
        args: f.args,
        key: f.key,
        objects: f.objects,
        rule,
        parents,
      });
    this.under.set(at - 1, list);
  }

  /** Every consequence listed under a shown fact. */
  get consequenceCount(): number {
    let n = 0;
    for (const l of this.under.values()) n += l.count;
    return n;
  }

  /** The shown facts with their consequences attached. */
  facts(): FoundFact[] {
    return this.shown.map((f, i) => {
      const l = this.under.get(i);
      return l === undefined ? f : { ...f, consequences: { count: l.count, shown: l.shown } };
    });
  }
}

/**
 * Lists every hidden fact under what it follows from (the Listing above): the confirmed facts the
 * ranking hid, the parts of shown groups, and the untested units that follow from the facts
 * shown; units that do not follow stay untested (counted).
 */
export function* listHidden(
  construction: Fact[],
  units: readonly Unit[],
  t: Confirmed,
  ranked: Ranked,
  halt: { stopped: boolean },
): Generator<
  DiscoveryProgress,
  { listing: Listing; untested: number } | 'cancel',
  DiscoveryCommand
> {
  const listing = new Listing(ranked.shown, construction);
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
    if (!halt.stopped && i % UNITS_PER_STEP === UNITS_PER_STEP - 1) {
      const cmd = yield {
        kind: 'progress',
        job: 'find',
        phase: 'listing consequences',
        done: i,
        total: units.length,
      };
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
