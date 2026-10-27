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
import { drain, TICK, type Ticking } from './ticking';
import { objectKey, termSteps, type Instance, type Terms } from './terms';
import { UnionFind } from './uf';
import type { ClosureState, TermArg } from './closure-view';
import { constructionRule } from './rules';
import {
  equalDistances,
  incidences,
  merge,
  parallelsThroughOne,
  radii,
  relate,
  type Sets,
} from './closure-merge';
import {
  fixedIncidences,
  inversionPairs,
  mapInstances,
  mapLengths,
  mapUnions,
} from './closure-maps';
import { midpointRules } from './closure-mid';

/** A fact about the figure's objects (a candidate, or a reported finding). */
export interface FactData {
  readonly kind: string;
  readonly args: readonly ScreenArg[];
}

export class Closure implements ClosureState {
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
  readonly virtualCenters = new Map<string, string>();
  readonly mids = new Set<string>();
  readonly isosceles = new Set<string>();

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
    for (const l of this.linesAt(pa)) if (this.lineSets.get(l)?.has(pb) === true) return l;
    return undefined;
  }

  /** The line classes through a point class, indexed once per `lineSets` (merges replace it). */
  private linesAt(p: string): readonly string[] {
    if (this.lineIndex?.sets !== this.lineSets) {
      const at = new Map<string, string[]>();
      for (const [l, s] of this.lineSets)
        for (const q of s) {
          const list = at.get(q);
          if (list === undefined) at.set(q, [l]);
          else list.push(l);
        }
      this.lineIndex = { sets: this.lineSets, at };
    }
    return this.lineIndex.at.get(p) ?? [];
  }

  private lineIndex: { sets: Sets; at: Map<string, string[]> } | undefined;

  /**
   * Whether |s| = k·|t| is a recorded ratio of their length classes. The index is built on first
   * use and rebuilt when ratios were added; it is read once the closure is built (the length
   * classes no longer change).
   */
  hasRatio(s: string, t: string, k: string): boolean {
    if (this.ratioIndex?.size !== this.ratios.size) {
      const keys = new Set<string>();
      for (const r of this.ratios) {
        const [x, y, kk] = r.split('&');
        if (x !== undefined && y !== undefined && kk !== undefined)
          keys.add(`${this.lengths.find(x)}&${this.lengths.find(y)}&${kk}`);
      }
      this.ratioIndex = { size: this.ratios.size, keys };
    }
    return this.ratioIndex.keys.has(`${this.lengths.find(s)}&${this.lengths.find(t)}&${k}`);
  }

  private ratioIndex: { size: number; keys: Set<string> } | undefined;

  parallelClass(lineClass: string): string {
    return this.parallels.find(lineClass);
  }

  /** Point class → its position in the figure (set when the closure is built). */
  readonly place = new Map<string, { readonly x: number; readonly y: number }>();
  /** The band two points must be apart by (the figure's length band). */
  band = Infinity;

  at(k: string): { readonly x: number; readonly y: number } | undefined {
    return this.place.get(this.points.find(k));
  }

  apart(a: string, b: string): boolean {
    const [pa, pb] = [this.at(a), this.at(b)];
    return (
      pa !== undefined &&
      pb !== undefined &&
      (Math.abs(pa.x - pb.x) > this.band || Math.abs(pa.y - pb.y) > this.band)
    );
  }

  /** Whether `kind`(args) follows from the construction (ADR-0035 decision 7). */
  isConstruction(fact: FactData): boolean {
    return this.holds(fact.kind, termArgs(fact.args));
  }

  /** Whether `kind` over these terms follows from the closure (keys need not be objects). */
  holds(kind: string, args: readonly TermArg[]): boolean {
    const spec = this.kinds.get(kind);
    if (spec === undefined) return false;
    const keys = args.map((a) => ('key' in a ? a.key : undefined));
    const generic: KeyArg[] = args.map((a) =>
      'lit' in a ? { lit: a.lit } : { key: this.classOf(a.key) },
    );
    if (this.generic.has(claimKey(spec, generic))) return true;
    const pts = keys.filter((k): k is string => k !== undefined);
    if (kind === 'concyclic' && inversionPairs(this, pts)) return true;
    return constructionRule(this, kind, keys, args);
  }
}

