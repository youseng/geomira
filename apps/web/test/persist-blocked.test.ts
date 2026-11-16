/** ADR-0067: denied storage keeps the editor usable and now reports the unsaved edit. */
import { afterEach, describe, expect, it } from 'vitest';
import { Autosave } from '../src/persist';

function blockStorage(): void {
  for (const key of ['localStorage', 'indexedDB'])
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
}
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, 'indexedDB');
});
describe('blocked storage', () => {
  it('opens without throwing and retains the pending figure with a persistent error', async () => {
    blockStorage();
    const a = new Autosave();
    expect(await a.initialize()).toBeNull();
    a.opened('new');
    a.edited();
    expect(await a.save('@version 1\nA = (0, 0)\n')).toBe(false);
    expect(a.getStatus().phase).toBe('not-saved');
    expect(a.getStatus().message).toContain('SecurityError');
    expect(a.entries().map((r) => r.text)).toContain('@version 1\nA = (0, 0)\n');
    expect(a.canRestore('@version 1\nA = (0, 0)\n')).toBe(false);
    expect(await a.restore('@version 1\nA = (0, 0)\n')).toBeUndefined();
  });
});
