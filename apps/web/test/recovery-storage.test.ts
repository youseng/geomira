import { afterEach, describe, expect, it } from 'vitest';
import { Autosave } from '../src/persist';
import { installStorage, removeStorage, SLOT } from './fake-storage';
import { MemoryRevisions } from './memory-revisions';

const A = '@version 1\nA = (0, 0)\n';
const AB = `${A}B = (1, 0)\n`;
const AC = `${A}C = (0, 1)\n`;
afterEach(removeStorage);

async function setup(storage = new MemoryRevisions()) {
  installStorage();
  const autosave = new Autosave({ storage });
  await autosave.initialize();
  return { storage, autosave };
}

async function reopen(storage: MemoryRevisions) {
  const autosave = new Autosave({ storage });
  const start = await autosave.initialize();
  autosave.opened('autosave', start);
  return autosave;
}

describe('durability and recovery', () => {
  it.each([false, true])(
    'serializes simultaneous stale writers without notifications (reverse %s)',
    async (reverse) => {
      const { storage, autosave: first } = await setup();
      await first.save(A);
      const second = await reopen(storage);
      let release: () => void = () => undefined;
      storage.barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      first.edited();
      second.edited();
      const requests = reverse
        ? [second.save(AC), first.save(AB)]
        : [first.save(AB), second.save(AC)];
      expect(first.getStatus().phase).toBe('saving');
      release();
      await Promise.all(requests);
      expect(storage.state.revisions.map((r) => r.text)).toEqual(expect.arrayContaining([AB, AC]));
      const third = await reopen(storage);
      expect(third.getStatus().phase).toBe('conflict');
      expect(third.entries().map((r) => r.text)).toEqual(expect.arrayContaining([AB, AC]));
      await first.refresh();
      expect(first.getStatus().phase).toBe('conflict');
    },
  );

  it.each(['read', 'put', 'complete'] as const)(
    'retains pending data and old durable state after %s failure, including repeated retry',
    async (failure) => {
      const { storage, autosave } = await setup();
      await autosave.save(A);
      const acknowledged = autosave.getStatus().revisionId;
      const old = structuredClone(storage.state);
      storage.failure = failure;
      autosave.edited();
      expect(await autosave.save(AB)).toBe(false);
      expect(storage.state).toEqual(old);
      expect(autosave.getStatus()).toMatchObject({ phase: 'not-saved', revisionId: acknowledged });
      expect(autosave.entries().map((r) => r.text)).toContain(AB);
      expect(await autosave.retry()).toBe(false);
      expect(autosave.getStatus().phase).toBe('not-saved');
      storage.failure = null;
      expect(await autosave.retry()).toBe(true);
      expect(autosave.getStatus().phase).toBe('saved');
      expect(storage.state.revisions.at(-1)?.text).toBe(AB);
    },
  );

  it('does not show Saved when an older in-flight save finishes after a newer edit', async () => {
    const { storage, autosave } = await setup();
    await autosave.save(A);
    let release: () => void = () => undefined;
    storage.barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    autosave.edited();
    const saving = autosave.save(AB);
    // The next edit is dirty, but its debounce has not produced a save request yet.
    autosave.edited();
    release();
    await saving;
    expect(autosave.getStatus().phase).toBe('saving');
    expect(await autosave.flush()).toBe(false);
    await autosave.save(AC);
    expect(autosave.getStatus().phase).toBe('saved');
  });

  it('catches serialization errors, retains the producer, and retries it', async () => {
    const { autosave, storage } = await setup();
    await autosave.save(A);
    let broken = true;
    const producer = () => {
      if (broken) throw new Error('serialization');
      return AB;
    };
    expect(await autosave.save(producer)).toBe(false);
    expect(autosave.getStatus().message).toContain('serialization');
    expect(storage.state.revisions.at(-1)?.text).toBe(A);
    broken = false;
    expect(await autosave.retry()).toBe(true);
    expect(storage.state.revisions.at(-1)?.text).toBe(AB);
  });

  it('keeps a failed save when another example opens and does not clear its error', async () => {
    const { autosave, storage } = await setup();
    await autosave.save(A);
    storage.failure = 'put';
    await autosave.save(AB);
    autosave.opened('example', AC);
    await autosave.save(AC);
    expect(autosave.getStatus().phase).toBe('not-saved');
    expect(autosave.entries().map((r) => r.text)).toContain(AB);
    storage.failure = null;
    await autosave.retry();
    expect(storage.state.revisions.at(-1)?.text).toBe(AB);
    expect(storage.state.revisions.map((r) => r.text)).not.toContain(AC);
  });

  it('restores without losing an unsaved browsing example and restores back', async () => {
    const { autosave, storage } = await setup();
    await autosave.save(A);
    autosave.opened('example', AC);
    expect(autosave.canRestore(AC)).toBe(true);
    expect(await autosave.restore(AC)).toBe(A);
    expect(storage.state.revisions.map((r) => r.text)).toContain(AC);
    autosave.opened('autosave', A);
    expect(await autosave.restore(A)).toBe(AC);
  });

  it('refuses invalid canonical data whole instead of acknowledging a partial parse', async () => {
    const { autosave, storage } = await setup();
    expect(await autosave.save(`${A}B = unknown(A)\n`)).toBe(false);
    expect(storage.state.revisions).toEqual([]);
    expect(autosave.getStatus().phase).toBe('not-saved');
  });
});

