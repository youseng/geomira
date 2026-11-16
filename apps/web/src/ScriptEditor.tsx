import { useEffect, useRef, type RefObject } from 'react';
import type { EditorState } from '@geomira/editor/state';
import type { TextApplier } from './text-apply';
import { highlightSource, signatureAt } from './script-source';
import {
  useScriptField,
  useScriptCompletion,
  useScriptComposition,
  type ScriptCompletion,
} from './script-input';

interface EditorProps {
  readonly state: EditorState;
  readonly applier: TextApplier;
  readonly field: RefObject<HTMLTextAreaElement | null>;
  readonly text: string;
  readonly onLeave: (target: EventTarget | null) => void;
  readonly onApply: (field: HTMLTextAreaElement) => void;
}
function SourceBackdrop({ text, scroll }: { text: string; scroll: { top: number; left: number } }) {
  return (
    <>
      <div className="script-gutter" aria-hidden="true">
        <pre style={{ transform: `translateY(${String(-scroll.top)}px)` }}>
          {text
            .split('\n')
            .map((_, i) => i + 1)
            .join('\n')}
        </pre>
      </div>
      <div className="script-overlay" aria-hidden="true">
        <pre
          className="script-highlight"
          style={{ transform: `translate(${String(-scroll.left)}px, ${String(-scroll.top)}px)` }}
        >
          {highlightSource(text).map((part, i) => (
            <span key={i} className={`syntax-${part.kind}`}>
              {part.text}
            </span>
          ))}
          {'\n'}
        </pre>
      </div>
    </>
  );
}
function Choices({ c, field }: { c: ScriptCompletion; field: EditorProps['field'] }) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [c.active, c.list.length]);
  if (!c.focused || !c.offered) return null;
  if (c.list.length === 0) return <p role="status">No matching completions.</p>;
  return (
    <ul
      id="script-completions"
      ref={list}
      className="script-completions"
      role="listbox"
      aria-label="Text completions"
    >
      {c.list.map((choice, i) => (
        <li
          key={`${choice.kind}:${choice.label}`}
          id={`script-choice-${String(i)}`}
          role="option"
          aria-selected={i === c.active}
          onPointerDown={(e) => {
            e.preventDefault();
            c.accept(choice, field.current);
          }}
        >
          <strong>{choice.label}</strong> <span>{choice.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** Native textarea is the only editable and announced source; its overlays are decorative. */
export function ScriptEditor(p: EditorProps) {
  const ime = useScriptComposition(p.applier, p.text);
  const text = ime.value ?? p.text;
  const c = useScriptCompletion(p.state, p.applier, text, p.field);
  const input = useScriptField(c, ime, p.onLeave, p.onApply);
  const composing = ime.value !== null;
  const signature = signatureAt(text, c.cursor, p.applier.env.registry);
  return (
    <>
      <div className="script-editor">
        <SourceBackdrop text={text} scroll={input.scroll} />
        <textarea
          ref={p.field}
          aria-label="Text"
          spellCheck={false}
          wrap="off"
          value={text}
          aria-describedby={signature === null ? 'script-help' : 'script-help script-signature'}
          aria-autocomplete="list"
          aria-controls={c.list.length > 0 ? 'script-completions' : undefined}
          aria-activedescendant={
            c.list[c.active] === undefined ? undefined : `script-choice-${String(c.active)}`
          }
          {...input.events}
        />
      </div>
      <p id="script-help" className="muted">
        Ctrl+Space: completions
      </p>
      {signature !== null && (
        <p id="script-signature" className="script-signature" role="status">
          {signature}
        </p>
      )}
      {!composing && <Choices c={c} field={p.field} />}
    </>
  );
}
