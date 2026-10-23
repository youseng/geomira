/**
 * Startup and "Restore previous figure" (SPEC §12), completing the autosave policy of
 * autosave.ts as pure functions (the web app owns storage). Run 8b: "opening a share link
 * keeps the autosave and Restore previous figure works".
 *   - At startup a valid share link opens (origin `link`, not saved before its first edit);
 *     otherwise the autosave (`current`); otherwise a new figure.
 *   - While a link or an example is open and NOT yet saved, the user's own figure is still
 *     the `current` slot, so that is what "Restore previous figure" offers; the opened text
 *     becomes `previous` (restoring again goes back to it).
 *   - Otherwise the offer is the `previous` slot, swapped with `current` (autosave.ts's
 *     restorePrevious); nothing when there is none.
 * After a restore the session counts as saved (its text is already `current`), so the next
 * save keeps `previous`.
 */
import {
  restorePrevious,
  waitsForEdit,
  type AutosaveSlots,
  type Origin,
  type Session,
} from './autosave';

export interface Startup {
  /** The text to open; null = a new, empty figure. */
  readonly text: string | null;
  readonly origin: Origin;
}

/** What opens at startup: a share link's text (already decoded and valid), else the autosave. */
export function openAtStartup(slots: AutosaveSlots, linkText: string | null): Startup {
  if (linkText !== null) return { text: linkText, origin: 'link' };
  if (slots.current !== null) return { text: slots.current, origin: 'autosave' };
  return { text: null, origin: 'new' };
}

/** The figure "Restore previous figure" would open and the slots after it, or undefined. */
export function restoreOffer(
  slots: AutosaveSlots,
  session: Session,
  openText: string,
): { text: string; slots: AutosaveSlots } | undefined {
  const unsaved = waitsForEdit(session.origin) && !session.saved;
  if (unsaved && slots.current !== null && slots.current !== openText)
    return { text: slots.current, slots: { current: slots.current, previous: openText } };
  return restorePrevious(slots);
}

/** The session of a restored figure: its text is the current slot already. */
export function restoredSession(): Session {
  return { origin: 'autosave', edited: false, saved: true };
}
