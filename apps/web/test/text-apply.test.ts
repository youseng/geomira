/**
 * ADR-0047: the text applies as you type (the page's TextApplier with fake timers, on the
 * page's EditorStore). The race of the audits' hunt list ("text debounce racing a drag"): a
 * drag, tool action or any other document change while a pause is pending wins; the pending
 * apply is dropped, never applied over the newer figure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Edit } from '@geomira/editor/edit';
import { randomizeEdit } from '@geomira/editor/randomize';
import { isStale } from '@geomira/editor/text-draft';
import { findObjectByName } from '@geomira/kernel/document';
import { ref } from '@geomira/kernel/expr';
import { print } from '@geomira/lang/print';
import { timeout } from '../src/long-press';
import { EditorStore } from '../src/store';
import { TEXT_APPLY_PAUSE_MS, TEXT_MERGE_MS, TextApplier } from '../src/text-apply';
import { registry } from './helpers';

const START = '@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\n';

function setup() {
  const store = new EditorStore({ registry }, (m) => {
    throw new Error(m);
  });
  store.openText(START, 'new');
  const edits: Edit[] = [];
  const host = {
    env: store.env,
    current: () => store.current(),
    apply: (e: Edit) => {
      edits.push(e);
      return store.apply(e);
    },
  };
  const applier = new TextApplier(host, timeout, () => Date.now());
  return { store, applier, edits, start: store.current().doc };
}

const idOf = (store: EditorStore, name: string): number =>
  findObjectByName(store.current().doc, name)?.id ?? -1;

/** The printed figure has this whole line. */
const hasLine = (store: EditorStore, line: string): boolean =>
  print(store.current().doc).split('\n').includes(line);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the text applies after a pause (ADR-0047)', () => {
  it('a text without errors applies after TEXT_APPLY_PAUSE_MS; the field keeps it as typed', () => {
    const { store, applier } = setup();
    const typed = START.replace('C = (1, 3)', 'C = (2,3)');
    applier.type(typed);
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS - 1);
    expect(hasLine(store, 'C = (1, 3)')).toBe(true);
    expect(applier.pending()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hasLine(store, 'C = (2, 3)')).toBe(true);
    // Not rewritten to the printed 'C = (2, 3)' while typing: the caret stays.
    expect(applier.getSnapshot().text).toBe(typed);
    expect(store.current().history.past).toHaveLength(1);
  });

  it('every keystroke restarts the pause', () => {
    const { store, applier } = setup();
    applier.type(START.replace('C = (1, 3)', 'C = (2, 3)'));
    vi.advanceTimersByTime(400);
    applier.type(START.replace('C = (1, 3)', 'C = (2, 4)'));
    vi.advanceTimersByTime(400);
    expect(hasLine(store, 'C = (1, 3)')).toBe(true);
    vi.advanceTimersByTime(100);
    expect(hasLine(store, 'C = (2, 4)')).toBe(true);
  });

  it('a typing session is one history entry; undo returns to the figure before it; redo works', () => {
    const { store, applier, start } = setup();
    applier.type(START.replace('C = (1, 3)', 'C = (2, 3)'));
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS + 1000);
    applier.type(START.replace('C = (1, 3)', 'C = (2, 5)'));
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS);
    expect(store.current().history.past).toHaveLength(1);
    const after = store.current().doc;
    store.apply({ kind: 'undo' });
    expect(store.current().doc).toBe(start);
    store.apply({ kind: 'redo' });
    expect(store.current().doc).toBe(after);
  });

  it('a longer pause than TEXT_MERGE_MS starts another entry', () => {
    const { store, applier } = setup();
    applier.type(START.replace('C = (1, 3)', 'C = (2, 3)'));
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS + TEXT_MERGE_MS);
    applier.type(START.replace('C = (1, 3)', 'C = (2, 5)'));
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS);
    expect(store.current().history.past).toHaveLength(2);
  });

  it('leaving the field applies now and ends the session: the next typing is another entry', () => {
    const { store, applier } = setup();
    const typed = START.replace('C = (1, 3)', 'C = (2,3)');
    applier.type(typed);
    applier.leave();
    expect(applier.pending()).toBe(false);
    expect(hasLine(store, 'C = (2, 3)')).toBe(true);
    // Settled: the field shows the printed figure.
    expect(applier.getSnapshot().text).toBe(print(store.current().doc));
    applier.type(print(store.current().doc).replace('C = (2, 3)', 'C = (2, 5)'));
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS);
    expect(store.current().history.past).toHaveLength(2);
  });

  it('Apply text (apply now) after automatic applies joins their entry and shows the printed figure', () => {
    const { store, applier, start } = setup();
    applier.type(START.replace('C = (1, 3)', 'C = (2,3)'));
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS);
    applier.type(START.replace('C = (1, 3)', 'C = (2,5)'));
    applier.applyNow();
    expect(store.current().history.past).toHaveLength(1);
    expect(store.current().history.past[0]?.before).toBe(start);
    expect(applier.getSnapshot().text).toBe(print(store.current().doc));
  });

  it('a text with errors is not applied; its diagnostics stay', () => {
    const { store, applier, start } = setup();
    applier.type(`${START}M = midpoint(A, Q)\n`);
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS * 4);
    expect(store.current().doc).toBe(start);
    expect(applier.hasErrors()).toBe(true);
    applier.leave();
    expect(store.current().doc).toBe(start);
    expect(applier.getSnapshot().text).toBe(`${START}M = midpoint(A, Q)\n`);
    expect(store.getSnapshot().notice).toBeNull();
  });

  it('the apply reuses the diagnostics parse (one parse per text)', () => {
    const { applier, edits } = setup();
    applier.type(START.replace('C = (1, 3)', 'C = (2, 3)'));
    const shown = applier.parse();
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS);
    const e = edits[0];
    expect(e?.kind === 'replaceText' ? e.parsed : undefined).toBe(shown);
  });
});

