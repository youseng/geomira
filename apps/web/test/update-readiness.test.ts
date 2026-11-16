import { afterEach, describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { print } from '@geomira/lang/print';
import { EditorStore } from '../src/store';
import { prepareUpdate } from '../src/update-readiness';
import { installStorage, removeStorage } from './fake-storage';
import { MemoryRevisions } from './memory-revisions';

const registry = createRegistry();
afterEach(removeStorage);
async function fixture() {
  installStorage();
  const storage = new MemoryRevisions();
  const store = new EditorStore({ registry }, () => undefined, storage);
  await store.autosave.initialize();
  store.openText('A=(1,2)', 'file');
  await store.retrySaving();
  return { storage, store };
}
function block(storage: MemoryRevisions) {
  let release: () => void = () => undefined;
  storage.barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  return release;
}
describe('PWA update readiness', () => {
  it('refuses invalid, stale and composing text without applying or discarding it', async () => {
    const { store } = await fixture();
    for (const text of ['A=(1,2)\nB=(', 'A=(1,2)\nB=(3,4)']) {
      store.textDraft.type(text);
      if (!store.textDraft.hasErrors()) store.command('C=(4,5)');
      const before = store.current();
      expect((await prepareUpdate(store, () => ''))?.kind).toBe('text');
      expect(store.current()).toBe(before);
      expect(store.textDraft.getSnapshot().text).toBe(text);
      store.textDraft.revert();
    }
    store.textDraft.compose('名前=');
    expect((await prepareUpdate(store, () => ''))?.kind).toBe('text');
    expect(store.textDraft.unappliedText()).toBe('名前=');
    store.textDraft.compose(null);
  });
  it('refuses exact nonempty command text and never executes it', async () => {
    const { store } = await fixture();
    const before = store.current();
    expect((await prepareUpdate(store, () => 'B=midpoint(A, '))?.kind).toBe('command');
    expect(store.current()).toBe(before);
  });
  for (const kind of ['source', 'command', 'figure'] as const) {
    it(`refuses ${kind} edits arriving during awaited saving`, async () => {
      const { store, storage } = await fixture();
      const release = block(storage);
      let command = '';
      const pending = prepareUpdate(store, () => command);
      if (kind === 'source') store.textDraft.type('A=(1,2)\nB=(');
      else if (kind === 'command') command = 'B=midpoint(A, ';
      else store.command('B=(3,4)');
      release();
      const result = await pending;
      expect(result?.kind).toBe(
        kind === 'source' ? 'text' : kind === 'figure' ? 'changed' : 'command',
      );
      if (kind === 'figure') expect(print(store.current().doc)).toContain('B = (3, 4)');
      if (kind === 'source') store.textDraft.revert();
    });
  }
  it('refuses unresolved recovery conflicts without switching documents', async () => {
    const { store, storage } = await fixture();
    const other = new EditorStore({ registry }, () => undefined, storage);
    other.openText((await other.autosave.initialize()) ?? '', 'autosave');
    store.command('B=(3,4)');
    await store.retrySaving();
    other.command('C=(5,6)');
    await other.retrySaving();
    await store.autosave.refresh();
    const before = store.current();
    expect((await prepareUpdate(store, () => ''))?.kind).toBe('conflict');
    expect(store.current()).toBe(before);
  });
  it('allows settled saved documents and refuses failed durable writes', async () => {
    const { store, storage } = await fixture();
    expect(await prepareUpdate(store, () => '')).toBeNull();
    storage.failure = 'put';
    store.command('B=(3,4)');
    expect((await prepareUpdate(store, () => ''))?.kind).toBe('save');
    expect(print(store.current().doc)).toContain('B = (3, 4)');
  });
});
