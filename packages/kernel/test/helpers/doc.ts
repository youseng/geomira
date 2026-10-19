/** Test helpers: build documents by name and evaluate them over any field. */
import type { Field } from '@geomira/num/field';
import { fromNumber, parseRational, type Rational } from '@geomira/num/rational';
import { evalContextFor } from '../../src/context';
import { emptyDocument, type Document } from '../../src/document';
import { addObject, type NewObject } from '../../src/edit';
import { evaluate, type Evaluation } from '../../src/evaluate';
import { call, lit, type Expr, type RefExpr } from '../../src/expr';
import { assertInvariants } from '../../src/invariants';
import { createRegistry, type Registry } from '../../src/registry';
import type { EvalContext } from '../../src/tool';
import type { Value } from '../../src/value';

export const REGISTRY: Registry = createRegistry();

/** x, or a thrown error when it is undefined (tests use it instead of `!`). */
export function must<X>(x: X | undefined, what = 'value'): X {
  if (x === undefined) throw new Error(`missing ${what}`);
  return x;
}

/** An exact rational from "2/3" text or from a double (exactly). */
export function q(x: string | number): Rational {
  if (typeof x === 'number') return fromNumber(x);
  const r = parseRational(x);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

export function num(x: string | number): Expr {
  return lit(q(x));
}

export function pt(x: string | number, y: string | number): Expr {
  return call('point', [num(x), num(y)]);
}

/** A mutable document builder for tests; every add asserts the invariants. */
export class Builder {
  doc: Document = emptyDocument();

  add(name: string, def: Expr, extra: Omit<NewObject, 'name' | 'def'> = {}): RefExpr {
    const r = addObject(this.doc, { name, def, ...extra });
    if (!r.ok) throw new Error(r.error);
    this.doc = assertInvariants(r.doc);
    return { kind: 'ref', id: r.id };
  }

  point(name: string, x: string | number, y: string | number): RefExpr {
    return this.add(name, pt(x, y));
  }

  call(name: string, tool: string, ...args: Expr[]): RefExpr {
    return this.add(name, call(tool, args));
  }

  ref(name: string): RefExpr {
    return { kind: 'ref', id: this.id(name) };
  }

  id(name: string): number {
    const o = this.doc.objects.find((x) => x.name === name);
    if (o === undefined) throw new Error(`no object ${name}`);
    return o.id;
  }
}

export function contextOf(doc: Document): EvalContext {
  const c = evalContextFor(doc);
  if (!c.ok) throw new Error(c.reason);
  return c.ctx;
}

export function evalDoc<T>(
  doc: Document,
  F: Field<T>,
  ctx: EvalContext = contextOf(doc),
): Evaluation<T> {
  return evaluate(doc, REGISTRY, F, ctx);
}

/** The value of the object called `name`. */
export function valueOf<T>(doc: Document, ev: Evaluation<T>, name: string): Value<T> {
  const o = doc.objects.find((x) => x.name === name);
  if (o === undefined) throw new Error(`no object ${name}`);
  const v = ev.values.get(o.id);
  if (v === undefined) throw new Error(`no value for ${name}`);
  return v;
}

/** Evaluates `tool(args)` as the last object of a fresh document of free points. */
export function evalCall<T>(F: Field<T>, tool: string, args: readonly Expr[]): Value<T> {
  const b = new Builder();
  b.add('x', call(tool, args));
  return valueOf(b.doc, evalDoc(b.doc, F), 'x');
}
