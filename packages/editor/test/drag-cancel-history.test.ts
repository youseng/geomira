/**
 * dragCancel restores the undo entries EXACTLY as they were before the drag: with a full
 * history (HISTORY_LIMIT entries) the drag's entry pushed the oldest one out and cancelling
 * dropped the drag's entry only, so the oldest was lost. (The redo stack stays cleared, as
 * the editor-level fuzz model, law L6, expects of a cancelled drag.)
 */
import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, type HistoryEntry } from '../src/history';
import type { EditorState } from '../src/state';
import { edit, editorOf, idOf } from './helpers/editor';

function cancelledDrag(s: EditorState): EditorState {
  let t = edit(s, { kind: 'dragStart', id: idOf(s, 'A') });
  t = edit(t, { kind: 'dragMove', to: { x: 1, y: 1 } });
  t = edit(t, { kind: 'dragMove', to: { x: 2, y: 1 } });
  return edit(t, { kind: 'dragCancel' });
}

describe('dragCancel and the history', () => {
  it('a full history keeps its oldest entry', () => {
    const s0 = editorOf('A = (0, 0)\nB = (4, 0)');
    const s1 = edit(s0, { kind: 'rename', id: idOf(s0, 'B'), name: 'C' });
    const [entry] = s1.history.past;
    if (entry === undefined) throw new Error('no entry');
    const past: HistoryEntry[] = Array.from({ length: HISTORY_LIMIT }, (_, i) => ({
      ...entry,
      label: `entry ${String(i)}`,
    }));
    const full: EditorState = { ...s1, history: { past, future: [] } };
    const s = cancelledDrag(full);
    expect(s.history).toEqual(full.history);
    expect(s.history.past[0]?.label).toBe('entry 0');
    expect(s.doc).toBe(full.doc);
  });

  it('a drag cancelled before any move leaves the history as it was', () => {
    const s0 = editorOf('A = (0, 0)\nB = (4, 0)');
    let s = edit(s0, { kind: 'rename', id: idOf(s0, 'B'), name: 'C' });
    s = edit(s, { kind: 'undo' });
    let t = edit(s, { kind: 'dragStart', id: idOf(s, 'A') });
    t = edit(t, { kind: 'dragCancel' });
    expect(t.history).toBe(s.history);
  });
});
