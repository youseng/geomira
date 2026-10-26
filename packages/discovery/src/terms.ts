/**
 * The construction facts of a document as data (ADR-0035 decision 7, first half): every
 * definition and every subterm gets a KEY (its construction key, ADR-0029; a reference is
 * `#id`, a call holding a free input a key of its own place), an object's id is identified
 * with its definition's key, and every instance of a tool's declared guarantees
 * (`Signature.guarantees`) is recorded over keys, its nested terms registered with their own
 * guarantees in turn. Nothing is evaluated: the facts follow from the definitions alone.
 */
import { assertNever } from '@geomira/num/assert';
import { formatRational, parseRational } from '@geomira/num/rational';
import { constructionKey } from '@geomira/kernel/construction-key';
import { exprKinds, objectKinds, type KindTable } from '@geomira/kernel/derived';
import type { Document } from '@geomira/kernel/document';
import { call, lit, ref, type CallExpr, type Expr } from '@geomira/kernel/expr';
import { guaranteesFor } from '@geomira/kernel/guarantees';
import type { Registry } from '@geomira/kernel/registry';
import type { GuaranteeTerm } from '@geomira/kernel/tool';
import type { ValueKind } from '@geomira/kernel/value';

/** A recorded fact over term keys (a claim kind's name and its arguments' keys). */
export interface Instance {
  readonly claim: string;
  readonly args: readonly string[];
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
  }
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
  const b = new Builder(registry, objectKinds(doc, registry));
  for (const o of doc.objects) {
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
  };
}
