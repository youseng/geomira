/**
 * One fact per configuration (ADR-0039): the screen's true facts of a kind are merged into
 * maximal facts. Collinear points, concyclic points and concurrent lines merge when two facts
 * share a determining subset that is proper in the figure (two points apart, three points not
 * on a line, two lines not parallel): the largest set is ONE n-ary fact. Equal lengths and equal
 * angles (directed and undirected) merge into classes: ONE fact "AB = CD = EF", whose links to
 * the first member are the claims it stands for. Construction facts take part, so the group is
 * maximal; a group whose every member holds by construction is itself a construction fact.
 */
import type { ClaimKindSpec } from '@geomira/claims/kind';
import type { ScreenArg } from '@geomira/claims/screen';
import { fromInteger } from '@geomira/num/rational';
import { makeCandidate, type Candidate } from './candidates';
import { TICK, type Ticking } from './ticking';
import { UnionFind } from './uf';

/** A unit of the search: one candidate, or a group standing for several (its parts). */
export interface Unit extends Candidate {
  /** A class's links (first member = each other member): the claims it is tested and added as. */
  readonly chain?: readonly Candidate[];
  /** The member facts the group stands for (screen-true, not construction facts). */
  readonly parts: readonly Candidate[];
  /**
   * A class's claims to test: the parts that join it once its construction members are joined
   * (a spanning forest). With the construction members they give every link by transitivity.
   */
  readonly checks?: readonly Candidate[];
  /** Every member holds by construction. */
  readonly construction: boolean;
  /** A class's screen-true members, construction facts included (to rebuild it, confirm.ts). */
  readonly members?: readonly TrueFact[];
}

/** A screen-true fact, and whether it holds by construction. */
export interface TrueFact {
  readonly c: Candidate;
  readonly construction: boolean;
}

/** What the grouping needs to know of the figure. */
export interface GroupEnv {
  /** Construction order of the objects. */
  readonly order: ReadonlyMap<number, number>;
  /** Whether a determining subset is proper in the figure (see the module comment). */
  readonly proper: (kind: string, ids: readonly number[]) => boolean;
  /** Whether two objects of a group of this kind coincide in the figure (same point or line). */
  readonly coincide: (kind: string, a: number, b: number) => boolean;
}

/** n-ary kinds and the size of the subset that determines their line, circle or point. */
const DETERMINED: Readonly<Record<string, number>> = { collinear: 2, concyclic: 3, concurrent: 2 };

/** Class kinds and the literal a member must have (k = 1, n = 1) to be an equality. */
export const CLASS_KINDS: readonly string[] = ['length', 'dangle', 'angle_eq'];

/** Whether facts of this kind are grouped. */
export function grouped(kind: string): boolean {
  return DETERMINED[kind] !== undefined || CLASS_KINDS.includes(kind);
}

function ids(c: Candidate): number[] {
  return c.args.flatMap((a) => ('id' in a ? [a.id] : []));
}

function isOne(a: ScreenArg | undefined): boolean {
  return a !== undefined && 'lit' in a && a.lit.num === 1n && a.lit.den === 1n;
}

/** k-element subsets of `xs` (small: k ≤ 3, |xs| ≤ 4). */
function subsets(xs: readonly number[], k: number): number[][] {
  if (k === 0) return [[]];
  return xs.flatMap((x, i) => subsets(xs.slice(i + 1), k - 1).map((s) => [x, ...s]));
}

function pushTo<T>(m: Map<string, T[]>, k: string, x: T): void {
  const list = m.get(k);
  if (list === undefined) m.set(k, [x]);
  else list.push(x);
}

function byOrder(env: GroupEnv) {
  return (a: number, b: number) => (env.order.get(a) ?? 0) - (env.order.get(b) ?? 0);
}

function unit(
  c: Candidate,
  parts: readonly Candidate[],
  construction: boolean,
  chain?: {
    links: readonly Candidate[];
    checks: readonly Candidate[];
    members: readonly TrueFact[];
  },
): Unit {
  return chain === undefined
    ? { ...c, parts, construction }
    : {
        ...c,
        parts,
        construction,
        chain: chain.links,
        checks: chain.checks,
        members: chain.members,
      };
}

