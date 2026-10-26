/**
 * The views shortcuts (Run 13): ] switches to the next saved view, [ to the previous one.
 * They collide with no other binding (every lowercase letter, the digits and many Shift
 * letters are tools'), take no modifier, and are listed in the help's View section.
 */
import { describe, expect, it } from 'vitest';
import { helpSections, keyAction, KEYMAP } from '../src/keymap';

const key = (k: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean }> = {}) =>
  keyAction({ key: k, ctrl: false, shift: false, alt: false, ...mods });

describe('views shortcuts', () => {
  it('] is the next view and [ the previous one', () => {
    expect(key(']')).toEqual({ kind: 'view', step: 1 });
    expect(key('[')).toEqual({ kind: 'view', step: -1 });
  });

  it('no other binding uses [ or ], with or without modifiers', () => {
    const uses = KEYMAP.filter((k) => k.key === '[' || k.key === ']' || k.also?.includes('['));
    expect(uses.map((k) => k.action)).toEqual([
      { kind: 'view', step: 1 },
      { kind: 'view', step: -1 },
    ]);
    expect(key(']', { ctrl: true })).toBeUndefined();
    expect(key('[', { alt: true })).toBeUndefined();
  });

  it('the help lists them in the View section', () => {
    const view = helpSections().find((s) => s.title === 'View');
    expect(view?.rows).toContainEqual({
      keys: ']',
      help: 'Switch to the next saved view (Layers panel)',
    });
    expect(view?.rows).toContainEqual({ keys: '[', help: 'Switch to the previous saved view' });
  });
});
