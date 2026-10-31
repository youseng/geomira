/**
 * The text panel's draft and its decisions (ADR-0047: the text applies as you type), pure:
 * the timer, the clock and the field are apps/web's (text-apply.ts). Times are the app's
 * clock in milliseconds, passed in.
 *
 * Rules:
 * - When a pause ends, a text with edits and without errors is applied (replaceText) if the
 *   draft is about the figure shown and no drag is in progress. A text typed on an older figure
 *   (a drag, a tool, undo, a link or example opened meanwhile) is STALE: the pending apply is
 *   dropped and the draft is kept with a note; neither a pause nor leaving the field applies it,
 *   only Apply text (the user's explicit choice; one undoable edit) or Revert text.
 * - Applies at most `mergeMs` apart are one typing session: one history entry (the editor's
 *   coalescing replaceText, text-edit.ts).
 * - After an apply the field keeps the text as typed (the caret and scroll stay; the applied
 *   document may print differently). Settling (Apply text, Ctrl+Enter, leaving the field) ends
 *   the session and shows the printed figure, unless the field holds a text that was not
 *   applied (errors, or stale), which stays.
 * - A draft without edits of its own follows the figure.
 */
import type { Document } from '@geomira/kernel/document';

export interface TextDraft {
  /** The field's text. */
  readonly text: string;
  /** The text without edits of its own: the printed `doc`, or the text last applied. */
  readonly clean: string;
  /** The figure the draft is about (shown when it started or followed, or made by its apply). */
  readonly doc: Document;
  /** When the open typing session's last apply was; null when no session is open. */
  readonly session: number | null;
}

/** What the decisions need to know about the editor. */
export interface DraftFacts {
  /** The figure now. */
  readonly doc: Document;
  /** The draft's text has errors (its diagnostics). */
  readonly errors: boolean;
  readonly dragging: boolean;
}

export type DraftDecision =
  | { readonly kind: 'apply'; readonly typing?: 'start' | 'continue' }
  | { readonly kind: 'none'; readonly why: 'no edits' | 'errors' | 'stale' | 'dragging' };

/** A draft showing the printed figure. */
export function draftOf(doc: Document, printed: string): TextDraft {
  return { text: printed, clean: printed, doc, session: null };
}

/** The field holds edits that are not in the figure. */
export function hasEdits(d: TextDraft): boolean {
  return d.text !== d.clean;
}

/** The field holds edits typed on another figure than `doc` (shown with a note). */
export function isStale(d: TextDraft, doc: Document): boolean {
  return hasEdits(d) && d.doc !== doc;
}

export function typedInto(d: TextDraft, text: string): TextDraft {
  return text === d.text ? d : { ...d, text };
}

/** Whether Apply text does something: apply the edits, or settle an open session. */
export function canApply(d: TextDraft, errors: boolean): boolean {
  return hasEdits(d) ? !errors : d.session !== null;
}

/**
 * The draft when the figure is `doc`: unchanged when it is about `doc` or holds edits of its
 * own (then it is stale); otherwise the printed figure (`printed` is called only then).
 */
export function follow(d: TextDraft, doc: Document, printed: () => string): TextDraft {
  return d.doc === doc || hasEdits(d) ? d : draftOf(doc, printed());
}

function sessionStep(d: TextDraft, now: number, mergeMs: number): 'start' | 'continue' {
  return d.session !== null && now - d.session <= mergeMs ? 'continue' : 'start';
}

/** When a pause ends, or the field is left: apply only a current text without errors. */
export function atPause(d: TextDraft, f: DraftFacts, now: number, mergeMs: number): DraftDecision {
  if (!hasEdits(d)) return { kind: 'none', why: 'no edits' };
  if (f.errors) return { kind: 'none', why: 'errors' };
  if (d.doc !== f.doc) return { kind: 'none', why: 'stale' };
  if (f.dragging) return { kind: 'none', why: 'dragging' };
  return { kind: 'apply', typing: sessionStep(d, now, mergeMs) };
}

/**
 * Apply text or Ctrl+Enter: like a pause, but a stale text is applied too (the note said the
 * figure changed; it replaces that figure as an entry of its own, which undo takes back).
 */
export function onApplyNow(
  d: TextDraft,
  f: DraftFacts,
  now: number,
  mergeMs: number,
): DraftDecision {
  const r = atPause(d, f, now, mergeMs);
  return r.kind === 'none' && r.why === 'stale' && !f.dragging ? { kind: 'apply' } : r;
}

/** The draft after its text `text` was applied, giving `doc` at time `now`. */
export function applied(d: TextDraft, text: string, doc: Document, now: number): TextDraft {
  return { text: d.text, clean: text, doc, session: now };
}

/**
 * The session ends (Apply text, Ctrl+Enter, leaving the field): the printed figure `doc`,
 * unless the field holds edits that are not applied, which stay (`printed` is called only
 * when it is shown).
 */
export function settled(d: TextDraft, doc: Document, printed: () => string): TextDraft {
  return hasEdits(d) ? { ...d, session: null } : draftOf(doc, printed());
}
