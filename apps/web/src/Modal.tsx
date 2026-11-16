import { useLayoutEffect, useRef, type ReactNode } from 'react';

// Host interaction state only: native dialogs enter the top layer in opening order,
// which can differ from DOM order. Pure editor packages have no modal state (ADR-0068).
const stack: HTMLDialogElement[] = [];

/** Editor shortcuts must not dispatch, even for a key targeted outside the active modal. */
export function modalOwnsInteraction(): boolean {
  return document.querySelector('dialog:modal') !== null;
}

function usable(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    !element.matches(':disabled') &&
    element.closest('[hidden], [inert]') === null &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === 'visible'
  );
}

/** Sequential controls, including contenteditable; only one tab stop per radio group. */
function controls(dialog: HTMLDialogElement): HTMLElement[] {
  const candidates = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button, input:not([type="hidden"]), textarea, select, a[href], summary, [tabindex], [contenteditable]',
    ),
  ).filter(
    (e) => usable(e) && (e.tabIndex >= 0 || (e.isContentEditable && !e.hasAttribute('tabindex'))),
  );
  return candidates.filter((e) => {
    if (!(e instanceof HTMLInputElement) || e.type !== 'radio' || e.name === '') return true;
    const group = candidates.filter(
      (r): r is HTMLInputElement =>
        r instanceof HTMLInputElement &&
        r.type === 'radio' &&
        r.name === e.name &&
        r.form === e.form,
    );
    return e === (group.find((r) => r.checked) ?? group[0]);
  });
}

function cycleFocus(event: KeyboardEvent, dialog: HTMLDialogElement): void {
  const elements = controls(dialog);
  const index = elements.findIndex((e) => e === document.activeElement);
  const next = event.shiftKey
    ? elements[index <= 0 ? elements.length - 1 : index - 1]
    : (elements[index + 1] ?? elements[0]);
  event.preventDefault();
  event.stopPropagation();
  (next ?? dialog).focus({ preventScroll: true });
}

function restoreFocus(before: Element | null): void {
  const top = stack.at(-1);
  if (
    before instanceof HTMLElement &&
    usable(before) &&
    (top === undefined || top.contains(before))
  ) {
    before.focus({ preventScroll: true });
    if (document.activeElement === before) return;
  }
  const fallback = top ?? document.querySelector<HTMLElement>('canvas.board');
  fallback?.focus({ preventScroll: true });
}

/** A named native modal with one shared focus, keyboard and restoration policy. */
export function Modal({
  title,
  onClose,
  className = '',
  children,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    const before = document.activeElement;
    dialog.showModal();
    stack.push(dialog);
    dialog.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (stack.at(-1) !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      } else if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        cycleFocus(event, dialog);
      }
    };
    const cancel = (event: Event) => {
      event.preventDefault();
      if (stack.at(-1) === dialog) close.current();
    };
    window.addEventListener('keydown', key, true);
    dialog.addEventListener('cancel', cancel);
    return () => {
      window.removeEventListener('keydown', key, true);
      dialog.removeEventListener('cancel', cancel);
      const wasTop = stack.at(-1) === dialog;
      stack.splice(stack.indexOf(dialog), 1);
      dialog.close();
      if (wasTop) restoreFocus(before);
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-label={title}
      aria-modal="true"
      tabIndex={-1}
    >
      {children}
    </dialog>
  );
}
