import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Restore only the matching committed value, before paint or a following keystroke. */
export function useCompletionCaret(
  text: string,
  field: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
) {
  const pending = useRef<{ text: string; cursor: number } | null>(null);
  useLayoutEffect(() => {
    const expected = pending.current;
    pending.current = null;
    const element = field.current;
    // Newer typing supersedes a completion; never move its caret using an older offset.
    if (expected !== null && element !== null && element.value === expected.text)
      element.setSelectionRange(expected.cursor, expected.cursor);
  }, [text, field]);
  return (text: string, cursor: number) => {
    pending.current = { text, cursor };
  };
}
