import { useState, useSyncExternalStore } from 'react';
import { downloadGeo, downloadText } from './backup';
import type { RecoveryEntry, SaveStatus } from './persist';
import type { EditorStore } from './store';

type PanelProps = { store: EditorStore; onRestore: () => void };
function statusText(phase: SaveStatus['phase']): string {
  switch (phase) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved locally';
    case 'not-saved':
      return 'Not saved';
    case 'conflict':
      return 'Conflict';
    case 'browsing':
      return 'Browsing';
  }
}
function VersionHeading({ entry }: { entry: RecoveryEntry }) {
  return (
    <p>
      {entry.pending ? 'Not saved' : entry.conflict ? 'Conflict' : entry.source} ·{' '}
      {new Date(entry.savedAt).toLocaleString()}
      <br />
      Document {entry.documentId} · session {entry.sessionId} · revision {entry.id}
    </p>
  );
}
function Version({ entry, store, onRestore }: PanelProps & { entry: RecoveryEntry }) {
  const [error, setError] = useState<string | null>(null);
  const restore = (resolve: boolean) => {
    void store.restoreRevision(entry.id, resolve).then((ok) => {
      if (ok) onRestore();
    });
  };
  return (
    <li>
      <VersionHeading entry={entry} />
      <details>
        <summary>Inspect figure text</summary>
        <pre>{entry.text}</pre>
      </details>
      <button
        type="button"
        onClick={() => {
          restore(false);
        }}
      >
        Restore this version
      </button>
      {entry.conflict && (
        <button
          type="button"
          onClick={() => {
            restore(true);
          }}
        >
          Use this version and resolve this document’s conflicts
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          try {
            downloadText(entry.text, 'geomira-recovery.geo');
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        Download this version
      </button>
      {error !== null && <p role="alert">Backup could not download: {error}</p>}
    </li>
  );
}
function LegacyVersions({ store }: { store: EditorStore }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {store.autosave.legacyEntries().map((entry) => (
        <details key={entry.key}>
          <summary>
            Original legacy {entry.key} {entry.valid ? '' : '(invalid text)'}
          </summary>
          <pre>{entry.text}</pre>
          <button
            type="button"
            onClick={() => {
              try {
                downloadText(entry.text, entry.valid ? 'geomira-legacy.geo' : 'geomira-legacy.txt');
              } catch (e) {
                setError(`Backup could not download: ${String(e)}`);
              }
            }}
          >
            Download original legacy text
          </button>
        </details>
      ))}
      {error !== null && <p role="alert">{error}</p>}
    </>
  );
}
function BackupActions({ store, status }: { store: EditorStore; status: SaveStatus }) {
  const [backup, setBackup] = useState<string | null>(null);
  return (
    <>
      {status.message !== null && <p>{status.message}</p>}
      {status.phase === 'not-saved' && (
        <p>Keep this page open. Retry local saving or download a .geo backup.</p>
      )}
      {status.phase === 'conflict' && (
        <p>
          Both versions are kept in this browser. Inspect them before choosing how to resolve the
          conflict.
        </p>
      )}
      {backup !== null && <p role="status">{backup}</p>}
      <button
        type="button"
        onClick={() => {
          try {
            downloadGeo(store.current().doc);
            setBackup('Backup download requested. Local save status is unchanged.');
          } catch (e) {
            setBackup(`Backup could not download: ${String(e)}`);
          }
        }}
      >
        Download .geo backup
      </button>
      {status.phase === 'not-saved' && (
        <button
          type="button"
          onClick={() => {
            void store.retrySaving();
          }}
        >
          Retry local save
        </button>
      )}
    </>
  );
}
function RecoveryPanel({
  store,
  onRestore,
  status,
  open,
}: PanelProps & { status: SaveStatus; open: boolean }) {
  return (
    <section id="recovery-versions" role="region" aria-label="Recovery versions">
      <BackupActions store={store} status={status} />
      {open && (
        <>
          <p>
            The latest version of each document and unresolved conflicts are protected. Older
            ordinary history is bounded. Restoring keeps the figure it replaces.
          </p>
          <ol>
            {store.autosave.entries().map((entry) => (
              <Version key={entry.id} entry={entry} store={store} onRestore={onRestore} />
            ))}
          </ol>
          <LegacyVersions store={store} />
        </>
      )}
    </section>
  );
}
/** Separate from drawing notices. Native buttons and a labelled live region remain accessible. */
export function PersistencePanel(props: PanelProps) {
  const { autosave } = props.store;
  useSyncExternalStore(autosave.subscribe, autosave.getVersion, autosave.getVersion);
  const [open, setOpen] = useState(false);
  const status = autosave.getStatus();
  const show =
    open || status.phase === 'not-saved' || status.phase === 'conflict' || status.message !== null;
  return (
    <div className="persistence">
      <div role="status" aria-label="Local save status" aria-live="polite" aria-atomic="true">
        <strong>{statusText(status.phase)}</strong>
        <span className="sr-only">
          {status.message}{' '}
          {status.phase === 'saved' ? 'In this browser, not a file or cloud backup.' : ''}
        </span>
      </div>
      <button
        type="button"
        aria-label="Recovery versions"
        aria-expanded={open}
        aria-controls="recovery-versions"
        onClick={() => {
          setOpen(!open);
          void autosave.refresh();
        }}
      >
        Recovery
      </button>
      {show && <RecoveryPanel {...props} status={status} open={open} />}
    </div>
  );
}
