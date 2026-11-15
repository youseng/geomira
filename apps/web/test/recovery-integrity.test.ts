import { afterEach, describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { parse } from '@geomira/lang/parse';
import { createRegistry } from '@geomira/kernel/registry';
import { assertInvariants } from '@geomira/kernel/invariants';
import { Autosave } from '../src/persist';
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
