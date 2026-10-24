/**
 * Bug-fix round (ADR-0028): browsing the examples destroyed the user's own autosaved figure
 * (examples opened as `file`, saved at once). Repro: A = (0, 0), B = (4, 0), wait for the
 * autosave, then open two examples: the user's figure was in neither slot.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { openExample } from '../src/page';
import { EditorStore } from '../src/store';
import { installStorage, removeStorage, SLOT } from './fake-storage';
import { registry } from './helpers';

afterEach(removeStorage);

describe('opening examples', () => {
  it('keeps the user’s figure in the current slot until an example is edited', () => {
    const data = installStorage();
    const store = new EditorStore({ registry }, () => undefined);
    const runs = { clear: () => undefined };
    store.openText('@version 1\n', 'new');
    store.command('A = (0, 0)');
    store.command('B = (4, 0)');
    const mine = print(store.current().doc);
    store.autosave.save(mine);
    expect(data.get(SLOT.current)).toBe(mine);
    for (const id of ['euler-line', 'miquel']) {
      expect(openExample(store, runs, id)).toBe(true);
      store.autosave.save(print(store.current().doc));
    }
    expect(data.get(SLOT.current)).toBe(mine);
    // Restore previous figure brings the user's figure back.
    expect(store.autosave.restore(print(store.current().doc))).toBe(mine);
  });

  it('an edited example is saved, and the user’s figure becomes previous', () => {
    const data = installStorage();
    const store = new EditorStore({ registry }, () => undefined);
    store.openText('@version 1\nA = (0, 0)\n', 'new');
    const mine = print(store.current().doc);
    store.autosave.save(mine);
    openExample(store, { clear: () => undefined }, 'euler-line');
    store.command('Z = (9, 9)');
    const edited = print(store.current().doc);
    store.autosave.save(edited);
    expect(data.get(SLOT.current)).toBe(edited);
    expect(data.get(SLOT.previous)).toBe(mine);
  });

  it('an unknown example id opens nothing', () => {
    const store = new EditorStore({ registry }, () => undefined);
    expect(openExample(store, { clear: () => undefined }, 'no-such-example')).toBe(false);
    expect(store.getSnapshot().openCount).toBe(0);
  });
});
