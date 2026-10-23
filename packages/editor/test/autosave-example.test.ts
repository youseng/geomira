/**
 * Bug-fix round (ADR-0028): browsing the examples destroyed the user's own autosaved figure.
 * Examples opened as `file`, which is saved at once, and each session's first save moves
 * `current` to `previous`: after two examples the user's figure was in neither slot. An
 * example is now like a link: not saved before its first edit.
 */
import { describe, expect, it } from 'vitest';
import { afterEdit, openSession, save, shouldSave, waitsForEdit } from '../src/autosave';
import { restoreOffer } from '../src/restore';

describe('an example opened and not edited never pushes the user’s figure out', () => {
  it('two examples in a row leave the user’s figure in the current slot', () => {
    const user = save({ current: 'yesterday', previous: null }, openSession('new'), 'my work');
    expect(user.slots).toEqual({ current: 'my work', previous: 'yesterday' });
    const first = save(user.slots, openSession('example'), 'euler-line');
    expect(first.slots).toBe(user.slots);
    const second = save(first.slots, openSession('example'), 'miquel');
    expect(second.slots).toEqual({ current: 'my work', previous: 'yesterday' });
  });

  it('its first edit saves it, and the user’s figure becomes previous', () => {
    const slots = { current: 'my work', previous: 'yesterday' };
    const s = afterEdit(openSession('example'));
    expect(shouldSave(s)).toBe(true);
    expect(save(slots, s, 'euler-line, edited').slots).toEqual({
      current: 'euler-line, edited',
      previous: 'my work',
    });
  });

  it('while it is unedited, Restore previous figure offers the user’s figure', () => {
    const slots = { current: 'my work', previous: 'yesterday' };
    expect(restoreOffer(slots, openSession('example'), 'euler-line')).toEqual({
      text: 'my work',
      slots: { current: 'my work', previous: 'euler-line' },
    });
  });

  it('which origins wait for their first edit', () => {
    expect(waitsForEdit('link')).toBe(true);
    expect(waitsForEdit('example')).toBe(true);
    expect(waitsForEdit('autosave')).toBe(false);
    expect(waitsForEdit('new')).toBe(false);
    expect(waitsForEdit('file')).toBe(false);
  });
});
