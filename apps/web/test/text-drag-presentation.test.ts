/** Settled panels must not rebuild clean source during live drag previews (ADR-0014/0075). */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isStale } from '@geomira/editor/text-draft';
import { findObjectByName } from '@geomira/kernel/document';
import { print } from '@geomira/lang/print';
import { EditorStore } from '../src/store';
import { TEXT_APPLY_PAUSE_MS } from '../src/text-apply';
import { registry } from './helpers';

const START = '@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\n';
function setup() {
  const store = new EditorStore({ registry }, (message) => {
    throw new Error(message);
  });
  store.openText(START, 'new');
  const id = findObjectByName(store.current().doc, 'A')?.id;
  if (id === undefined) throw new Error('missing A');
  return { store, draft: store.textDraft, id };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('keeps one clean source snapshot through previews and publishes the final figure at dragEnd', () => {
  const { store, draft, id } = setup();
  const before = draft.getSnapshot();
  const parsed = draft.parse();
  const changed = vi.fn();
  draft.subscribe(changed);
  store.apply({ kind: 'dragStart', id });
  for (const x of [1, 2, 3]) {
    store.apply({ kind: 'dragMove', to: { x, y: 2 } });
    expect(print(store.current().doc)).toContain(`A = (${String(x)}, 2)`);
    expect(draft.getSnapshot()).toBe(before);
    expect(draft.parse()).toBe(parsed);
    expect(draft.unappliedText()).toBeNull();
    // A panel mounting/changing tabs during the drag has the same follow boundary.
    draft.follow(store.current().doc);
    expect(draft.getSnapshot()).toBe(before);
  }
  expect(changed).not.toHaveBeenCalled();
  store.apply({ kind: 'dragEnd' });
  const after = draft.getSnapshot().text;
  expect(after).toBe(START.replace('A = (0, 0)', 'A = (3, 2)'));
  expect(changed).toHaveBeenCalledTimes(1);
  // An old settled-panel effect cannot roll presentation back after dragEnd.
  draft.follow(before.doc);
  expect(draft.getSnapshot().text).toBe(after);
  store.apply({ kind: 'undo' });
  expect(draft.getSnapshot().text).toBe(before.text);
  store.apply({ kind: 'redo' });
  expect(draft.getSnapshot().text).toBe(after);
});

it('cancel restores the baseline without replacing clean user formatting or publishing a preview', () => {
  const { store, draft, id } = setup();
  const raw = START.replace('C = (1, 3)', 'C=(2,3) # my spacing');
  draft.type(raw);
  draft.leave();
  const before = draft.getSnapshot();
  const original = store.current().doc;
  const changed = vi.fn();
  draft.subscribe(changed);
  store.apply({ kind: 'dragStart', id });
  store.apply({ kind: 'dragMove', to: { x: 4, y: 5 } });
  expect(draft.getSnapshot()).toBe(before);
  store.apply({ kind: 'dragCancel' });
  expect(store.current().doc).toBe(original);
  expect(draft.getSnapshot()).toBe(before);
  expect(draft.getSnapshot().text).toBe(raw);
  expect(draft.sourceNotice()).toBeNull();
  expect(changed).not.toHaveBeenCalled();
});

it('cancels a pending pause at dragStart and keeps dirty text attached to its original figure', () => {
  const { store, draft, id } = setup();
  const raw = START.replace('C = (1, 3)', 'C = (2, 3)');
  draft.type(raw);
  const before = draft.getSnapshot();
  expect(draft.pending()).toBe(true);
  store.apply({ kind: 'dragStart', id });
  expect(draft.pending()).toBe(false);
  store.apply({ kind: 'dragMove', to: { x: 4, y: 5 } });
  vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS * 2);
  store.apply({ kind: 'dragEnd' });
  expect(print(store.current().doc)).toBe(START.replace('A = (0, 0)', 'A = (4, 5)'));
  expect(draft.getSnapshot()).toBe(before);
  expect(draft.unappliedText()).toBe(raw);
  expect(isStale(draft.getSnapshot(), store.current().doc)).toBe(true);
  draft.leave();
  expect(draft.getSnapshot().doc).toBe(before.doc);
  expect(print(store.current().doc)).toContain('A = (4, 5)');
});

it('keeps transient IME work recoverable through previews, end and cancellation', () => {
  for (const ending of ['dragEnd', 'dragCancel'] as const) {
    const { store, draft, id } = setup();
    const raw = `${START}日本語 composition`;
    draft.compose(raw);
    store.apply({ kind: 'dragStart', id });
    store.apply({ kind: 'dragMove', to: { x: 4, y: 5 } });
    expect(draft.unappliedText()).toBe(raw);
    store.apply({ kind: ending });
    expect(draft.unappliedText()).toBe(raw);
    draft.compose(null);
  }
});

it('applies valid pending source before pointer-down, then treats its drag as one separate edit', () => {
  const { store, draft, id } = setup();
  draft.type(START.replace('C = (1, 3)', 'C=(2,3)'));
  draft.leave();
  const applied = store.current().doc;
  store.apply({ kind: 'dragStart', id });
  store.apply({ kind: 'dragMove', to: { x: 4, y: 5 } });
  store.apply({ kind: 'dragEnd' });
  expect(draft.getSnapshot().text).toBe(
    START.replace('C = (1, 3)', 'C = (2, 3)').replace('A = (0, 0)', 'A = (4, 5)'),
  );
  store.apply({ kind: 'undo' });
  expect(store.current().doc).toBe(applied);
  expect(draft.getSnapshot().text).toContain('C = (2, 3)');
});
