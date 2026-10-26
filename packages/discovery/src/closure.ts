/**
 * The closure of the construction facts (ADR-0035 decision 7, second half): from the recorded
 * instances (terms.ts), to a fixpoint, point classes (equal), line classes (lines and
 * collinear triples, merged when they share two distinct points), circle classes (merged when
 * they share three) with their centres, parallel classes (two lines perpendicular to one line
 * are parallel), perpendicular pairs, tangent pairs and equal-length classes of segments
 * (AB = CD with k = 1, and the radii of each circle through its centre). `isConstruction`
 * says whether a candidate fact follows; the rules only follow declared definitions, so a
 * trivial fact may pass but a non-trivial one is never hidden.
 */
import { FloatField } from '@geomira/num/float-field';
import { formatRational } from '@geomira/num/rational';
import { bandThreshold } from '@geomira/num/tolerance';
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import type { Value } from '@geomira/kernel/value';
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import type { ScreenArg } from '@geomira/claims/screen';
import { claimKey, type KeyArg } from '@geomira/claims/symmetry';
import { collectTerms, objectKey, type Instance, type Terms } from './terms';
import { UnionFind } from './uf';
import type { ClosureView } from './closure-view';
import { constructionRule } from './rules';

/** A fact about the figure's objects (a candidate, or a reported finding). */
export interface FactData {
  readonly kind: string;
  readonly args: readonly ScreenArg[];
}

type Sets = Map<string, Set<string>>;

export class Closure implements ClosureView {
  readonly points = new UnionFind();
  readonly lines = new UnionFind();
  readonly circles = new UnionFind();
  readonly parallels = new UnionFind();
  readonly lengths = new UnionFind();
  /** Line class → its points (point classes). */
  lineSets: Sets = new Map();
  circleSets: Sets = new Map();
  /** Circle class → its centre's point class. */
  readonly centerOf = new Map<string, string>();
  /** Parallel class → the parallel classes perpendicular to it. */
  readonly perps = new Map<string, Set<string>>();
  readonly tangents = new Set<string>();
  /** k ≠ 1 length facts: `seg|seg|k`. */
  readonly ratios = new Set<string>();
  /** Canonical keys of every instance (the generic rule). */
  readonly generic = new Set<string>();

  constructor(
    readonly terms: Terms,
    readonly kinds: ClaimKinds,
  ) {}

  isLine(k: string): boolean {
    const t = this.terms.terms.get(k)?.kinds;
    return t !== undefined && t.length > 0 && t.every((x) => x === 'line');
  }

  isCircle(k: string): boolean {
    const t = this.terms.terms.get(k)?.kinds;
    return t !== undefined && t.length > 0 && t.every((x) => x === 'circle');
  }

  /** The class of a term key as an argument of a claim: its point, line or circle class. */
  classOf(k: string): string {
    if (this.isLine(k)) return `L${this.lines.find(k)}`;
    if (this.isCircle(k)) return `C${this.circles.find(k)}`;
    return `P${this.points.find(k)}`;
  }

  segment(a: string, b: string): string {
    const [x, y] = [this.points.find(a), this.points.find(b)].sort();
    return `${x ?? ''}|${y ?? ''}`;
  }

  /** The line class through two distinct point classes, if the closure knows one. */
  lineThrough(a: string, b: string): string | undefined {
    const [pa, pb] = [this.points.find(a), this.points.find(b)];
    if (pa === pb) return undefined;
    for (const [l, s] of this.lineSets) if (s.has(pa) && s.has(pb)) return l;
    return undefined;
  }

  parallelClass(lineClass: string): string {
    return this.parallels.find(lineClass);
  }

  /** Whether `kind`(args) follows from the construction (ADR-0035 decision 7). */
  isConstruction(fact: FactData): boolean {
    const spec = this.kinds.get(fact.kind);
    if (spec === undefined) return false;
    const keys = fact.args.map((a) => ('id' in a ? objectKey(a.id) : undefined));
    const generic: KeyArg[] = fact.args.map((a, i) => {
      const k = keys[i];
      return 'lit' in a ? { lit: a.lit } : { key: k === undefined ? '' : this.classOf(k) };
    });
    if (this.generic.has(claimKey(spec, generic))) return true;
    return constructionRule(this, fact.kind, keys, fact.args);
  }
}

function addTo(sets: Sets, k: string, member: string): void {
  const s = sets.get(k) ?? new Set<string>();
  s.add(member);
  sets.set(k, s);
}

