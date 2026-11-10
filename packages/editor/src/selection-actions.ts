/**
 * What the GUI does to SEVERAL objects at once, and to layers from the Layers panel
 * (ADR-0060): the selection bar's actions (hide, show, labels, remove, move to a layer), the
 * Move tool's extended click (Shift or Ctrl: the clicked object joins or leaves the selection),
 * "select all", and the name a new layer is offered. Every action is ONE edit for applyEdit (a
 * batch: one history entry, one undo), built from the kernel's document edits, so locked
 * layers, managed images and names are judged by their owners; nothing here changes a
 * document itself. No DOM.
 *
 * Degenerate cases: an empty selection, or a selection the action changes nothing of (every
 * object hidden already, …) → { ok: false } with the reason, never an empty history entry.
 */
import { findLayer, type DocObject, type Document, type Style } from '@geomira/kernel/document';
import { refsOf } from '@geomira/kernel/expr';
import { nameProblem } from '@geomira/kernel/names';
import { assertNever } from '@geomira/num/assert';
import type { DocumentEdit, Edit } from './edit';
import type { EditorState } from './state';

export type SelectionAction =
  | { readonly kind: 'hide' }
  | { readonly kind: 'show' }
  | { readonly kind: 'hideLabels' }
  | { readonly kind: 'showLabels' }
  | { readonly kind: 'remove' }
  /** The selected objects go to this layer alone (managed images follow their sources). */
  | { readonly kind: 'toLayer'; readonly layer: string };

export type ActionEdit =
  | { readonly ok: true; readonly edit: Edit; readonly count: number }
  | { readonly ok: false; readonly reason: string };

/** A style with `hidden` and `label` replaced (undefined: the key is absent). */
function restyled(s: Style, hidden: boolean | undefined, label: string | undefined): Style {
  return {
    ...(s.color === undefined ? {} : { color: s.color }),
    ...(s.width === undefined ? {} : { width: s.width }),
    ...(s.dash === undefined ? {} : { dash: s.dash }),
    ...(s.opacity === undefined ? {} : { opacity: s.opacity }),
    ...(hidden === undefined ? {} : { hidden }),
    ...(s.noimage === undefined ? {} : { noimage: s.noimage }),
    ...(label === undefined ? {} : { label }),
    ...(s.z === undefined ? {} : { z: s.z }),
    ...(s.labelAngle === undefined ? {} : { labelAngle: s.labelAngle }),
    ...(s.labelDist === undefined ? {} : { labelDist: s.labelDist }),
    ...(s.show === undefined ? {} : { show: s.show }),
    ...(s.digits === undefined ? {} : { digits: s.digits }),
  };
}

/**
 * Whether an object's label is drawn: `label=""` hides it; an absent label shows a point's
 * name and nothing for other kinds (the language's existing form, ADR-0029).
 */
function labelShown(o: DocObject, isPoint: boolean): boolean {
  if (o.style.label === '') return false;
  return o.style.label !== undefined || isPoint;
}

/** The style edit of one object for a style action, or undefined when it changes nothing. */
function styleEdit(
  state: EditorState,
  o: DocObject,
  kind: 'hide' | 'show' | 'hideLabels' | 'showLabels',
): DocumentEdit | undefined {
  const s = o.style;
  const isPoint = state.values.values.get(o.id)?.kind === 'point';
  const to = (style: Style): DocumentEdit => ({ kind: 'style', id: o.id, style });
  switch (kind) {
    case 'hide':
      return s.hidden === true ? undefined : to(restyled(s, true, s.label));
    case 'show':
      return s.hidden === true ? to(restyled(s, undefined, s.label)) : undefined;
    case 'hideLabels':
      return labelShown(o, isPoint) ? to(restyled(s, s.hidden, '')) : undefined;
    case 'showLabels':
      if (labelShown(o, isPoint)) return undefined;
      // A point's own name is its default label; another kind's label is written out.
      return to(restyled(s, s.hidden, isPoint ? undefined : o.name));
    default:
      return assertNever(kind, 'style action');
  }
}

/** The objects of `ids`, in construction order (a cascade removes dependents after sources). */
function selected(state: EditorState, ids: readonly number[] = state.selection): DocObject[] {
  return state.doc.objects.filter((o) => ids.includes(o.id));
}

function layerEdits(objects: readonly DocObject[], layer: string): DocumentEdit[] {
  return objects
    .filter((o) => o.managedBy === undefined)
    .filter((o) => !(o.layers.length === 1 && o.layers[0] === layer))
    .map((o) => ({ kind: 'setLayers', id: o.id, layers: [layer] }));
}

/**
 * The removals of a selection: an object that another selected object's removal takes with it
 * is left out (its `remove` would name an object that is gone), as are managed images, which
 * follow their sources.
 */
