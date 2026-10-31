/**
 * Label drags (ADR-0049): the drag protocol of drag-edit.ts applied to a label. dragStart(id,
 * part 'label') → dragLabel(angle, dist)… → dragEnd | dragCancel. Each move writes the
 * object's `labelAngle` / `labelDist` style fields (the text's `label_angle` / `label_dist`)
 * through the kernel's style edit; the first move records the gesture's history entry and
 * later moves amend it (coalescing), so a whole drag is ONE entry; dragCancel (drag-edit.ts)
 * restores the document and the history from before the gesture. The editor knows nothing of
 * the screen: the host computes the offset from the pointer (scene's labelOffset).
 *
 * Rounding and limits, at every move (so what the drag shows is what is written): the angle
 * in whole degrees in [0, 360), the distance in whole px clamped to [0, MAX_LABEL_DRAG_PX].
 * Any object with a style has a label offset (points, lines, circles, polygons, marks, and
 * any later labelled display value); whether a label is drawn is the scene's business.
 */
import { applyDocEdit } from '@geomira/kernel/doc-edit';
import { findObject, type Style } from '@geomira/kernel/document';
import { amendLast, record } from './history';
import { lockedDrag } from './locked';
import { done, refuse, type EditResult } from './result';
import { withDocument, type DragState, type EditorEnv, type EditorState } from './state';

/** The farthest a label is dragged from its anchor, CSS px (the scene caps at 1000). */
export const MAX_LABEL_DRAG_PX = 100;

/** The style with the label offset of a drag (rounded and clamped, see the module comment). */
export function labelOffsetStyle(style: Style, angle: number, dist: number): Style {
  const a = ((Math.round(angle) % 360) + 360) % 360;
  const d = Math.min(MAX_LABEL_DRAG_PX, Math.max(0, Math.round(dist)));
  return { ...style, labelAngle: a, labelDist: d };
}

/**
 * Starts a label drag of object `id`. Degenerate: a drag in progress, a missing object, an
 * object in a locked layer (ADR-0020) → refused with the reason, the state unchanged.
 */
export function labelDragStart(state: EditorState, id: number): EditResult {
  if (state.drag !== null) return refuse(state, 'a drag is already in progress');
  if (findObject(state.doc, id) === undefined)
    return refuse(state, `there is no object #${String(id)}`);
  const locked = lockedDrag(state.doc, [id]);
  if (locked !== undefined) return refuse(state, locked);
  const drag: DragState = {
    id,
    base: id,
    before: state.doc,
    history: state.history,
    moved: false,
    part: 'label',
  };
  return done({ ...state, drag });
}

/**
 * Moves the dragged label to the offset (angle in degrees, distance in px). Degenerate: a
 * non-finite angle or distance → refused; the object gone (it cannot be while the drag
 * refuses document edits) → refused.
 */
export function labelDragMove(
  state: EditorState,
  drag: DragState,
  angle: number,
  dist: number,
  env: EditorEnv,
): EditResult {
  if (!Number.isFinite(angle) || !Number.isFinite(dist))
    return refuse(state, 'a label offset is a finite angle and distance');
  const o = findObject(state.doc, drag.id);
  if (o === undefined) return refuse(state, `there is no object #${String(drag.id)}`);
  const style = labelOffsetStyle(o.style, angle, dist);
  const r = applyDocEdit(state.doc, env.registry, { kind: 'style', id: drag.id, style });
  if (!r.ok) return refuse(state, r.error);
  const history = drag.moved
    ? amendLast(state.history, r.doc)
    : record(state.history, `move the label of ${o.name}`, drag.before, r.doc);
  const next = withDocument(state, r.doc, env);
  return done({ ...next, history, drag: { ...drag, moved: true } });
}

/** Whether the drag left the label where it was (the same offset fields as before it). */
export function labelUnmoved(state: EditorState, drag: DragState): boolean {
  const was = findObject(drag.before, drag.id)?.style;
  const now = findObject(state.doc, drag.id)?.style;
  return was?.labelAngle === now?.labelAngle && was?.labelDist === now?.labelDist;
}
