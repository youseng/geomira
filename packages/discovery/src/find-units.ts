/**
 * The find job's helpers for units (ADR-0039): when a determining subset is proper in the figure
 * (group.ts merges facts only through proper ones: two points apart, three points apart and not
 * on a line, two lines not parallel), and the lemma tag of a unit (a group carries the tag of
 * the first tagged fact it stands for: the tags match facts of their own size), and the
 * knowledge of the facts confirmed so far (a unit that follows from it is not tested).
 */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { Value } from '@geomira/kernel/value';
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import type { Closure, FactData } from './closure';
import type { Candidate, Pools } from './candidates';
import { asFact, type Known } from './confirm';
import { knowledgeSteps, type Knowledge } from './derive';
import type { GroupEnv, Unit } from './group';
import { claimsOf, follows } from './rank';
import { objectKey } from './terms';
import type { FoundFact, LemmaTag } from './types';

/** Parts of a group asked for a tag at most (the rest are not looked at). */
const TAGGED_PARTS = 8;

function notCollinear(c: Closure, a: string, b: string, d: string): boolean {
  const [pa, pb, pd] = [c.at(a), c.at(b), c.at(d)];
  if (pa === undefined || pb === undefined || pd === undefined) return false;
  const cross = (pa.x - pb.x) * (pd.y - pb.y) - (pa.y - pb.y) * (pd.x - pb.x);
  const size = Math.hypot(pa.x - pb.x, pa.y - pb.y) * Math.hypot(pd.x - pb.x, pd.y - pb.y);
  return size > 0 && Math.abs(cross) > c.band * Math.sqrt(size);
}

/** Points pairwise apart, no three of them collinear (ADR-0042: five of them determine a conic). */
function generalPosition(c: Closure, pts: readonly string[]): boolean {
  const apart = pts.every((x, i) => pts.slice(i + 1).every((y) => c.apart(x, y)));
  return (
    apart &&
    pts.every((x, i) =>
      pts.slice(i + 1).every((y, j) => pts.slice(i + j + 2).every((z) => notCollinear(c, x, y, z))),
    )
  );
}

function notParallel(p: Pools, band: number, l: number, m: number): boolean {
  const [a, b] = [p.values.get(l), p.values.get(m)];
  if (a?.kind !== 'line' || b?.kind !== 'line') return false;
  const cross = a.d.x * b.d.y - a.d.y * b.d.x;
  const size = Math.hypot(a.d.x, a.d.y) * Math.hypot(b.d.x, b.d.y);
  return size > 0 && Math.abs(cross) > (band / p.scale) * size;
}

/** The figure facts group.ts needs. */
export function groupEnv(c: Closure, p: Pools): GroupEnv {
  const k = objectKey;
  return {
    order: p.order,
    proper: (kind, ids) => {
      const [a, b, d] = ids;
      if (a === undefined || b === undefined) return false;
      if (kind === 'concurrent') return notParallel(p, c.band, a, b);
      if (kind === 'conconic') return generalPosition(c, ids.map(k));
      if (!c.apart(k(a), k(b))) return false;
      if (kind === 'collinear') return true;
      return (
        d !== undefined &&
        c.apart(k(a), k(d)) &&
        c.apart(k(b), k(d)) &&
        notCollinear(c, k(a), k(b), k(d))
      );
    },
    // Lines of one concurrent group through one point coincide when parallel.
    coincide: (kind, a, b) =>
      kind === 'concurrent' ? !notParallel(p, c.band, a, b) : !c.apart(k(a), k(b)),
  };
}

/** A unit's lemma tag: its own, else the first tagged part's. */
export function tagUnit(
  tagger: (f: FactData) => LemmaTag | undefined,
  u: Unit,
): LemmaTag | undefined {
  const own = tagger({ kind: u.kind.name, args: u.args });
  if (own !== undefined) return own;
  const parts: readonly Candidate[] = u.parts.slice(0, TAGGED_PARTS);
  for (const p of parts) {
    const t = tagger({ kind: p.kind.name, args: p.args });
    if (t !== undefined) return t;
  }
  return undefined;
}

/** Knowledge rebuilds while testing (beyond them units are tested without the check). */
const MAX_LEARNED = 12;

/** The knowledge of the construction and of the facts confirmed so far (confirm.ts). */
export class Learned implements Known {
  private readonly given: FactData[] = [];
  private rebuilds = 0;

  constructor(
    private knowledge: Knowledge,
    private readonly env: {
      readonly doc: Document;
      readonly registry: Registry;
      readonly kinds: ClaimKinds;
      readonly values: ReadonlyMap<number, Value<number>>;
    },
  ) {}

  follows(u: Unit): boolean {
    return follows(this.knowledge, {
      ...asFact(u),
      ...(u.chain === undefined ? {} : { chain: u.chain.map(asFact) }),
    });
  }

  *learn(f: FoundFact): Generator<undefined, void, unknown> {
    if (this.rebuilds >= MAX_LEARNED) return;
    this.rebuilds++;
    this.given.push(...claimsOf(f));
    this.knowledge = yield* knowledgeSteps(this.env.doc, this.env.registry, this.env.kinds, {
      extra: this.given,
      values: this.env.values,
      terms: this.knowledge.closure.terms,
    });
  }
}
