/**
 * The selection box's result (ADR-0062): the objects of the scene wholly inside the box drawn
 * on the canvas (scene/box.ts) become the selection, or with Shift or Ctrl are added to it.
 * Host code: the geometry is the scene's, the selection a UI edit of the editor.
 */
import { inBox } from '@geomira/scene/box';
import type { Scene } from '@geomira/scene/types';
import { toWorld, type Rect, type Vec2, type View } from '@geomira/scene/viewport';
import type { EditorStore } from './store';

/** The world rectangle of a box drawn between two canvas points (in any order). */
export function boxRect(view: View, a: Vec2, b: Vec2): Rect {
  const [p, q] = [toWorld(view, a), toWorld(view, b)];
  return {
    minX: Math.min(p.x, q.x),
    minY: Math.min(p.y, q.y),
    maxX: Math.max(p.x, q.x),
    maxY: Math.max(p.y, q.y),
  };
}

/** Selects what the box holds; an empty box clears the selection (keeps it when `extend`). */
export function selectBox(
  store: EditorStore,
  scene: Scene,
  view: View,
  a: Vec2,
  b: Vec2,
  extend: boolean,
): void {
  // In construction order, as the selection bar names them (the scene's order is the draw order).
  const inside = new Set(inBox(scene, boxRect(view, a, b)));
  const ids = store
    .current()
    .doc.objects.map((o) => o.id)
    .filter((id) => inside.has(id));
  store.apply({ kind: 'select', ids, mode: extend ? 'add' : 'replace' });
}
