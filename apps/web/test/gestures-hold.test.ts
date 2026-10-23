/**
 * ADR-0029: on touch, a press held LONG_PRESS_MS without moving opens the style card (the
 * browser's contextmenu does it where it sends one). The long press ends the gesture: a drag
 * it started is cancelled (no edit, no history) and the release is no click.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import { layout } from '@geomira/scene/display';
import { toScreen, type Vec2 } from '@geomira/scene/viewport';
import { CLICK_SLOP, Gestures, LONG_PRESS_MS, type Hold } from '../src/gestures';
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
  const timer = { f: null as (() => void) | null, ms: 0, cancelled: 0 };
  const held: Vec2[] = [];
  const hold: Hold = {
    schedule: (f, ms) => {
      timer.f = f;
      timer.ms = ms;
      return () => {
        timer.cancelled += 1;
        timer.f = null;
      };
    },
    onHold: (q) => {
      held.push(q);
    },
  };
  return { store, display, a, timer, held, gestures: new Gestures(store, hold) };
}

describe('a long press on touch (ADR-0029)', () => {
  it('held still: the hold fires once; the drag it started is cancelled; the release is no click', () => {
    const { store, display, a, timer, held, gestures } = setup();
    const before = print(store.current().doc);
    gestures.down(1, a, display(), true);
    expect(timer.ms).toBe(LONG_PRESS_MS);
    expect(store.current().drag).not.toBeNull();
    gestures.move(1, { x: a.x + 1, y: a.y }, display());
    timer.f?.();
    expect(held).toEqual([a]);
    expect(store.current().drag).toBeNull();
    gestures.move(1, { x: a.x + 40, y: a.y }, display());
    gestures.up(1, { x: a.x + 40, y: a.y }, display());
    expect(print(store.current().doc)).toBe(before);
    expect(store.current().history.past).toHaveLength(0);
    expect(store.current().selection).toEqual([]);
    expect(store.getSnapshot().notice).toBeNull();
  });

  it('a press that moves, is released or gets a second finger is no long press', () => {
    const { display, a, timer, held, gestures } = setup();
    gestures.down(1, a, display(), true);
    gestures.move(1, { x: a.x + CLICK_SLOP + 2, y: a.y }, display());
    expect(timer.cancelled).toBe(1);
    gestures.up(1, { x: a.x + CLICK_SLOP + 2, y: a.y }, display());
    gestures.down(1, a, display(), true);
    gestures.up(1, a, display());
    expect(timer.cancelled).toBe(2);
    gestures.down(1, a, display(), true);
    gestures.down(2, { x: a.x + 100, y: a.y }, display(), true);
    expect(timer.cancelled).toBe(3);
    expect(held).toEqual([]);
  });

  it('a pointercancel cancels it; a mouse press never starts one', () => {
    const { display, a, timer, held, gestures } = setup();
    gestures.down(1, a, display(), true);
    gestures.cancel(1);
    expect(timer.cancelled).toBe(1);
    timer.ms = 0;
    gestures.down(2, a, display());
    expect(timer.ms).toBe(0);
    gestures.up(2, a, display());
    expect(held).toEqual([]);
  });

  it("the browser's contextmenu ends the press as a long press would (endPress)", () => {
    const { store, display, a, timer, held, gestures } = setup();
    const before = print(store.current().doc);
    gestures.down(1, a, display(), true);
    expect(store.current().drag).not.toBeNull();
    gestures.endPress();
    expect(timer.cancelled).toBe(1);
    expect(store.current().drag).toBeNull();
    gestures.move(1, { x: a.x + 50, y: a.y }, display());
    gestures.up(1, { x: a.x + 50, y: a.y }, display());
    expect(print(store.current().doc)).toBe(before);
    expect(store.current().history.past).toHaveLength(0);
    expect(held).toEqual([]);
    // With no press (a mouse's right button presses nothing), it does nothing.
    gestures.endPress();
    expect(store.getSnapshot().notice).toBeNull();
  });

  it('without a hold the gestures work as before (no timer at all)', () => {
    const store = new EditorStore({ registry }, () => undefined);
    store.openText('@version 1\nA = (0, 0)\n', 'new');
    const s = store.current();
    const d = layout(buildScene(s.doc, s.values.values), { viewport: s.viewport, size: SIZE });
    const g = new Gestures(store);
    const a = toScreen({ viewport: s.viewport, size: SIZE }, { x: 0, y: 0 });
    g.down(1, a, d, true);
    g.up(1, a, d);
    expect(store.current().drag).toBeNull();
  });
});
