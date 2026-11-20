import { printPortable } from '@geomira/lang/portable';
import { hasEdits } from '@geomira/editor/text-draft';
import { useEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from 'react';
import { FileSession } from './file-session';
import { FileDialog } from './FileDialog';
import { HeaderIcon } from './HeaderIcon';
import { FileMenu } from './FileMenu';
import type { EditorStore } from './store';

/** Portable file input/download baseline, also available in file:// and storage-denied sessions. */
export function DocumentFiles({ store }: { store: EditorStore }) {
  const unapplied = useUnappliedDraft(store);
  const session = useMemo(() => new FileSession(store), [store]);
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const field = input.current;
    field?.addEventListener('cancel', session.finish);
    return () => {
      field?.removeEventListener('cancel', session.finish);
      session.dispose();
    };
  }, [session]);
  const current = store.document();
  const title = current.meta.title ?? 'Untitled';
  return (
    <div className="document-files" data-document-files>
      <DocumentTrigger session={session} open={state.menu} title={title} />
      <span
        className="document-draft"
        data-active={unapplied}
        role={unapplied ? 'status' : undefined}
        aria-hidden={!unapplied}
      >
        Unapplied text draft
      </span>
      {state.downloaded !== null && (
        <span className="document-download" role="status">
          {unapplied
            ? 'Draft not included in download'
            : state.downloaded === printPortable(current)
              ? 'Download requested'
              : 'Changed since download'}
        </span>
      )}
      <FileMenu
        session={session}
        state={state}
        openFile={() => {
          input.current?.click();
        }}
      />
      <FilePicker input={input} session={session} />
      <FileDialog session={session} state={state} />
    </div>
  );
}

function DocumentTrigger({
  session,
  open,
  title,
}: {
  session: FileSession;
  open: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      className="tb document-trigger"
      title={`File menu · ${title}`}
      aria-label={`File: ${title}`}
      aria-expanded={open}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={() => {
        session.toggle();
      }}
    >
      <span className="document-name">{title}</span>
      <HeaderIcon name="down" />
    </button>
  );
}

function FilePicker({
  input,
  session,
}: {
  input: RefObject<HTMLInputElement | null>;
  session: FileSession;
}) {
  return (
    <input
      ref={input}
      type="file"
      accept=".geo,text/plain"
      aria-label="Open .geo file"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file === undefined) session.finish();
        else void session.read(file);
      }}
    />
  );
}

function useUnappliedDraft(store: EditorStore): boolean {
  return hasEdits(
    useSyncExternalStore(
      store.textDraft.subscribe,
      store.textDraft.getSnapshot,
      store.textDraft.getSnapshot,
    ),
  );
}
