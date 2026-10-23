/**
 * Bug-fix round (ADR-0028): the autosave runs 200 ms after the last change. When another
 * figure opened within those 200 ms, the pending save was dropped (the last edit was lost),
 * and nothing saved when the page was hidden or closed. The pending save now runs before a
 * figure opens, before a restore, and when the page hides.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { print } from '@geomira/lang/print';
import { flushWhenHidden } from '../src/hooks';
import { EditorStore } from '../src/store';
import { installStorage, removeStorage, SLOT } from './fake-storage';
import { registry } from './helpers';

afterEach(() => {
  removeStorage();
  vi.useRealTimers();
});

/** A store with the user's figure edited and its save pending (as useAutosave schedules it). */
function pendingEdit() {
  const data = installStorage();
  data.set(SLOT.current, '@version 1\n# yesterday\n');
  const store = new EditorStore({ registry }, () => undefined);
  store.openText('@version 1\nA = (0, 0)\n', 'new');
  store.autosave.save(print(store.current().doc));
  store.command('B = (4, 0)');
  const edited = print(store.current().doc);
  vi.useFakeTimers();
  store.autosave.schedule(() => {
    store.autosave.save(edited);
  }, 200);
  return { data, store, edited };
}

describe('the pending autosave', () => {
  it('runs before another figure opens', () => {
    const { data, store, edited } = pendingEdit();
    store.openText('@version 1\nZ = (1, 1)\n', 'example');
    expect(data.get(SLOT.current)).toBe(edited);
    // It ran once: the timer does not save again over the next figure.
    vi.advanceTimersByTime(1000);
    expect(data.get(SLOT.current)).toBe(edited);
  });

  it('runs before Restore previous figure reads the slots', () => {
    const { data, store, edited } = pendingEdit();
    // Restoring yesterday's figure keeps the edited one as previous (not the one before it).
    expect(store.autosave.restore(edited)).toBe('@version 1\n# yesterday\n');
    expect(data.get(SLOT.previous)).toBe(edited);
  });

  it('runs when the page hides (pagehide, or visibility hidden), not while visible', () => {
    const { data, store, edited } = pendingEdit();
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const stop = flushWhenHidden(store.autosave, win, doc);
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(data.get(SLOT.current)).not.toBe(edited);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(data.get(SLOT.current)).toBe(edited);
    // pagehide flushes too; after stop() nothing is listened to.
    store.command('C = (1, 3)');
    const again = print(store.current().doc);
    store.autosave.schedule(() => {
      store.autosave.save(again);
    }, 200);
    win.dispatchEvent(new Event('pagehide'));
    expect(data.get(SLOT.current)).toBe(again);
    stop();
    store.autosave.schedule(() => {
      store.autosave.save('late');
    }, 200);
    win.dispatchEvent(new Event('pagehide'));
    expect(data.get(SLOT.current)).toBe(again);
  });

  it('a timer that fires saves once; flush with nothing pending does nothing', () => {
    const { data, store, edited } = pendingEdit();
    vi.advanceTimersByTime(200);
    expect(data.get(SLOT.current)).toBe(edited);
    data.delete(SLOT.current);
    store.autosave.flush();
    expect(data.get(SLOT.current)).toBeUndefined();
  });
});
