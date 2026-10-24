/**
 * Bug-fix round (ADR-0028): the page's shortcuts called preventDefault for Enter on every
 * target, so Enter did nothing on a focused button, tab or link (the keymap binds Enter to
 * "finish"). Enter and Space now belong to a focused control; fields keep every key.
 */
import { describe, expect, it } from 'vitest';
import { shortcutFor } from '../src/hooks';

const key = (k: string, more: Partial<{ ctrl: boolean; shift: boolean; alt: boolean }> = {}) => ({
  key: k,
  ctrl: false,
  shift: false,
  alt: false,
  ...more,
});

describe('which keys the page takes as shortcuts', () => {
  it('Enter and Space on a focused control are the control’s', () => {
    expect(shortcutFor(key('Enter'), 'control')).toBeUndefined();
    expect(shortcutFor(key(' '), 'control')).toBeUndefined();
  });

  it('other shortcuts still work on a focused control; Enter finishes elsewhere', () => {
    expect(shortcutFor(key('z', { ctrl: true }), 'control')).toEqual({ kind: 'undo' });
    expect(shortcutFor(key('Escape'), 'control')).toEqual({ kind: 'cancel' });
    expect(shortcutFor(key('Enter'), 'other')).toEqual({ kind: 'finish' });
  });

  it('nothing while typing in a field', () => {
    for (const k of ['Enter', 'z', 'Escape', '/'])
      expect(shortcutFor(key(k), 'field')).toBeUndefined();
  });
});
