/**
 * The whole-text edit (replaceText, SPEC §12) and the typing session of the text panel
 * (ADR-0047). The text is the document's new state through lang's parseInto (ids of persisting
 * names kept). A parse the caller already made (the text panel's diagnostics parse, lang's
 * ParsedText) is used when it is of this very text and registry; otherwise the text is parsed
 * here. A typing session coalesces like a drag: `typing: 'start'` records the session's entry
 * and opens it, `typing: 'continue'` replaces the open entry's `after`; any other entry, undo
 * or redo ends the session (history.ts).
 */
import type { Document } from '@geomira/kernel/document';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { stable } from '@geomira/lang/canonical';
import { parseInto } from '@geomira/lang/parse-into';
import { rebase, type ParsedText } from '@geomira/lang/parse-text';
import { dropLast, record, type History } from './history';
import type { EditorEnv } from './state';

export interface ReplaceText {
  readonly kind: 'replaceText';
  readonly text: string;
  /** The text panel's typing session (ADR-0047); absent: an entry of its own. */
  readonly typing?: 'start' | 'continue';
  /** A parse of `text` already made (used only when its text and registry are these). */
  readonly parsed?: ParsedText;
}

export type TextStep =
  | { readonly ok: true; readonly doc: Document }
  | { readonly ok: false; readonly error: string; readonly diagnostics: readonly Diagnostic[] };

/**
 * The document of a whole text. Degenerate: a text with an error is refused, with its
 * diagnostics (applying the lines that parsed would silently drop the others); a text that
 * gives the same document changes nothing (the very document is returned: no history entry).
 */
export function textStep(doc: Document, e: ReplaceText, env: EditorEnv): TextStep {
  const p = e.parsed;
  const r =
    p !== undefined && p.text === e.text && p.registry === env.registry
      ? rebase(doc, p.result)
      : parseInto(doc, e.text, env.registry);
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0)
    return { ok: false, error: 'the text has errors; nothing was changed', diagnostics: errors };
  return { ok: true, doc: stable(r.doc) === stable(doc) ? doc : r.doc };
}

/** The history with its last entry marked as an open typing session. */
function openTyping(h: History): History {
  return h.past.length === 0 ? h : { past: h.past, future: h.future, typing: true };
}

/** The history with no open typing session. */
function closeTyping(h: History): History {
  return h.typing === true ? { past: h.past, future: h.future } : h;
}

/** The history and document after a committed text edit (`doc` in text form). */
export interface TextCommit {
  readonly doc: Document;
  readonly history: History;
}

/**
 * The history after a text edit turned `before` into `doc`. 'continue' while the session's
 * entry is open and still the last action replaces its `after`; when that returns to the
 * document before the session, the entry goes (no undo that changes nothing) and the document
 * is that one itself. 'start' and a plain text record an entry ('start' opens it); a text that
 * changes nothing records none, and a 'start' then still ends the previous session.
 */
export function typingCommit(
  h: History,
  label: string,
  before: Document,
  doc: Document,
  typing: ReplaceText['typing'],
): TextCommit {
  if (doc === before) return { doc, history: typing === 'start' ? closeTyping(h) : h };
  const last = h.past[h.past.length - 1];
  if (typing === 'continue' && h.typing === true && last !== undefined && last.after === before) {
    if (stable(doc) === stable(last.before)) return { doc: last.before, history: dropLast(h) };
    const past = [...h.past.slice(0, -1), { ...last, after: doc }];
    return { doc, history: { past, future: h.future, typing: true } };
  }
  const recorded = record(h, label, before, doc);
  return { doc, history: typing === undefined ? recorded : openTyping(recorded) };
}
