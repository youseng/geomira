import { hasEdits } from '@geomira/editor/text-draft';
import { downloadGeo, downloadText } from './backup';
import { documentFileName } from './document-file';
import { Modal } from './Modal';
import { draftIssue, downloadDraft } from './file-actions';
import type { FileSession, FileState } from './file-session';

function DraftChoices({ session }: { session: FileSession }) {
  const { store } = session;
  if (!hasEdits(store.textDraft.getSnapshot())) return null;
  return (
    <>
      <p>
        The text draft is separate from the current valid figure. Download it before replacing or
        discarding it.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            downloadDraft(store);
          } catch (e) {
            session.patch({ error: String(e) });
          }
        }}
      >
        Download draft text
      </button>
      {!store.textDraft.hasErrors() && (
        <button
          type="button"
          onClick={() => {
            store.textDraft.applyNow();
            session.patch({ error: null });
          }}
        >
          Apply draft
        </button>
      )}
    </>
  );
}
function SeparateBackups({ session }: { session: FileSession }) {
  const { store } = session;
  const download = (markdown: boolean) => {
    try {
      const figure = store.current().doc;
      if (markdown)
        downloadText(
          store.getSnapshot().writeUp,
          documentFileName(figure).replace(/\.geo$/u, '.md'),
        );
      else downloadGeo(figure);
    } catch (error) {
      session.patch({ error: String(error) });
    }
  };
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          download(false);
        }}
      >
        Download figure only
      </button>
      <button
        type="button"
        onClick={() => {
          download(true);
        }}
      >
        Download write-up Markdown
      </button>
    </div>
  );
}

function ConfirmActions({ session, state }: { session: FileSession; state: FileState }) {
  const choice = state.choice;
  if (choice === null) return null;
  return (
    <>
      <p>
        {choice.kind === 'save'
          ? 'Download the last valid figure; this does not save the visible draft.'
          : 'Continue preserves the current valid figure in local recovery before replacing it. Unapplied draft text is discarded only when you continue.'}
      </p>
      {state.failedRecovery && (
        <p role="alert">
          Local recovery failed. Keep this page open, download a backup, or explicitly discard the
          unsaved figure to continue.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          session.backup();
        }}
      >
        Download current valid figure
      </button>
      {(choice.kind !== 'open' || choice.doc !== undefined) && (
        <button
          type="button"
          onClick={() => {
            void session.confirm();
          }}
        >
          {choice.kind === 'save' ? 'Download last valid figure' : 'Continue'}
        </button>
      )}
      {state.failedRecovery && (
        <button
          type="button"
          onClick={() => {
            void session.confirm(true);
          }}
        >
          Discard unsaved figure and continue
        </button>
      )}
      <button type="button" onClick={session.finish}>
        Cancel
      </button>
    </>
  );
}
export function FileDialog({ session, state }: { session: FileSession; state: FileState }) {
  const choice = state.choice;
  if (choice === null) return null;
  const issue = draftIssue(session.store);
  return (
    <Modal
      title={choice.kind === 'save' ? 'Save figure' : 'Document files'}
      onClose={session.finish}
    >
      <h2>
        {choice.kind === 'new'
          ? 'New document'
          : choice.kind === 'open'
            ? 'Open document'
            : choice.kind === 'save-as'
              ? 'Save As / Duplicate'
              : 'Save figure'}
      </h2>
      {state.busy && (
        <p role="status">
          Saving before replacement… Please wait. This confirmed operation cannot be cancelled while
          saving.
        </p>
      )}
      <fieldset disabled={state.busy} className="file-controls">
        {state.error !== null && <p role="alert">{state.error}</p>}
        {state.error && session.store.getSnapshot().writeUp && (
          <SeparateBackups session={session} />
        )}
        {issue !== null && <p role="alert">{issue}</p>}
        <DraftChoices session={session} />
        {(choice.kind === 'new' || choice.kind === 'save-as') && (
          <label>
            Document name
            <input
              aria-label="Document name"
              value={state.name}
              onChange={(e) => {
                session.patch({ name: e.target.value });
              }}
            />
          </label>
        )}
        <ConfirmActions session={session} state={state} />
      </fieldset>
    </Modal>
  );
}
