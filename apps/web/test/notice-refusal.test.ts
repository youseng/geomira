/**
 * Bug-fix round (ADR-0028): a refusal notice disappeared on the next mouse hover, because any
 * successful edit cleared it, and hover, viewport and selection changes are edits. A refusal
 * now stays until a document edit or a new tool action (or until dismissed).
 */
import { describe, expect, it } from 'vitest';
import { findObjectByName } from '@geomira/kernel/document';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

function refused(): { store: EditorStore; a: number } {
  const store = new EditorStore({ registry }, () => undefined);
  store.openText('@version 1\nA = (0, 0)\nB = (4, 0)\n', 'new');
  const a = findObjectByName(store.current().doc, 'A')?.id ?? -1;
  expect(store.apply({ kind: 'remove', id: 9999 }).ok).toBe(false);
  expect(store.getSnapshot().notice?.tone).toBe('refusal');
  return { store, a };
}

describe('a refusal notice', () => {
  it('stays through hover, viewport and selection changes', () => {
    const { store, a } = refused();
    store.apply({ kind: 'hover', id: a });
    store.apply({ kind: 'hover', id: null });
    store.apply({ kind: 'viewport', viewport: { cx: 1, cy: 2, zoom: 40 } });
    store.apply({ kind: 'select', ids: [a], mode: 'replace' });
    expect(store.getSnapshot().notice?.tone).toBe('refusal');
  });

  it('is answered by a document edit', () => {
    const { store, a } = refused();
    store.apply({ kind: 'style', id: a, style: { color: 'red' } });
    expect(store.getSnapshot().notice).toBeNull();
  });

  it('is answered by a new tool action', () => {
    const { store } = refused();
    store.apply({ kind: 'tool', tool: 'midpoint' });
    expect(store.getSnapshot().notice).toBeNull();
  });

  it('an error notice stays until dismissed, whatever the edit', () => {
    const store = new EditorStore({ registry }, () => undefined);
    store.openText('@version 1\nA = (0, 0)\nB = (\n', 'new');
    expect(store.getSnapshot().notice?.tone).toBe('error');
    store.command('C = (1, 1)');
    expect(store.getSnapshot().notice?.tone).toBe('error');
  });
});
