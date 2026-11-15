/** ADR-0067: flush starts before switching/hiding; durability requires awaiting completion. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { print } from '@geomira/lang/print';
import { flushWhenHidden } from '../src/hooks';
import { EditorStore } from '../src/store';
import { installStorage, removeStorage, SLOT } from './fake-storage';
import { MemoryRevisions } from './memory-revisions';
import { registry } from './helpers';

afterEach(() => {
  removeStorage();
  vi.useRealTimers();
});
async function pendingEdit() {
  const data = installStorage();
  data.set(SLOT.current, '@version 1\n# yesterday\n');
  const storage = new MemoryRevisions();
  const store = new EditorStore({ registry }, () => undefined, storage);
  await store.autosave.initialize();
  store.openText('@version 1\nA = (0, 0)\n', 'new');
  await store.autosave.save(print(store.current().doc));
  store.command('B = (4, 0)');
  const edited = print(store.current().doc);
  vi.useFakeTimers();
  store.autosave.schedule(() => {
    void store.autosave.save(edited);
  }, 200);
  return { storage, store, edited };
}

describe('the pending autosave', () => {
  it('runs before another figure opens', async () => {
    const { storage, store, edited } = await pendingEdit();
    store.openText('@version 1\nZ = (1, 1)\n', 'example');
    await store.autosave.flush();
    expect(storage.state.revisions.at(-1)?.text).toBe(edited);
    vi.advanceTimersByTime(1000);
    await store.autosave.flush();
    expect(storage.state.revisions.at(-1)?.text).toBe(edited);
  });
  it('runs before Restore previous figure reads the revisions', async () => {
    const { storage, store, edited } = await pendingEdit();
    const yesterday = store.autosave.entries().find((r) => r.text === '@version 1\n# yesterday\n');
    expect(yesterday).toBeDefined();
    expect(await store.autosave.restore(edited, yesterday?.id)).toBe('@version 1\n# yesterday\n');
    expect(storage.state.revisions.map((r) => r.text)).toContain(edited);
  });
  it('runs when the page hides (pagehide, or visibility hidden), not while visible', async () => {
    const { storage, store, edited } = await pendingEdit();
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const stop = flushWhenHidden(store.autosave, win, doc);
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(storage.state.revisions.at(-1)?.text).not.toBe(edited);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    await store.autosave.flush();
    expect(storage.state.revisions.at(-1)?.text).toBe(edited);
    store.command('C = (1, 3)');
    const again = print(store.current().doc);
    store.autosave.schedule(() => {
      void store.autosave.save(again);
    }, 200);
    win.dispatchEvent(new Event('pagehide'));
    await store.autosave.flush();
    expect(storage.state.revisions.at(-1)?.text).toBe(again);
    stop();
    store.autosave.schedule(() => {
      void store.autosave.save('@version 1\n# late\n');
    }, 200);
    win.dispatchEvent(new Event('pagehide'));
    expect(storage.state.revisions.at(-1)?.text).toBe(again);
  });
  it('a timer that fires saves once; flush with nothing pending does nothing', async () => {
    const { storage, store, edited } = await pendingEdit();
    vi.advanceTimersByTime(200);
    await store.autosave.flush();
    expect(storage.state.revisions.at(-1)?.text).toBe(edited);
    const before = structuredClone(storage.state);
    await store.autosave.flush();
    expect(storage.state).toEqual(before);
  });
});
