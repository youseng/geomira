import { useEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from 'react';
import { print } from '@geomira/lang/print';
import { FileSession } from './file-session';
import { FileDialog } from './FileDialog';
import { FileMenu } from './FileMenu';
import type { EditorStore } from './store';

/** Portable file input/download baseline, also available in file:// and storage-denied sessions. */
export function DocumentFiles({ store }: { store: EditorStore }) {
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
  const current = store.current().doc;
  return (
    <div className="document-files" data-document-files>
      <button
        type="button"
        className="tb"
        aria-expanded={state.menu}
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={() => {
          session.toggle();
        }}
      >
        File
      </button>
      <span className="document-name" title={current.meta.title ?? 'Untitled'}>
        {current.meta.title ?? 'Untitled'}
      </span>
      {state.downloaded !== null && (
        <span className="document-download" role="status">
          {state.downloaded === print(current) ? 'Download requested' : 'Changed since download'}
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
