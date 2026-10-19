/**
 * Layer helpers (SPEC §8.2): add, update and remove plain layers. Derived-layer rules are
 * created by a later run; removing a layer keeps I4 on documents that have them
 * (ADR-0003).
 */
import { MAIN_LAYER_ID, type Document, type Layer } from './document';
import { applyRemoval, dependents, fail, type EditResult, type Removal } from './edit';
import { nameProblem } from './names';

export interface LayerOptions {
  readonly visible?: boolean;
  readonly locked?: boolean;
  /** In [0, 1]. */
  readonly opacity?: number;
}

function layerNameProblem(doc: Document, name: string, self?: string): string | undefined {
  const problem = nameProblem(name);
  if (problem !== undefined) return problem;
  return doc.layers.some((l) => l.name === name && l.id !== self)
    ? `the layer name ${name} is already used`
    : undefined;
}

function opacityProblem(opacity: number | undefined): string | undefined {
  return opacity === undefined || (opacity >= 0 && opacity <= 1)
    ? undefined
    : 'opacity must be in [0, 1]';
}

/** Adds a plain layer on top (order = highest + 1). */
export function addLayer(
  doc: Document,
  name: string,
  options: LayerOptions = {},
): EditResult<{ readonly layerId: string }> {
  const problem = layerNameProblem(doc, name) ?? opacityProblem(options.opacity);
  if (problem !== undefined) return fail(problem);
  const id = `L${String(doc.nextId)}`;
  const layer: Layer = {
    id,
    name,
    visible: options.visible ?? true,
    locked: options.locked ?? false,
    opacity: options.opacity ?? 1,
    order: Math.max(...doc.layers.map((l) => l.order)) + 1,
  };
  return {
    ok: true,
    doc: { ...doc, nextId: doc.nextId + 1, layers: [...doc.layers, layer] },
    layerId: id,
  };
}

/** Changes a layer's name, visibility, lock or opacity. */
export function updateLayer(
  doc: Document,
  id: string,
  patch: LayerOptions & { readonly name?: string },
): EditResult {
  const layer = doc.layers.find((l) => l.id === id);
  if (layer === undefined) return fail(`there is no layer "${id}"`);
  const problem =
    (patch.name === undefined ? undefined : layerNameProblem(doc, patch.name, id)) ??
    opacityProblem(patch.opacity);
  if (problem !== undefined) return fail(problem);
  const next: Layer = { ...layer, ...patch };
  return { ok: true, doc: { ...doc, layers: doc.layers.map((l) => (l.id === id ? next : l)) } };
}

/**
 * Removes a layer. Degenerate cases: "main" → error; the source of another layer's rule
 * → error. Objects that lived only in it move to "main"; a derived layer's managed
 * images are removed with their dependents (listed in `removed`); views forget it.
 */
export function removeLayer(doc: Document, id: string): EditResult<{ readonly removed: Removal }> {
  if (id === MAIN_LAYER_ID) return fail('the main layer cannot be removed');
  const layer = doc.layers.find((l) => l.id === id);
  if (layer === undefined) return fail(`there is no layer "${id}"`);
  const user = doc.layers.find((l) => l.rule?.source === id);
  if (user !== undefined)
    return fail(`layer "${layer.name}" is the source of layer "${user.name}"`);
  const removed = dependents(
    doc,
    doc.objects.filter((o) => o.managedBy === id).map((o) => o.id),
  );
  const pruned = applyRemoval(doc, removed);
  const objects = pruned.objects.map((o) => {
    if (!o.layers.includes(id)) return o;
    const rest = o.layers.filter((l) => l !== id);
    return { ...o, layers: rest.length > 0 ? rest : [MAIN_LAYER_ID] };
  });
  const views = pruned.views.map((v) => {
    if (!(id in v.layerVisibility)) return v;
    const kept = Object.entries(v.layerVisibility).filter(([k]) => k !== id);
    return { ...v, layerVisibility: Object.fromEntries(kept) };
  });
  return {
    ok: true,
    doc: { ...pruned, objects, views, layers: pruned.layers.filter((l) => l.id !== id) },
    removed,
  };
}
