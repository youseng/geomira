import { useLayoutEffect, useRef } from 'react';

/** Explicit Recovery activation owns visibility of its invoker and newly inserted panel.
 * Native focus may retain a source-panel scroll; insertion anchoring can then hide both.
 * This measures page flow after insertion and only scrolls while that invoker owns focus.
 */
function revealRecovery(button: HTMLButtonElement): void {
  if (!button.isConnected || document.activeElement !== button) return;
  const app = button.closest('.app');
  const header = button.closest('header');
  const workspace = app?.querySelector('[aria-label="Workspace"]');
  const panel = app?.querySelector('#recovery-versions');
  if (!(app instanceof HTMLElement) || !header || !workspace || !panel) return;
  const view = window.visualViewport;
  const top = view?.offsetTop ?? 0;
  const bottom = top + (view?.height ?? innerHeight);
  const boxes = [header, workspace, panel].map((element) => element.getBoundingClientRect());
  const first = Math.min(...boxes.map((box) => box.top));
  const last = Math.max(...boxes.map((box) => box.bottom));
  const minimum = Math.ceil(last - bottom);
  const maximum = Math.floor(first - top);
  // Preserve native behavior if this viewport cannot contain the controls and panel.
  if (minimum <= maximum) app.scrollTop += Math.max(minimum, Math.min(0, maximum));
}

/** No passive-error auto-open, persistent scroll listener, focus call or anchor override. */
export function useRecoveryFocus(open: boolean) {
  const button = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reveal = () => {
      if (!cancelled && button.current !== null) revealRecovery(button.current);
    };
    reveal();
    queueMicrotask(reveal);
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(reveal);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [open]);
  return button;
}
