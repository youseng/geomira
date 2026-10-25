/**
 * The views UI's actions (SPEC §8.3, §15: views UI in v1.1, Run 13). A view is a named set of
 * layer visibilities and a viewport (the data model, language and kernel edits exist since
 * Run 4). Every action here is ONE document edit through applyEdit: it is in the text
 * (`@view …`, and `@viewport` after a switch), it is one history entry, and undo restores
 * the document exactly (L6). The web app only wires these to its controls and keys.
 *
 * The canvas: the editor's viewport is outside history (ADR-0012 decision 4). Switching to a
 * view that has a viewport makes it the document's `@viewport` (the kernel's applyView) AND
 * moves the canvas there (a UI viewport edit after the document edit), so the canvas shows
 * the view. Undo restores the document's layers and `@viewport`, not the canvas (as undo
 * never moves the canvas). Saving a view records the canvas's viewport, which is what the
 * user sees.
 */
import type { Document, View } from '@geomira/kernel/document';
import { applyEdit } from './edit';
import { done, refuse, type EditResult } from './result';
import type { EditorEnv, EditorState } from './state';

/** The view the current state would save: every layer's visibility and the canvas's viewport. */
export function viewOf(state: EditorState, name: string): View {
  return {
    name,
    layerVisibility: Object.fromEntries(state.doc.layers.map((l) => [l.id, l.visible])),
    viewport: { ...state.viewport },
  };
}

/** Whether the document shows `view`: its layers have its visibilities, and its viewport. */
export function viewShown(doc: Document, view: View): boolean {
  const layers = Object.entries(view.layerVisibility).every(
    ([id, visible]) => doc.layers.find((l) => l.id === id)?.visible === visible,
  );
  if (!layers) return false;
  const v = view.viewport;
  if (v === undefined) return true;
  const d = doc.viewport;
  return d !== null && d.cx === v.cx && d.cy === v.cy && d.zoom === v.zoom;
}

/** The first view the document shows (viewShown), or undefined. */
export function currentView(doc: Document): string | undefined {
  return doc.views.find((v) => viewShown(doc, v))?.name;
}

/** A free view name: view1, view2, … (the first not used by a view). */
export function suggestedViewName(doc: Document): string {
  for (let i = 1; ; i += 1) {
    const name = `view${String(i)}`;
    if (!doc.views.some((v) => v.name === name)) return name;
  }
}

/** Saves the current layers and canvas as the view `name` (one addView edit). */
export function saveView(state: EditorState, name: string, env: EditorEnv): EditResult {
  return applyEdit(state, { kind: 'addView', view: viewOf(state, name.trim()) }, env);
}

/**
 * Switches to the view `name`: one applyView edit, then the canvas moves to the view's
 * viewport when it has one. A view the document already shows needs no document edit (no
 * history entry): only the canvas moves. Degenerate: no such view → refused, state unchanged.
 */
export function switchView(state: EditorState, name: string, env: EditorEnv): EditResult {
  const view = state.doc.views.find((v) => v.name === name);
  if (view === undefined) return refuse(state, `there is no view "${name}"`);
  const r = viewShown(state.doc, view)
    ? done(state)
    : applyEdit(state, { kind: 'applyView', name }, env);
  if (!r.ok || view.viewport === undefined) return r;
  const moved = applyEdit(r.state, { kind: 'viewport', viewport: view.viewport }, env);
  return moved.ok ? { ...r, state: moved.state } : refuse(state, moved.reason);
}

/**
 * Switches to the next (step 1) or previous (step −1) view in the document's order, after
 * the one the document shows (the first or last view when it shows none). Degenerate: no
 * views → refused with how to make one.
 */
export function cycleView(state: EditorState, step: 1 | -1, env: EditorEnv): EditResult {
  const views = state.doc.views;
  const n = views.length;
  if (n === 0) return refuse(state, 'there are no views: save one in the Layers panel');
  const at = views.findIndex((v) => v.name === currentView(state.doc));
  const i = at === -1 ? (step === 1 ? 0 : n - 1) : (at + step + n) % n;
  const view = views[i];
  return view === undefined ? refuse(state, 'no such view') : switchView(state, view.name, env);
}

/** Renames a view (one renameView edit). */
export function renameView(
  state: EditorState,
  from: string,
  to: string,
  env: EditorEnv,
): EditResult {
  const name = to.trim();
  return name === from
    ? done(state)
    : applyEdit(state, { kind: 'renameView', from, to: name }, env);
}

/** Deletes a view (one removeView edit; the layers are untouched). */
export function deleteView(state: EditorState, name: string, env: EditorEnv): EditResult {
  return applyEdit(state, { kind: 'removeView', name }, env);
}
