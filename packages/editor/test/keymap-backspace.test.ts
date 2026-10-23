/**
 * A Mac's delete key sends "Backspace": it removes the selection as "Delete" does, with one
 * help row naming both keys (the web app never runs shortcuts while a field has the focus).
 */
import { describe, expect, it } from 'vitest';
import { helpSections, keyAction, KEYMAP } from '../src/keymap';

const key = (k: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) => ({
  key: k,
  ctrl: mods.ctrl ?? false,
  shift: mods.shift ?? false,
  alt: mods.alt ?? false,
});

describe('Backspace deletes', () => {
  it('Backspace and Delete are the delete action', () => {
    expect(keyAction(key('Backspace'))).toEqual({ kind: 'delete' });
    expect(keyAction(key('Delete'))).toEqual({ kind: 'delete' });
  });

  it('with Ctrl/Cmd or Alt it is left to the browser', () => {
    expect(keyAction(key('Backspace', { ctrl: true }))).toBeUndefined();
    expect(keyAction(key('Backspace', { alt: true }))).toBeUndefined();
  });

  it('one help row names both keys', () => {
    const rows = helpSections().flatMap((s) => s.rows);
    const del = rows.filter((r) => r.help.startsWith('Remove the selected objects'));
    expect(del).toEqual([
      {
        keys: 'Delete or Backspace',
        help: 'Remove the selected objects (and what is built from them)',
      },
    ]);
    expect(rows).toHaveLength(KEYMAP.length);
  });

  it('every key value, the alternatives included, is bound once (with its modifiers)', () => {
    const keys = KEYMAP.flatMap((k) =>
      [k.key, ...(k.also ?? [])].map(
        (x) => `${k.ctrl === true ? 'C-' : ''}${k.shift === true ? 'S-' : ''}${x}`,
      ),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