/** Document changes from elsewhere, made while a pause is pending. */
const OTHERS: readonly (readonly [string, (s: EditorStore) => void])[] = [
  [
    'a drag',
    (s) => {
      s.apply({ kind: 'dragStart', id: idOf(s, 'A') });
      s.apply({ kind: 'dragMove', to: { x: -1, y: -1 } });
      s.apply({ kind: 'dragEnd' });
    },
  ],
  [
    // ADR-0049's label drag goes through the drag protocol too: it ends the pending apply.
    'a label drag',
    (s) => {
      s.apply({ kind: 'dragStart', id: idOf(s, 'A'), part: 'label' });
      s.apply({ kind: 'dragLabel', angle: 30, dist: 20 });
      s.apply({ kind: 'dragEnd' });
    },
  ],
  [
    'a tool action',
    (s) => {
      s.apply({ kind: 'tool', tool: 'midpoint' });
      s.input({ kind: 'object', id: idOf(s, 'A') });
      s.input({ kind: 'object', id: idOf(s, 'B') });
    },
  ],
  ['undo', (s) => s.apply({ kind: 'undo' })],
  [
    'a style card write',
    (s) => s.apply({ kind: 'style', id: idOf(s, 'B'), style: { color: 'red' } }),
  ],
  [
    'the claim bar',
    (s) =>
      s.apply({
        kind: 'addClaim',
        claim: { kind: 'collinear', args: ['A', 'B', 'C'].map((n) => ref(idOf(s, n))) },
      }),
  ],
  [
    'the command bar',
    (s) => {
      s.command('D = (5, 5)');
    },
  ],
  [
    'Randomize',
    (s) => {
      const r = randomizeEdit(s.current(), s.env, 'any', 20261030);
      if (r.kind === 'refused') throw new Error(r.reason);
      s.apply(r.edit);
    },
  ],
  [
    'an example or link opened',
    (s) => {
      s.openText('@version 1\nP = (1, 1)\n', 'link');
    },
  ],
];

