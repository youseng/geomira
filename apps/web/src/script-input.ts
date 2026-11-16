/** Textarea assistance; parsing and document ownership stay in the shared TextApplier. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { acceptCompletion, completions, type Completion } from '@geomira/editor/command';
import type { EditorState } from '@geomira/editor/state';
import type { TextApplier } from './text-apply';
import { lineAt, sourceCompletionsAllowed } from './script-source';
import { parseText } from '@geomira/lang/parse-text';
import { insertCompletion } from './native-completion';
import { useCompletionCaret } from './completion-caret';

export function useScriptCompletion(
  state: EditorState,
  applier: TextApplier,
  text: string,
  field: RefObject<HTMLTextAreaElement | null>,
) {
  const restoreCaret = useCompletionCaret(text, field);
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState(0);
  const [offered, offer] = useState(false);
  const [focused, focus] = useState(false);
  const line = lineAt(text, cursor);
  const priorDoc = useMemo(
    () =>
      offered && focused
        ? parseText(text.slice(0, line.start), applier.env.registry).result.doc
        : state.doc,
    [text, line.start, applier, offered, focused, state.doc],
  );
  const draftState = { ...state, doc: priorDoc };
  const list =
    offered && focused && sourceCompletionsAllowed(text, cursor)
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
    const at = line.start + result.cursor;
    insertCompletion(
      field,
      at - completion.insert.length,
      line.start + line.cursor,
      completion.insert,
    );
    restoreCaret(next, at);
    applier.type(next);
    setCursor(at);
    offer(false);
  };
  return { cursor, active, setActive, offered, offer, focused, focus, list, select, accept };
}
export type ScriptCompletion = ReturnType<typeof useScriptCompletion>;

/** Hold automatic applies across the native IME transaction, including long compositions. */
export function useScriptComposition(applier: TextApplier, text: string) {
  const [value, setValue] = useState<string | null>(null);
  const release = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      applier.compose(null);
      release.current?.();
    },
    [applier],
  );
  const end = (text: string) => {
    setValue(null);
    applier.compose(null);
    applier.type(text);
    release.current?.();
    release.current = null;
  };
  return {
    value,
    start: () => {
      release.current?.();
      release.current = applier.hold();
      applier.compose(text);
      setValue(text);
    },
    end,
    change: (text: string) => {
      if (value === null) applier.type(text);
      else {
        applier.compose(text);
        setValue(text);
      }
    },
  };
}

export function scriptKey(
  e: KeyboardEvent<HTMLTextAreaElement>,
  c: ScriptCompletion,
  composing: boolean,
  apply: (field: HTMLTextAreaElement) => void,
): void {
  if (composing || e.nativeEvent.isComposing) return;
  const chosen = c.list[c.active];
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
  } else if (chosen !== undefined && (e.key === 'Tab' || e.key === 'Enter')) {
    e.preventDefault();
    c.accept(chosen, e.currentTarget);
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
    onScroll: (e: React.UIEvent<HTMLTextAreaElement>) => {
      setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft });
    },
    onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      c.select(e.currentTarget);
    },
    onFocus: () => {
      c.focus(true);
    },
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
          sourceCompletionsAllowed(e.currentTarget.value, e.currentTarget.selectionStart) &&
          /[\p{L}_\\]{2,}$/u.test(e.currentTarget.value.slice(0, e.currentTarget.selectionStart)),
      );
    },
    onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => {
      scriptKey(e, c, composing, apply);
    },
  };
  return { scroll, events };
}
