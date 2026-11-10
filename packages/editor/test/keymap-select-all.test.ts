/**
 * ADR-0060: Ctrl+A (Cmd+A) selects every drawn object. It collides with no tool key (the
 * tools take no Ctrl), and the help lists it under Editing.
 */
import { describe, expect, it } from 'vitest';
import { helpSections, keyAction, KEYMAP } from '../src/keymap';

const key = (k: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean }> = {}) =>
  keyAction({ key: k, ctrl: false, shift: false, alt: false, ...mods });

describe('select all', () => {
  it('Ctrl+A selects all; plain a stays the Angle tool', () => {
    expect(key('a', { ctrl: true })).toEqual({ kind: 'selectAll' });
    expect(key('A', { ctrl: true })).toEqual({ kind: 'selectAll' });
    expect(key('a')).toEqual({ kind: 'tool', tool: 'measure_angle' });
    expect(key('a', { ctrl: true, alt: true })).toBeUndefined();
  });

  it('is bound once and listed in the help', () => {
    expect(KEYMAP.filter((k) => k.action.kind === 'selectAll')).toHaveLength(1);
    const editing = helpSections().find((s) => s.title === 'Editing');
    expect(editing?.rows).toContainEqual({
      keys: 'Ctrl+a',
      help: 'Select every drawn object (Shift+click or Ctrl+click adds or removes one)',
    });
  });
});
