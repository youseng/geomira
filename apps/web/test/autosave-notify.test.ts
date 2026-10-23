/**
 * Bug-fix round (ADR-0028): "Restore previous figure" stayed disabled after a save wrote the
 * slots, because the header computed it at render and the slot write (200 ms later) did not
 * re-render anything. The Autosave object now tells its subscribers when it writes the slots.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Autosave } from '../src/persist';
import { installStorage, removeStorage } from './fake-storage';

afterEach(removeStorage);

describe('Autosave notifies when it writes the slots', () => {
  it('a save that writes, and a restore, notify; a save the policy skips does not', () => {
    installStorage();
    const a = new Autosave();
    let n = 0;
    const stop = a.subscribe(() => n++);
    const v0 = a.getVersion();
    a.opened('new');
    a.save('@version 1\nA = (0, 0)\n');
    expect(n).toBe(1);
    expect(a.getVersion()).not.toBe(v0);
    a.opened('example');
    a.save('@version 1\n# an example\n');
    expect(n).toBe(1);
    expect(a.canRestore('@version 1\n# an example\n')).toBe(true);
    expect(a.restore('@version 1\n# an example\n')).toBe('@version 1\nA = (0, 0)\n');
    expect(n).toBe(2);
    stop();
    a.opened('new');
    a.save('@version 1\nB = (1, 1)\n');
    expect(n).toBe(2);
  });

  it('after opening over an autosave, Restore becomes possible once the first save is written', () => {
    const data = installStorage();
    data.set('geomira.autosave.current', 'yesterday');
    const a = new Autosave();
    a.opened('new');
    expect(a.canRestore('today')).toBe(false);
    let n = 0;
    a.subscribe(() => n++);
    a.save('today');
    expect(n).toBe(1);
    expect(a.canRestore('today')).toBe(true);
  });
});
