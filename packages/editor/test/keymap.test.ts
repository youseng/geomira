import { describe, expect, it } from 'vitest';
import { helpSections, keyAction, KEYMAP } from '../src/keymap';
import { TOOLS } from '../src/tools';

/** Shortcuts and help are generated from data (SPEC §15, E10). */

describe('the keymap', () => {
  it('has one entry per GUI tool, from the tool table', () => {
    for (const t of TOOLS) {
      const e = KEYMAP.find((k) => k.action.kind === 'tool' && k.action.tool === t.id);
      expect(e?.key, t.id).toBe(t.key);
      expect(e?.help).toBe(`${t.label}: ${t.help}`);
    }
  });

  it('keys are unique (with their modifiers)', () => {
    const keys = KEYMAP.map(
      (k) => `${k.ctrl === true ? 'C-' : ''}${k.shift === true ? 'S-' : ''}${k.key}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keyAction finds the entry; modifiers matter', () => {
    expect(keyAction({ key: 'c', ctrl: false, shift: false, alt: false })).toEqual({
      kind: 'tool',
      tool: 'circle',
    });
    expect(keyAction({ key: 'z', ctrl: true, shift: false, alt: false })).toEqual({ kind: 'undo' });
    expect(keyAction({ key: 'Z', ctrl: true, shift: true, alt: false })).toEqual({ kind: 'redo' });
    expect(keyAction({ key: 'y', ctrl: true, shift: false, alt: false })).toEqual({ kind: 'redo' });
    expect(keyAction({ key: 'Escape', ctrl: false, shift: false, alt: false })).toEqual({
      kind: 'cancel',
    });
    expect(keyAction({ key: 'c', ctrl: true, shift: false, alt: false })).toBeUndefined();
    expect(keyAction({ key: 'c', ctrl: false, shift: false, alt: true })).toBeUndefined();
    expect(keyAction({ key: 'F13', ctrl: false, shift: false, alt: false })).toBeUndefined();
  });

  it('help lists every entry once, grouped', () => {
    const rows = helpSections().flatMap((s) => s.rows);
    expect(rows).toHaveLength(KEYMAP.length);
    for (const r of rows) {
      expect(r.keys).not.toBe('');
      expect(r.help).not.toBe('');
    }
    expect(helpSections().map((s) => s.title)).toEqual(['Tools', 'Editing', 'View']);
  });
});
