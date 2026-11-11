/**
 * The style card's live edits (ADR-0063): every change in the card is applied at once, as a
 * `style` edit of the object, and coalesced like a drag or the text panel's typing (ADR-0047):
 * `session: 'start'` records an entry and opens it; `session: 'continue'` replaces the open
 * entry's `after` while that entry is still the last action and is the same object's. So
 * dragging a slider, or typing a label, is ONE undo; the card starts a new session for each
 * new control. Any other edit, undo or redo ends the session (history.ts).
 */
import type { Document, Style } from '@geomira/kernel/document';
import { stable } from '@geomira/lang/canonical';
import { dropLast, record, type History } from './history';

export interface LiveStyle {
  readonly kind: 'liveStyle';
  readonly id: number;
  readonly style: Style;
  readonly session: 'start' | 'continue';
}

/** The history and document after a live style edit turned `before` into `doc`. */
export interface LiveCommit {
  readonly doc: Document;
  readonly history: History;
}

/**
 * The history after a live style edit of object `id`. 'continue' while that object's session
 * is open and its entry is the last action replaces the entry's `after`; when that returns to
 * the document before the session (a slider dragged back), the entry goes and the document is
 * that one itself (no undo that changes nothing). Otherwise an entry is recorded and opened.
 * Degenerate: an edit that changes nothing records none and keeps an open session open.
 */
export function liveCommit(
  h: History,
  label: string,
  before: Document,
  doc: Document,
  id: number,
  session: LiveStyle['session'],
): LiveCommit {
  // The kernel's style edit makes a new document even for the same style: compared by content.
  if (doc === before || stable(doc) === stable(before)) return { doc: before, history: h };
  const last = h.past[h.past.length - 1];
  if (session === 'continue' && h.live === id && last !== undefined && last.after === before) {
    if (stable(doc) === stable(last.before)) return { doc: last.before, history: dropLast(h) };
    const past = [...h.past.slice(0, -1), { ...last, after: doc }];
    return { doc, history: { past, future: h.future, live: id } };
  }
  const recorded = record(h, label, before, doc);
  return { doc, history: { past: recorded.past, future: recorded.future, live: id } };
}
