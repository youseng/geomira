/**
 * ADR-0062 through the page's gestures: with the mouse, a left press on empty canvas in the
 * Move tool draws a selection box (the objects wholly inside are selected; Shift or Ctrl adds
 * them); a right press pans in every tool and, when it does not move, opens the style card;
 * a press on a point still drags it; a finger still pans; other tools keep panning.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import { layout } from '@geomira/scene/display';
import { toScreen, type Vec2 } from '@geomira/scene/viewport';
import { selectBox } from '../src/box-select';
import { Gestures, type BoxHost } from '../src/gestures';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

const SIZE = { width: 800, height: 600 };
const TEXT = '@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\nl = line(A, B)\ns = segment(A, C)\n';

function setup() {
  const store = new EditorStore({ registry }, () => undefined);
  store.openText(TEXT, 'new');
  const scene = () => buildScene(store.current().doc, store.current().values.values);
  const display = () => layout(scene(), { viewport: store.current().viewport, size: SIZE });
  const at = (x: number, y: number): Vec2 =>
    toScreen({ viewport: store.current().viewport, size: SIZE }, { x, y });
  const boxes: (object | null)[] = [];
  const cards: Vec2[] = [];
  const box: BoxHost = {
    change: (b) => boxes.push(b),
    done: (a, b, d, extend) => {
      selectBox(store, scene(), d.view, a, b, extend);
    },
  };
  const hold = { schedule: () => () => undefined, onHold: (q: Vec2) => cards.push(q) };
  const gestures = new Gestures(store, hold, undefined, box);
  /** A mouse drag between two world points with a button. */
  const drag = (
    from: [number, number],
    to: [number, number],
    press: 'left' | 'right',
    extend = false,
  ) => {
    const [a, b] = [at(...from), at(...to)];
    gestures.down(1, a, display(), false, press);
    gestures.move(1, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, display());
    gestures.move(1, b, display());
    gestures.up(1, b, display(), extend);
  };
  const selected = () =>
    store
      .current()
      .selection.map((id) => store.current().doc.objects.find((o) => o.id === id)?.name);
  return { store, gestures, display, at, drag, selected, boxes, cards };
}

describe('the left button on empty canvas, Move tool', () => {
  it('draws a box and selects what is wholly inside; the box is gone at the end', () => {
    const { drag, selected, boxes, store } = setup();
    const viewport = store.current().viewport;
    drag([-1, 4], [2, -1], 'left');
    expect(selected()).toEqual(['A', 'C', 's']);
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    expect(boxes[0]).not.toBeNull();
    expect(boxes[boxes.length - 1]).toBeNull();
    // It does not pan, and it is no document edit.
    expect(store.current().viewport).toEqual(viewport);
    expect(store.current().history.past).toEqual([]);
  });

  it('a box in any direction; an empty box clears the selection', () => {
    const { drag, selected } = setup();
    drag([5, -1], [3, 1], 'left');
    expect(selected()).toEqual(['B']);
    drag([6, 6], [7, 7], 'left');
    expect(selected()).toEqual([]);
  });

  it('with Shift or Ctrl the box adds to the selection, and an empty one keeps it', () => {
    const { drag, selected } = setup();
    drag([-1, 1], [1, -1], 'left');
    drag([3, 1], [5, -1], 'left', true);
    expect(selected()).toEqual(['A', 'B']);
    drag([6, 6], [7, 7], 'left', true);
    expect(selected()).toEqual(['A', 'B']);
  });

  it('a press on a point still drags the point', () => {
    const { drag, store, boxes } = setup();
    drag([0, 0], [1, 1], 'left');
    expect(print(store.current().doc)).toContain('A = (1, 1)');
    expect(boxes).toEqual([]);
  });

  it('a press that starts on a line (nothing to drag) draws the box too', () => {
    const { drag, selected, store } = setup();
    const viewport = store.current().viewport;
    drag([2, 0], [5, 1], 'left');
    expect(selected()).toEqual(['B']);
    expect(store.current().viewport).toEqual(viewport);
  });
});

describe('the right button', () => {
  it('pans, in the Move tool and in a construction tool; it selects and builds nothing', () => {
    for (const tool of ['move', 'segment'] as const) {
      const { store, drag, selected, cards } = setup();
      store.apply({ kind: 'tool', tool });
      const before = store.current().viewport;
      drag([0, 0], [2, 1], 'right');
      const after = store.current().viewport;
      expect(after.cx).toBeCloseTo(before.cx - 2, 9);
      expect(after.cy).toBeCloseTo(before.cy - 1, 9);
      expect(selected()).toEqual([]);
      expect(print(store.current().doc)).toBe(TEXT);
      expect(store.current().toolState.picks).toEqual([]);
      expect(cards).toEqual([]);
    }
  });

  it('released where it went down: the style card, never a tool’s click', () => {
    const { store, gestures, display, at, cards, selected } = setup();
    store.apply({ kind: 'tool', tool: 'point' });
    gestures.down(1, at(2, 2), display(), false, 'right');
    gestures.up(1, at(2, 2), display());
    expect(cards).toEqual([at(2, 2)]);
    expect(print(store.current().doc)).toBe(TEXT);
    expect(selected()).toEqual([]);
  });
});

describe('what stays as it was', () => {
  it('a finger on empty canvas pans (no box)', () => {
    const { store, gestures, display, at, boxes } = setup();
    const before = store.current().viewport;
    gestures.down(1, at(6, 6), display(), true);
    gestures.move(1, at(7, 6), display());
    gestures.up(1, at(7, 6), display());
    expect(store.current().viewport.cx).toBeCloseTo(before.cx - 1, 9);
    expect(boxes).toEqual([]);
  });

  it('the left button in a construction tool pans on a drag', () => {
    const { store, drag, boxes } = setup();
    store.apply({ kind: 'tool', tool: 'segment' });
    const before = store.current().viewport;
    drag([6, 6], [7, 6], 'left');
    expect(store.current().viewport.cx).toBeCloseTo(before.cx - 1, 9);
    expect(boxes).toEqual([]);
  });

  it('a second finger ends a box without selecting', () => {
    const { gestures, display, at, selected, boxes } = setup();
    gestures.down(1, at(-1, 4), display(), false, 'left');
    gestures.move(1, at(2, -1), display());
    gestures.down(2, at(3, 3), display(), true);
    gestures.up(2, at(3, 3), display());
    gestures.up(1, at(2, -1), display());
    expect(selected()).toEqual([]);
    expect(boxes[boxes.length - 1]).toBeNull();
  });
});
