/** Textarea assistance; parsing and document ownership stay in the shared TextApplier. */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { acceptCompletion, completions, type Completion } from '@geomira/editor/command';
import type { EditorState } from '@geomira/editor/state';
import type { TextApplier } from './text-apply';
import { lineAt } from './script-source';

export function useScriptCompletion(state: EditorState, applier: TextApplier, text: string) {
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState(0);
  const [offered, offer] = useState(false);
  const [focused, focus] = useState(false);
  const line = lineAt(text, cursor);
  const draftState = { ...state, doc: applier.parse().result.doc };
  const list =
    offered && focused
      ? completions(draftState, line.text, line.cursor, applier.env).filter((c) => c.kind !== 'gui')
      : [];
  const select = (field: HTMLTextAreaElement) => {
    setCursor(field.selectionStart);
    setActive(0);
  };
  const accept = (completion: Completion, field: HTMLTextAreaElement | null) => {
    const result = acceptCompletion(line.text, line.cursor, completion);
    const next =
      text.slice(0, line.start) + result.text + text.slice(line.start + line.text.length);
    applier.type(next);
    const at = line.start + result.cursor;
    setCursor(at);
    offer(false);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(at, at);
    });
  };
  return { cursor, active, setActive, offered, offer, focused, focus, list, select, accept };
}
export type ScriptCompletion = ReturnType<typeof useScriptCompletion>;

/** Hold automatic applies across the native IME transaction, including long compositions. */
export function useScriptComposition(applier: TextApplier, text: string) {
  const [value, setValue] = useState<string | null>(null);
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => release.current?.(), []);
  const end = (text: string) => {
    setValue(null);
    applier.type(text);
    release.current?.();
    release.current = null;
  };
  return {
    value,
    start: () => {
      release.current?.();
      release.current = applier.hold();
      setValue(text);
    },
    end,
    change: (text: string) => (value === null ? applier.type(text) : setValue(text)),
  };
}

export function scriptKey(
  e: KeyboardEvent<HTMLTextAreaElement>,
  c: ScriptCompletion,
  composing: boolean,
  apply: (field: HTMLTextAreaElement) => void,
): void {
  if (composing || e.nativeEvent.isComposing) return;
  if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    c.offer(true);
    c.setActive(0);
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    c.offer(false);
    apply(e.currentTarget);
  } else if (c.list.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    c.setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : c.list.length - 1)) % c.list.length);
  } else if (c.list[c.active] !== undefined && (e.key === 'Tab' || e.key === 'Enter')) {
    e.preventDefault();
    c.accept(c.list[c.active], e.currentTarget);
  } else if (e.key === 'Escape' && c.offered) {
    e.preventDefault();
    c.offer(false);
  }
}

export function useScriptField(
  c: ScriptCompletion,
  ime: ReturnType<typeof useScriptComposition>,
  leave: (target: EventTarget | null) => void,
  apply: (field: HTMLTextAreaElement) => void,
) {
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const composing = ime.value !== null;
  const events = {
    onScroll: (e: React.UIEvent<HTMLTextAreaElement>) =>
      setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft }),
    onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => c.select(e.currentTarget),
    onFocus: () => c.focus(true),
    onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => {
      if (composing) ime.end(e.currentTarget.value);
      c.focus(false);
      c.offer(false);
      leave(e.relatedTarget);
    },
    onCompositionStart: () => {
      ime.start();
      c.offer(false);
    },
    onCompositionEnd: (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      ime.end(e.currentTarget.value);
      c.select(e.currentTarget);
    },
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      ime.change(e.currentTarget.value);
      c.select(e.currentTarget);
      c.offer(
        !composing &&
          /[\p{L}_\\]{2,}$/u.test(e.currentTarget.value.slice(0, e.currentTarget.selectionStart)),
      );
    },
    onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => scriptKey(e, c, composing, apply),
  };
  return { scroll, events };
}
