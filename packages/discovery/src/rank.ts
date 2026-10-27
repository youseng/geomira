/**
 * The finder's ranking (ADR-0035 decision 12), stable: (a) facts that do not follow from
 * higher-ranked reported facts of the same kind before those that do (kept, marked "follows
 * from …": the closure re-run with those facts given); then, in the preliminary order:
 * (b) exact rungs before numeric, (c) tagged before untagged, (d) fewer distinct objects,
 * (e) the latest object involved later in the construction first, (f) the kind's registry
 * order, then the claim key.
 */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { Value } from '@geomira/kernel/value';
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import type { Ticking } from './candidates';
import { closureSteps } from './closure';
import type { Terms } from './terms';
import type { FoundFact } from './types';

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
  return [...facts].sort(
    (a, b) =>
      cmp(a.exact ? 0 : 1, b.exact ? 0 : 1) ||
      cmp(a.tag === undefined ? 1 : 0, b.tag === undefined ? 1 : 0) ||
      cmp(a.objects.length, b.objects.length) ||
      cmp(latest(b), latest(a)) ||
      cmp(kindIndex(a.kind), kindIndex(b.kind)) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

/**
 * The ranked facts (one closure per fact, in bounded steps). Once `stopped()` (the host's time
 * budget), the facts not yet checked keep the preliminary order, unmarked.
 */
export function* rankFacts(
  facts: readonly FoundFact[],
  env: RankEnv,
  stopped: () => boolean = () => false,
): Ticking<FoundFact[]> {
  const pre = preliminary(facts, env.kinds, env.order);
  const accepted: FoundFact[] = [];
  const out: FoundFact[] = [];
  for (const f of pre) {
    const same = accepted.filter((a) => a.kind === f.kind);
    let follows: string[] = [];
    if (same.length > 0 && !stopped()) {
      const c = yield* closureSteps(env.doc, env.registry, env.kinds, {
        extra: same,
        values: env.values,
        ...(env.terms === undefined ? {} : { terms: env.terms }),
      });
      if (c.isConstruction(f)) follows = same.map((a) => a.key);
      yield undefined;
    }
    if (follows.length === 0) accepted.push(f);
    out.push(follows.length === 0 ? f : { ...f, follows });
  }
  return [
    ...out.filter((f) => f.follows === undefined),
    ...out.filter((f) => f.follows !== undefined),
  ];
}
