import { flushWhenHidden } from './save-lifecycle';
import type { EditorStore } from './store';

/** Notifications improve freshness; transactions provide correctness even without them. */
export function watchRecovery(store: EditorStore, win: Window, doc: Document): () => void {
  const { autosave } = store;
  const stopFlush = flushWhenHidden(autosave, win, doc);
  const refresh = () => {
    void autosave.refresh();
  };
  const shown = () => {
    if (doc.visibilityState === 'visible') refresh();
  };
  const channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('geomira.recovery.v2');
  // A pagehide flush may outlive the document. Let the writer stay until IndexedDB commits.
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (store.getSnapshot().writeUpRevision === 0) return;
    event.preventDefault();
    void autosave.flush();
  };
  const guardPending = (dirty: boolean) => {
    if (dirty) win.addEventListener('beforeunload', beforeUnload);
    else win.removeEventListener('beforeunload', beforeUnload);
  };
  const initial = autosave.getStatus();
  guardPending(initial.dirty);
  let acknowledged = initial.revisionId;
  const stop = autosave.subscribe(() => {
    const { dirty, revisionId: next } = autosave.getStatus();
    guardPending(dirty);
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
    win.removeEventListener('beforeunload', beforeUnload);
    stopFlush();
    stop();
    channel?.close();
    win.removeEventListener('focus', refresh);
    win.removeEventListener('pageshow', refresh);
    doc.removeEventListener('visibilitychange', shown);
  };
}
