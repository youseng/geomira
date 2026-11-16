import { useEffect } from 'react';
import type { FileSession, FileState } from './file-session';

function useFileMenuDismiss(session: FileSession, open: boolean): void {
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        event.target.closest('[data-document-files]') === null
      )
        session.finish();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      session.finish();
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape, true);
    };
  }, [session, open]);
}
export function FileMenu({
  session,
  state,
  openFile,
}: {
  session: FileSession;
  state: FileState;
  openFile: () => void;
}) {
  useFileMenuDismiss(session, state.menu);
  if (!state.menu) return null;
  return (
    <div className="menu" role="group" aria-label="File menu">
      <button
        type="button"
        onClick={() => {
          session.start({ kind: 'new' });
        }}
      >
        New document
      </button>
      <button
        type="button"
        onClick={() => {
          session.patch({ menu: false });
          openFile();
        }}
      >
        Open .geo file
      </button>
      <button
        type="button"
        onClick={() => {
          session.save();
        }}
      >
        Save / Download .geo
      </button>
      <button
        type="button"
        onClick={() => {
          session.start({ kind: 'save-as' });
        }}
      >
        Save As / Duplicate
      </button>
    </div>
  );
}
