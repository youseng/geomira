import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { EditorState } from '@geomira/editor/state';
import { canApply, hasEdits, isStale, type TextDraft } from '@geomira/editor/text-draft';
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { parseText } from '@geomira/lang/parse-text';
import { lineColumnOf, offsetOf, type LineColumn } from '../caret';
import type { TextApplier } from '../text-apply';
import { ScriptEditor } from '../ScriptEditor';
import { commandLines, diagnosticRange } from '../script-source';

export interface TextPanelProps {
  readonly state: EditorState;
  /** The draft and its applies (kept by the side panel while another tab is shown). */
  readonly applier: TextApplier;
}

/**
 * The draft's diagnostics. A definition that repeats an earlier construction is a warning
 * (ADR-0029): the text is still accepted, so files saved with repeats stay editable.
 */
export function diagnosticsOf(text: string, registry: Registry): readonly Diagnostic[] {
  return parseText(text, registry).result.diagnostics;
}

export function DiagnosticList({
  items,
  onChoose,
}: {
  items: readonly Diagnostic[];
  onChoose?: (diagnostic: Diagnostic) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="diagnostics" aria-label="Diagnostics">
      {items.map((d) => (
        <li
          key={`${String(d.line)}:${String(d.column)}:${d.message}`}
          className={`diag-${d.severity}`}
        >
          {onChoose === undefined ? (
            <>
              Line {d.line}, column {d.column}: {d.message}. <span className="hint">{d.hint}</span>
            </>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                onChoose(d);
              }}
            >
              Line {d.line}, column {d.column}: {d.message}. <span className="hint">{d.hint}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Where the caret and the scroll were, to restore them when the field's text is replaced. */
interface Caret {
  readonly start: LineColumn;
  readonly end: LineColumn;
  readonly scroll: number;
}

/**
 * Ctrl+Enter replaces the text with the printed figure while the field has the focus:
 * `keepAcross(t, action)` notes the caret (line and column) and the scroll, runs the action,
 * and puts them back, clamped to the new text, once it shows. When the action leaves the text
 * as it was, nothing is put back later (the next key must not move the caret).
 */
function useCaretKept(text: string) {
  const field = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<Caret | null>(null);
  useLayoutEffect(() => {
    const t = field.current;
    const c = caret.current;
    caret.current = null;
    if (t === null || c === null) return;
    t.setSelectionRange(offsetOf(t.value, c.start), offsetOf(t.value, c.end));
    t.scrollTop = c.scroll;
  }, [text]);
  const keepAcross = (t: HTMLTextAreaElement, action: () => string) => {
    const before = t.value;
    const start = lineColumnOf(before, t.selectionStart);
    caret.current = { start, end: lineColumnOf(before, t.selectionEnd), scroll: t.scrollTop };
    if (action() === before) caret.current = null;
  };
  return { field, keepAcross };
}

/** Apply text (apply now), Revert text, and the note on a text typed on an older figure. */
function TextActions(p: {
  readonly applier: TextApplier;
  readonly draft: TextDraft;
  readonly doc: Document;
  readonly errors: boolean;
}) {
  const { applier, draft } = p;
  return (
    <div className="text-actions">
      <button
        type="button"
        disabled={!canApply(draft, p.errors)}
        onClick={() => {
          applier.applyNow();
        }}
      >
        Apply text
      </button>
      <button
        type="button"
        disabled={!hasEdits(draft)}
        onMouseDown={(e) => {
          // Keep the focus in the text: leaving it would apply the text this button reverts.
          e.preventDefault();
        }}
        onClick={() => {
          applier.revert();
        }}
      >
        Revert text
      </button>
      {isStale(draft, p.doc) && (
        <span className="muted">
          The figure changed meanwhile: this text is not applied as you type. Apply text puts it in
          place of the figure; Revert text shows the figure&apos;s text.
        </span>
      )}
    </div>
  );
}

/**
 * The text panel (SPEC §15, two-way): the figure's text as the language prints it. Editing
 * shows the diagnostics of every line as you type, and the text applies as you type
 * (ADR-0047, text-apply.ts): after a pause, a text without errors becomes the figure (one
 * replaceText; a typing session is one undo), and the field keeps the text as typed, caret
 * and scroll included. Apply text and Ctrl+Enter apply at once and show the printed figure;
 * leaving the field applies current valid text while preserving its source (ADR-0075). A text with errors is not applied: the figure stays and the errors stay
 * listed. A change of the figure from elsewhere updates the text, unless the text holds edits
 * that were not applied: they are kept, with a note, and applied only by Apply text (also
 * while another tab is shown; Run 10 audit, W4).
 */
export function TextPanel({ state, applier }: TextPanelProps) {
  const draft = useSyncExternalStore(applier.subscribe, applier.getSnapshot, applier.getSnapshot);
  const doc = state.doc;
  useEffect(() => {
    applier.follow(doc);
  }, [applier, doc]);
  const { field, keepAcross } = useCaretKept(draft.text);
  const diagnostics = applier.parse().result.diagnostics;
  const errors = diagnostics.some((d) => d.severity === 'error');
  return (
    <div className="text-panel">
      <ScriptEditor
        state={state}
        applier={applier}
        field={field}
        text={draft.text}
        onLeave={(target) => {
          if (target instanceof Element && target.closest('[data-document-files]') !== null) return;
          applier.leave();
        }}
        onApply={(element) => {
          keepAcross(element, () => {
            applier.applyNow();
            return applier.getSnapshot().text;
          });
        }}
      />
      {applier.sourceNotice() !== null && (
        <p className="muted source-regeneration" role="status">
          {applier.sourceNotice()}
        </p>
      )}
      <SourceActions applier={applier} field={field} text={draft.text} />
      <TextActions applier={applier} draft={draft} doc={doc} errors={errors} />
      <DiagnosticList
        items={diagnostics}
        onChoose={(d) => {
          const element = field.current;
          if (element === null) return;
          const [start, end] = diagnosticRange(draft.text, d);
          element.focus();
          element.setSelectionRange(start, end);
          const height = parseFloat(getComputedStyle(element).lineHeight);
          element.scrollTop = Math.max(0, (d.line - 1) * height - element.clientHeight / 2);
          element.dispatchEvent(new Event('scroll', { bubbles: true }));
        }}
      />
    </div>
  );
}

function SourceActions({
  applier,
  field,
  text,
}: {
  applier: TextApplier;
  field: React.RefObject<HTMLTextAreaElement | null>;
  text: string;
}) {
  const converted = commandLines(text);
  return (
    <div className="text-source-actions">
      {converted !== text && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => {
            applier.type(converted);
            field.current?.focus();
          }}
        >
          Convert command separators to lines
        </button>
      )}
      <details className="editor-help">
        <summary>Editor help</summary>
        <p className="muted">
          Ctrl+Space opens completions. Arrow keys choose, Tab or Enter accepts, Escape dismisses.
          Ctrl+Enter applies and formats valid source.
        </p>
        <p className="muted">
          Leaving the editor keeps your source. Apply text formats valid source. Construction edits
          regenerate clean text; unapplied drafts stay available with a warning. Pasting command
          separators reveals an explicit conversion to separate lines.
        </p>
      </details>
    </div>
  );
}
