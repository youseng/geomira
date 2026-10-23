/**
 * Drag-through (SPEC §8.4): dragging a managed image X* of a free input X sets
 * X := T⁻¹(cursor). A chain of derived layers (X** = T₂(X*), X* = T₁(X)) inverts every
 * map in turn. Free points get the new coordinates; gliders `on(obj, …)` with literal
 * parameters get the parameter of the point of obj nearest to the preimage (glider.ts
 * dragParameter); a glider whose parameter is computed (on(l, s), on(c, 2 * angle(…))) is not
 * draggable, since its parameter is not free (SPEC §5). The
 * result is an edit (a redefinition of X, for applyDocEdit), never a document. Stated rule
 * (tested): if a map of the chain depends on X (X defines the mirror, the centre, …), the
 * image is NOT draggable, since moving X would move the map as well. Inversion (Phase 2)
 * inherits the rule unchanged.
 */
import { assertNever } from '@geomira/num/assert';
import { FloatField } from '@geomira/num/float-field';
import { isInexact } from '@geomira/num/field';
import { fromNumber } from '@geomira/num/rational';
import { findLayer, findObject, type DocObject, type Document } from './document';
import type { DocEdit } from './doc-edit';
import { evaluate, type Evaluation } from './evaluate';
import { call, lit, type Expr } from './expr';
import { dragParameter, type GliderForm, type GliderParameter } from './glider';
import { dependentClosure } from './graph';
import { sourceOf } from './derived';
import { inverseSimilarity, mapPoint, similarityProblem } from './similarity';
import type { Value, Vec } from './value';

export type DragThrough =
  | { readonly kind: 'edit'; readonly edit: DocEdit }
  | { readonly kind: 'not-draggable'; readonly reason: string };

function no(reason: string): DragThrough {
  return { kind: 'not-draggable', reason };
}

/** The managed chain from `img` down to its user source: the maps' ids, outermost first. */
function chain(doc: Document, img: DocObject): { maps: number[]; base: DocObject } | string {
  const maps: number[] = [];
  let cur = img;
  while (cur.managedBy !== undefined) {
    const rule = findLayer(doc, cur.managedBy)?.rule;
    const src = findObject(doc, sourceOf(cur) ?? -1);
    if (rule === undefined || src === undefined) return `${cur.name} has no rule or source`;
    maps.push(rule.transform.id);
    cur = src;
  }
  return { maps, base: cur };
}

/** T⁻¹(…T⁻¹(cursor)) through the chain, from the current float values. */
function preimage(
  doc: Document,
  maps: readonly number[],
  cursor: Vec<number>,
  values: Evaluation<number>,
): Vec<number> | string {
  let p = cursor;
  for (const id of maps) {
    const t = values.values.get(id);
    const name = findObject(doc, id)?.name ?? '?';
    if (t?.kind !== 'transform') return `the transformation ${name} is undefined`;
    const bad = similarityProblem(FloatField, t.t, name);
    if (bad !== undefined) return bad.reason;
    p = mapPoint(FloatField, inverseSimilarity(FloatField, t.t), p);
  }
  return Number.isFinite(p.x) && Number.isFinite(p.y)
    ? p
    : 'the preimage is beyond the double range';
}

/** The value of an argument expression of `base` (evaluated before `base`). */
function argValue(
  doc: Document,
  base: DocObject,
  e: Expr,
  values: Evaluation<number>,
): Value<number> | undefined {
  if (e.kind === 'ref') return values.values.get(e.id);
  const before = doc.objects.slice(
    0,
    doc.objects.findIndex((o) => o.id === base.id),
  );
  const tmp = { id: doc.nextId, name: 'tmp', def: e, style: {}, layers: base.layers };
  const ev = evaluate(
    { ...doc, objects: [...before, tmp] },
    values.registry,
    FloatField,
    values.ctx,
  );
  return ev.values.get(tmp.id);
}

function paramExprs(p: GliderParameter<number>): Expr[] {
  const q = (x: number) => lit(fromNumber(x));
  switch (p.form) {
    case 'line':
      return [q(p.t)];
    case 'stereo':
      return [q(p.u), q(p.v)];
    case 'angle':
      return [q(p.degrees)];
    default:
      return assertNever(p, 'glider parameter');
  }
}

/** The new definition of `base` for the preimage, or why it cannot be dragged. */
function redefinition(
  doc: Document,
  base: DocObject,
  at: Vec<number>,
  values: Evaluation<number>,
): Expr | string {
  const d = base.def;
  if (
    d.kind === 'call' &&
    d.tool === 'point' &&
    d.args.length === 2 &&
    d.args.every((a) => a.kind === 'lit')
  ) {
    return call('point', [lit(fromNumber(at.x)), lit(fromNumber(at.y))]);
  }
  const [objExpr, ...params] = d.kind === 'call' && d.tool === 'on' ? d.args : [];
  if (objExpr === undefined) return `${base.name} is not a free point or a glider`;
  // Only literal parameters are free (SPEC §5): a computed one is never replaced by a number.
  if (params.some((a) => a.kind !== 'lit'))
    return `${base.name} is not draggable: its parameter is computed`;
  const obj = argValue(doc, base, objExpr, values);
  if (obj === undefined || (obj.kind !== 'line' && obj.kind !== 'circle'))
    return `the object ${base.name} glides on is undefined`;
  const form: GliderForm = obj.kind === 'line' ? 'line' : params.length === 2 ? 'stereo' : 'angle';
  const p = dragParameter(FloatField, obj, at, form, values.ctx);
  if (isInexact(p) || 'kind' in p) return p.reason;
  return call('on', [objExpr, ...paramExprs(p)]);
}

/**
 * The edit that drags the managed image `managedId` to `cursor` (world coordinates),
 * given the document's current float evaluation. Degenerate cases (→ not-draggable, with
 * the reason): not a managed object; a map of the chain that depends on the source; a map
 * that is undefined; a source that is neither a free point nor a glider; a glider whose
 * parameter is computed; a glider whose object is undefined, or a cursor at the centre of
 * its circle.
 */
export function dragThrough(
  doc: Document,
  managedId: number,
  cursor: Vec<number>,
  values: Evaluation<number>,
): DragThrough {
  const img = findObject(doc, managedId);
  if (img?.managedBy === undefined) return no(`#${String(managedId)} is not a managed image`);
  const c = chain(doc, img);
  if (typeof c === 'string') return no(c);
  const moved = new Set(dependentClosure(doc.objects, [c.base.id]));
  const dep = c.maps.find((id) => moved.has(id));
  if (dep !== undefined) {
    const t = findObject(doc, dep)?.name ?? '?';
    return no(`${img.name} cannot be dragged: ${t} depends on ${c.base.name}`);
  }
  const at = preimage(doc, c.maps, cursor, values);
  if (typeof at === 'string') return no(at);
  const def = redefinition(doc, c.base, at, values);
  return typeof def === 'string'
    ? no(def)
    : { kind: 'edit', edit: { kind: 'redefine', id: c.base.id, def } };
}
