/**
 * The construction facts of a document as data (ADR-0035 decision 7, first half): every
 * definition and every subterm gets a KEY (its construction key, ADR-0029; a reference is
 * `#id`, a call holding a free input a key of its own place), an object's id is identified
 * with its definition's key, and every instance of a tool's declared guarantees
 * (`Signature.guarantees`) is recorded over keys, its nested terms registered with their own
 * guarantees in turn. Nothing is evaluated: the facts follow from the definitions alone.
 */
import { assertNever } from '@geomira/num/assert';
import { abs, formatRational, parseRational, type Rational } from '@geomira/num/rational';
import { constructionKey } from '@geomira/kernel/construction-key';
import { exprKinds, objectKinds, type KindTable } from '@geomira/kernel/derived';
import type { Document } from '@geomira/kernel/document';
import { call, lit, ref, type CallExpr, type Expr } from '@geomira/kernel/expr';
import { guaranteesFor } from '@geomira/kernel/guarantees';
import { imageOfFor, mapFactsFor } from '@geomira/kernel/map-facts';
import type { Registry } from '@geomira/kernel/registry';
import type { GuaranteeTerm, MapFacts, MapType } from '@geomira/kernel/tool';
import type { ValueKind } from '@geomira/kernel/value';
import { drain, type Ticking } from './ticking';

/** A recorded fact over term keys (a claim kind's name and its arguments' keys). */
export interface Instance {
  readonly claim: string;
  readonly args: readonly string[];
}

/** A map of the document with its declared facts over term keys (ADR-0039). */
export interface MapRecord {
  readonly key: string;
  readonly type: MapType;
  readonly involution: boolean;
  /** |X*Y*| / |XY| (a similarity with an exact ratio). */
  readonly ratio?: Rational;
  /** The turn of every direction, in degrees (a direct similarity with an exact turn). */
  readonly turn?: Rational;
  /** A homothety's signed ratio about its first fixed point (an exact literal). */
  readonly factor?: Rational;
  readonly fixedPoints: readonly string[];
  readonly fixedCurve?: string;
  readonly invariant: readonly string[];
  readonly center?: string;
  readonly sends: readonly (readonly [string, string])[];
}

/** `img` is the image of `pre` under the map `map` (term keys). */
export interface ImageRecord {
  readonly map: string;
  readonly pre: string;
  readonly img: string;
}

export interface Term {
  readonly key: string;
  readonly expr: Expr;
  /** The static kinds of the term (undefined: unknown). */
  readonly kinds: readonly ValueKind[] | undefined;
}

export interface Terms {
  readonly terms: ReadonlyMap<string, Term>;
  readonly instances: readonly Instance[];
  /** Pairs of keys that name one object (an object's id and its definition's key). */
  readonly same: readonly (readonly [string, string])[];
  /** Circle key → the key of its `center(…)` term (the closure's link from circles to centres). */
  readonly centers: ReadonlyMap<string, string>;
  /** The key of every registered expression (by identity). */
  readonly exprKeys: ReadonlyMap<Expr, string>;
  /** The maps of the document by key, and every image of a term under one (ADR-0039). */
  readonly maps: ReadonlyMap<string, MapRecord>;
  readonly images: readonly ImageRecord[];
}

/** The key of an object of the document. */
export function objectKey(id: number): string {
  return `#${String(id)}`;
}

/** Guarantees nest at most this deep (registered terms are memoised, so this only bounds work). */
const MAX_DEPTH = 6;

/** The tool whose calls name a circle's centre (registry tool `center(c)`). */
const CENTER_TOOL = 'center';

class Builder {
  readonly terms = new Map<string, Term>();
  readonly instances: Instance[] = [];
  readonly same: [string, string][] = [];
  readonly centers = new Map<string, string>();
  readonly exprKeys = new Map<Expr, string>();
  readonly maps = new Map<string, MapRecord>();
  readonly images: ImageRecord[] = [];
  constructor(
    readonly registry: Registry,
    readonly kinds: KindTable,
  ) {}

  keyOf(e: Expr, place: string): string {
    switch (e.kind) {
      case 'ref':
        return objectKey(e.id);
      case 'lit':
        return `q${formatRational(e.value)}`;
      case 'str':
        return `s${JSON.stringify(e.value)}`;
      case 'call':
        return constructionKey(e, this.registry, this.kinds) ?? `@${place}`;
      default:
        return assertNever(e, 'expression');
    }
  }

  /** Registers `e` (and, unless `bare`, the guarantees of its call); returns its key. */
  term(e: Expr, place: string, depth: number, bare = false): string {
    const key = this.keyOf(e, place);
    this.exprKeys.set(e, key);
    if (this.terms.has(key)) return key;
    this.terms.set(key, { key, expr: e, kinds: exprKinds(e, this.kinds, this.registry) });
    if (e.kind === 'call' && depth < MAX_DEPTH && !bare) this.call(e, key, e, place, depth);
    return key;
  }

