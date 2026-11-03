/**
 * The text panel's applies (ADR-0047: the text applies as you type). Host code around
 * packages/editor's pure draft rules (text-draft.ts); the timer and the clock are injected, so
 * the races are tested without a browser.
 *
 * - Typing restarts a pause of TEXT_APPLY_PAUSE_MS; when it ends, a text without errors about
 *   the figure shown is applied (one replaceText; applies at most TEXT_MERGE_MS apart are one
 *   history entry). The field keeps the text as typed.
 * - At the end of the pause the decision is taken against the editor's state AT THAT MOMENT: a
 *   drag in progress, or any document change since the text was typed (a drag, a tool, undo,
 *   redo, the style card, the claim bar, the command bar, Randomize, an example or a link), wins:
 *   the pending apply is dropped, never applied over the newer figure, and the typed text stays
 *   with a note (stale) until Apply text or Revert text.
 * - Apply text and Ctrl+Enter apply now; leaving the field applies like the end of a pause.
 *   Each ends the typing session and shows the printed figure (unless the text was not applied).
 * - The text is parsed once per text: the diagnostics' parse is handed on to the apply.
 */
import type { Edit } from '@geomira/editor/edit';
import type { EditResult } from '@geomira/editor/result';
import type { EditorEnv, EditorState } from '@geomira/editor/state';
import {
  applied,
  atPause,
  draftOf,
  follow,
  onApplyNow,
  settled,
  typedInto,
  type DraftDecision,
  type DraftFacts,
  type TextDraft,
} from '@geomira/editor/text-draft';
import type { Document } from '@geomira/kernel/document';
import { parseText, type ParsedText } from '@geomira/lang/parse-text';
import { print } from '@geomira/lang/print';
import type { Schedule } from './long-press';

/** The pause after the last keystroke before the text applies. */
export const TEXT_APPLY_PAUSE_MS = 500;

/** Automatic applies at most this far apart are one typing session (one undo). */
export const TEXT_MERGE_MS = 3000;

/** What the text panel needs of the page's editor (EditorStore). */
export interface TextHost {
  readonly env: EditorEnv;
  current(): EditorState;
  apply(e: Edit): EditResult;
}

export class TextApplier {
  private draft: TextDraft;
  private parsed: ParsedText | null = null;
  private cancel: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly host: TextHost,
    private readonly schedule: Schedule,
    private readonly now: () => number,
  ) {
    const doc = host.current().doc;
    this.draft = draftOf(doc, print(doc));
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): TextDraft => this.draft;

  /** The parse of the field's text: one per text, shared by the diagnostics and the apply. */
  parse(): ParsedText {
    const text = this.draft.text;
    if (this.parsed?.text !== text) this.parsed = parseText(text, this.host.env.registry);
    return this.parsed;
  }

  hasErrors(): boolean {
    return this.parse().result.diagnostics.some((d) => d.severity === 'error');
  }

  /** Whether a pause is running (an apply may follow). */
  pending(): boolean {
    return this.cancel !== null;
  }

  /** The field's text changed: the pause starts again. */
  type(text: string): void {
    this.set(typedInto(this.draft, text));
    this.stop();
    this.cancel = this.schedule(() => {
      this.cancel = null;
      this.run(atPause(this.draft, this.facts(), this.now(), TEXT_MERGE_MS));
    }, TEXT_APPLY_PAUSE_MS);
  }

  /** Apply text, Ctrl+Enter: apply now (a stale text too: the note said so); settle. */
  applyNow(): void {
    this.stop();
    this.run(onApplyNow(this.draft, this.facts(), this.now(), TEXT_MERGE_MS));
    this.settle();
  }

  /** The field loses the focus: apply as at the end of a pause; settle. */
  leave(): void {
    this.stop();
    this.run(atPause(this.draft, this.facts(), this.now(), TEXT_MERGE_MS));
    this.settle();
  }

  /** Revert text: the figure's text, the typed edits dropped. */
  revert(): void {
    this.stop();
    const doc = this.host.current().doc;
    this.set(draftOf(doc, print(doc)));
  }

  /**
   * The figure shown is `doc`: a draft without edits of its own follows it; a pause on an older
   * figure is dropped (its text stays, stale).
   */
  follow(doc: Document): void {
    if (doc !== this.draft.doc) this.stop();
    this.set(follow(this.draft, doc, () => print(doc)));
  }

  private stop(): void {
    this.cancel?.();
    this.cancel = null;
  }

  private facts(): DraftFacts {
    const s = this.host.current();
    return { doc: s.doc, dragging: s.drag !== null, errors: this.hasErrors() };
  }

  private run(d: DraftDecision): void {
    if (d.kind === 'none') return;
    const text = this.draft.text;
    const typing = d.typing === undefined ? {} : { typing: d.typing };
    const r = this.host.apply({ kind: 'replaceText', text, parsed: this.parse(), ...typing });
    if (r.ok) this.set(applied(this.draft, text, r.state.doc, this.now()));
  }

  private settle(): void {
    const doc = this.host.current().doc;
    this.set(settled(this.draft, doc, () => print(doc)));
  }

  private set(d: TextDraft): void {
    if (d === this.draft) return;
    this.draft = d;
    for (const l of this.listeners) l();
  }
}
