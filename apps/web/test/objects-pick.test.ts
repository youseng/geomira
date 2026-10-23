/**
 * Bug-fix round (ADR-0028): a pick refused by the active tool in the Objects panel showed no
 * reason: the click fell through to a selection, whose success cleared the refusal notice.
 * The refusal now stays shown (the object is still selected, as before).
 */
import { describe, expect, it } from 'vitest';
import { findObjectByName } from '@geomira/kernel/document';
import { pickObject } from '../src/panels/ObjectsPanel';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

function store(): EditorStore {
  const s = new EditorStore({ registry }, () => undefined);
  s.openText('@version 1\nA = (0, 0)\nB = (4, 0)\nl = line(A, B)\n', 'new');
  return s;
}

const id = (s: EditorStore, name: string) => findObjectByName(s.current().doc, name)?.id ?? -1;

describe('a pick in the Objects panel', () => {
  it('a refused pick says why, and selects the object', () => {
    const s = store();
    s.apply({ kind: 'tool', tool: 'midpoint' });
    pickObject(s, id(s, 'l'));
    const notice = s.getSnapshot().notice;
    expect(notice?.tone).toBe('refusal');
    expect(notice?.text).toMatch(/pick a point/u);
    expect(s.current().selection).toEqual([id(s, 'l')]);
  });

  it('a pick the tool takes goes to the tool; in Move it selects', () => {
    const s = store();
    s.apply({ kind: 'tool', tool: 'midpoint' });
    pickObject(s, id(s, 'A'));
    expect(s.current().toolState.picks).toEqual([id(s, 'A')]);
    expect(s.getSnapshot().notice).toBeNull();
    s.apply({ kind: 'tool', tool: 'move' });
    pickObject(s, id(s, 'B'));
    expect(s.current().selection).toEqual([id(s, 'B')]);
  });
});
