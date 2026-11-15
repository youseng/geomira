import { afterEach, describe, expect, it } from 'vitest';
import { Autosave } from '../src/persist';
import { installStorage, removeStorage } from './fake-storage';
import { MemoryRevisions } from './memory-revisions';

const A = '@version 1\nA = (0, 0)\n';
const AB = `${A}B = (1, 0)\n`;
const AC = `${A}C = (0, 1)\n`;
afterEach(removeStorage);

describe('release 02 data-loss reproductions', () => {
  it('keeps both constructions when a second tab saves its stale A+C', async () => {
    installStorage();
    const storage = new MemoryRevisions();
    const first = new Autosave({ storage });
    await first.save(A);
    const second = new Autosave({ storage });
    const start = await second.initialize();
    second.opened('autosave', start);
    await second.save(A);
    first.edited();
    await first.save(AB);
    second.edited();
    await second.save(AC);
    const versions = storage.state.revisions.map((r) => r.text);
    expect(versions).toContain(AB);
    expect(versions).toContain(AC);
    expect(second.getStatus().phase).toBe('conflict');
  });

  it('does not acknowledge a quota failure after a successful initial save', async () => {
    installStorage();
    const storage = new MemoryRevisions();
    const first = new Autosave({ storage });
    await first.save(A);
    const acknowledged = first.getStatus().revisionId;
    storage.failure = 'put';
    first.edited();
    await first.save(AB);
    expect(storage.state.revisions.at(-1)?.text).toBe(A);
    expect(first.getStatus().revisionId).toBe(acknowledged);
    expect(first.getStatus().phase).toBe('not-saved');
  });
});