describe('a document change while a pause is pending wins (ADR-0047, audit hunt item)', () => {
  for (const [what, act] of OTHERS) {
    it(`${what}: the pending apply is dropped, never applied over the newer figure`, () => {
      const { store, applier } = setup();
      // A first edit, so that undo has something to take back.
      store.command('E = (7, 7)');
      applier.follow(store.current().doc);
      const typed = print(store.current().doc).replace('C = (1, 3)', 'C = (2, 3)');
      applier.type(typed);
      vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS / 2);
      act(store);
      const newer = store.current().doc;
      vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS * 10);
      expect(store.current().doc, what).toBe(newer);
      // The typed text is kept, marked stale; leaving the field does not apply it either.
      applier.follow(newer);
      expect(applier.getSnapshot().text).toBe(typed);
      expect(isStale(applier.getSnapshot(), newer)).toBe(true);
      applier.type(`${typed}\n`);
      vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS * 10);
      applier.leave();
      expect(store.current().doc, what).toBe(newer);
    });
  }

  it('redo: the pending apply is dropped', () => {
    const { store, applier, start } = setup();
    store.command('E = (7, 7)');
    store.apply({ kind: 'undo' });
    applier.follow(store.current().doc);
    expect(store.current().doc).toBe(start);
    applier.type(START.replace('C = (1, 3)', 'C = (2, 3)'));
    store.apply({ kind: 'redo' });
    const newer = store.current().doc;
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS * 10);
    expect(store.current().doc).toBe(newer);
  });

  it('undo then redo back to the very figure the text was typed on: the text applies', () => {
    const { store, applier } = setup();
    store.command('E = (7, 7)');
    applier.follow(store.current().doc);
    applier.type(print(store.current().doc).replace('C = (1, 3)', 'C = (2, 3)'));
    store.apply({ kind: 'undo' });
    store.apply({ kind: 'redo' });
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS);
    expect(hasLine(store, 'C = (2, 3)') && hasLine(store, 'E = (7, 7)')).toBe(true);
  });

  it('a drag still in progress when the pause ends: not applied', () => {
    const { store, applier, start } = setup();
    applier.type(START.replace('C = (1, 3)', 'C = (2, 3)'));
    store.apply({ kind: 'dragStart', id: idOf(store, 'A') });
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS);
    expect(store.current().doc).toBe(start);
    expect(store.current().drag).not.toBeNull();
    store.apply({ kind: 'dragMove', to: { x: -1, y: -1 } });
    store.apply({ kind: 'dragEnd' });
    expect(hasLine(store, 'C = (1, 3)')).toBe(true);
    expect(hasLine(store, 'A = (-1, -1)')).toBe(true);
  });

  it('Apply text puts a stale text in place of the newer figure as an edit of its own (undo returns)', () => {
    const { store, applier } = setup();
    const typed = START.replace('C = (1, 3)', 'C = (2, 3)');
    applier.type(typed);
    store.apply({ kind: 'style', id: idOf(store, 'B'), style: { color: 'red' } });
    const newer = store.current().doc;
    applier.follow(newer);
    applier.applyNow();
    expect(hasLine(store, 'C = (2, 3)')).toBe(true);
    expect(hasLine(store, 'style B [color=red]')).toBe(false);
    store.apply({ kind: 'undo' });
    expect(store.current().doc).toBe(newer);
  });

  it('Revert text drops the typed text and shows the figure', () => {
    const { store, applier } = setup();
    applier.type(START.replace('C = (1, 3)', 'C = (2, 3)'));
    store.apply({ kind: 'style', id: idOf(store, 'B'), style: { color: 'red' } });
    applier.revert();
    expect(applier.pending()).toBe(false);
    expect(applier.getSnapshot().text).toBe(print(store.current().doc));
  });

  it('leaving the field before a drag (a press on the canvas) applies the text first; one undo takes back the drag only', () => {
    const { store, applier } = setup();
    applier.type(START.replace('C = (1, 3)', 'C = (2, 3)'));
    applier.leave();
    store.apply({ kind: 'dragStart', id: idOf(store, 'B') });
    store.apply({ kind: 'dragMove', to: { x: 5, y: 1 } });
    store.apply({ kind: 'dragEnd' });
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS * 10);
    expect(hasLine(store, 'C = (2, 3)') && hasLine(store, 'B = (5, 1)')).toBe(true);
    store.apply({ kind: 'undo' });
    expect(hasLine(store, 'C = (2, 3)') && hasLine(store, 'B = (4, 0)')).toBe(true);
  });

  it('a draft without edits follows the figure (after its own apply it is not rewritten)', () => {
    const { store, applier } = setup();
    const typed = START.replace('C = (1, 3)', 'C = (2,3)');
    applier.type(typed);
    vi.advanceTimersByTime(TEXT_APPLY_PAUSE_MS);
    applier.follow(store.current().doc);
    expect(applier.getSnapshot().text).toBe(typed);
    store.apply({ kind: 'style', id: idOf(store, 'B'), style: { color: 'red' } });
    applier.follow(store.current().doc);
    expect(applier.getSnapshot().text).toBe(print(store.current().doc));
  });
});
