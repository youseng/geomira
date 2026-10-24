/**
 * Bug-fix round (ADR-0028): Escape during a drag cancelled it (page.ts), but the pointer
 * gesture went on sending dragMove and dragEnd, so the user saw "dragMove without a drag in
 * progress". A drag ended elsewhere (Escape, undo) now ends the gesture quietly.
 */
import { describe, expect, it } from 'vitest';
import { findObjectByName } from '@geomira/kernel/document';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import { layout } from '@geomira/scene/display';
import { toScreen } from '@geomira/scene/viewport';
import { Gestures } from '../src/gestures';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

const SIZE = { width: 800, height: 600 };

function setup() {
  const store = new EditorStore({ registry }, () => undefined);
  store.openText('@version 1\nA = (0, 0)\nB = (4, 0)\n', 'new');
  const display = () => {
    const s = store.current();
    return layout(buildScene(s.doc, s.values.values), { viewport: s.viewport, size: SIZE });
  };
  const view = { viewport: store.current().viewport, size: SIZE };
  const a = toScreen(view, { x: 0, y: 0 });
  return { store, display, a, gestures: new Gestures(store) };
}

describe('a drag cancelled by the keyboard', () => {
  it('the gesture ends quietly: no refusal, no pan, no click, the figure as before', () => {
    const { store, display, a, gestures } = setup();
    const before = print(store.current().doc);
    gestures.down(1, a, display());
    expect(store.current().drag).not.toBeNull();
    gestures.move(1, { x: a.x + 30, y: a.y + 10 }, display());
    store.apply({ kind: 'dragCancel' }); // Escape (page.ts)
    const viewport = store.current().viewport;
    gestures.move(1, { x: a.x + 60, y: a.y + 20 }, display());
    gestures.up(1, { x: a.x + 60, y: a.y + 20 }, display());
    expect(store.getSnapshot().notice).toBeNull();
    expect(store.current().viewport).toEqual(viewport);
    expect(print(store.current().doc)).toBe(before);
    expect(store.current().selection).toEqual([]);
  });

  it('cancelled before it moved: the release is no click and no refusal', () => {
    const { store, display, a, gestures } = setup();
    gestures.down(1, a, display());
    store.apply({ kind: 'dragCancel' });
    gestures.up(1, a, display());
    expect(store.getSnapshot().notice).toBeNull();
    expect(store.current().selection).toEqual([]);
  });

  it('a second finger or a pointercancel after it refuses nothing', () => {
    const { store, display, a, gestures } = setup();
    gestures.down(1, a, display());
    store.apply({ kind: 'dragCancel' });
    gestures.down(2, { x: a.x + 100, y: a.y }, display());
    gestures.cancel(2);
    gestures.cancel(1);
    expect(store.getSnapshot().notice).toBeNull();
    gestures.down(3, a, display());
    store.apply({ kind: 'dragCancel' });
    gestures.cancel(3);
    expect(store.getSnapshot().notice).toBeNull();
  });

  it('an uncancelled drag still moves the point', () => {
    const { store, display, a, gestures } = setup();
    gestures.down(1, a, display());
    gestures.move(1, { x: a.x + 50, y: a.y }, display());
    gestures.up(1, { x: a.x + 50, y: a.y }, display());
    const A = findObjectByName(store.current().doc, 'A');
    expect(print(store.current().doc)).not.toContain('A = (0, 0)');
    expect(A).toBeDefined();
    expect(store.getSnapshot().notice).toBeNull();
  });
});
