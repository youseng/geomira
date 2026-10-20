/**
 * Renaming ids throughout a document: objects (definitions, selectors, claims,
 * assumptions, rules, comments), layers (objects, rules, views, comments), claims and
 * assumptions. Used by canonicalDocument (laws P1–P3 compare documents up to ids) and by
 * parseInto (which keeps the ids of persisting names).
 */
import type { Comment, CommentAnchor, Document } from '@geomira/kernel/document';
import { call, lit, ref, type Expr, type Selector } from '@geomira/kernel/expr';
import { assertNever } from '@geomira/num/assert';

export interface IdMaps {
  readonly object: (id: number) => number;
  readonly layer: (id: string) => string;
  readonly claim: (id: number) => number;
  readonly assumption: (id: number) => number;
}

export function mapExpr(e: Expr, f: (id: number) => number): Expr {
  switch (e.kind) {
    case 'ref':
      return ref(f(e.id));
    case 'lit':
      return e.text === undefined ? lit(e.value) : lit(e.value, e.text);
    case 'call':
      return call(
        e.tool,
        e.args.map((a) => mapExpr(a, f)),
        e.selectors.map((s) => mapSelector(s, f)),
      );
    default:
      return assertNever(e, 'expression');
  }
}

function mapSelector(s: Selector, f: (id: number) => number): Selector {
  const m = (e: Expr): Expr => mapExpr(e, f);
  switch (s.kind) {
    case 'same_side':
    case 'opposite_side':
      return { kind: s.kind, q: m(s.q), l: m(s.l) };
    case 'on_arc':
      return { kind: 'on_arc', b: m(s.b), c: m(s.c), a: m(s.a), not: s.not };
    case 'between':
      return { kind: 'between', a: m(s.a), b: m(s.b) };
    case 'inside':
    case 'outside':
      return { kind: s.kind, c: m(s.c) };
    case 'other':
    case 'near':
    case 'far_from':
      return { kind: s.kind, p: m(s.p) };
    case 'along':
    case 'orient':
      return { kind: s.kind, sign: s.sign };
    default:
      return assertNever(s, 'selector');
  }
}

function mapAnchor(a: CommentAnchor, m: IdMaps): CommentAnchor {
  switch (a.kind) {
    case 'object':
      return { kind: 'object', id: m.object(a.id) };
    case 'claim':
      return { kind: 'claim', id: m.claim(a.id) };
    case 'assumption':
      return { kind: 'assumption', id: m.assumption(a.id) };
    case 'layer':
      return { kind: 'layer', id: m.layer(a.id) };
    case 'view':
    case 'header':
    case 'title':
    case 'author':
    case 'viewport':
    case 'end':
      return a;
    default:
      return assertNever(a, 'comment anchor');
  }
}

function mapComment(c: Comment, m: IdMaps): Comment {
  return { ...c, anchor: mapAnchor(c.anchor, m) };
}

/** The document with every id replaced through the maps (nextId is left to the caller). */
export function remapIds(doc: Document, m: IdMaps): Document {
  const objects = doc.objects.map((o) => {
    const base = {
      ...o,
      id: m.object(o.id),
      def: mapExpr(o.def, m.object),
      layers: o.layers.map(m.layer),
    };
    return o.managedBy === undefined ? base : { ...base, managedBy: m.layer(o.managedBy) };
  });
  const layers = doc.layers.map((l) => {
    const base = { ...l, id: m.layer(l.id) };
    const r = l.rule;
    return r === undefined
      ? base
      : {
          ...base,
          rule: {
            ...r,
            transform: ref(m.object(r.transform.id)),
            source: m.layer(r.source),
            exclude: r.exclude.map(m.object),
          },
        };
  });
  const views = doc.views.map((v) => ({
    ...v,
    layerVisibility: Object.fromEntries(
      Object.entries(v.layerVisibility).map(([k, x]) => [m.layer(k), x]),
    ),
  }));
  const claims = doc.claims.map((c) => ({
    ...c,
    id: m.claim(c.id),
    args: c.args.map((a) => mapExpr(a, m.object)),
  }));
  const assumptions = doc.assumptions.map((a) => ({
    ...a,
    id: m.assumption(a.id),
    args: a.args.map((x) => mapExpr(x, m.object)),
  }));
  const comments = doc.meta.comments?.map((c) => mapComment(c, m));
  const meta = comments === undefined ? doc.meta : { ...doc.meta, comments };
  return { ...doc, objects, layers, views, claims, assumptions, meta };
}