function removeEdits(state: EditorState, objects: readonly DocObject[]): DocumentEdit[] {
  const gone = new Set<number>();
  const edits: DocumentEdit[] = [];
  for (const o of state.doc.objects) {
    if (refsOf(o.def).some((id) => gone.has(id))) {
      gone.add(o.id);
      continue;
    }
    if (!objects.includes(o) || o.managedBy !== undefined) continue;
    gone.add(o.id);
    edits.push({ kind: 'remove', id: o.id });
  }
  return edits;
}

const LABELS: Record<SelectionAction['kind'], string> = {
  hide: 'hide',
  show: 'show',
  hideLabels: 'hide labels',
  showLabels: 'show labels',
  remove: 'remove',
  toLayer: 'move to layer',
};

const NOTHING: Record<SelectionAction['kind'], string> = {
  hide: 'every selected object is hidden already',
  show: 'no selected object is hidden',
  hideLabels: 'no selected object shows a label',
  showLabels: 'every selected object shows its label already',
  remove: 'the selected objects are images: they follow their sources',
  toLayer: 'the selected objects are in that layer already',
};

/**
 * The one edit of `action` on the selection, or on `ids` (the Objects panel's eye acts on its
 * row's object, selected or not); `count`: the objects it changes. Or why there is none.
 */
export function selectionEdit(
  state: EditorState,
  action: SelectionAction,
  ids: readonly number[] = state.selection,
): ActionEdit {
  const objects = selected(state, ids);
  if (objects.length === 0) return { ok: false, reason: 'nothing is selected' };
  const edits = editsOf(state, objects, action);
  if (typeof edits === 'string') return { ok: false, reason: edits };
  if (edits.length === 0) return { ok: false, reason: NOTHING[action.kind] };
  return {
    ok: true,
    edit: { kind: 'batch', label: LABELS[action.kind], edits },
    count: edits.length,
  };
}

function editsOf(
  state: EditorState,
  objects: readonly DocObject[],
  action: SelectionAction,
): DocumentEdit[] | string {
  switch (action.kind) {
    case 'hide':
    case 'show':
    case 'hideLabels':
    case 'showLabels':
      return objects.flatMap((o) => styleEdit(state, o, action.kind) ?? []);
    case 'remove':
      return removeEdits(state, objects);
    case 'toLayer':
      return findLayer(state.doc, action.layer) === undefined
        ? `there is no layer "${action.layer}"`
        : layerEdits(objects, action.layer);
    default:
      return assertNever(action, 'selection action');
  }
}

/** What the selection bar offers for the current selection (a button is shown when true). */
export interface SelectionSummary {
  readonly count: number;
  /** "A", "A, B, ω" or "5 objects". */
  readonly text: string;
  readonly canHide: boolean;
  readonly canShow: boolean;
  readonly canHideLabels: boolean;
  readonly canShowLabels: boolean;
}

/** At most this many names are listed before the bar says "n objects". */
export const SELECTION_NAMES = 3;

export function selectionSummary(state: EditorState): SelectionSummary {
  const objects = selected(state);
  const can = (kind: 'hide' | 'show' | 'hideLabels' | 'showLabels'): boolean =>
    objects.some((o) => styleEdit(state, o, kind) !== undefined);
  return {
    count: objects.length,
    text:
      objects.length <= SELECTION_NAMES
        ? objects.map((o) => o.name).join(', ')
        : `${String(objects.length)} objects`,
    canHide: can('hide'),
    canShow: can('show'),
    canHideLabels: can('hideLabels'),
    canShowLabels: can('showLabels'),
  };
}

/**
 * "Select all": every object that is drawn or could be (not hidden, in a visible layer), in
 * construction order. Hidden objects are selected from the Objects panel, where they are listed.
 */
export function selectableIds(state: EditorState): number[] {
  const visible = new Set(state.doc.layers.filter((l) => l.visible).map((l) => l.id));
  return state.doc.objects
    .filter((o) => o.style.hidden !== true && o.layers.some((l) => visible.has(l)))
    .map((o) => o.id);
}

/** The first of layer1, layer2, … that no layer has: the name a new layer is offered. */
export function nextLayerName(doc: Document): string {
  const used = new Set(doc.layers.map((l) => l.name));
  for (let n = 1; ; n += 1) {
    const name = `layer${String(n)}`;
    if (!used.has(name)) return name;
  }
}

/** Why `name` cannot name a new layer (or layer `self`, when renaming), or undefined. */
export function layerNameProblem(doc: Document, name: string, self?: string): string | undefined {
  if (name === '') return 'type a name for the layer';
  const problem = nameProblem(name);
  if (problem !== undefined) return problem;
  return doc.layers.some((l) => l.name === name && l.id !== self)
    ? `the layer name ${name} is already used`
    : undefined;
}
