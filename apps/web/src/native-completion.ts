/** Keep completion in the native field's undo transaction before React follows its value. */
export function insertCompletion(
  field: HTMLInputElement | HTMLTextAreaElement | null,
  start: number,
  end: number,
  inserted: string,
): void {
  if (field === null) return;
  field.focus({ preventScroll: true });
  field.setSelectionRange(start, end);
  // All supported engines retain undo for insertText. A programmatic value assignment
  // instead leaves older native undo records with offsets in the wrong source.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- insertText is the interoperable native undo API; value assignments do not preserve that transaction (ADR-0075).
  document.execCommand('insertText', false, inserted);
}
