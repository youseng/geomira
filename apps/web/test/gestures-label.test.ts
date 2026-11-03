/**
 * ADR-0049: dragging a label on the canvas. In the Move tool a press inside a label's drawn
 * box drags the label (one edit of label_angle / label_dist at the end; the label follows
 * the pointer); a press that starts a point's drag (the dot and its pick radius) drags the
 * point instead, whatever label overlaps it. A still press is a click; on touch a still
 * press held LONG_PRESS_MS opens the style card of the label's object, and a press that
 * moves past CLICK_SLOP first is a drag. Escape (a dragCancel) ends the gesture quietly.
 */
import { describe, expect, it } from 'vitest';
import { findObjectByName } from '@geomira/kernel/document';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import { layout, type DisplayList } from '@geomira/scene/display';
import { estimatedWidth, labelGlyphs } from '@geomira/scene/label-hit';
import { LABEL_FONT_PX } from '@geomira/scene/label-box';
import { toScreen, type Vec2 } from '@geomira/scene/viewport';
import { CLICK_SLOP, Gestures, LONG_PRESS_MS, pressedObject, type Hold } from '../src/gestures';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

const SIZE = { width: 800, height: 600 };

const FIG = [
  '@version 1',
  'A = (0, 0)',
  'B = (4, 0)',
  'M = midpoint(A, B)',
  'E = (-4, 0) [label="Apex", label_angle=0, label_dist=0]',
  'l = line((-2, 3), (2, 3)) [label="g"]',
  '',
].join('\n');

function setup(text = FIG) {
  const store = new EditorStore({ registry }, () => undefined);
  store.openText(text, 'new');
  const display = (): DisplayList => {
    const s = store.current();
    return layout(buildScene(s.doc, s.values.values), { viewport: s.viewport, size: SIZE });
  };
  const timer = { f: null as (() => void) | null, ms: 0 };
  const held: Vec2[] = [];
  const hold: Hold = {
    schedule: (f, ms) => {
      timer.f = f;
      timer.ms = ms;
      return () => {
        timer.f = null;
      };
    },
    onHold: (q) => {
      held.push(q);
    },
  };
  const id = (n: string) => findObjectByName(store.current().doc, n)?.id ?? -1;
  /** A point inside the drawn box of `name`'s label, and its reference point. */
  const labelAt = (name: string, fx = 0.5) => {
    const l = display().labels.find((x) => x.id === id(name));
    if (l === undefined) throw new Error(`no label of ${name}`);
    const { box } = labelGlyphs(l, l.runs.map(estimatedWidth), LABEL_FONT_PX);
    return {
      q: { x: box.minX + fx * (box.maxX - box.minX), y: (box.minY + box.maxY) / 2 },
      at: l.at,
    };
  };
  const dot = (x: number, y: number) =>
    toScreen({ viewport: store.current().viewport, size: SIZE }, { x, y });
  return { store, display, timer, held, id, labelAt, dot, gestures: new Gestures(store, hold) };
}

function lineOf(store: EditorStore, name: string): string {
  return (
    print(store.current().doc)
      .split('\n')
      .find((x) => x.startsWith(`${name} = `)) ?? ''
  );
}

