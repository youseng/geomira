import { afterEach, describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { parse } from '@geomira/lang/parse';
import { createRegistry } from '@geomira/kernel/registry';
import { assertInvariants } from '@geomira/kernel/invariants';
import { Autosave } from '../src/persist';
import { commitRevision, EMPTY_RECOVERY, type Revision } from '@geomira/editor/persistence';
import { EditorStore } from '../src/store';
import { isRecoveryState } from '../src/recovery-format';
import { installStorage, removeStorage, SLOT } from './fake-storage';
import { MemoryRevisions } from './memory-revisions';

const registry = createRegistry();
const rich = [
  '# preserved comment',
  '@version 1',
  '@title "Recovery fixture"',
  '@author "Geomira"',
  '@layer aux [visible=false, opacity=0.5]',
  '@view only [layers=aux,-main] [viewport=1,-2,50]',
  '@viewport 1 -2 50',
  'A = (0, 0) [color=red, label="origin", layers=aux,main]',
  'B = (4, 0)',
  'M = midpoint(A, B)',
  'claim collinear(A, M, B) [name=saved]',
  'assume greater(dist(A, B), 0)',
  '',
].join('\n');
const canonical = print(parse(rich, registry).doc);
afterEach(removeStorage);

describe('whole-document integrity', () => {
  it('migration, conflicts, restore-back and retry preserve geometry and all document fields', async () => {
    const data = installStorage();
    data.set(SLOT.current, rich);
    const storage = new MemoryRevisions();
    const first = new Autosave({ storage, registry });
    const start = await first.initialize();
    expect(start).toBe(canonical);
    first.opened('autosave', start);
    const second = new Autosave({ storage, registry });
    second.opened('autosave', await second.initialize());
    const changed = canonical.replace('B = (4, 0)', 'B = (5, 0)');
    await first.save(changed);
    await second.save(canonical.replace('B = (4, 0)', 'B = (6, 0)'));
    const entry = second.entries().find((r) => r.text === canonical);
    expect(entry).toBeDefined();
    const restored = await second.restore(canonical.replace('B = (4, 0)', 'B = (6, 0)'), entry?.id);
    expect(restored).toBe(canonical);
    const original = parse(canonical, registry).doc;
    const doc = parse(restored ?? '', registry).doc;
    expect(doc).toEqual(original);
    expect(doc.meta).toMatchObject({ title: 'Recovery fixture', author: 'Geomira' });
    expect(doc.claims).toHaveLength(1);
    expect(doc.assumptions).toHaveLength(1);
    expect(doc.views).toHaveLength(1);
    expect(doc.layers).toHaveLength(2);
    expect(doc.viewport).toEqual({ cx: 1, cy: -2, zoom: 50 });
    expect(doc.objects[0]?.style).toMatchObject({ color: 'red', label: 'origin' });
    expect(() => {
      assertInvariants(doc);
    }).not.toThrow();
    expect(storage.state.conflicts).toHaveLength(2);
  });

  it('does not replace an edit made while a recovery transaction is in flight', async () => {
    installStorage();
    const storage = new MemoryRevisions();
    const store = new EditorStore({ registry }, () => undefined, storage);
    await store.autosave.initialize();
    store.command('A = (0, 0)');
    await store.autosave.save(print(store.current().doc));
    store.command('B = (1, 0)');
    await store.autosave.save(print(store.current().doc));
    const target = store.autosave.entries().find((r) => !r.text.includes('B ='));
    let release: () => void = () => undefined;
    storage.barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const restoring = store.restoreRevision(target?.id);
    store.command('C = (0, 1)');
    release();
    expect(await restoring).toBe(false);
    expect(print(store.current().doc)).toContain('C = (0, 1)');
  });

  it('captures the last committed figure when switching before the debounce effect runs', async () => {
    installStorage();
    const storage = new MemoryRevisions();
    const store = new EditorStore({ registry }, () => undefined, storage);
    await store.autosave.initialize();
    store.openText('@version 1\n', 'new');
    store.command('A = (123, 456)');
    const edited = print(store.current().doc);
    store.openText('@version 1\nB = (1, 0)\n', 'example');
    store.openText('@version 1\nC = (0, 1)\n', 'example');
    await store.autosave.flush();
    expect(storage.state.revisions.map((r) => r.text)).toContain(edited);
    expect(storage.state.revisions.map((r) => r.text)).not.toContain('@version 1\nB = (1, 0)\n');
  });

  it('never restores invalid pending text as a partially parsed figure', async () => {
    installStorage();
    const autosave = new Autosave({ storage: new MemoryRevisions(), registry });
    await autosave.save('@version 1\nA = (0, 0)\nB = unknown(A)\n');
    const invalid = autosave.entries().find((r) => r.pending);
    expect(await autosave.restore(canonical, invalid?.id)).toBeUndefined();
    expect(autosave.getStatus().phase).toBe('not-saved');
  });

  it('conflict resolution preserves a writer that committed after the recovery list was read', async () => {
    installStorage();
    const storage = new MemoryRevisions();
    const version = (id: string, baseId: string | null): Revision => ({
      id,
      baseId,
      documentId: 'shared',
      sessionId: id,
      savedAt: 1,
      source: 'edit',
      text: `@version 1\n# ${id}\n`,
    });
    let known = commitRevision(EMPTY_RECOVERY, version('root', null));
    known = commitRevision(known, version('B', 'root'));
    known = commitRevision(known, version('C', 'root'));
    storage.state = { ...known, migrated: true };
    const autosave = new Autosave({ storage, registry });
    await autosave.initialize();
    autosave.opened('example', canonical);
    const selected = autosave.entries().find((r) => r.id === 'B');
    // Another tab commits a new conflicting version while this list is stale.
    storage.state = commitRevision(storage.state, version('unseen', 'B'));
    await autosave.refresh();
    expect(await autosave.restore(canonical, 'B', true, selected?.observation)).toBe(
      version('B', 'root').text,
    );
    expect(storage.state.conflicts).toContain('unseen');
    expect(storage.state.revisions.find((r) => r.id === 'unseen')?.text).toBe(
      version('unseen', 'B').text,
    );
    expect(storage.state.conflicts).toContain(storage.state.currentId);
  });

  it('rejects unknown schemas, duplicate identities and dangling protected pointers', async () => {
    installStorage();
    const storage = new MemoryRevisions();
    const autosave = new Autosave({ storage, registry });
    await autosave.save(canonical);
    const valid = storage.state;
    expect(isRecoveryState(valid)).toBe(true);
    for (const damaged of [
      null,
      {},
      { ...valid, schema: 3 },
      { ...valid, currentId: 'missing' },
      { ...valid, conflicts: ['missing'] },
      { ...valid, revisions: [...valid.revisions, ...valid.revisions] },
      { ...valid, revisions: [{ ...valid.revisions[0], savedAt: Infinity }] },
      { ...valid, legacy: [{}] },
    ])
      expect(isRecoveryState(damaged)).toBe(false);
  });

  it('does not remove either original on a failed migration, and cleanup failure keeps committed raw copies', async () => {
    const data = installStorage();
    data.set(SLOT.current, rich);
    data.set(SLOT.previous, '@version 1\n');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        removeItem: () => {
          throw new DOMException('denied cleanup', 'SecurityError');
        },
      },
    });
    const storage = new MemoryRevisions();
    const autosave = new Autosave({ storage, registry });
    expect(await autosave.initialize()).toBe(canonical);
    expect(storage.state.legacy.map((e) => e.text)).toEqual(['@version 1\n', rich]);
    expect(data.get(SLOT.current)).toBe(rich);
    expect(autosave.getStatus().message).toBeNull();
  });
});
