/** A reload must preserve transient editor work as well as the last valid document. */
import type { EditorStore } from './store';

export interface UpdateRefusal {
  readonly kind: 'text' | 'command' | 'save' | 'conflict' | 'changed';
  readonly message: string;
}
function pendingText(store: EditorStore, command: () => string): UpdateRefusal | null {
  if (store.writeUpComposing)
    return { kind: 'changed', message: 'Finish composing the write-up before updating.' };
  if (store.textDraft.unappliedText() !== null)
    return {
      kind: 'text',
      message:
        'Unapplied text would be lost by reloading. Finish composition, then Apply or Revert text before updating; download the raw text first if you want to keep it.',
    };
  if (command() !== '')
    return {
      kind: 'command',
      message:
        'Your command draft has not been run. Finish it or download its exact text and clear the command before updating.',
    };
  return null;
}
function conflict(store: EditorStore): UpdateRefusal | null {
  return store.autosave.getStatus().phase === 'conflict'
    ? {
        kind: 'conflict',
        message:
          'Resolve the local recovery conflict before updating. Your current figure remains open and can be downloaded.',
      }
    : null;
}
/** Check again after saving: source, commands or the figure can change while I/O is pending. */
export async function prepareUpdate(
  store: EditorStore,
  command: () => string,
): Promise<UpdateRefusal | null> {
  const pending = pendingText(store, command) ?? conflict(store);
  if (pending !== null) return pending;
  const before = store.getSnapshot();
  if (store.current().drag !== null)
    return { kind: 'changed', message: 'Finish the current drag before updating.' };
  const saved = await store.retrySaving();
  const after = pendingText(store, command) ?? conflict(store);
  if (after !== null) return after;
  if (!store.canReplace(before) || store.current().drag !== null)
    return {
      kind: 'changed',
      message:
        'The figure changed while preparing the update. It remains open; wait for saving and try again.',
    };
  return saved
    ? null
    : {
        kind: 'save',
        message:
          'Local saving failed. Keep this page open, retry local saving or download the current figure before updating.',
      };
}