/** Line and circle sets from the incidence instances (on, collinear, concyclic). */
function incidences(c: Closure, inst: readonly Instance[]): { lines: Sets; circles: Sets } {
  const lines: Sets = new Map();
  const circles: Sets = new Map();
  inst.forEach((x, i) => {
    const [p, q] = x.args;
    if (x.claim === 'on' && p !== undefined && q !== undefined) {
      if (c.isLine(q)) addTo(lines, q, p);
      else if (c.isCircle(q)) addTo(circles, q, p);
    }
    if (x.claim === 'collinear') for (const a of x.args) addTo(lines, `~col${String(i)}`, a);
    if (x.claim === 'concyclic') for (const a of x.args) addTo(circles, `~cyc${String(i)}`, a);
  });
  return { lines, circles };
}

/** Whether `need` of the shared points are pairwise apart in the figure (brute force: sets are small). */
function apartAmong(
  shared: readonly string[],
  need: number,
  apart: (a: string, b: string) => boolean,
): boolean {
  if (need === 2) return shared.some((p, i) => shared.slice(i + 1).some((q) => apart(p, q)));
  return shared.some((p, i) =>
    shared
      .slice(i + 1)
      .some(
        (q, j) => apart(p, q) && shared.slice(i + j + 2).some((r) => apart(p, r) && apart(q, r)),
      ),
  );
}

/**
 * One merging pass: two classes sharing `need` points that are pairwise APART in the current
 * figure are one (two lines through two distinct points, two circles through three). Points
 * that are only known as different terms may coincide (the medians' intersection is G), so
 * the figure decides distinctness; a merge then holds wherever those points stay apart.
 */
function merge(
  uf: UnionFind,
  raw: Sets,
  points: UnionFind,
  need: number,
  apart: (a: string, b: string) => boolean,
): { sets: Sets; changed: boolean } {
  const sets: Sets = new Map();
  for (const [k, s] of raw) for (const p of s) addTo(sets, uf.find(k), points.find(p));
  let changed = false;
  const keys = [...sets.keys()];
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const [a, b] = [sets.get(keys[i] ?? ''), sets.get(keys[j] ?? '')];
      if (a === undefined || b === undefined) continue;
      const shared = [...a].filter((p) => b.has(p));
      if (
        shared.length >= need &&
        apartAmong(shared, need, apart) &&
        uf.union(keys[i] ?? '', keys[j] ?? '')
      )
        changed = true;
    }
  return { sets, changed };
}

/** Lines of one parallel class through one point are one line; returns whether any merged. */
function parallelsThroughOne(c: Closure): boolean {
  const byClass = new Map<string, string[]>();
  for (const l of c.lineSets.keys()) {
    const p = c.parallelClass(l);
    byClass.set(p, [...(byClass.get(p) ?? []), l]);
  }
  let changed = false;
  for (const ls of byClass.values())
    for (let i = 0; i < ls.length; i++)
      for (let j = i + 1; j < ls.length; j++) {
        const [a, b] = [c.lineSets.get(ls[i] ?? ''), c.lineSets.get(ls[j] ?? '')];
        if (a !== undefined && b !== undefined && [...a].some((p) => b.has(p)))
          if (c.lines.union(ls[i] ?? '', ls[j] ?? '')) changed = true;
      }
  return changed;
}

function relate(c: Closure, inst: readonly Instance[]): void {
  for (const x of inst) {
    const [a, b, p, q, k] = x.args;
    if (a === undefined || b === undefined) continue;
    if (x.claim === 'parallel' && c.isLine(a) && c.isLine(b))
      c.parallels.union(c.lines.find(a), c.lines.find(b));
    if (x.claim === 'tangent') c.tangents.add([c.classOf(a), c.classOf(b)].sort().join('&'));
    if (x.claim === 'length' && p !== undefined && q !== undefined) {
      if (k === 'q1') c.lengths.union(c.segment(a, b), c.segment(p, q));
      else if (k !== undefined) c.ratios.add(`${c.segment(a, b)}&${c.segment(p, q)}&${k}`);
    }
  }
  // Perpendicular pairs, then: lines perpendicular to one line are parallel (to a fixpoint).
  for (let changed = true; changed;) {
    changed = false;
    c.perps.clear();
    for (const x of inst) {
      const [a, b] = x.args;
      if (x.claim !== 'perpendicular' || a === undefined || b === undefined) continue;
      if (!c.isLine(a) || !c.isLine(b)) continue;
      const [pa, pb] = [c.parallelClass(c.lines.find(a)), c.parallelClass(c.lines.find(b))];
      addTo(c.perps, pa, pb);
      addTo(c.perps, pb, pa);
    }
    for (const partners of c.perps.values()) {
      const [first, ...rest] = [...partners];
      for (const r of rest) if (first !== undefined && c.parallels.union(first, r)) changed = true;
    }
  }
}

