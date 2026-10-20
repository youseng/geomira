/**
 * The test builder of the claims run: documents by name (there is no parser yet), with
 * nested calls, selectors, claims, assumptions and derived layers. Every step asserts the
 * kernel's invariants.
 */
import { fromNumber, parseRational, type Rational } from '@geomira/num/rational';
import { addDerivedLayer } from '@geomira/kernel/derived-edit';
import { emptyDocument, type Document } from '@geomira/kernel/document';
import { addObject } from '@geomira/kernel/edit';
import { call, lit, ref, type Expr, type LitExpr, type Selector } from '@geomira/kernel/expr';
import { assertInvariants } from '@geomira/kernel/invariants';
import { createRegistry, type Registry } from '@geomira/kernel/registry';

export const REGISTRY: Registry = createRegistry();

export function q(x: string | number): Rational {
  if (typeof x === 'number') return fromNumber(x);
  const r = parseRational(x);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

/** An exact number literal. */
export function n(x: string | number): LitExpr {
  return lit(q(x));
}

/** A selector argument for c(): built when the figure resolves the call. */
export interface Sel {
  readonly sel: (f: Figure) => Selector;
}

/** A nested call; string arguments are names, resolved when the figure adds it. */
export interface Pending {
  readonly pending: string;
  readonly args: readonly Arg[];
}

export type Arg = string | Expr | Sel | Pending;

export function c(tool: string, ...args: Arg[]): Pending {
  return { pending: tool, args };
}

export const orient = (sign: 1 | -1): Sel => ({ sel: () => ({ kind: 'orient', sign }) });
export const along = (sign: 1 | -1): Sel => ({ sel: () => ({ kind: 'along', sign }) });
export const sameSide = (qn: Arg, l: Arg): Sel => ({
  sel: (f) => ({ kind: 'same_side', q: f.expr(qn), l: f.expr(l) }),
});
export const oppositeSide = (qn: Arg, l: Arg): Sel => ({
  sel: (f) => ({ kind: 'opposite_side', q: f.expr(qn), l: f.expr(l) }),
});
export const onArc = (b: Arg, cn: Arg, a: Arg, not = false): Sel => ({
  sel: (f) => ({ kind: 'on_arc', b: f.expr(b), c: f.expr(cn), a: f.expr(a), not }),
});
export const other = (p: Arg): Sel => ({ sel: (f) => ({ kind: 'other', p: f.expr(p) }) });
export const near = (p: Arg): Sel => ({ sel: (f) => ({ kind: 'near', p: f.expr(p) }) });

export class Figure {
  doc: Document = emptyDocument();
  constructor(readonly registry: Registry = REGISTRY) {}

  id(name: string): number {
    const o = this.doc.objects.find((x) => x.name === name);
    if (o === undefined) throw new Error(`no object ${name}`);
    return o.id;
  }

  /** Resolves names, nested calls and selectors to an Expr. */
  expr(a: Arg): Expr {
    if (typeof a === 'string') return ref(this.id(a));
    if ('sel' in a) throw new Error('a selector outside a call');
    if ('pending' in a) {
      const args = a.args
        .filter((x) => typeof x === 'string' || !('sel' in x))
        .map((x) => this.expr(x));
      const selectors = a.args.flatMap((x) =>
        typeof x !== 'string' && 'sel' in x ? [x.sel(this)] : [],
      );
      return call(a.pending, args, selectors);
    }
    return a;
  }

  add(name: string, def: Arg, layers?: readonly string[]): this {
    const r = addObject(
      this.doc,
      layers === undefined ? { name, def: this.expr(def) } : { name, def: this.expr(def), layers },
    );
    if (!r.ok) throw new Error(r.error);
    this.doc = assertInvariants(r.doc);
    return this;
  }

  point(name: string, x: string | number, y: string | number): this {
    return this.add(name, call('point', [n(x), n(y)]));
  }

  def(name: string, tool: string, ...args: Arg[]): this {
    return this.add(name, c(tool, ...args));
  }

  claim(kind: string, ...args: Arg[]): number {
    const id = this.doc.nextId;
    this.doc = assertInvariants({
      ...this.doc,
      nextId: id + 1,
      claims: [...this.doc.claims, { id, kind, args: args.map((a) => this.expr(a)) }],
    });
    return id;
  }

  assume(kind: string, ...args: Arg[]): this {
    const id = this.doc.nextId;
    this.doc = assertInvariants({
      ...this.doc,
      nextId: id + 1,
      assumptions: [...this.doc.assumptions, { id, kind, args: args.map((a) => this.expr(a)) }],
    });
    return this;
  }

  /** A derived layer `image(T, main)` with suffix `*`. */
  derived(layerName: string, transform: string): this {
    const r = addDerivedLayer(this.doc, this.registry, {
      name: layerName,
      transform: this.id(transform),
      source: 'main',
    });
    if (!r.ok) throw new Error(r.error);
    this.doc = assertInvariants(r.doc);
    return this;
  }
}
