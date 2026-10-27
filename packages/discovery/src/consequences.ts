/**
 * Where each hidden fact is listed (ADR-0039): nothing hidden is lost. A fact that follows from
 * the construction alone goes to the construction facts; one that follows once a shown fact is
 * known is listed under that fact ("12 consequences of A, B, C, M concyclic"), with its rule and
 * its parents (that fact and the facts shown above it); a part of a shown group is listed under
 * the group. Each list keeps its count and its first CONSEQUENCES_SHOWN facts.
 */
import {
  CONSTRUCTION_SHOWN,
  type DeriveRule,
  type Fact,
  type FoundFact,
  type HiddenFact,
} from './types';

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
