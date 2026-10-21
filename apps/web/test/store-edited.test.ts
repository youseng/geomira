/**
 * Found in the Run 10 audit: every dragMove marked the session edited, so a drag that was
 * canceled (a second finger, pointercancel) left an unchanged share-link session marked edited;
 * the autosave then saved the link and removed its hash before any real edit (ADR-0013
 * decision 8: a link is not saved until its first edit). A drag is one edit, at its end, and
 * only if it moved something.
 */
import { describe, expect, it } from 'vitest';
import { findObjectByName } from '@geomira/kernel/document';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

const TEXT = '@version 1\nA = (1, 3)\nB = (0, 0)\nC = (4, 0)\n';

function linkStore(): { store: EditorStore; a: number } {
  const store = new EditorStore({ registry }, () => undefined);
  store.openText(TEXT, 'link');
  return { store, a: findObjectByName(store.current().doc, 'A')?.id ?? -1 };
}

describe('when a link session counts as edited', () => {
  it('a canceled drag is no edit', () => {
    const { store, a } = linkStore();
    const before = store.current().doc;
    store.apply({ kind: 'dragStart', id: a });
    store.apply({ kind: 'dragMove', to: { x: 2, y: 4 } });
    expect(store.autosave.wasEdited()).toBe(false);
    store.apply({ kind: 'dragCancel' });
    expect(store.current().doc).toBe(before);
    expect(store.autosave.wasEdited()).toBe(false);
  });

  it('a drag that ends after moving is one edit; one that ends where it started is none', () => {
    const { store, a } = linkStore();
    store.apply({ kind: 'dragStart', id: a });
    store.apply({ kind: 'dragEnd' });
    expect(store.autosave.wasEdited()).toBe(false);
    store.apply({ kind: 'dragStart', id: a });
    store.apply({ kind: 'dragMove', to: { x: 2, y: 4 } });
    store.apply({ kind: 'dragEnd' });
    expect(store.autosave.wasEdited()).toBe(true);
  });

  it('any other document edit counts at once', () => {
    const { store, a } = linkStore();
    store.apply({ kind: 'style', id: a, style: { color: 'red' } });
    expect(store.autosave.wasEdited()).toBe(true);
  });
});
