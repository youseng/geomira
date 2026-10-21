/**
 * Dragging (SPEC §8.4, §12): free points, gliders on lines and circles (both parameter
 * forms), managed images (drag-through to the source; not draggable when the map depends
 * on it), texts (a literal anchor, or the point they are anchored at); cancel restores; out
 * of order and during-drag edits are refused with the state unchanged.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { applyEdit, type Edit } from '../src/edit';
import type { EditorState } from '../src/state';
import { defText, edit, editorOf, env, idOf, xyOf } from './helpers/editor';

function drag(s: EditorState, name: string, ...to: [number, number][]): EditorState {
  let t = edit(s, { kind: 'dragStart', id: idOf(s, name) });
  for (const [x, y] of to) t = edit(t, { kind: 'dragMove', to: { x, y } });
  return edit(t, { kind: 'dragEnd' });
}

function refused(s: EditorState, e: Edit, reason: RegExp | string): void {
  const r = applyEdit(s, e, env);
  expect(r.ok).toBe(false);
  expect(r.state).toBe(s);
  if (!r.ok) expect(r.reason).toMatch(reason);
}

describe('drag targets', () => {
  it('a free point takes the cursor, rounded to decimals at the end', () => {
    const s = drag(
      editorOf('A = (0, 0)\nB = (4, 0)'),
      'A',
      [1.5, 2.25],
      [1.23456789, -0.987654321],
    );
    expect(print(s.doc)).toContain('A = (1.2346, -0.9877)');
    expect(xyOf(s, 'A')).toEqual([1.2346, -0.9877]);
  });

  it('gliders on a line, on a circle with an anchor (u : v) and on circle(O, r) (angle)', () => {
    let s = editorOf(
      [
        'A = (0, 0)',
        'B = (4, 0)',
        'l = line(A, B)',
        'P = on(l, 1/2)',
        'c = circle(A, B)',
        'Q = on(c, 1, 0)',
        'k = circle(A, 2)',
        'R = on(k, 0)',
      ].join('\n'),
    );
    s = drag(s, 'P', [3, 5]);
    expect(xyOf(s, 'P')).toEqual([3, 0]);
    s = drag(s, 'Q', [0, 9]);
    const [qx, qy] = xyOf(s, 'Q');
    expect(Math.hypot(qx - 0, qy - 4)).toBeLessThan(1e-3);
    s = drag(s, 'R', [-5, 0]);
    expect(defText(s, 'R')).toBe('on(k, 180)');
  });

  it('a managed image drags its source through the inverse map', () => {
    let s = editorOf(
      [
        'A = (0, 0)',
        'B = (4, 0)',
        'C = (1, 3)',
        'T = reflect(line(A, B))',
        '@layer m = image(T, main)',
      ].join('\n'),
    );
    s = drag(s, 'C*', [2, -5]);
    expect(xyOf(s, 'C')).toEqual([2, 5]);
    expect(xyOf(s, 'C*')).toEqual([2, -5]);
  });

  it('an image whose map depends on its source is not draggable', () => {
    const s = editorOf(
      ['A = (0, 0)', 'B = (4, 0)', 'T = reflect(A)', '@layer m = image(T, main)'].join('\n'),
    );
    refused(s, { kind: 'dragStart', id: idOf(s, 'A*') }, 'A* cannot be dragged: T depends on A');
    expect(drag(s, 'B*', [-1, -1]).doc.objects.find((o) => o.name === 'B')).toBeDefined();
  });

  it('texts: a literal anchor moves; a text at a point drags that point', () => {
    let s = editorOf('A = (0, 0)\nt = text((1, 1), "x")\nu = text(A, "y")');
    s = drag(s, 't', [2, 3]);
    expect(defText(s, 't')).toBe('text(point(2, 3), "x")');
    s = drag(s, 'u', [5, 6]);
    expect(xyOf(s, 'A')).toEqual([5, 6]);
  });

  it('constructed objects are not draggable', () => {
    const s = editorOf('A = (0, 0)\nB = (4, 0)\nM = midpoint(A, B)\nl = line(A, B)');
    refused(
      s,
      { kind: 'dragStart', id: idOf(s, 'M') },
      'M is not draggable: only free points, gliders, their images and texts are',
    );
    refused(s, { kind: 'dragStart', id: idOf(s, 'l') }, /l is not draggable/);
    refused(s, { kind: 'dragStart', id: 999 }, 'there is no object #999');
  });
});

describe('drag protocol', () => {
  it('cancel restores the document from before the gesture and drops its entry', () => {
    const s = editorOf('A = (0, 0)\nB = (4, 0)');
    let t = edit(s, { kind: 'dragStart', id: idOf(s, 'A') });
    t = edit(t, { kind: 'dragMove', to: { x: 3, y: 3 } });
    t = edit(t, { kind: 'dragCancel' });
    expect(t.doc).toBe(s.doc);
    expect(t.history.past).toHaveLength(0);
    expect(t.drag).toBeNull();
  });

  it('out-of-order drag edits and document edits during a drag are refused', () => {
    const s = editorOf('A = (0, 0)\nB = (4, 0)');
    refused(s, { kind: 'dragMove', to: { x: 1, y: 1 } }, 'dragMove without a drag in progress');
    refused(s, { kind: 'dragEnd' }, 'dragEnd without a drag in progress');
    refused(s, { kind: 'dragCancel' }, 'dragCancel without a drag in progress');
    const t = edit(s, { kind: 'dragStart', id: idOf(s, 'A') });
    refused(t, { kind: 'dragStart', id: idOf(s, 'B') }, 'a drag is already in progress');
    refused(t, { kind: 'remove', id: idOf(s, 'B') }, /a drag is in progress/);
    refused(t, { kind: 'undo' }, /a drag is in progress/);
    refused(
      t,
      { kind: 'dragMove', to: { x: Number.NaN, y: 1 } },
      'the cursor is not a finite position',
    );
    expect(edit(t, { kind: 'hover', id: idOf(s, 'B') }).hover).toBe(idOf(s, 'B'));
    const ended = edit(t, { kind: 'dragEnd' });
    expect(ended.doc).toBe(s.doc);
    expect(ended.history.past).toHaveLength(0);
  });
});