describe('a press on a label drags the label', () => {
  it("A's label follows the pointer; at the end one edit writes its offset", () => {
    const { store, display, labelAt, id, gestures } = setup();
    const { q, at } = labelAt('A');
    gestures.down(1, q, display());
    expect(store.current().drag).toMatchObject({ id: id('A'), part: 'label' });
    gestures.move(1, { x: q.x + 15, y: q.y - 5 }, display());
    gestures.move(1, { x: q.x + 30, y: q.y - 20 }, display());
    gestures.up(1, { x: q.x + 30, y: q.y - 20 }, display());
    expect(store.current().drag).toBeNull();
    expect(lineOf(store, 'A')).toMatch(/^A = \(0, 0\) \[label_angle=\d+, label_dist=\d+\]$/u);
    expect(store.current().history.past).toHaveLength(1);
    // The reference point moved with the pointer (within the rounding to whole degrees and px).
    const now = display().labels.find((l) => l.id === id('A'))?.at ?? { x: 0, y: 0 };
    expect(Math.hypot(now.x - (at.x + 30), now.y - (at.y - 20))).toBeLessThan(1.5);
    store.apply({ kind: 'undo' });
    expect(lineOf(store, 'A')).toBe('A = (0, 0)');
  });

  it('a constructed point, a line: their labels drag too; far away, 100 px at most', () => {
    const { store, display, labelAt, gestures } = setup();
    const m = labelAt('M');
    gestures.down(1, m.q, display());
    gestures.move(1, { x: m.q.x, y: m.q.y + 400 }, display());
    gestures.up(1, { x: m.q.x, y: m.q.y + 400 }, display());
    // Straight down, from where the label was grabbed: about 270°, clamped to 100 px.
    const mm = /^M = midpoint\(A, B\) \[label_angle=(\d+), label_dist=100\]$/u.exec(
      lineOf(store, 'M'),
    );
    expect(Math.abs(Number(mm?.[1]) - 270)).toBeLessThan(5);
    const g = labelAt('l');
    gestures.down(1, g.q, display());
    gestures.move(1, { x: g.q.x - 20, y: g.q.y }, display());
    gestures.up(1, { x: g.q.x - 20, y: g.q.y }, display());
    expect(lineOf(store, 'l')).toMatch(
      /^l = line\(\(-2, 3\), \(2, 3\)\) \[label="g", label_angle=\d+, label_dist=\d+\]$/u,
    );
    expect(store.current().history.past).toHaveLength(2);
  });

  it('priority: within the dot (and its pick radius) the point wins; elsewhere in the box, the label', () => {
    const { store, display, labelAt, dot, id, gestures } = setup();
    // E's label "Apex" starts at its dot (angle 0, distance 0): the box covers the dot.
    const e = dot(-4, 0);
    gestures.down(1, e, display());
    expect(store.current().drag).toMatchObject({ id: id('E') });
    expect(store.current().drag?.part).toBeUndefined();
    gestures.up(1, e, display());
    const far = labelAt('E', 0.9).q;
    expect(Math.hypot(far.x - e.x, far.y - e.y)).toBeGreaterThan(12);
    gestures.down(1, far, display());
    expect(store.current().drag).toMatchObject({ id: id('E'), part: 'label' });
    gestures.up(1, far, display());
  });

  it('a still press is a click: no edit; outside the Move tool a label is not dragged', () => {
    const { store, display, labelAt, gestures } = setup();
    const before = print(store.current().doc);
    const { q } = labelAt('A');
    gestures.down(1, q, display());
    gestures.move(1, { x: q.x + CLICK_SLOP - 1, y: q.y }, display());
    gestures.up(1, { x: q.x + CLICK_SLOP - 1, y: q.y }, display());
    expect(print(store.current().doc)).toBe(before);
    expect(store.current().history.past).toHaveLength(0);
    store.apply({ kind: 'tool', tool: 'segment' });
    gestures.down(1, q, display());
    expect(store.current().drag).toBeNull();
  });

  it('Escape during a label drag: the gesture ends quietly, the figure as before', () => {
    const { store, display, labelAt, gestures } = setup();
    const before = print(store.current().doc);
    const { q } = labelAt('A');
    gestures.down(1, q, display());
    gestures.move(1, { x: q.x + 30, y: q.y }, display());
    store.apply({ kind: 'dragCancel' });
    gestures.move(1, { x: q.x + 60, y: q.y }, display());
    gestures.up(1, { x: q.x + 60, y: q.y }, display());
    expect(print(store.current().doc)).toBe(before);
    expect(store.getSnapshot().notice).toBeNull();
    expect(store.current().history.past).toHaveLength(0);
  });
});

describe('touch: no conflict with the long press of the style card (ADR-0029)', () => {
  it('held still on a label: the card (of the label’s object), no drag, no edit', () => {
    const { store, display, labelAt, held, timer, id, gestures } = setup();
    const { q } = labelAt('A');
    gestures.down(1, q, display(), true);
    expect(timer.ms).toBe(LONG_PRESS_MS);
    expect(store.current().drag?.part).toBe('label');
    timer.f?.();
    expect(held).toEqual([q]);
    expect(store.current().drag).toBeNull();
    expect(pressedObject(display(), q)).toBe(id('A'));
    gestures.move(1, { x: q.x + 40, y: q.y }, display());
    gestures.up(1, { x: q.x + 40, y: q.y }, display());
    expect(store.current().history.past).toHaveLength(0);
  });

  it('moved past the click slop before the long press: a label drag, the card never opens', () => {
    const { store, display, labelAt, held, timer, gestures } = setup();
    const { q } = labelAt('A');
    gestures.down(1, q, display(), true);
    gestures.move(1, { x: q.x + CLICK_SLOP + 1, y: q.y }, display());
    expect(timer.f).toBeNull();
    gestures.move(1, { x: q.x + 25, y: q.y }, display());
    gestures.up(1, { x: q.x + 25, y: q.y }, display());
    expect(held).toEqual([]);
    expect(lineOf(store, 'A')).toMatch(/label_angle=\d+, label_dist=\d+/u);
  });

  it('pressedObject: a hit object first, else the label under the press, else none', () => {
    const { display, labelAt, dot, id } = setup();
    expect(pressedObject(display(), dot(0, 0))).toBe(id('A'));
    expect(pressedObject(display(), labelAt('l').q)).toBe(id('l'));
    expect(pressedObject(display(), { x: 5, y: 5 })).toBeUndefined();
  });
});
