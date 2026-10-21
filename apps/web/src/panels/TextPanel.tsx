import { useEffect, useMemo, useState } from 'react';
import type { EditorState } from '@geomira/editor/state';
import type { Registry } from '@geomira/kernel/registry';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import type { EditorStore } from '../store';

export interface TextPanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
}

function diagnosticsOf(text: string, registry: Registry): readonly Diagnostic[] {
  return parse(text, registry).diagnostics;
}

export function DiagnosticList({ items }: { items: readonly Diagnostic[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="diagnostics" aria-label="Diagnostics">
      {items.map((d) => (
        <li
          key={`${String(d.line)}:${String(d.column)}:${d.message}`}
          className={`diag-${d.severity}`}
        >
          Line {d.line}, column {d.column}: {d.message}. <span className="hint">{d.hint}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The text panel (SPEC §15, two-way): the figure's text as the language prints it. Editing
 * shows the diagnostics of every line as you type; Apply (or leaving the field, or
 * Ctrl+Enter) turns the text into the figure as ONE edit (replaceText: the parser decides,
 * ids are kept, undo returns). A text with errors is not applied: the figure stays and the
 * errors stay listed. A change of the figure from elsewhere updates the text, unless the text
 * holds unapplied edits, which are kept until applied or reverted.
 */
export function TextPanel({ store, state }: TextPanelProps) {
  const printed = useMemo(() => print(state.doc), [state.doc]);
  const [draft, setDraft] = useState(printed);
  // The printed text the draft started from: a draft equal to it holds no edits of its own.
  const [base, setBase] = useState(printed);
  const dirty = draft !== base;
  useEffect(() => {
    if (draft === base && printed !== base) {
      setDraft(printed);
      setBase(printed);
    }
  }, [printed, draft, base]);
  const sync = (text: string) => {
    setDraft(text);
    setBase(text);
  };
  const registry = store.env.registry;
  const diagnostics = useMemo(() => diagnosticsOf(draft, registry), [draft, registry]);
  const errors = diagnostics.some((d) => d.severity === 'error');
  const apply = () => {
    if (!dirty || errors) return;
    const r = store.apply({ kind: 'replaceText', text: draft });
    if (r.ok) sync(print(r.state.doc));
  };
  return (
    <div className="text-panel">
      <textarea
        aria-label="Text"
        spellCheck={false}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) apply();
        }}
      />
      <div className="text-actions">
        <button type="button" disabled={!dirty || errors} onClick={apply}>
          Apply text
        </button>
        <button
          type="button"
          disabled={!dirty}
          onMouseDown={(e) => {
            // Keep the focus in the text: leaving it would apply the text this button reverts.
            e.preventDefault();
          }}
          onClick={() => {
            sync(printed);
          }}
        >
          Revert text
        </button>
        {dirty && printed !== base && <span className="muted">The figure changed meanwhile.</span>}
      </div>
      <DiagnosticList items={diagnostics} />
    </div>
  );
}
