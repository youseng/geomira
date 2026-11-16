import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { print } from '@geomira/lang/print';
import { EditorStore } from '../src/store';
import { FileSession } from '../src/file-session';
import { installStorage, removeStorage } from './fake-storage';
import { MemoryRevisions } from './memory-revisions';
import { downloadGeo } from '../src/backup';

vi.mock('../src/backup', () => ({ downloadGeo: vi.fn(), downloadText: vi.fn() }));
const registry = createRegistry();
afterEach(() => {
  removeStorage();
  vi.clearAllMocks();
});
async function fixture() {
  installStorage();
  const storage = new MemoryRevisions();
  const store = new EditorStore({ registry }, () => undefined, storage);
  await store.autosave.initialize();
  store.openText('A=(1,2)', 'file');
  await store.retrySaving();
  return { storage, store, files: new FileSession(store) };
}
describe('file workflow lifecycle', () => {
  it('Cancel is a read-only choice for document, history, draft and recovery', async () => {
    const { storage, store, files } = await fixture();
    store.textDraft.type('A=(1,2)\nB=(');
    const document = store.current();
    const status = store.autosave.getStatus();
    const recovery = structuredClone(storage.state);
    const draft = store.textDraft.getSnapshot();
    files.toggle();
    files.start({ kind: 'new' });
    files.finish();
    files.dispose();
    expect(store.current()).toBe(document);
    expect(store.textDraft.getSnapshot()).toBe(draft);
    expect(store.autosave.getStatus()).toEqual(status);
    expect(storage.state).toEqual(recovery);
    store.textDraft.revert();
  });
  it('Save captures a valid pending draft and refuses to silently save an invalid draft', async () => {
    const { store, files } = await fixture();
    store.textDraft.type('A=(3,4)');
    files.save();
    expect(print(store.current().doc)).toContain('A = (3, 4)');
    expect(downloadGeo).toHaveBeenCalledTimes(1);
    store.textDraft.type('A=(');
    files.save();
    expect(files.snapshot().choice?.kind).toBe('save');
    expect(downloadGeo).toHaveBeenCalledTimes(1);
    expect(store.textDraft.getSnapshot().text).toBe('A=(');
    store.textDraft.revert();
  });
  it('Save As creates a distinct recovery identity and preserves the original', async () => {
    const { storage, store, files } = await fixture();
    const firstId = store.autosave.getStatus().documentId;
    files.start({ kind: 'save-as' });
    files.patch({ name: 'Duplicate' });
    await files.confirm();
    await store.retrySaving();
    expect(store.autosave.getStatus().documentId).not.toBe(firstId);
    expect(storage.state.revisions.some((r) => r.documentId === firstId)).toBe(true);
    expect(store.current().doc.meta.title).toBe('Duplicate');
  });
  it('failed recovery needs an explicit discard, and cancellation keeps usable work', async () => {
    const { storage, store, files } = await fixture();
    store.command('B=(3,4)');
    storage.failure = 'put';
    const before = store.current();
    files.start({ kind: 'new' });
    await files.confirm();
    expect(files.snapshot().failedRecovery).toBe(true);
    expect(store.current()).toBe(before);
    files.finish();
    expect(store.current()).toBe(before);
    files.start({ kind: 'new' });
    await files.confirm(true);
    expect(store.current().doc.objects).toHaveLength(0);
    expect(store.autosave.entries().some((r) => r.pending && r.text.includes('B ='))).toBe(true);
  });
});
