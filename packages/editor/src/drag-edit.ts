/**
 * Drag edits (SPEC §12): dragStart(id) → dragMove(to)… → dragEnd | dragCancel. A label drag
 * (ADR-0049, label-drag.ts) is the same protocol: dragStart(id, part 'label') → dragLabel(angle,
 * dist)… → dragEnd | dragCancel; each kind of move is refused on the other kind of drag. A gesture is
 * ONE history entry: the first move records it, later moves amend it (coalescing), dragEnd
 * rounds the moved coordinates (drag.ts) inside the same entry, dragCancel restores the
 * document and the undo entries from before the gesture, exactly. Out-of-order edits (a move without
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
import { amendLast, record } from './history';
import { labelDragMove, labelDragStart, labelUnmoved } from './label-drag';
import { lockedDrag } from './locked';
import { done, refuse, type EditResult } from './result';
import { withDocument, type DragState, type EditorEnv, type EditorState } from './state';

export type DragEdit =
  /** `part: 'label'` drags the object's label (ADR-0049); absent, the object itself. */
  | { readonly kind: 'dragStart'; readonly id: number; readonly part?: 'label' }
  /** The dragged object's new position, world coordinates. */
  | { readonly kind: 'dragMove'; readonly to: Vec<number> }
  /** The dragged label's new offset: degrees counter-clockwise as seen, CSS px (ADR-0049). */
  | { readonly kind: 'dragLabel'; readonly angle: number; readonly dist: number }
  | { readonly kind: 'dragEnd' }
  | { readonly kind: 'dragCancel' };

function start(state: EditorState, id: number): EditResult {
  if (state.drag !== null) return refuse(state, 'a drag is already in progress');
  const base = dragBase(state.doc, id, state.values);
  if (typeof base === 'string') return refuse(state, base);
  const locked = lockedDrag(state.doc, [id, base]);
  if (locked !== undefined) return refuse(state, locked);
  const drag: DragState = { id, base, before: state.doc, history: state.history, moved: false };
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

/**
 * The object whose image scale applies to a drag of `id`: a text's anchor (followed while it
 * is a text anchored at an object, so a text at a scaled image rounds as that image does),
 * else `id` itself.
 */
function scaled(state: EditorState, id: number): number {
  let cur = id;
  for (let guard = 0; guard < state.doc.objects.length; guard++) {
    const def = findObject(state.doc, cur)?.def;
    const anchor = def?.kind === 'call' && def.tool === 'text' ? def.args[0] : undefined;
    if (anchor?.kind !== 'ref') return cur;
    cur = anchor.id;
  }
  return cur;
}

/** Rounds the base's coordinates at drag end, unless that would move the object visibly. */
function end(state: EditorState, drag: DragState, env: EditorEnv): EditResult {
  const finished = { ...state, drag: null };
  // A label dropped where it was is no edit: as if the drag had been cancelled.
  if (drag.part === 'label')
    return drag.moved && labelUnmoved(state, drag) ? cancel(state, drag, env) : done(finished);
  const base = findObject(state.doc, drag.base);
  const c = evalContextFor(state.doc);
  if (!drag.moved || base === undefined || !c.ok) return done(finished);
  const k = chainScale(state.doc, scaled(state, drag.id), state.values);
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
  // The undo entries come back exactly (the drag's entry may have pushed the oldest one out
  // of a full history); the redo stack stays as the drag's first move left it (cleared).
  const history = drag.moved
    ? { past: drag.history.past, future: state.history.future }
    : state.history;
  return done({ ...restored, history });
}

export function dragEdit(state: EditorState, e: DragEdit, env: EditorEnv): EditResult {
  if (e.kind === 'dragStart')
    return e.part === 'label' ? labelDragStart(state, e.id) : start(state, e.id);
  const drag = state.drag;
  if (drag === null) return refuse(state, `${e.kind} without a drag in progress`);
  switch (e.kind) {
    case 'dragMove':
      return drag.part === 'label'
        ? refuse(state, 'a label drag moves the label: dragLabel')
        : move(state, drag, e.to, env);
    case 'dragLabel':
      return drag.part === 'label'
        ? labelDragMove(state, drag, e.angle, e.dist, env)
        : refuse(state, 'an object drag moves the object: dragMove');
    case 'dragEnd':
      return end(state, drag, env);
    case 'dragCancel':
      return cancel(state, drag, env);
    default:
      return assertNever(e, 'drag edit');
  }
}
