import { hasEdits } from '@geomira/editor/text-draft';
import { downloadDraft } from './file-actions';
import { useMemo, useState, type ReactNode } from 'react';
import { encodeShareChecked } from '@geomira/editor/share';
import { shareUrl } from './share-url';
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
  const [include, setInclude] = useState(false);
  const source = store.getSnapshot().writeUp;
  const geometry = store.current().doc;
  const offer = useMemo(
    () =>
      include && source && problem === undefined
        ? encodeShareChecked({ ...geometry, writeUp: source })
        : undefined,
    [include, source, geometry, problem],
  );
  const choice =
    source && problem === undefined ? (
      <label>
        <input
          type="checkbox"
          checked={include}
          onChange={(event) => {
            setInclude(event.target.checked);
          }}
        />{' '}
        Include write-up
      </label>
    ) : null;
  const issue = offer && !offer.ok ? offer.reason : problem;
  if (issue === undefined)
    return (
      <TextDialog
        title="Share link"
        text={offer && offer.ok ? shareUrl(location.href, offer.fragment) : text}
        copyLabel="Copy link"
        multiline={false}
        description="The recipient opens the hosted app. Figure data stays in the URL fragment; it is not uploaded."
        onClose={onClose}
      >
        {choice}
      </TextDialog>
    );
  return <ShareFailure choice={choice} issue={issue} store={store} onClose={onClose} />;
}

function ShareFailure({
  choice,
  issue,
  store,
  onClose,
}: {
  choice: ReactNode;
  issue: string;
  store: EditorStore;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title="Share link" onClose={onClose}>
      <h2>Share link</h2>
      {choice}
      <p>{issue}</p>
      <p>
        A .geo file preserves the current valid figure. Unapplied text is separate. Links and
        downloads do not upload data.
      </p>
      <ShareDraft store={store} onError={setError} />
      <button
        type="button"
        onClick={() => {
          try {
            downloadGeo(store.document());
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
