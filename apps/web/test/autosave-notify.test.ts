/** ADR-0067: notifications track durable completion, pending state and recovery availability. */
import { afterEach, describe, expect, it } from 'vitest';
import { Autosave } from '../src/persist';
import { installStorage, removeStorage, SLOT } from './fake-storage';
import { MemoryRevisions } from './memory-revisions';

afterEach(removeStorage);
describe('Autosave notifies when it writes revisions', () => {
  it('a save that writes, and a restore, notify; a save the policy skips does not', async () => {
    installStorage();
    const a = new Autosave({ storage: new MemoryRevisions() });
    await a.initialize();
    let n = 0;
    const stop = a.subscribe(() => n++);
    const v0 = a.getVersion();
    a.opened('new');
    await a.save('@version 1\nA = (0, 0)\n');
    expect(n).toBeGreaterThan(0);
    expect(a.getVersion()).not.toBe(v0);
    a.opened('example');
    const before = n;
    await a.save('@version 1\n# an example\n');
    expect(n).toBe(before);
    expect(a.canRestore('@version 1\n# an example\n')).toBe(true);
    expect(await a.restore('@version 1\n# an example\n')).toBe('@version 1\nA = (0, 0)\n');
    expect(n).toBeGreaterThan(before);
    stop();
    const stopped = n;
    a.opened('new');
    await a.save('@version 1\nB = (1, 1)\n');
    expect(n).toBe(stopped);
  });

  it('after opening over an autosave, Restore becomes possible once the first save is written', async () => {
    const data = installStorage();
    const yesterday = '@version 1\n# yesterday\n';
    const today = '@version 1\n# today\n';
    data.set(SLOT.current, yesterday);
    const a = new Autosave({ storage: new MemoryRevisions() });
    await a.initialize();
    a.opened('new');
    expect(a.canRestore(today)).toBe(true);
    let n = 0;
    a.subscribe(() => n++);
    await a.save(today);
    expect(n).toBeGreaterThan(0);
    expect(a.canRestore(today)).toBe(true);
    expect(a.entries().map((r) => r.text)).toContain(yesterday);
  });
});
