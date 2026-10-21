/**
 * History (SPEC §12, law L6): undo and redo restore documents EXACTLY (the same objects);
 * a new action clears redo; a drag gesture is one entry (coalesced moves and the rounding at
 * its end); the history is bounded.
 */
import { describe, expect, it } from 'vitest';
import { call, ref } from '@geomira/kernel/expr';
import { applyEdit } from '../src/edit';
import { EMPTY_HISTORY, HISTORY_LIMIT, record } from '../src/history';
import { edit, editorOf, env, idOf, xyOf } from './helpers/editor';

describe('history', () => {
  it('undo and redo restore the very documents, and values with them', () => {
    const s0 = editorOf('A = (0, 0)\nB = (4, 0)');
    const s1 = edit(s0, {
      kind: 'add',
      object: { name: 'M', def: call('midpoint', [ref(idOf(s0, 'A')), ref(idOf(s0, 'B'))]) },
    });
    const s2 = edit(s1, { kind: 'style', id: idOf(s1, 'A'), style: { color: 'red' } });
    const u1 = edit(s2, { kind: 'undo' });
    expect(u1.doc).toBe(s1.doc);
    const u0 = edit(u1, { kind: 'undo' });
    expect(u0.doc).toBe(s0.doc);
    expect(u0.values.values).toEqual(s0.values.values);
    const r1 = edit(u0, { kind: 'redo' });
    const r2 = edit(r1, { kind: 'redo' });
    expect(r1.doc).toBe(s1.doc);
    expect(r2.doc).toBe(s2.doc);
  });

  it('a new action clears the redo stack', () => {
    const s0 = editorOf('A = (0, 0)');
    const s1 = edit(s0, { kind: 'style', id: idOf(s0, 'A'), style: { color: 'red' } });
    const u = edit(s1, { kind: 'undo' });
    const t = edit(u, { kind: 'style', id: idOf(u, 'A'), style: { color: 'blue' } });
    expect(t.history.future).toEqual([]);
    expect(applyEdit(t, { kind: 'redo' }, env).ok).toBe(false);
  });

  it('a drag is one entry: moves coalesce, the rounding joins it, one undo returns', () => {
    let s = editorOf('A = (0, 0)\nB = (4, 0)\nM = midpoint(A, B)');
    const before = s.doc;
    s = edit(s, { kind: 'dragStart', id: idOf(s, 'A') });
    for (const x of [0.1234567, 0.5, 1.000049, 2.0000123])
      s = edit(s, { kind: 'dragMove', to: { x, y: x / 2 } });
    s = edit(s, { kind: 'dragEnd' });
    expect(s.history.past).toHaveLength(1);
    expect(s.history.past[0]?.label).toBe('drag A');
    expect(s.history.past[0]?.after).toBe(s.doc);
    expect(xyOf(s, 'A')).toEqual([2, 1]);
    const u = edit(s, { kind: 'undo' });
    expect(u.doc).toBe(before);
  });

  it('is bounded: the oldest entries are dropped', () => {
    const d = editorOf('A = (0, 0)').doc;
    let h = EMPTY_HISTORY;
    for (let i = 0; i < HISTORY_LIMIT + 3; i++)
      h = record(h, String(i), d, { ...d, nextId: i + 10 });
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]?.label).toBe('3');
    expect(record(h, 'same', d, d)).toBe(h);
  });
});