/** Radii: every point of a circle with a known centre is at one distance from it. */
function radii(c: Closure): void {
  for (const [circle, pts] of c.circleSets) {
    const o = c.centerOf.get(circle);
    if (o === undefined) continue;
    const [first, ...rest] = [...pts];
    if (first === undefined) continue;
    for (const p of rest) c.lengths.union(c.segment(o, first), c.segment(o, p));
  }
}

export interface ClosureOptions {
  /** Facts taken as given (the ranking asks whether a finding follows from those above it). */
  readonly extra?: readonly FactData[];
  /** The figure's float values (default: evaluated here); they decide which points are apart. */
  readonly values?: ReadonlyMap<number, Value<number>>;
}

/** Merges lines and circles, ties centres, relates lines, to a fixpoint (see buildClosure). */
function fixpoint(
  c: Closure,
  raw: { lines: Sets; circles: Sets },
  inst: readonly Instance[],
  index: () => void,
  apart: (a: string, b: string) => boolean,
): void {
  for (let outer = true; outer;) {
    for (let changed = true; changed;) {
      index();
      const l = merge(c.lines, raw.lines, c.points, 2, apart);
      const k = merge(c.circles, raw.circles, c.points, 3, apart);
      c.lineSets = l.sets;
      c.circleSets = k.sets;
      // One circle has one centre: the centres of merged circles are one point.
      c.centerOf.clear();
      let centred = false;
      for (const [circle, center] of c.terms.centers) {
        const cls = c.circles.find(circle);
        const known = c.centerOf.get(cls);
        if (known === undefined) c.centerOf.set(cls, c.points.find(center));
        else if (c.points.union(known, center)) centred = true;
      }
      changed = l.changed || k.changed || centred;
    }
    relate(c, inst);
    outer = parallelsThroughOne(c);
  }
}

/** The current figure's points by object key, and the band they must be apart by. */
function positions(doc: Document, registry: Registry, given: ClosureOptions['values']) {
  const ctx = evalContextFor(doc);
  const values =
    given ??
    (ctx.ok
      ? evaluate(doc, registry, FloatField, ctx.ctx).values
      : new Map<number, Value<number>>());
  const band = ctx.ok ? bandThreshold('length', ctx.ctx) : Infinity;
  const at = new Map<string, { x: number; y: number }>();
  for (const [id, v] of values) if (v.kind === 'point') at.set(objectKey(id), v);
  return { at, band };
}

/** The closure of `doc`'s construction facts (see the module comment). */
export function buildClosure(
  doc: Document,
  registry: Registry,
  kinds: ClaimKinds,
  options: ClosureOptions = {},
): Closure {
  const terms = collectTerms(doc, registry);
  const c = new Closure(terms, kinds);
  const given: Instance[] = (options.extra ?? []).map((f) => ({
    claim: f.kind,
    args: f.args.map((a) => ('id' in a ? objectKey(a.id) : `q${formatRational(a.lit)}`)),
  }));
  const inst = [...terms.instances, ...given];
  for (const [a, b] of terms.same) {
    c.points.union(a, b);
    c.lines.union(a, b);
    c.circles.union(a, b);
  }
  for (const x of inst)
    if (x.claim === 'equal' && x.args[0] !== undefined && x.args[1] !== undefined)
      c.points.union(x.args[0], x.args[1]);
  const pos = positions(doc, registry, options.values);
  // Positions by point class, rebuilt whenever point classes may have merged.
  let byClass = new Map<string, { x: number; y: number }>();
  const index = () => {
    byClass = new Map();
    for (const [k, v] of pos.at) byClass.set(c.points.find(k), v);
  };
  const apart = (a: string, b: string): boolean => {
    const [pa, pb] = [byClass.get(c.points.find(a)), byClass.get(c.points.find(b))];
    return (
      pa !== undefined &&
      pb !== undefined &&
      (Math.abs(pa.x - pb.x) > pos.band || Math.abs(pa.y - pb.y) > pos.band)
    );
  };
  fixpoint(c, incidences(c, inst), inst, index, apart);
  radii(c);
  for (const x of inst) {
    const spec = kinds.get(x.claim);
    if (spec !== undefined)
      c.generic.add(
        claimKey(
          spec,
          x.args.map((k) => (k.startsWith('q') ? { key: k } : { key: c.classOf(k) })),
        ),
      );
  }
  return c;
}