describe('legacy migration', () => {
  it.each([true, false])(
    'migrates both valid slots or a missing previous slot (%s)',
    async (previous) => {
      const data = installStorage();
      data.set(SLOT.current, AB);
      if (previous) data.set(SLOT.previous, A);
      const storage = new MemoryRevisions();
      const autosave = new Autosave({ storage });
      expect(await autosave.initialize()).toBe(AB);
      expect(storage.state.revisions.map((r) => r.text)).toContain(AB);
      if (previous) expect(storage.state.revisions.map((r) => r.text)).toContain(A);
      expect(data.has(SLOT.current)).toBe(false);
      expect(storage.state.legacy.map((r) => r.text)).toContain(AB);
    },
  );

  it('opens the valid previous slot when current is malformed, and preserves raw data for download', async () => {
    const data = installStorage();
    data.set(SLOT.current, 'A = broken(');
    data.set(SLOT.previous, A);
    const storage = new MemoryRevisions();
    const autosave = new Autosave({ storage });
    expect(await autosave.initialize()).toBe(A);
    expect(autosave.getStatus().message).toMatch(/legacy/iu);
    expect(storage.state.legacy.map((r) => r.text)).toContain('A = broken(');
  });

  it('uses a valid previous slot when current is missing, and keeps malformed previous text', async () => {
    const data = installStorage();
    data.set(SLOT.previous, A);
    const storage = new MemoryRevisions();
    const autosave = new Autosave({ storage });
    expect(await autosave.initialize()).toBe(A);
    expect(storage.state.revisions.map((r) => r.text)).toEqual([A]);
    data.set(SLOT.previous, 'malformed(');
    data.set(SLOT.current, AB);
    const another = new MemoryRevisions();
    const migrated = new Autosave({ storage: another });
    expect(await migrated.initialize()).toBe(AB);
    expect(another.state.legacy).toContainEqual({
      key: SLOT.previous,
      text: 'malformed(',
      valid: false,
    });
  });

  it('a failed migration leaves both original slots and a usable current figure for retry', async () => {
    const data = installStorage();
    data.set(SLOT.current, AB);
    data.set(SLOT.previous, A);
    const storage = new MemoryRevisions();
    storage.failure = 'complete';
    const autosave = new Autosave({ storage });
    expect(await autosave.initialize()).toBe(AB);
    expect(data.get(SLOT.current)).toBe(AB);
    expect(data.get(SLOT.previous)).toBe(A);
    expect(autosave.getStatus().phase).toBe('not-saved');
    storage.failure = null;
    expect(await autosave.retry()).toBe(true);
    expect(storage.state.revisions.map((r) => r.text)).toEqual(expect.arrayContaining([A, AB]));
  });
});
