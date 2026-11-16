import { flushWhenHidden } from './save-lifecycle';
import type { Autosave } from './persist';

/** Notifications improve freshness; transactions provide correctness even without them. */
export function watchRecovery(autosave: Autosave, win: Window, doc: Document): () => void {
  const stopFlush = flushWhenHidden(autosave, win, doc);
  const refresh = () => {
    void autosave.refresh();
  };
  const shown = () => {
    if (doc.visibilityState === 'visible') refresh();
  };
  const channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('geomira.recovery.v2');
  let acknowledged = autosave.getStatus().revisionId;
  const stop = autosave.subscribe(() => {
    const next = autosave.getStatus().revisionId;
    if (next !== acknowledged) {
      acknowledged = next;
      channel?.postMessage('changed');
    }
  });
  if (channel !== null) channel.onmessage = refresh;
  win.addEventListener('focus', refresh);
  win.addEventListener('pageshow', refresh);
  doc.addEventListener('visibilitychange', shown);
  return () => {
    stopFlush();
    stop();
    channel?.close();
    win.removeEventListener('focus', refresh);
    win.removeEventListener('pageshow', refresh);
    doc.removeEventListener('visibilitychange', shown);
  };
}
