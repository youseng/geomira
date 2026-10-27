/**
 * The finder's ranking (ADR-0035 decision 12, as amended by ADR-0039), stable: in the
 * preliminary order (b) exact rungs before numeric, (c) tagged before untagged, (d) fewer distinct
 * objects (a group counted as one fact of its kind), (d′) a group standing for more facts before
 * one standing for fewer, (e) the
 * latest object involved later in the construction first, (f) the kind's registry order, then
 * the claim key; then (a) each fact in that order is SHOWN unless it follows from the
 * construction and the facts shown before it (any kind: the knowledge of derive.ts), in which
 * case it is hidden and listed under the fact whose showing made it follow.
 */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { Value } from '@geomira/kernel/value';
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import type { FactData } from './closure';
import type { Ticking } from './candidates';
import { knowledgeSteps, type Knowledge } from './derive';
import type { Terms } from './terms';
import type { Fact, FoundFact } from './types';

export interface RankEnv {
  readonly doc: Document;
  readonly registry: Registry;
  readonly kinds: ClaimKinds;
  readonly values: ReadonlyMap<number, Value<number>>;
  /** Construction order of the objects. */
  readonly order: ReadonlyMap<number, number>;
  /** The document's terms (collected once, by the find job's closure). */
  readonly terms?: Terms;
}

function cmp(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The preliminary order (b)–(f). */
export function preliminary(
  facts: readonly FoundFact[],
  kinds: ClaimKinds,
  order: ReadonlyMap<number, number>,
): FoundFact[] {
  const kindIndex = (k: string) => kinds.kinds.findIndex((x) => x.name === k);
  const latest = (f: FoundFact) => Math.max(-1, ...f.objects.map((id) => order.get(id) ?? -1));
  // A group counts as one fact of its kind: an n-ary group its kind's arity, a class its link.
  const arity = (k: string) => kinds.kinds.find((x) => x.name === k)?.params.length ?? Infinity;
  const size = (f: FoundFact) =>
    f.chain?.[0]?.objects.length ??
    ((f.standsFor ?? 1) > 1 ? Math.min(f.objects.length, arity(f.kind)) : f.objects.length);
  return [...facts].sort(
    (a, b) =>
      cmp(a.exact ? 0 : 1, b.exact ? 0 : 1) ||
      cmp(a.tag === undefined ? 1 : 0, b.tag === undefined ? 1 : 0) ||
      cmp(size(a), size(b)) ||
      cmp(b.standsFor ?? 1, a.standsFor ?? 1) ||
      cmp(latest(b), latest(a)) ||
      cmp(kindIndex(a.kind), kindIndex(b.kind)) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

type Chained = Fact & { readonly chain?: readonly Fact[] };

/** The claims a fact stands for: a class's links, else itself. */
export function claimsOf(f: Chained): readonly FactData[] {
  return f.chain ?? [f];
}

/** Whether every claim of the fact follows from the knowledge. */
export function follows(k: Knowledge, f: Chained): boolean {
  return claimsOf(f).every((x) => k.derives(x) !== undefined);
}

/**
 * The knowledge snapshots of a ranking: [0] the construction, [i] the construction and the
 * first i shown facts. `trigger` is the first snapshot a fact follows from (0: the construction
 * alone), found by bisection (following is monotone in the snapshots).
 */
export class Snapshots {
  constructor(readonly list: Knowledge[]) {}

  get last(): Knowledge {
    const k = this.list[this.list.length - 1];
    if (k === undefined) throw new Error('no knowledge');
    return k;
  }

  trigger(f: Chained): number | undefined {
    if (!follows(this.last, f)) return undefined;
    let lo = 0;
    let hi = this.list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const k = this.list[mid];
      if (k !== undefined && follows(k, f)) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }
}

export interface Ranked {
  readonly shown: FoundFact[];
  /** Confirmed facts that follow, each with the snapshot it follows from. */
  readonly hidden: { readonly fact: FoundFact; readonly at: number }[];
  readonly snapshots: Snapshots;
}

/**
 * The ranked facts (one knowledge per shown fact, in bounded steps). Once `stopped()` (the
 * host's time budget), the facts not yet checked are shown in the preliminary order.
 */
export function* rankFacts(
  facts: readonly FoundFact[],
  env: RankEnv,
  k0: Knowledge,
  stopped: () => boolean = () => false,
): Ticking<Ranked> {
  const pre = preliminary(facts, env.kinds, env.order);
  const shown: FoundFact[] = [];
  const hidden: { fact: FoundFact; at: number }[] = [];
  const snaps = new Snapshots([k0]);
  for (const f of pre) {
    const at = stopped() ? undefined : snaps.trigger(f);
    if (at !== undefined) {
      hidden.push({ fact: f, at });
      continue;
    }
    shown.push(f);
    if (stopped()) continue;
    const k = yield* knowledgeSteps(env.doc, env.registry, env.kinds, {
      // The facts hidden so far are known too (each follows from the facts shown before it).
      extra: [...shown, ...hidden.map((h) => h.fact)].flatMap((x) => claimsOf(x)),
      values: env.values,
      ...(env.terms === undefined ? {} : { terms: env.terms }),
    });
    snaps.list.push(k);
    yield undefined;
  }
  return { shown, hidden, snapshots: snaps };
}
