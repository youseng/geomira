import { describe, expect, it } from 'vitest';
import { afterEdit, EMPTY_SLOTS, openSession, save } from '../src/autosave';
import { openAtStartup, restoreOffer, restoredSession } from '../src/restore';

/**
 * "Opening a share link keeps the autosave and Restore previous figure works" (Run 8b): the
 * figure to restore while a link is open and unedited is the autosave itself.
 */

describe('openAtStartup', () => {
  it('a valid link wins, then the autosave, then a new figure', () => {
    const slots = { current: 'X', previous: 'W' };
    expect(openAtStartup(slots, 'Y')).toEqual({ text: 'Y', origin: 'link' });
    expect(openAtStartup(slots, null)).toEqual({ text: 'X', origin: 'autosave' });
    expect(openAtStartup(EMPTY_SLOTS, null)).toEqual({ text: null, origin: 'new' });
  });
});

describe('restoreOffer', () => {
  it('a link opened over an autosave: the autosave is offered, untouched by the link', () => {
    const slots = { current: 'X', previous: 'W' };
    const s = openSession('link');
    // Not saved before the first edit: the slots still hold X.
    expect(save(slots, s, 'Y').slots).toBe(slots);
    const r = restoreOffer(slots, s, 'Y');
    expect(r).toEqual({ text: 'X', slots: { current: 'X', previous: 'Y' } });
  });

  it('after the first edit of the link, the autosave has moved to previous and is offered', () => {
    const slots = { current: 'X', previous: 'W' };
    const edited = afterEdit(openSession('link'));
    const saved = save(slots, edited, 'Y2');
    expect(saved.slots).toEqual({ current: 'Y2', previous: 'X' });
    expect(restoreOffer(saved.slots, saved.session, 'Y2')).toEqual({
      text: 'X',
      slots: { current: 'X', previous: 'Y2' },
    });
  });

  it('otherwise the previous slot (a swap); nothing when there is none', () => {
    const s = { ...openSession('autosave'), saved: true };
    expect(restoreOffer({ current: 'X', previous: 'W' }, s, 'X')).toEqual({
      text: 'W',
      slots: { current: 'W', previous: 'X' },
    });
    expect(restoreOffer({ current: 'X', previous: null }, s, 'X')).toBeUndefined();
    expect(
      restoreOffer({ current: 'Y', previous: null }, openSession('link'), 'Y'),
    ).toBeUndefined();
  });

  it('the session after a restore has saved its slot, so the next save keeps previous', () => {
    const r = restoreOffer({ current: 'X', previous: 'W' }, openSession('link'), 'Y');
    if (r === undefined) throw new Error('no offer');
    const next = save(r.slots, afterEdit(restoredSession()), 'X2');
    expect(next.slots).toEqual({ current: 'X2', previous: 'Y' });
  });
});
