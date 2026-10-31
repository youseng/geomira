/**
 * ADR-0049: dragging a label is a gesture of the drag protocol: dragStart(id, part 'label') →
 * dragLabel(angle, dist)… → dragEnd | dragCancel. The moves are coalesced into ONE history
 * entry that writes the object's label_angle / label_dist (whole degrees in [0, 360), whole
 * px clamped to [0, MAX_LABEL_DRAG_PX]); undo restores; cancel leaves no trace; a label
 * dropped where it was adds no entry. Any object with a style can have its label dragged.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import { MAX_LABEL_DRAG_PX } from '../src/label-drag';
import type { EditorState } from '../src/state';
import { edit, editorOf, env, idOf, registry } from './helpers/editor';

const FIG = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3) [color=red]',
  'l = line(A, B) [label="g"]',
  'T = reflect(line(B, (4, 1)))',
  '@layer inv = image(T, main)',
].join('\n');

function refused(s: EditorState, e: Parameters<typeof applyEdit>[1]): string {
  const r = applyEdit(s, e, env);
  if (r.ok) throw new Error('accepted');
  expect(r.state).toBe(s);
  return r.reason;
}

function lineOf(s: EditorState, name: string): string {
  return (
    print(s.doc)
      .split('\n')
      .find((x) => x.startsWith(`${name} = `)) ?? ''
  );
}

describe('a label drag is one edit of label_angle and label_dist', () => {
  it('moves are coalesced, rounded to whole degrees and px; undo and redo', () => {
    const s = editorOf(FIG);
    const a = idOf(s, 'A');
    let t = edit(s, { kind: 'dragStart', id: a, part: 'label' });
    expect(t.drag).toMatchObject({ id: a, part: 'label', moved: false });
    t = edit(t, { kind: 'dragLabel', angle: 30.4, dist: 20.6 });
    expect(lineOf(t, 'A')).toBe('A = (0, 0) [label_angle=30, label_dist=21]');
    t = edit(t, { kind: 'dragLabel', angle: 100.5, dist: 15.4 });
    t = edit(t, { kind: 'dragEnd' });
    expect(t.drag).toBeNull();
    expect(lineOf(t, 'A')).toBe('A = (0, 0) [label_angle=101, label_dist=15]');
    expect(t.history.past).toHaveLength(1);
    expect(t.history.past[0]?.label).toBe('move the label of A');
    const u = edit(t, { kind: 'undo' });
    expect(u.doc).toBe(s.doc);
    expect(print(edit(u, { kind: 'redo' }).doc)).toBe(print(t.doc));
    // L5: the text holds it.
    expect(print(parse(print(t.doc), registry).doc)).toBe(print(t.doc));
  });

  it('the other style fields are kept; a line and an image have labels to drag too', () => {
    const s = editorOf(FIG);
    const drag = (st: EditorState, name: string, angle: number, dist: number) =>
      [
        { kind: 'dragStart', id: idOf(st, name), part: 'label' } as const,
        { kind: 'dragLabel', angle, dist } as const,
        { kind: 'dragEnd' } as const,
      ].reduce(edit, st);
    expect(lineOf(drag(s, 'C', 0, 12), 'C')).toBe(
      'C = (1, 3) [color=red, label_angle=0, label_dist=12]',
    );
    expect(lineOf(drag(s, 'l', 270, 30), 'l')).toBe(
      'l = line(A, B) [label="g", label_angle=270, label_dist=30]',
    );
    const img = drag(s, 'A*', 180, 10);
    expect(print(img.doc)).toContain('style A* [label_angle=180, label_dist=10]');
    expect(img.history.past).toHaveLength(1);
  });

  it(`angles wrap into [0, 360); distances are clamped to [0, ${String(MAX_LABEL_DRAG_PX)}] px`, () => {
    const s = editorOf(FIG);
    const t = edit(s, { kind: 'dragStart', id: idOf(s, 'A'), part: 'label' });
    const at = (angle: number, dist: number) =>
      lineOf(edit(t, { kind: 'dragLabel', angle, dist }), 'A');
    expect(at(-90, 500)).toBe(
      `A = (0, 0) [label_angle=270, label_dist=${String(MAX_LABEL_DRAG_PX)}]`,
    );
    expect(at(359.6, -3)).toBe('A = (0, 0) [label_angle=0, label_dist=0]');
    expect(at(725, 9)).toBe('A = (0, 0) [label_angle=5, label_dist=9]');
    expect(refused(t, { kind: 'dragLabel', angle: Number.NaN, dist: 3 })).toBe(
      'a label offset is a finite angle and distance',
    );
    expect(refused(t, { kind: 'dragLabel', angle: 3, dist: Number.POSITIVE_INFINITY })).toBe(
      'a label offset is a finite angle and distance',
    );
  });

  it('cancel restores the document and the history; dropped where it was: no entry', () => {
    const s0 = editorOf(FIG);
    const s = edit(s0, {
      kind: 'style',
      id: idOf(s0, 'A'),
      style: { labelAngle: 45, labelDist: 9 },
    });
    const a = idOf(s, 'A');
    const moved = [
      { kind: 'dragStart', id: a, part: 'label' } as const,
      { kind: 'dragLabel', angle: 200, dist: 40 } as const,
    ].reduce(edit, s);
    const c = edit(moved, { kind: 'dragCancel' });
    expect(c.doc).toBe(s.doc);
    expect(c.history.past).toEqual(s.history.past);
    const back = edit(edit(moved, { kind: 'dragLabel', angle: 45.2, dist: 8.8 }), {
      kind: 'dragEnd',
    });
    expect(back.doc).toBe(s.doc);
    expect(back.history.past).toEqual(s.history.past);
    // A press without a move ends with nothing.
    const still = edit(edit(s, { kind: 'dragStart', id: a, part: 'label' }), { kind: 'dragEnd' });
    expect(still.doc).toBe(s.doc);
    expect(still.history).toBe(s.history);
  });
});

describe('out of order, refused', () => {
  it('protocol: a point move on a label drag, a label move on a point drag or without a drag', () => {
    const s = editorOf(FIG);
    const a = idOf(s, 'A');
    expect(refused(s, { kind: 'dragLabel', angle: 0, dist: 5 })).toBe(
      'dragLabel without a drag in progress',
    );
    const label = edit(s, { kind: 'dragStart', id: a, part: 'label' });
    expect(refused(label, { kind: 'dragMove', to: { x: 1, y: 1 } })).toBe(
      'a label drag moves the label: dragLabel',
    );
    expect(refused(label, { kind: 'dragStart', id: a })).toBe('a drag is already in progress');
    expect(refused(label, { kind: 'style', id: a, style: {} })).toBe(
      'a drag is in progress: finish or cancel it first',
    );
    expect(refused(label, { kind: 'undo' })).toBe(
      'a drag is in progress: finish or cancel it first',
    );
    const point = edit(s, { kind: 'dragStart', id: a });
    expect(refused(point, { kind: 'dragLabel', angle: 0, dist: 5 })).toBe(
      'an object drag moves the object: dragMove',
    );
  });

  it('a missing object, an object in a locked layer', () => {
    const s = editorOf(FIG);
    expect(refused(s, { kind: 'dragStart', id: 999, part: 'label' })).toBe(
      'there is no object #999',
    );
    const locked = editorOf(['@layer given [locked]', 'P = (0, 0) [layers=given]'].join('\n'));
    expect(refused(locked, { kind: 'dragStart', id: idOf(locked, 'P'), part: 'label' })).toBe(
      'P is in the locked layer given: unlock the layer to drag it',
    );
  });
});
