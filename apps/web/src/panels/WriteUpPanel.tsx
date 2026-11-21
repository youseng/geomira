import { memo, useState } from 'react';
import { downloadText } from '../backup';
import { documentFileName } from '../document-file';
import type { EditorStore } from '../store';
import { useWriteUpEditor } from '../use-writeup-editor';
import '../writeup.css';

interface WriteUpProps {
  readonly store: EditorStore;
  readonly source: string;
  readonly active: boolean;
}

function MarkdownDownload({ store }: { store: EditorStore }) {
  const [error, setError] = useState('');
  function download() {
    try {
      downloadText(
        store.getSnapshot().writeUp,
        documentFileName(store.current().doc).replace(/\.geo$/u, '.md'),
      );
      setError('');
    } catch {
      setError('Markdown could not be downloaded. You can still copy the source.');
    }
  }
  return (
    <div>
      <button type="button" onClick={download}>
        Download .md
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export const WriteUpPanel = memo(function WriteUpPanel({ store, source, active }: WriteUpProps) {
  const editor = useWriteUpEditor(store, source, active);
  return (
    <div aria-hidden={!active} className="writeup">
      <div className="writeup-heading">
        <div className="writeup-modes" role="group" aria-label="Writing mode">
          {(['Live', 'Source'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="tb"
              aria-pressed={editor.mode === option}
              onClick={() => {
                editor.choose(option);
              }}
            >
              {option}
            </button>
          ))}
        </div>
        <MarkdownDownload store={store} />
      </div>
      <div ref={editor.host} className="writeup-surface" />
      {!editor.ready && (
        <textarea
          ref={editor.fallback}
          aria-label="Write-up source"
          spellCheck={false}
          placeholder="Write your solution…"
          value={source}
          onChange={(e) => {
            store.setWriteUp(e.currentTarget.value);
          }}
          onCompositionStart={() => {
            store.writeUpComposing = true;
          }}
          onCompositionEnd={(e) => {
            store.writeUpComposing = false;
            store.setWriteUp(e.currentTarget.value);
          }}
        />
      )}
      {editor.message && (
        <p className="writeup-message" role="status">
          {editor.message}
        </p>
      )}
    </div>
  );
});
