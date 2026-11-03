/**
 * SceneBuilder (SPEC §13): document + float values → Scene. Pure and total: it never
 * throws and never emits a non-finite number (law L9), whatever the document and values
 * (Undefined and Inexact values, unsynced or hand-built documents, huge or tiny figures).
 *
 * 1. Visibility (order.ts): an object is drawn iff it is not hidden (its effective style,
 *    style.ts) and some layer of its set is visible; it is drawn once, in its drawing layer.
 * 2. Values: a drawable value becomes a Shape (shapes.ts), and so does a number styled `show`
 *    that is a measurement (measure.ts, ADR-0048); an Undefined or Inexact value of a visible
 *    object is listed in `unavailable` with its reason, never drawn.
 * 3. Coincident images (SPEC §13, coincide.ts): a managed image whose value coincides with
 *    its source's within BAND is not drawn WHILE THE SOURCE IS SHOWN, where shown means
 *    drawn, or itself a coincident image of a shown source (so X** on X* on X is not drawn
 *    either). When the source is hidden (its layer, its style, or Undefined), the image is
 *    drawn: fixed points never disappear. No document change.
 * 4. Order: stable keys (order.ts), independent of where images sit in the object list.
 */
import type { DocObject, Document, Style } from '@geomira/kernel/document';
import { evalContextFor } from '@geomira/kernel/context';
import { undef, type Value } from '@geomira/kernel/value';
import type { ToleranceContext } from '@geomira/num/tolerance';
import { coincides } from './coincide';
import { indexDocument, type DocIndex } from './doc-index';
import { compare, drawingLayer, drawKey } from './order';
import { digitsOf, formatMeasure, inDegrees, measureRuns, measureShape } from './measure';
import { shapeOf, type ShapeResult } from './shapes';
import { drawStyle, effectiveStyle, labelOf, placedLabel, zOf } from './style';
import type { Label, Primitive, Scene, Shape, ShapeKind, Unavailable } from './types';

interface Candidate {
  readonly o: DocObject;
  readonly value: Value<number>;
  readonly shape: Shape;
  readonly primitive: Primitive;
  readonly key: readonly number[];
}

const NOT_EVALUATED = undef('not evaluated');

/** The coincidence context: the document's figure scale (scale 1 when it has none). */
function contextOf(doc: Document): ToleranceContext {
  const c = evalContextFor(doc);
  return c.ok ? c.ctx : { scale: 1 };
}

function candidate(
  index: DocIndex,
  o: DocObject,
  values: ReadonlyMap<number, Value<number>>,
  unavailable: Unavailable[],
  ctx: ToleranceContext,
): Candidate | undefined {
  const layer = drawingLayer(index, o);
  const style = effectiveStyle(index, o);
  if (layer === undefined || style.hidden === true) return undefined;
  const value = values.get(o.id) ?? NOT_EVALUATED;
  const s = shapeFor(o, style, value, values, ctx);
  if (s.kind === 'none') return undefined;
  if (s.kind === 'unavailable') {
    const base = { id: o.id, name: o.name, reason: s.reason };
    unavailable.push(s.atInfinity === true ? { ...base, atInfinity: true } : base);
    return undefined;
  }
  const kind = s.shape.kind;
  const primitive: Primitive = {
    id: o.id,
    name: o.name,
    shape: s.shape,
    style: drawStyle(style, kind, layer.opacity),
    layer: layer.id,
    label:
      value.kind === 'number'
        ? measureLabel(o, style, value.v, kind)
        : labelOf(o.name, style, kind, s.shape.kind === 'text' ? s.shape.text : undefined),
  };
  return { o, value, shape: s.shape, primitive, key: drawKey(index, o, layer, kind, zOf(style)) };
}

/**
 * The shape of an object's value; a number styled `show` is drawn when it is a measurement
 * (ADR-0048, measure.ts), any other number is not drawn.
 */
function shapeFor(
  o: DocObject,
  style: Style,
  value: Value<number>,
  values: ReadonlyMap<number, Value<number>>,
  ctx: ToleranceContext,
): ShapeResult {
  const s = shapeOf(value, ctx);
  if (s.kind !== 'none' || value.kind !== 'number' || style.show !== true) return s;
  return measureShape(o.def, value.v, values);
}

/** A measurement's label: its value (`digits` decimals, ° for angles) after the style's label. */
function measureLabel(o: DocObject, style: Style, v: number, kind: ShapeKind): Label {
  const { text, runs } = measureRuns(style, formatMeasure(v, digitsOf(style), inDegrees(o.def)));
  return placedLabel(text, runs, style, kind);
}

/**
 * The ids of candidates hidden as coincident with their source. Every candidate is SHOWN
 * (drawn, or hidden here as coincident with a shown source), so an image is judged
 * against its source exactly when the source is a candidate.
 */
function coincidentImages(
  index: DocIndex,
  candidates: readonly Candidate[],
  ctx: ToleranceContext,
): Set<number> {
  const byId = new Map(candidates.map((c) => [c.o.id, c]));
  const hidden = new Set<number>();
  for (const c of candidates) {
    const source = index.source(c.o);
    const s = source === undefined ? undefined : byId.get(source.id);
    if (s !== undefined && coincides(c.value, s.value, ctx)) hidden.add(c.o.id);
  }
  return hidden;
}

/** The scene of `doc` with the float values of its objects (SPEC §13). */
export function buildScene(doc: Document, values: ReadonlyMap<number, Value<number>>): Scene {
  const index = indexDocument(doc);
  const ctx = contextOf(doc);
  const unavailable: Unavailable[] = [];
  const candidates: Candidate[] = [];
  for (const o of doc.objects) {
    const c = candidate(index, o, values, unavailable, ctx);
    if (c !== undefined) candidates.push(c);
  }
  const coincident = coincidentImages(index, candidates, ctx);
  const sorted = [...candidates].sort(
    (a, b) => compare(a.key, b.key) || compare(stableKey(index, a.o), stableKey(index, b.o)),
  );
  return {
    primitives: sorted.filter((c) => !coincident.has(c.o.id)).map((c) => c.primitive),
    unavailable: unavailable.sort((a, b) => compare(unavailableKey(a), unavailableKey(b))),
    coincident: sorted.filter((c) => coincident.has(c.o.id)).map((c) => c.o.id),
    scale: ctx.scale,
  };

  function unavailableKey(u: Unavailable): number[] {
    const o = index.byId.get(u.id);
    return o === undefined ? [] : stableKey(index, o);
  }
}

/**
 * An object's origin key, then its position: lists other than the draw order are sorted
 * by it, so they too do not depend on where images sit (the position only separates
 * objects of unsynced documents that share an origin).
 */
function stableKey(index: DocIndex, o: DocObject): number[] {
  const origin = index.origin(o);
  return [origin.position, ...origin.rules, -1, index.position.get(o.id) ?? -1];
}
