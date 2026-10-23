/**
 * The autosave POLICY as pure functions (SPEC §12): the web app owns the storage and the
 * timers, these functions decide what to write. Two slots: `current` (the figure being
 * edited) and `previous` (the autosave that the current session replaced, offered as
 * "Restore previous figure").
 *   - A document opened from a link or as one of the app's examples is NOT saved until its
 *     first edit: opening (or browsing) them must not overwrite the user's own work, which
 *     stays the `current` slot meanwhile (ADR-0028: examples used to be saved at once, so
 *     opening two pushed the user's figure out of both slots).
 *   - The first save of a session moves the stored `current` to `previous` (unless it is
 *     the same text), so a session never silently destroys the last one; later saves of the
 *     session overwrite `current` only.
 *   - Restoring swaps the slots: the restored figure becomes current, and the figure it
 *     replaces becomes previous (so a restore can itself be undone by restoring again).
 */
import { assertNever } from '@geomira/num/assert';

export interface AutosaveSlots {
  readonly current: string | null;
  readonly previous: string | null;
}

export const EMPTY_SLOTS: AutosaveSlots = Object.freeze({ current: null, previous: null });

/** Where the open document came from (`example`: one of the app's example figures). */
export type Origin = 'autosave' | 'link' | 'example' | 'file' | 'new';

/** Whether a document of this origin is saved only after its first edit (module comment). */
export function waitsForEdit(origin: Origin): boolean {
  switch (origin) {
    case 'link':
    case 'example':
      return true;
    case 'autosave':
    case 'file':
    case 'new':
      return false;
    default:
      return assertNever(origin, 'origin');
  }
}

export interface Session {
  readonly origin: Origin;
  /** Whether the document was edited since it was opened. */
  readonly edited: boolean;
  /** Whether this session has written the current slot yet. */
  readonly saved: boolean;
}

export function openSession(origin: Origin): Session {
  return { origin, edited: false, saved: false };
}

/** The session after a committed edit (any change of the document). */
export function afterEdit(s: Session): Session {
  return { ...s, edited: true };
}

/** Whether the document should be saved now (see the module comment). */
export function shouldSave(s: Session): boolean {
  return !waitsForEdit(s.origin) || s.edited;
}

/** The slots after saving `text` in session `s`, and the session after it. */
export function save(
  slots: AutosaveSlots,
  s: Session,
  text: string,
): { slots: AutosaveSlots; session: Session } {
  if (!shouldSave(s)) return { slots, session: s };
  const keep = !s.saved && slots.current !== null && slots.current !== text;
  return {
    slots: { current: text, previous: keep ? slots.current : slots.previous },
    session: { ...s, saved: true },
  };
}

/** "Restore previous figure": the text to open and the new slots, or undefined when none. */
export function restorePrevious(
  slots: AutosaveSlots,
): { text: string; slots: AutosaveSlots } | undefined {
  if (slots.previous === null) return undefined;
  return { text: slots.previous, slots: { current: slots.previous, previous: slots.current } };
}