/** n-ary groups of one kind: components of facts sharing a proper determining subset. */
function* incidenceGroups(
  kind: ClaimKindSpec,
  facts: readonly TrueFact[],
  env: GroupEnv,
): Ticking<Unit[]> {
  const d = DETERMINED[kind.name] ?? 2;
  const uf = new UnionFind();
  for (const [i, f] of facts.entries()) {
    for (const s of subsets(
      ids(f.c).sort((a, b) => a - b),
      d,
    ))
      if (env.proper(kind.name, s)) uf.union(`f${String(i)}`, `s${s.join(',')}`);
    if (i % TICK === TICK - 1) yield undefined;
  }
  const comps = new Map<string, TrueFact[]>();
  facts.forEach((f, i) => {
    const r = uf.find(`f${String(i)}`);
    pushTo(comps, r, f);
  });
  const out: Unit[] = [];
  for (const members of comps.values()) out.push(...incidenceUnits(kind, members, env));
  return out;
}

/**
 * The units of one component: one group over objects that do not coincide in the figure (a
 * claim naming one line or point twice is degenerate); a member naming an object that coincides
 * with an earlier one stays a fact of its own.
 */
function incidenceUnits(kind: ClaimKindSpec, members: readonly TrueFact[], env: GroupEnv): Unit[] {
  const [only] = members;
  if (members.length === 1 && only !== undefined)
    return [unit(only.c, only.construction ? [] : [only.c], only.construction)];
  const kept: number[] = [];
  for (const id of [...new Set(members.flatMap((m) => ids(m.c)))].sort(byOrder(env)))
    if (!kept.some((k) => env.coincide(kind.name, k, id))) kept.push(id);
  const inGroup = members.filter((m) => ids(m.c).every((id) => kept.includes(id)));
  const apart = members
    .filter((m) => !inGroup.includes(m))
    .map((m) => unit(m.c, m.construction ? [] : [m.c], m.construction));
  const parts = inGroup.filter((m) => !m.construction).map((m) => m.c);
  const all = inGroup.every((m) => m.construction);
  const objs = [...new Set(inGroup.flatMap((m) => ids(m.c)))].sort(byOrder(env));
  const [first] = inGroup;
  if (inGroup.length === 1 && first !== undefined) return [unit(first.c, parts, all), ...apart];
  return [
    unit(
      makeCandidate(
        kind,
        objs.map((id) => ({ id })),
      ),
      parts,
      all,
    ),
    ...apart,
  ];
}

/** The two members of an equality fact as class nodes (point ids per angle or segment). */
function nodes(kind: string, c: Candidate): [number[], number[]] | undefined {
  const x = ids(c);
  if (kind === 'length') return isOne(c.args[4]) ? [x.slice(0, 2), x.slice(2, 4)] : undefined;
  if (kind === 'dangle') return isOne(c.args[0]) ? [x.slice(0, 3), x.slice(3, 6)] : undefined;
  return [x.slice(0, 3), x.slice(3, 6)];
}

/** A node's key: a segment and an undirected angle up to reversal; a directed angle as given. */
function nodeKey(kind: string, n: readonly number[]): string {
  if (kind === 'dangle') return n.join(',');
  const [a, b, c] = n;
  if (kind === 'length') return [a, b].sort((x, y) => (x ?? 0) - (y ?? 0)).join(',');
  return [Math.min(a ?? 0, c ?? 0), b, Math.max(a ?? 0, c ?? 0)].join(',');
}

/** The claim "first member = other member" of a class. */
function link(kind: ClaimKindSpec, a: readonly number[], b: readonly number[]): Candidate {
  const pts = (n: readonly number[]): ScreenArg[] => n.map((id) => ({ id }));
  const one: ScreenArg = { lit: fromInteger(1) };
  if (kind.name === 'length') return makeCandidate(kind, [...pts(a), ...pts(b), one]);
  if (kind.name === 'dangle') return makeCandidate(kind, [one, ...pts(a), ...pts(b)]);
  return makeCandidate(kind, [...pts(a), ...pts(b)]);
}

/** The members that join their class once the construction members are joined (Kruskal). */
function* spanning(
  members: readonly { f: TrueFact; pairs: readonly [string, string][] }[],
): Ticking<Set<TrueFact>> {
  const uf = new UnionFind();
  const out = new Set<TrueFact>();
  const ordered = [
    ...members.filter((m) => m.f.construction),
    ...members.filter((m) => !m.f.construction),
  ];
  for (const [i, m] of ordered.entries()) {
    const joins = m.pairs.some(([x, y]) => uf.find(x) !== uf.find(y));
    for (const [x, y] of m.pairs) uf.union(x, y);
    if (joins && !m.f.construction) out.add(m.f);
    if (i % TICK === TICK - 1) yield undefined;
  }
  return out;
}

