/**
 * Drag edits (SPEC §12): dragStart(id) → dragMove(to)… → dragEnd | dragCancel. A gesture is
 * ONE history entry: the first move records it, later moves amend it (coalescing), dragEnd
 * rounds the moved coordinates (drag.ts) inside the same entry, dragCancel restores the
 * document from before the gesture and drops its entry. Out-of-order edits (a move without
 * a start, a second start, an end without a drag) are refused with the state unchanged.
 */
import { applyDocEdit } from '@geomira/kernel/doc-edit';
import { findObject } from '@geomira/kernel/document';
import { evalContextFor } from '@geomira/kernel/context';
import type { Vec } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import {
  chainScale,
  dragBase,
  dragDefinition,
  dragGrid,
  roundedDefinition,
  withinRounding,
} from './drag';
import { dependentsKept } from './drag-dependents';
import { amendLast, dropLast, record } from './history';
import { lockedDrag } from './locked';
import { done, refuse, type EditResult } from './result';
import { withDocument, type DragState, type EditorEnv, type EditorState } from './state';

export type DragEdit =
  | { readonly kind: 'dragStart'; readonly id: number }
  /** The dragged object's new position, world coordinates. */
  | { readonly kind: 'dragMove'; readonly to: Vec<number> }
  | { readonly kind: 'dragEnd' }
  | { readonly kind: 'dragCancel' };

function start(state: EditorState, id: number): EditResult {
  if (state.drag !== null) return refuse(state, 'a drag is already in progress');
  const base = dragBase(state.doc, id, state.values);
  if (typeof base === 'string') return refuse(state, base);
  const locked = lockedDrag(state.doc, [id, base]);
  if (locked !== undefined) return refuse(state, locked);
  const drag: DragState = { id, base, before: state.doc, moved: false };
  return done({ ...state, drag });
}

function move(state: EditorState, drag: DragState, to: Vec<number>, env: EditorEnv): EditResult {
  const def = dragDefinition(state.doc, drag.id, drag.base, to, state.values);
  if (typeof def === 'string') return refuse(state, def);
  const r = applyDocEdit(state.doc, env.registry, { kind: 'redefine', id: drag.base, def });
  if (!r.ok) return refuse(state, r.error);
  const label = `drag ${findObject(state.doc, drag.id)?.name ?? '?'}`;
  const history = drag.moved
    ? amendLast(state.history, r.doc)
    : record(state.history, label, drag.before, r.doc);
  const next = withDocument(state, r.doc, env);
  return done({ ...next, history, drag: { ...drag, moved: true } });
}

/** Rounds the base's coordinates at drag end, unless that would move the object visibly. */
function end(state: EditorState, drag: DragState, env: EditorEnv): EditResult {
  const finished = { ...state, drag: null };
  const base = findObject(state.doc, drag.base);
  const c = evalContextFor(state.doc);
  if (!drag.moved || base === undefined || !c.ok) return done(finished);
  const k = chainScale(state.doc, drag.id, state.values);
  const exp = dragGrid(c.ctx.scale, state.viewport.zoom, k);
  const def = roundedDefinition(state.doc, base, exp, state.values);
  const r = applyDocEdit(state.doc, env.registry, { kind: 'redefine', id: drag.base, def });
  if (!r.ok) return done(finished);
  const rounded = withDocument(finished, r.doc, env);
  // The object under the cursor and the object rewritten (an image's source, a text's
  // anchor) both stay within ROUNDING_PX on screen, and every other object keeps its kind
  // and stays within DEPENDENT_PX (no selector flips: ADR-0027), or the rounding is not
  // applied.
  const zoom = state.viewport.zoom;
  const [before, after] = [state.values.values, rounded.values.values];
  const kept =
    [drag.id, drag.base].every((id) => withinRounding(before.get(id), after.get(id), zoom)) &&
    dependentsKept(before, after, zoom, new Set([drag.id, drag.base]));
  if (!kept) return done(finished);
  return done({ ...rounded, history: amendLast(state.history, r.doc) });
}

function cancel(state: EditorState, drag: DragState, env: EditorEnv): EditResult {
  const restored = withDocument({ ...state, drag: null }, drag.before, env);
  return done({ ...restored, history: drag.moved ? dropLast(state.history) : state.history });
}

export function dragEdit(state: EditorState, e: DragEdit, env: EditorEnv): EditResult {
  if (e.kind === 'dragStart') return start(state, e.id);
  const drag = state.drag;
  if (drag === null) return refuse(state, `${e.kind} without a drag in progress`);
  switch (e.kind) {
    case 'dragMove':
      return move(state, drag, e.to, env);
    case 'dragEnd':
      return end(state, drag, env);
    case 'dragCancel':
      return cancel(state, drag, env);
    default:
      return assertNever(e, 'drag edit');
  }
}
