/**
 * ADR-0063: the style card's live edits. `liveStyle` applies a style at once; 'start' records
 * one history entry and opens it, 'continue' amends it while it is the last action and the
 * same object's, so a slider drag or a typed label is ONE undo. Dragging back to where the
 * session began leaves no entry. Any other edit, undo or redo ends the session; a locked layer
 * refuses it whole.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import type { EditorState } from '../src/state';
import { edit, editorOf, env, idOf } from './helpers/editor';

const FIGURE = 'A = (0, 0)\nB = (4, 0)';

function live(
  s: EditorState,
  name: string,
  style: Record<string, unknown>,
  session: 'start' | 'continue',
) {
  return edit(s, { kind: 'liveStyle', id: idOf(s, name), style, session });
}

const lineOf = (s: EditorState, name: string) =>
  print(s.doc)
    .split('\n')
    .find((l) => l.startsWith(`${name} = `));

describe('a live style session', () => {
  it('applies at once; a run of changes of one control is one entry, one undo', () => {
    const base = editorOf(FIGURE);
    let s = live(base, 'A', { width: 2 }, 'start');
    expect(lineOf(s, 'A')).toBe('A = (0, 0) [width=2]');
    s = live(s, 'A', { width: 3 }, 'continue');
    s = live(s, 'A', { width: 4 }, 'continue');
    expect(lineOf(s, 'A')).toBe('A = (0, 0) [width=4]');
    expect(s.history.past).toHaveLength(1);
    expect(print(edit(s, { kind: 'undo' }).doc)).toBe(print(base.doc));
  });

  it('a new control starts a new entry', () => {
    let s = live(editorOf(FIGURE), 'A', { width: 2 }, 'start');
    s = live(s, 'A', { width: 2, color: 'red' }, 'start');
    expect(s.history.past).toHaveLength(2);
    expect(lineOf(edit(s, { kind: 'undo' }), 'A')).toBe('A = (0, 0) [width=2]');
  });

  it('back to where it began: no entry, the very document before', () => {
    const base = editorOf(FIGURE);
    let s = live(base, 'A', { width: 2 }, 'start');
    s = live(s, 'A', {}, 'continue');
    expect(s.history.past).toHaveLength(0);
    expect(s.doc).toBe(base.doc);
  });

  it('continue after another edit, or on another object, records a new entry', () => {
    let s = live(editorOf(FIGURE), 'A', { width: 2 }, 'start');
    s = edit(s, { kind: 'rename', id: idOf(s, 'B'), name: 'C' });
    s = live(s, 'A', { width: 3 }, 'continue');
    expect(s.history.past).toHaveLength(3);
    s = live(s, 'C', { width: 5 }, 'continue');
    expect(s.history.past).toHaveLength(4);
    expect(lineOf(edit(s, { kind: 'undo' }), 'C')).toBe('C = (4, 0)');
  });

  it('undo ends the session: a continue after it is an entry of its own', () => {
    let s = live(editorOf(FIGURE), 'A', { width: 2 }, 'start');
    s = edit(s, { kind: 'undo' });
    s = live(s, 'A', { width: 3 }, 'continue');
    expect(s.history.past).toHaveLength(1);
    expect(s.history.future).toHaveLength(0);
    expect(print(edit(s, { kind: 'undo' }).doc)).toBe(print(editorOf(FIGURE).doc));
  });

  it('a change that changes nothing records nothing', () => {
    const base = editorOf('A = (0, 0) [width=2]');
    const s = live(base, 'A', { width: 2 }, 'start');
    expect(s.history.past).toHaveLength(0);
    expect(s.doc).toBe(base.doc);
  });

  it('it ends a text typing session, which then cannot swallow it', () => {
    let s = edit(editorOf(FIGURE), {
      kind: 'replaceText',
      text: '@version 1\nA = (0, 0)\nB = (5, 0)\n',
      typing: 'start',
    });
    s = live(s, 'A', { color: 'red' }, 'start');
    s = edit(s, {
      kind: 'replaceText',
      text: print(s.doc).replace('B = (5, 0)', 'B = (6, 0)'),
      typing: 'continue',
    });
    expect(s.history.past).toHaveLength(3);
  });

  it('a locked layer refuses it, and the state is the very same', () => {
    const s = edit(editorOf(FIGURE), {
      kind: 'updateLayer',
      id: 'main',
      patch: { locked: true },
    });
    const r = applyEdit(
      s,
      { kind: 'liveStyle', id: idOf(s, 'A'), style: { width: 2 }, session: 'start' },
      env,
    );
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
  });

  it('it is refused during a drag', () => {
    let s = editorOf(FIGURE);
    s = edit(s, { kind: 'dragStart', id: idOf(s, 'A') });
    const r = applyEdit(
      s,
      { kind: 'liveStyle', id: idOf(s, 'B'), style: { width: 2 }, session: 'start' },
      env,
    );
    expect(r.ok).toBe(false);
  });
});
