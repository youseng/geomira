/**
 * Immutable document helpers (SPEC §5): add, removeCascade (with the dependents list),
 * rename, redefine (with cycle check), style and object layers. Each returns a new
 * document or an error and never mutates its input; on a valid document every successful
 * edit keeps invariants I1–I8 (property-tested). Derived-layer rules are created by a
 * later run; these helpers keep I4 on documents that have them (ADR-0003).
 */
import {
  MAIN_LAYER_ID,
  findObject,
  type DocObject,
  type Document,
  type Layer,
  type Style,
} from './document';
import { refsOf, type Expr } from './expr';
import { dependentClosure, stableTopologicalOrder } from './graph';
import { nameProblem } from './names';

export type EditResult<X extends object = object> =
  | ({ readonly ok: true; readonly doc: Document } & X)
  | { readonly ok: false; readonly error: string };

/** What a cascading removal deletes (the dependents list shown before deleting). */
export interface Removal {
  /** Object ids, in construction order. */
  readonly objects: readonly number[];
  readonly claims: readonly number[];
  readonly assumptions: readonly number[];
  /** Layers whose rule is cleared because its transform is removed. */
  readonly clearedRules: readonly string[];
}

export interface NewObject {
  readonly name: string;
  readonly def: Expr;
  readonly style?: Style;
  /** Default: ["main"]. */
  readonly layers?: readonly string[];
}

export function fail(error: string): { readonly ok: false; readonly error: string } {
  return { ok: false, error };
}

/** Why `name` cannot be given to a new or renamed object (`self` is the renamed id). */
function nameConflict(doc: Document, name: string, self?: number): string | undefined {
  const problem = nameProblem(name);
  if (problem !== undefined) return problem;
  const clash =
    doc.objects.some((o) => o.name === name && o.id !== self) ||
    doc.claims.some((c) => c.name === name);
  return clash ? `the name ${name} is already used` : undefined;
}

function layersProblem(doc: Document, layers: readonly string[]): string | undefined {
  if (layers.length === 0) return 'an object needs at least one layer';
  if (new Set(layers).size !== layers.length) return 'a layer is listed twice';
  const missing = layers.find((id) => !doc.layers.some((l) => l.id === id));
  return missing === undefined ? undefined : `there is no layer "${missing}"`;
}

function missingRef(doc: Document, def: Expr): number | undefined {
  return refsOf(def).find((id) => findObject(doc, id) === undefined);
}

/** Appends a new object (it may reference any existing object, all of which are earlier). */
export function addObject(doc: Document, spec: NewObject): EditResult<{ readonly id: number }> {
  const problem = nameConflict(doc, spec.name);
  if (problem !== undefined) return fail(problem);
  const layers = spec.layers ?? [MAIN_LAYER_ID];
  const lp = layersProblem(doc, layers);
  if (lp !== undefined) return fail(lp);
  const missing = missingRef(doc, spec.def);
  if (missing !== undefined) return fail(`there is no object #${String(missing)}`);
  const id = doc.nextId;
  const obj: DocObject = { id, name: spec.name, def: spec.def, style: spec.style ?? {}, layers };
  return { ok: true, doc: { ...doc, nextId: id + 1, objects: [...doc.objects, obj] }, id };
}

/** The objects, claims, assumptions and rules a removal of `ids` would take with it. */
export function dependents(doc: Document, ids: readonly number[]): Removal {
  const objects = dependentClosure(doc.objects, ids);
  const gone = new Set(objects);
  const hits = (args: readonly Expr[]): boolean =>
    args.some((a) => refsOf(a).some((id) => gone.has(id)));
  return {
    objects,
    claims: doc.claims.filter((c) => hits(c.args)).map((c) => c.id),
    assumptions: doc.assumptions.filter((a) => hits(a.args)).map((a) => a.id),
    clearedRules: doc.layers
      .filter((l) => l.rule !== undefined && gone.has(l.rule.transform.id))
      .map((l) => l.id),
  };
}

/** Applies a removal computed by `dependents` (internal to the edit helpers). */
export function applyRemoval(doc: Document, r: Removal): Document {
  const gone = new Set(r.objects);
  const layers = doc.layers.map((l): Layer => {
    if (l.rule === undefined) return l;
    if (r.clearedRules.includes(l.id)) {
      return {
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        order: l.order,
      };
    }
    const exclude = l.rule.exclude.filter((id) => !gone.has(id));
    return exclude.length === l.rule.exclude.length ? l : { ...l, rule: { ...l.rule, exclude } };
  });
  return {
    ...doc,
    objects: doc.objects.filter((o) => !gone.has(o.id)),
    claims: doc.claims.filter((c) => !r.claims.includes(c.id)),
    assumptions: doc.assumptions.filter((a) => !r.assumptions.includes(a.id)),
    layers,
  };
}

