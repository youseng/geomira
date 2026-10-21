import { useMemo, useState, type RefObject } from 'react';
import { acceptCompletion, completions, type Completion } from '@geomira/editor/command';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { DiagnosticList } from './panels/TextPanel';
import type { EditorStore } from './store';

export interface CommandBarProps {
  readonly store: EditorStore;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}

interface Feedback {
  readonly reason: string;
  readonly diagnostics: readonly Diagnostic[];
}

/** The command bar's state: the line, its cursor, the completions and the last error. */
function useCommandBar(store: EditorStore, inputRef: CommandBarProps['inputRef']) {
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const state = store.current();
  const list = useMemo(
    () => (text === '' ? [] : completions(state, text, cursor, store.env)),
    [state, text, cursor, store],
  );
  const accept = (c: Completion) => {
    const r = acceptCompletion(text, cursor, c);
    setText(r.text);
    setCursor(r.cursor);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(r.cursor, r.cursor));
  };
  const run = () => {
    const r = store.command(text);
    if (r === undefined) return;
    if (r.kind === 'edit') {
      setText('');
      setCursor(0);
      setFeedback(null);
    } else setFeedback({ reason: r.reason, diagnostics: r.diagnostics });
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const chosen = list[active];
    if (e.key === 'Enter') run();
    else if (e.key === 'Tab' && chosen !== undefined) accept(chosen);
    else if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, list.length - 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
    else if (e.key === 'Escape') setText('');
    else return;
    e.preventDefault();
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setCursor(e.target.selectionStart ?? e.target.value.length);
    setActive(0);
    setFeedback(null);
  };
  return { text, list, active, feedback, accept, onKey, onChange };
}

/**
 * The command bar (SPEC §15): type one statement of the language ("O = circumcenter(A, B,
 * C)", "claim …") or a tool's name; Enter runs it (packages/editor's runCommand: the same
 * parser as the text, one edit). Completions come from the registry, the objects, the
 * keywords and the tools: Tab or a click accepts, the arrows choose.
 */
export function CommandBar({ store, inputRef }: CommandBarProps) {
  const c = useCommandBar(store, inputRef);
  return (
    <div className="cmdbar">
      <span className="pr" aria-hidden="true">
        ›
      </span>
      <input
        ref={inputRef}
        type="text"
        aria-label="Command"
        placeholder="Command, construction or claim — e.g.  X = midpoint(A, H)  ·  claim collinear(A, B, C)   (press /)"
        spellCheck={false}
        autoComplete="off"
        value={c.text}
        onChange={c.onChange}
        onKeyDown={c.onKey}
      />
      {c.list.length > 0 && (
        <ul className="completions" role="listbox" aria-label="Completions">
          {c.list.map((x, i) => (
            <li
              key={`${x.kind}:${x.label}`}
              role="option"
              aria-selected={i === c.active}
              onMouseDown={(e) => {
                e.preventDefault();
                c.accept(x);
              }}
            >
              <span className="completion-label">{x.label}</span>{' '}
              <span className="muted">{x.detail}</span>
            </li>
          ))}
        </ul>
      )}
      {c.feedback !== null && (
        <div className="command-error" role="alert">
          {c.feedback.diagnostics.length === 0 ? (
            <p>{c.feedback.reason}</p>
          ) : (
            <DiagnosticList items={c.feedback.diagnostics} />
          )}
        </div>
      )}
    </div>
  );
}
