import { useState } from 'react';
import { claimForms } from '@geomira/editor/claim-bar';
import { acceptCompletion, type Completion } from '@geomira/editor/command';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { Glyph } from './icons';
import { DiagnosticList } from './panels/TextPanel';

/** What the box could not read: the reason and its diagnostics (columns of the box's text). */
export interface ClaimFeedback {
  readonly reason: string;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * The claim box's host (page.ts): `test` adds the claim and starts its local test, null when
 * added; `complete` gives the completions at the cursor (packages/editor claim-bar.ts).
 */
export interface ClaimBoxHost {
  readonly test: (text: string) => ClaimFeedback | null;
  readonly complete: (text: string, cursor: number) => readonly Completion[];
}

/** The forms the box reads (from the notation table), shown while it is empty and focused. */
const FORMS: readonly Completion[] = claimForms().map((f) => ({
  label: f.form,
  insert: f.form,
  detail: f.kind,
  kind: 'claim',
}));

function useClaimBox(host: ClaimBoxHost) {
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [feedback, setFeedback] = useState<ClaimFeedback | null>(null);
  const list = !focused ? [] : text.trim() === '' ? FORMS : host.complete(text, cursor);
  const edit = (t: string, at: number) => {
    setText(t);
    setCursor(at);
    setActive(0);
    setFeedback(null);
  };
  const accept = (c: Completion) => {
    const r = text.trim() === '' ? { text: c.insert, cursor: c.insert.length } : null;
    const next = r ?? acceptCompletion(text, cursor, c);
    edit(next.text, next.cursor);
  };
  const submit = () => {
    const f = host.test(text);
    setFeedback(f);
    if (f === null) edit('', 0);
  };
  const clear = () => {
    setFeedback(null);
  };
  return {
    text,
    cursor,
    list,
    active,
    setActive,
    feedback,
    setFocused,
    edit,
    accept,
    submit,
    clear,
  };
}

type Box = ReturnType<typeof useClaimBox>;

/** The forms (box empty) or the completions at the cursor; a click accepts one. */
function Suggestions({ b }: { b: Box }) {
  return (
    <ul
      className="claim-suggestions"
      role="listbox"
      aria-label={b.text.trim() === '' ? 'Forms it reads' : 'Suggestions'}
    >
      {b.list.map((x, i) => (
        <li
          key={`${x.kind}:${x.label}`}
          role="option"
          aria-selected={i === b.active}
          onMouseDown={(e) => {
            e.preventDefault();
            b.accept(x);
          }}
        >
          <span className="completion-label">{x.label}</span>{' '}
          <span className="muted">{x.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** What the box could not read, with its column and hint. */
function Feedback({ feedback }: { feedback: ClaimFeedback }) {
  return (
    <div className="claim-feedback" role="alert">
      {feedback.diagnostics.length === 0 ? (
        <p>{feedback.reason}</p>
      ) : (
        <DiagnosticList items={feedback.diagnostics} />
      )}
    </div>
  );
}

/**
 * A claim to add and test at once ("AP, BQ, CR concurrent", "AB = CD", "claim …"; ADR-0051):
 * while empty it lists the forms it reads, while typing it completes the word at the cursor
 * (Tab or a click), and when it cannot read the text it says what, where, in the box.
 */
export function ClaimBox(p: {
  readonly label: string;
  readonly className: string;
  readonly host: ClaimBoxHost;
}) {
  const b = useClaimBox(p.host);
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const chosen = b.list[b.active];
    if (e.key === 'Tab' && chosen !== undefined && b.text.trim() !== '') b.accept(chosen);
    else if (e.key === 'ArrowDown') b.setActive((a) => Math.min(a + 1, b.list.length - 1));
    else if (e.key === 'ArrowUp') b.setActive((a) => Math.max(a - 1, 0));
    else return;
    e.preventDefault();
  };
  return (
    <form
      className={`${p.className} claim-box`}
      onSubmit={(e) => {
        e.preventDefault();
        b.submit();
      }}
    >
      <input
        type="text"
        aria-label={p.label}
        placeholder="Test a claim: A, B, C collinear · ABCD cyclic · AB ⟂ CD · AB = CD"
        spellCheck={false}
        autoComplete="off"
        value={b.text}
        onChange={(e) => {
          b.edit(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onSelect={(e) => {
          const at = e.currentTarget.selectionStart ?? e.currentTarget.value.length;
          if (at !== b.cursor) b.edit(b.text, at);
        }}
        onKeyDown={onKey}
        onFocus={() => {
          b.setFocused(true);
        }}
        onBlur={() => {
          b.setFocused(false);
          b.clear();
        }}
      />
      <button type="submit" className="tb" title="Add the claim and test it (local test)">
        <Glyph>{'▸'}</Glyph>
        Test
      </button>
      {b.list.length > 0 && b.feedback === null && <Suggestions b={b} />}
      {b.feedback !== null && <Feedback feedback={b.feedback} />}
    </form>
  );
}