  /** The guarantees of `c` (whose value is the term `self`, written as `selfExpr`). */
  call(c: CallExpr, self: string, selfExpr: Expr, place: string, depth: number): void {
    const argKeys = c.args.map((a, i) => this.term(a, `${place}.${String(i)}`, depth + 1));
    if (c.tool === CENTER_TOOL && argKeys[0] !== undefined) this.centers.set(argKeys[0], self);
    const spec = this.registry.get(c.tool);
    const kinds = c.args.map((a) => exprKinds(a, this.kinds, this.registry));
    const facts = guaranteesFor(spec, kinds);
    facts.forEach((g, gi) => {
      const args = g.args.map((t, ti) => {
        const e = instantiate(t, c, selfExpr);
        return e === undefined
          ? undefined
          : this.term(e, `${place}:g${String(gi)}.${String(ti)}`, depth + 1);
      });
      if (args.every((a): a is string => a !== undefined))
        this.instances.push({ claim: g.claim, args });
    });
    const where = { c, self: selfExpr, place, depth };
    const map = mapFactsFor(spec, kinds);
    if (map !== undefined) this.maps.set(self, this.mapRecord(map, self, where));
    const image = imageOfFor(spec, kinds);
    const pre = image === undefined ? undefined : argKeys[image.of];
    const of = image === undefined ? undefined : this.termKey(image.map, where, 'm');
    if (pre !== undefined && of !== undefined) this.images.push({ map: of, pre, img: self });
  }

  /** The key of a term of a map's data over the call (registered with its own guarantees). */
  termKey(x: GuaranteeTerm, w: Where, tag: string): string | undefined {
    const e = instantiate(x, w.c, w.self);
    return e === undefined ? undefined : this.term(e, `${w.place}:${tag}`, w.depth + 1);
  }

  mapRecord(m: MapFacts, key: string, w: Where): MapRecord {
    const keys = (xs: readonly GuaranteeTerm[], tag: string) =>
      xs.flatMap((x, i) => this.termKey(x, w, `${tag}${String(i)}`) ?? []);
    const center = m.center === undefined ? undefined : this.termKey(m.center, w, 'c');
    const curve = m.fixedCurve === undefined ? undefined : this.termKey(m.fixedCurve, w, 'f');
    const ratio = m.ratio === undefined ? undefined : literalOf(m.ratio, w.c);
    const turn = m.turn === undefined ? undefined : literalOf(m.turn, w.c);
    const factor = m.factor === undefined ? undefined : literalOf(m.factor, w.c);
    return {
      key,
      type: m.type,
      involution: m.involution === true,
      ...(ratio === undefined ? {} : { ratio: abs(ratio) }),
      ...(turn === undefined ? {} : { turn }),
      ...(factor === undefined ? {} : { factor }),
      fixedPoints: keys(m.fixedPoints ?? [], 'p'),
      ...(curve === undefined ? {} : { fixedCurve: curve }),
      invariant: keys(m.invariantCurves ?? [], 'i'),
      ...(center === undefined ? {} : { center }),
      sends: (m.sends ?? []).flatMap(([a, b], i) => {
        const [x, y] = [this.termKey(a, w, `s${String(i)}a`), this.termKey(b, w, `s${String(i)}b`)];
        return x === undefined || y === undefined ? [] : [[x, y] as const];
      }),
    };
  }
}

/** Where a call's map data is instantiated (the call, its value's expression, its place). */
interface Where {
  readonly c: CallExpr;
  readonly self: Expr;
  readonly place: string;
  readonly depth: number;
}

/** An exact number a term stands for: a literal, or a literal argument of the call. */
function literalOf(x: GuaranteeTerm, c: CallExpr): Rational | undefined {
  if (typeof x === 'object' && 'lit' in x) {
    const r = parseRational(x.lit);
    return r.ok ? r.value : undefined;
  }
  const e = typeof x === 'number' ? c.args[x] : undefined;
  return e?.kind === 'lit' ? e.value : undefined;
}

/** A guarantee term as an expression over the call (the result is `self`). */
function instantiate(t: GuaranteeTerm, c: CallExpr, self: Expr): Expr | undefined {
  if (t === 'result') return self;
  if (typeof t === 'number') return c.args[t];
  if ('lit' in t) {
    const r = parseRational(t.lit);
    return r.ok ? lit(r.value) : undefined;
  }
  const args = t.args.map((a) => instantiate(a, c, self));
  return args.every((a): a is Expr => a !== undefined) ? call(t.tool, args) : undefined;
}

/** The construction facts of every object of `doc` (managed images included). */
export function collectTerms(doc: Document, registry: Registry): Terms {
  return drain(termSteps(doc, registry));
}

/** Objects whose terms are collected between two yields of termSteps. */
const TERM_BATCH = 8;

/** collectTerms in bounded steps (TERM_BATCH objects each). */
export function* termSteps(doc: Document, registry: Registry): Ticking<Terms> {
  const b = new Builder(registry, objectKinds(doc, registry));
  for (const [i, o] of doc.objects.entries()) {
    if (i % TERM_BATCH === TERM_BATCH - 1) yield undefined;
    const own = objectKey(o.id);
    b.terms.set(own, { key: own, expr: ref(o.id), kinds: b.kinds.get(o.id) });
    // The definition's guarantees are recorded once, over the object's own key.
    const k = b.term(o.def, String(o.id), 0, true);
    b.same.push([own, k]);
    if (o.def.kind === 'call') b.call(o.def, own, ref(o.id), String(o.id), 0);
  }
  return {
    terms: b.terms,
    instances: b.instances,
    same: b.same,
    centers: b.centers,
    exprKeys: b.exprKeys,
    maps: b.maps,
    images: b.images,
  };
}
