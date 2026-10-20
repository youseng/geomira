/**
 * Views (SPEC §8.3): View = { name, layerVisibility, viewport? }, a named set of layer
 * visibilities and optionally a viewport. v1 has the data model, its edits and tests (the
 * UI is v1.1): add a view, apply it (the document's layers take the view's visibility,
 * and its viewport if it has one), remove it. Invariant I7: views reference existing
 * layers and view names are unique; removing a layer drops it from every view (layers.ts).
 */
import type { Document, View, Viewport } from './document';
import { fail, type EditResult } from './edit';
import { nameProblem } from './names';

function viewportProblem(v: Viewport | undefined): string | undefined {
  if (v === undefined) return undefined;
  const finite = [v.cx, v.cy, v.zoom].every((x) => Number.isFinite(x));
  return finite && v.zoom > 0 ? undefined : 'a viewport needs finite coordinates and a zoom > 0';
}

/**
 * Adds a view. Degenerate cases: a name that is not grammatical or is already a view's →
 * error; a layer id that does not exist → error; a viewport with a non-finite coordinate
 * or a zoom ≤ 0 → error. An empty layerVisibility is allowed (the view sets only the
 * viewport, or nothing).
 */
export function addView(doc: Document, view: View): EditResult {
  const problem = nameProblem(view.name);
  if (problem !== undefined) return fail(problem);
  if (doc.views.some((v) => v.name === view.name))
    return fail(`the view name ${view.name} is already used`);
  const missing = Object.keys(view.layerVisibility).find(
    (id) => !doc.layers.some((l) => l.id === id),
  );
  if (missing !== undefined) return fail(`there is no layer "${missing}"`);
  const vp = viewportProblem(view.viewport);
  if (vp !== undefined) return fail(vp);
  const copy: View = {
    name: view.name,
    layerVisibility: { ...view.layerVisibility },
    ...(view.viewport === undefined ? {} : { viewport: { ...view.viewport } }),
  };
  return { ok: true, doc: { ...doc, views: [...doc.views, copy] } };
}

/**
 * Applies a view: every layer it lists gets its visibility (the others keep theirs), and
 * the document's viewport becomes the view's when it has one. Degenerate: no such view →
 * error. Applying the same view twice changes nothing more (idempotent).
 */
export function applyView(doc: Document, name: string): EditResult {
  const view = doc.views.find((v) => v.name === name);
  if (view === undefined) return fail(`there is no view "${name}"`);
  const layers = doc.layers.map((l) => {
    const visible = view.layerVisibility[l.id];
    return visible === undefined || visible === l.visible ? l : { ...l, visible };
  });
  return {
    ok: true,
    doc: { ...doc, layers, viewport: view.viewport ?? doc.viewport },
  };
}

/** Removes a view (layers are untouched). Degenerate: no such view → error. */
export function removeView(doc: Document, name: string): EditResult {
  if (!doc.views.some((v) => v.name === name)) return fail(`there is no view "${name}"`);
  return { ok: true, doc: { ...doc, views: doc.views.filter((v) => v.name !== name) } };
}
