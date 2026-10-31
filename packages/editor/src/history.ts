/**
 * Undo/redo history (SPEC §12, law L6). Each entry holds the documents before and after one
 * user action (an edit, a batch, or a whole drag gesture), so undo and redo restore a
 * document EXACTLY: the very objects that were there. A new action clears the redo stack.
 * Drags are coalesced: every move of one gesture replaces the `after` of the gesture's
 * entry (drag.ts), so one undo returns to the document before the drag. The history keeps
 * at most HISTORY_LIMIT entries (the oldest are dropped). The text panel's automatic applies
 * are coalesced the same way (ADR-0047): a typing session's entry is open (`typing`) until any
 * other entry, an undo or a redo; while it is open, the session's next apply replaces its
 * `after` (edit.ts).
 */
import type { Document } from '@geomira/kernel/document';

export interface HistoryEntry {
  /** What the action was ("add A", "drag A", "replace text"). */
  readonly label: string;
  readonly before: Document;
  readonly after: Document;
}

export interface History {
  /** Oldest first; the last entry is the next undo. */
  readonly past: readonly HistoryEntry[];
  /** The next redo is the last entry. */
  readonly future: readonly HistoryEntry[];
  /**
   * The last entry is a typing session's that is still open (ADR-0047). Every function here
   * returns a history without it, so any other action ends the session (text-edit.ts opens it).
   */
  readonly typing?: true;
}

export const EMPTY_HISTORY: History = Object.freeze({ past: [], future: [] });

/** Entries kept for undo. */
export const HISTORY_LIMIT = 500;

/** The history after an action that turned `before` into `after` (no entry when equal). */
export function record(h: History, label: string, before: Document, after: Document): History {
  if (before === after) return h;
  const past = [...h.past, { label, before, after }];
  return { past: past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past, future: [] };
}

/** The history with the last entry's `after` replaced (a coalesced drag move). */
export function amendLast(h: History, after: Document): History {
  const last = h.past[h.past.length - 1];
  if (last === undefined) return h;
  return { past: [...h.past.slice(0, -1), { ...last, after }], future: h.future };
}

/** The history without its last entry (a cancelled drag). */
export function dropLast(h: History): History {
  return { past: h.past.slice(0, -1), future: h.future };
}

/** Undo: the document to show and the new history, or undefined when nothing to undo. */
export function undo(h: History): { doc: Document; history: History } | undefined {
  const last = h.past[h.past.length - 1];
  if (last === undefined) return undefined;
  return { doc: last.before, history: { past: h.past.slice(0, -1), future: [...h.future, last] } };
}

/** Redo: the document to show and the new history, or undefined when nothing to redo. */
export function redo(h: History): { doc: Document; history: History } | undefined {
  const next = h.future[h.future.length - 1];
  if (next === undefined) return undefined;
  return { doc: next.after, history: { past: [...h.past, next], future: h.future.slice(0, -1) } };
}
