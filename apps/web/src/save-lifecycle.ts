/** Runs the pending save when the page hides (pagehide, or hidden); returns the unsubscribe. */
export function flushWhenHidden(
  autosave: { flush(): unknown },
  win: EventTarget,
  doc: EventTarget & { readonly visibilityState: string },
): () => void {
  const flush = () => {
    void autosave.flush();
  };
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') void autosave.flush();
  };
  win.addEventListener('pagehide', flush);
  doc.addEventListener('visibilitychange', onVisibility);
  return () => {
    win.removeEventListener('pagehide', flush);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
