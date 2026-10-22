/**
 * Storage that throws on access (pre-beta review): with cookies and site data blocked, in a
 * sandboxed frame or some private modes, merely reading `window.localStorage` throws a
 * SecurityError. readSlots read it outside its try/catch, so the startup effect threw and
 * the page stayed blank. The app must run without autosave instead.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { EMPTY_SLOTS } from '@geomira/editor/autosave';
import { Autosave, readSlots } from '../src/persist';

function blockStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError: The operation is insecure.');
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('blocked storage', () => {
  it('reads give empty slots and writes are dropped, never an error', () => {
    blockStorage();
    expect(readSlots()).toEqual(EMPTY_SLOTS);
    const a = new Autosave();
    a.opened('new');
    a.edited();
    expect(() => {
      a.save('@version 1\nA = (0, 0)\n');
    }).not.toThrow();
    expect(a.canRestore('@version 1\n')).toBe(false);
    expect(a.restore('@version 1\n')).toBeUndefined();
  });
});