/** Classes of one equality kind: components of equal nodes (a directed angle's reverse too). */
function* classGroups(
  kind: ClaimKindSpec,
  facts: readonly TrueFact[],
  env: GroupEnv,
): Ticking<Unit[]> {
  const uf = new UnionFind();
  const nodeOf = new Map<string, number[]>();
  const plain: Unit[] = [];
  const members: { f: TrueFact; a: string; pairs: [string, string][] }[] = [];
  for (const [i, f] of facts.entries()) {
    if (i % TICK === TICK - 1) yield undefined;
    const ns = nodes(kind.name, f.c);
    if (ns === undefined) {
      plain.push(unit(f.c, f.construction ? [] : [f.c], f.construction));
      continue;
    }
    const [a, b] = ns;
    const [ka, kb] = [nodeKey(kind.name, a), nodeKey(kind.name, b)];
    nodeOf.set(ka, a);
    nodeOf.set(kb, b);
    const pairs: [string, string][] = [[ka, kb]];
    // ∡ABC = ∡DEF gives ∡CBA = ∡FED: the reversed class mirrors this one, and a member counts
    // in whichever of the two has the smaller root, so a class is never shown twice.
    if (kind.name === 'dangle') {
      const [ra, rb] = [[...a].reverse(), [...b].reverse()];
      nodeOf.set(nodeKey(kind.name, ra), ra);
      nodeOf.set(nodeKey(kind.name, rb), rb);
      pairs.push([nodeKey(kind.name, ra), nodeKey(kind.name, rb)]);
    }
    for (const [x, y] of pairs) uf.union(x, y);
    members.push({ f, a: ka, pairs });
  }
  const rootOf = (k: string): string => {
    const r = uf.find(k);
    if (kind.name !== 'dangle') return r;
    const mirror = uf.find(nodeKey(kind.name, [...(nodeOf.get(k) ?? [])].reverse()));
    return mirror < r ? mirror : r;
  };
  const comps = new Map<string, TrueFact[]>();
  for (const m of members) pushTo(comps, rootOf(m.a), m.f);
  yield undefined;
  const checks = yield* spanning(members);
  const out: Unit[] = [...plain];
  const byRoot = new Map<string, number[][]>();
  for (const [k, n] of nodeOf) pushTo(byRoot, uf.find(k), n);
  yield undefined;
  for (const [root, fs] of comps) {
    const u = classUnit(kind, env, byRoot.get(root) ?? [], fs, checks);
    if (u !== undefined) out.push(u);
    if (out.length % TICK === 0) yield undefined;
  }
  return out;
}

/** One class from its nodes and members: links from its first node to every other one. */
function classUnit(
  kind: ClaimKindSpec,
  env: GroupEnv,
  nodeList: readonly number[][],
  fs: readonly TrueFact[],
  checks: ReadonlySet<TrueFact>,
): Unit | undefined {
  const parts = fs.filter((m) => !m.construction).map((m) => m.c);
  const all = fs.every((m) => m.construction);
  const [only] = fs;
  if (fs.length === 1 && only !== undefined) return unit(only.c, parts, all);
  const order = (n: readonly number[]) => Math.max(...n.map((id) => env.order.get(id) ?? 0));
  const ns = [...nodeList].sort(
    (x, y) => order(x) - order(y) || nodeKey(kind.name, x).localeCompare(nodeKey(kind.name, y)),
  );
  const [first, ...rest] = ns;
  if (first === undefined) return undefined;
  const links = rest.map((n) => link(kind, first, n));
  const [head] = links;
  if (head === undefined) return undefined;
  const objects = [...new Set(ns.flat())].sort(byOrder(env));
  const tested = fs.filter((m) => checks.has(m)).map((m) => m.c);
  // No check left: the construction members join the class (its parts follow by transitivity).
  const byConstruction = all || tested.length === 0;
  return unit({ ...head, key: `class:${head.key}`, objects }, parts, byConstruction, {
    links,
    checks: tested,
    members: fs,
  });
}

/** The units of one grouped kind from its screen-true facts. */
export function* groupKind(
  kind: ClaimKindSpec,
  facts: readonly TrueFact[],
  env: GroupEnv,
): Ticking<Unit[]> {
  if (facts.length === 0) return [];
  return CLASS_KINDS.includes(kind.name)
    ? yield* classGroups(kind, facts, env)
    : yield* incidenceGroups(kind, facts, env);
}