/** Removes an object and everything that depends on it; `removed` lists all of it. */
export function removeCascade(
  doc: Document,
  id: number,
): EditResult<{ readonly removed: Removal }> {
  if (findObject(doc, id) === undefined) return fail(`there is no object #${String(id)}`);
  const removed = dependents(doc, [id]);
  return { ok: true, doc: applyRemoval(doc, removed), removed };
}

function managedError(o: DocObject): { readonly ok: false; readonly error: string } {
  const layer = o.managedBy ?? '';
  return fail(`${o.name} is managed by layer "${layer}" and cannot be edited directly`);
}

/** The managed images of object `id`, optionally only for rules matching `pick`. */
function imagesOf(
  doc: Document,
  id: number,
  pick: (l: Layer) => boolean = () => true,
): DocObject[] {
  return doc.objects.filter((o) => {
    if (o.managedBy === undefined || o.def.kind !== 'call') return false;
    const src = o.def.args[1];
    const layer = doc.layers.find((l) => l.id === o.managedBy);
    return src?.kind === 'ref' && src.id === id && layer !== undefined && pick(layer);
  });
}

/** Renames an object; its managed images follow (X* stays the image of X, X** of X*). */
export function renameObject(doc: Document, id: number, name: string): EditResult {
  const o = findObject(doc, id);
  if (o === undefined) return fail(`there is no object #${String(id)}`);
  if (o.managedBy !== undefined) return managedError(o);
  const problem = nameConflict(doc, name, id);
  if (problem !== undefined) return fail(problem);
  // An image is named source + suffix and source names are unique, so the new image
  // names cannot collide in a valid document. Images of images (chained derived layers)
  // follow too: X** stays the image of X* (found in Run 4, rename-chain.test.ts).
  const renames = new Map<number, string>([[id, name]]);
  const queue = [id];
  for (let src = queue.shift(); src !== undefined; src = queue.shift()) {
    for (const img of imagesOf(doc, src)) {
      renames.set(img.id, name + img.name.slice(o.name.length));
      queue.push(img.id);
    }
  }
  const objects = doc.objects.map((x) => {
    const n = renames.get(x.id);
    return n === undefined ? x : { ...x, name: n };
  });
  return { ok: true, doc: { ...doc, objects } };
}

/**
 * Gives an object a new definition. Degenerate cases: a reference to the object itself
 * or to one of its dependents (a cycle) → error; a reference to a missing object →
 * error; a reference to a later object → the objects are reordered (stable topological
 * order), so I2 still holds.
 */
export function redefineObject(doc: Document, id: number, def: Expr): EditResult {
  const o = findObject(doc, id);
  if (o === undefined) return fail(`there is no object #${String(id)}`);
  if (o.managedBy !== undefined) return managedError(o);
  const missing = missingRef(doc, def);
  if (missing !== undefined) return fail(`there is no object #${String(missing)}`);
  const below = new Set(dependentClosure(doc.objects, [id]));
  const cyclic = refsOf(def).find((r) => below.has(r));
  if (cyclic !== undefined) {
    const via = findObject(doc, cyclic)?.name ?? '';
    return fail(`cycle: ${o.name} cannot depend on ${via}, which depends on ${o.name}`);
  }
  const replaced = doc.objects.map((x) => (x.id === id ? { ...x, def } : x));
  const ordered = stableTopologicalOrder(replaced);
  if (ordered === undefined) return fail(`cycle: ${o.name} cannot be defined this way`);
  return { ok: true, doc: { ...doc, objects: ordered } };
}

/**
 * Replaces an object's style. Styling a source object [noimage] removes its managed
 * images and their dependents (listed in `removed`).
 */
export function setStyle(
  doc: Document,
  id: number,
  style: Style,
): EditResult<{ readonly removed: Removal }> {
  const o = findObject(doc, id);
  if (o === undefined) return fail(`there is no object #${String(id)}`);
  const images = style.noimage === true ? imagesOf(doc, id).map((x) => x.id) : [];
  const removed = dependents(doc, images);
  const styled = { ...doc, objects: doc.objects.map((x) => (x.id === id ? { ...x, style } : x)) };
  return { ok: true, doc: applyRemoval(styled, removed), removed };
}

/**
 * Moves an object to other layers (non-empty, existing, no repeats). Images under rules
 * whose source layer the object leaves are removed with their dependents.
 */
export function setObjectLayers(
  doc: Document,
  id: number,
  layers: readonly string[],
): EditResult<{ readonly removed: Removal }> {
  const o = findObject(doc, id);
  if (o === undefined) return fail(`there is no object #${String(id)}`);
  if (o.managedBy !== undefined) return managedError(o);
  const lp = layersProblem(doc, layers);
  if (lp !== undefined) return fail(lp);
  const left = (l: Layer): boolean => l.rule !== undefined && !layers.includes(l.rule.source);
  const removed = dependents(
    doc,
    imagesOf(doc, id, left).map((x) => x.id),
  );
  const moved = { ...doc, objects: doc.objects.map((x) => (x.id === id ? { ...x, layers } : x)) };
  return { ok: true, doc: applyRemoval(moved, removed), removed };
}
