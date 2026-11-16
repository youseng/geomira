import { hasEdits } from '@geomira/editor/text-draft';
import { downloadDraft } from './file-actions';
import { useState } from 'react';
import { TextDialog } from './Dialogs';
import { Modal } from './Modal';
import { downloadGeo } from './backup';
import type { EditorStore } from './store';

export function ShareDialog({
  text,
  problem,
  store,
  onClose,
}: {
  readonly text: string;
  readonly problem: string | undefined;
  readonly store: EditorStore;
  readonly onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  if (problem === undefined)
    return (
      <TextDialog
        title="Share link"
        text={text}
        copyLabel="Copy link"
        multiline={false}
        description="The recipient opens the hosted app. Figure data stays in the URL fragment; it is not uploaded."
        onClose={onClose}
      />
    );
  return (
    <Modal title="Share link" onClose={onClose}>
      <h2>Share link</h2>
      <p>{problem}</p>
      <p>
        A .geo file preserves the current valid figure. Unapplied text is separate. Links and
        downloads do not upload data.
      </p>
      <ShareDraft store={store} onError={setError} />
      <button
        type="button"
        onClick={() => {
          try {
            downloadGeo(store.current().doc);
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        Download .geo file
      </button>
      {error !== null && <p role="alert">{error}</p>}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}

function ShareDraft({ store, onError }: { store: EditorStore; onError: (error: string) => void }) {
  if (!hasEdits(store.textDraft.getSnapshot())) return null;
  return (
    <button
      type="button"
      onClick={() => {
        try {
          downloadDraft(store);
        } catch (e) {
          onError(String(e));
        }
      }}
    >
      Download draft text
    </button>
  );
}
