import type { FocusEvent } from 'react';

/** Keep a useful part of the figure and source visible together after native phone focus.
 * WebKit may leave the source partly below the viewport despite scroll-padding (ADR-0074).
 * Only the host scrolls: the editor's focus, selection, raw draft and history are untouched.
 */
export function keepPanelFocusVisible(event: FocusEvent<HTMLElement>): void {
  const field = event.target;
  if (
    innerWidth > 760 ||
    !(field instanceof HTMLTextAreaElement) ||
    (field.getAttribute('aria-label') !== 'Text' && field.id !== 'writeup-source')
  )
    return;
  const app = event.currentTarget.closest('.app');
  const canvas = app?.querySelector('canvas');
  if (!(app instanceof HTMLElement) || canvas === null || canvas === undefined) return;
  const align = () => {
    if (!field.isConnected || document.activeElement !== field) return;
    const view = window.visualViewport;
    const top = view?.offsetTop ?? 0;
    const bottom = top + (view?.height ?? innerHeight);
    const source = field.getBoundingClientRect();
    const figure = canvas.getBoundingClientRect();
    const visible = Math.min(120, source.height, figure.height);
    // Native scroll offsets may round to CSS pixels; round inward so a fraction cannot
    // leave the promised last source/canvas pixel outside the viewport.
    const minimum = Math.ceil(
      Math.max(source.top + visible - bottom, figure.top + visible - bottom),
    );
    const maximum = Math.floor(
      Math.min(source.bottom - visible - top, figure.bottom - visible - top),
    );
    // When both fit, use the smallest scroll that exposes them. A keyboard viewport too
    // short for both keeps native focus behaviour rather than moving the user's caret.
    if (minimum <= maximum) app.scrollTop += Math.max(minimum, Math.min(0, maximum));
  };
  align();
  // The focus() algorithm may scroll after dispatching its synchronous focus events.
  queueMicrotask(align);
  // Native focus scrolling and viewport updates can finish after the focus event.
  requestAnimationFrame(() => {
    requestAnimationFrame(align);
  });
}