/** A fact's arguments as terms (objects by their keys). */
export function termArgs(args: readonly ScreenArg[]): TermArg[] {
  return args.map((a) => ('id' in a ? { key: objectKey(a.id) } : { lit: a.lit }));
}

export interface ClosureOptions {
  /** Facts taken as given (the ranking asks whether a finding follows from those above it). */
  readonly extra?: readonly FactData[];
  /** The figure's float values (default: evaluated here); they decide which points are apart. */
  readonly values?: ReadonlyMap<number, Value<number>>;
  /** The document's terms when already collected (the ranking re-runs the closure). */
  readonly terms?: Terms;
}

/** Merges lines and circles, ties centres, relates lines, to a fixpoint (see buildClosure). */
function* fixpoint(
  c: Closure,
  raw: { lines: Sets; circles: Sets },
  inst: readonly Instance[],
  index: () => void,
  apart: (a: string, b: string) => boolean,
): Ticking<void> {
  for (let outer = true; outer;) {
    for (let changed = true; changed;) {
      index();
      const l = merge(c.lines, raw.lines, c.points, 2, apart);
      c.lineSets = l.sets;
      yield undefined;
      const k = merge(c.circles, raw.circles, c.points, 3, apart);
      c.circleSets = k.sets;
      changed = l.changed || k.changed || centres(c);
      yield undefined;
    }
    // One rule per step: on a large figure each pass of a rule takes milliseconds.
    relate(c, inst);
    mapLengths(c);
    radii(c);
    yield undefined;
    const eq = yield* equalDistances(c, raw.circles, apart);
    yield undefined;
    const mapped = mapUnions(c);
    const fixed = fixedIncidences(c, raw);
    yield undefined;
    const mid = yield* midpointRules(c, raw.circles);
    yield undefined;
    outer = parallelsThroughOne(c) || eq || mapped || fixed || mid;
  }
}

/** One circle has one centre: the centres of merged circles are one point. Whether any merged. */
function centres(c: Closure): boolean {
  c.centerOf.clear();
  let centred = false;
  for (const [circle, center] of [...c.terms.centers, ...c.virtualCenters]) {
    const cls = c.circles.find(circle);
    const known = c.centerOf.get(cls);
    if (known === undefined) c.centerOf.set(cls, c.points.find(center));
    else if (c.points.union(known, center)) centred = true;
  }
  return centred;
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
  return drain(closureSteps(doc, registry, kinds, options));
}

/**
 * buildClosure in bounded steps (a job's step stays short on a large figure): the terms by
 * batches of objects, then each merging pass of the fixpoint, then the claim keys by TICK.
 */
export function* closureSteps(
  doc: Document,
  registry: Registry,
  kinds: ClaimKinds,
  options: ClosureOptions = {},
): Ticking<Closure> {
  const terms = options.terms ?? (yield* termSteps(doc, registry));
  const c = new Closure(terms, kinds);
  const given: Instance[] = (options.extra ?? []).map((f) => ({
    claim: f.kind,
    args: f.args.map((a) => ('id' in a ? objectKey(a.id) : `q${formatRational(a.lit)}`)),
  }));
  const inst = [...terms.instances, ...given, ...mapInstances(c)];
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
    c.place.clear();
    for (const [k, v] of byClass) c.place.set(k, v);
  };
  c.band = pos.band;
  const apart = (a: string, b: string): boolean => {
    const [pa, pb] = [byClass.get(c.points.find(a)), byClass.get(c.points.find(b))];
    return (
      pa !== undefined &&
      pb !== undefined &&
      (Math.abs(pa.x - pb.x) > pos.band || Math.abs(pa.y - pb.y) > pos.band)
    );
  };
  yield* fixpoint(c, incidences(c, inst), inst, index, apart);
  index();
  for (const [i, x] of inst.entries()) {
    if (i % TICK === TICK - 1) yield undefined;
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
