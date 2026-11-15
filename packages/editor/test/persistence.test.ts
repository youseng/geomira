import { describe, expect, it } from 'vitest';
import {
  commitRevision,
  EMPTY_RECOVERY,
  recoverRevision,
  type RecoveryState,
  type Revision,
} from '../src/persistence';

const revision = (id: string, documentId = 'doc', baseId: string | null = null): Revision => ({
  id,
  documentId,
  sessionId: id,
  baseId,
  text: `@version 1\n# ${id}\n`,
  savedAt: 1,
  source: 'edit',
});
const limits = { revisions: 4, bytes: 10000, history: 2 };

describe('transactional revision policy', () => {
  it.each([
    ['B', 'C'],
    ['C', 'B'],
  ])('preserves both stale writers in order %s then %s without events', (first, second) => {
    const a = commitRevision(EMPTY_RECOVERY, revision('A'));
    // Both requests were prepared before either transaction read/write starts.
    const b = revision(first, 'doc', 'A');
    const c = revision(second, 'doc', 'A');
    const result = commitRevision(commitRevision(a, b), c);
    expect(result.revisions.map((r) => r.id)).toEqual(['A', first, second]);
    expect(result.conflicts).toEqual([first, second]);
    expect(result.currentId).toBe(second);
    expect(a.revisions.map((r) => r.id)).toEqual(['A']);
  });

  it('treats a suspended tab with a pruned base as stale and keeps the third tab’s work', () => {
    let state = commitRevision(EMPTY_RECOVERY, revision('A'), limits);
    for (const [id, base] of [
      ['B', 'A'],
      ['C', 'B'],
      ['D', 'C'],
    ] as const)
      state = commitRevision(state, revision(id, 'doc', base), limits);
    expect(state.revisions.map((r) => r.id)).toEqual(['C', 'D']);
    state = commitRevision(state, revision('resumed', 'doc', 'A'), limits);
    expect(state.conflicts).toEqual(['D', 'resumed']);
    expect(state.revisions.map((r) => r.id)).toContain('D');
  });

  it('bounds ordinary history deterministically while preserving the sole copy of every document', () => {
    let state = commitRevision(EMPTY_RECOVERY, revision('personal'), limits);
    state = commitRevision(state, revision('example', 'example'), limits);
    for (const [id, base] of [
      ['e2', 'example'],
      ['e3', 'e2'],
      ['e4', 'e3'],
    ] as const)
      state = commitRevision(state, revision(id, 'example', base), limits);
    expect(state.revisions.map((r) => r.id)).toEqual(['personal', 'e3', 'e4']);
    expect(() =>
      commitRevision(state, revision('big', 'example', 'e4'), { ...limits, bytes: 10 }),
    ).toThrow(/capacity/iu);
    expect(state.currentId).toBe('e4');
  });

  it('refuses capacity instead of evicting unresolved conflicts or a sole document', () => {
    const a = commitRevision(EMPTY_RECOVERY, revision('A'), limits);
    const b = commitRevision(a, revision('B', 'doc', 'A'), limits);
    const conflict = commitRevision(b, revision('C', 'doc', 'A'), limits);
    const full = commitRevision(conflict, revision('other', 'other'), limits);
    expect(() =>
      commitRevision(full, revision('third', 'third'), { ...limits, revisions: 3 }),
    ).toThrow(/capacity/iu);
    expect(full.conflicts).toEqual(['B', 'C']);
    expect(full.revisions.map((r) => r.id)).toEqual(['B', 'C', 'other']);
  });

  it('restores a chosen version and the replaced figure atomically and can restore back', () => {
    let state = commitRevision(EMPTY_RECOVERY, revision('A'));
    state = commitRevision(state, revision('B', 'doc', 'A'));
    const restored = recoverRevision(
      state,
      revision('unsaved', 'doc', 'B'),
      'A',
      'restore',
      2,
      false,
    );
    expect(restored.revisions.map((r) => r.id)).toContain('unsaved');
    expect(restored.revisions.at(-1)?.text).toBe(revision('A').text);
    const back = recoverRevision(
      restored,
      { ...revision('open', 'doc', 'restore'), text: revision('A').text },
      'unsaved',
      'back',
      3,
      false,
    );
    expect(back.revisions.at(-1)?.text).toBe(revision('unsaved').text);
  });

  it('only explicit conflict resolution unpins the chosen document, retaining the displaced version as history', () => {
    let state = commitRevision(EMPTY_RECOVERY, revision('A'));
    state = commitRevision(state, revision('B', 'doc', 'A'));
    state = commitRevision(state, revision('C', 'doc', 'A'));
    const resolved = recoverRevision(
      state,
      { ...revision('open', 'doc', 'C'), text: revision('C').text },
      'B',
      'chosen',
      2,
      true,
    );
    expect(resolved.conflicts).toEqual([]);
    expect(resolved.revisions.map((r) => r.text)).toContain(revision('C').text);
    expect(resolved.revisions.at(-1)?.text).toBe(revision('B').text);
  });

  it('deduplicates a repeat of an acknowledged revision and rejects ID reuse', () => {
    const a = revision('A');
    const state = commitRevision(EMPTY_RECOVERY, a);
    expect(commitRevision(state, a)).toBe(state);
    expect(() => commitRevision(state, { ...a, text: 'different' })).toThrow(/identity/iu);
    expect(() => recoverRevision(state, revision('open'), 'missing', 'restore', 2, false)).toThrow(
      /available/iu,
    );
  });

  it('keeps protected data when history and total boundaries coincide', () => {
    let state: RecoveryState = EMPTY_RECOVERY;
    state = commitRevision(state, revision('A'), limits);
    state = commitRevision(state, revision('B', 'doc', 'A'), limits);
    state = commitRevision(state, revision('C', 'doc', 'A'), limits);
    state = commitRevision(state, revision('D', 'doc', 'C'), limits);
    state = commitRevision(state, revision('E', 'doc', 'D'), limits);
    expect(state.revisions.map((r) => r.id)).toEqual(['B', 'C', 'D', 'E']);
    expect(state.conflicts).toEqual(['B', 'C']);
  });
  it('refuses a restore when keeping its replaced figure would exceed protected capacity', () => {
    let state = commitRevision(EMPTY_RECOVERY, revision('A'));
    state = commitRevision(state, revision('other', 'other'));
    expect(() =>
      recoverRevision(state, revision('replaced', 'doc', 'A'), 'A', 'restored', 2, false, {
        revisions: 2,
        bytes: 10000,
        history: 2,
      }),
    ).toThrow(/capacity/iu);
    expect(state.revisions.map((r) => r.id)).toEqual(['A', 'other']);
  });

  it('can resolve conflicts at the capacity boundary without first requiring an extra pinned slot', () => {
    let state = commitRevision(EMPTY_RECOVERY, revision('A'));
    state = commitRevision(state, revision('B', 'doc', 'A'));
    state = commitRevision(state, revision('C', 'doc', 'A'));
    state = commitRevision(state, revision('other', 'other'));
    const chosen = recoverRevision(
      state,
      revision('replaced', 'doc', 'C'),
      'B',
      'chosen',
      2,
      true,
      { revisions: 3, bytes: 10000, history: 2 },
    );
    expect(chosen.conflicts).toEqual([]);
    expect(chosen.revisions.map((r) => r.id)).toEqual(['other', 'replaced', 'chosen']);
    expect(chosen.revisions.at(-1)?.text).toBe(revision('B').text);
  });
  it('a restore from a stale tab also protects the unseen writer and the figure being replaced', () => {
    let state = commitRevision(EMPTY_RECOVERY, revision('A'));
    state = commitRevision(state, revision('B', 'doc', 'A'));
    const restored = recoverRevision(
      state,
      revision('stale', 'doc', 'A'),
      'A',
      'restored',
      2,
      false,
    );
    expect(restored.conflicts).toEqual(['B', 'stale']);
    expect(restored.revisions.map((r) => r.id)).toEqual(['A', 'B', 'stale', 'restored']);
  });
  it('enforces the real 128-revision ceiling without removing a sole document copy', () => {
    let state = EMPTY_RECOVERY;
    for (let n = 0; n < 128; n++)
      state = commitRevision(state, revision(String(n), `doc-${String(n)}`));
    expect(state.revisions).toHaveLength(128);
    expect(() => commitRevision(state, revision('overflow', 'new-doc'))).toThrow(/capacity/iu);
    expect(state.revisions).toHaveLength(128);
  });
});
