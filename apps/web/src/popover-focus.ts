import { useEffect, useRef } from 'react';
import { modalOwnsInteraction } from './Modal';

/** Non-modal style-card focus and dismissal (ADR-0028); native modals own Escape first. */
export function usePopoverFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || modalOwnsInteraction()) return;
      e.stopPropagation();
      e.preventDefault();
      close.current();
    };
    addEventListener('keydown', onKey, true);
    return () => {
      removeEventListener('keydown', onKey, true);
      if (before instanceof HTMLElement && before.isConnected)
        before.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
