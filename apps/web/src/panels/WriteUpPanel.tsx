import { memo, useEffect, useRef, useState } from 'react';
import { downloadText } from '../backup';
import { documentFileName } from '../document-file';
import type { EditorStore } from '../store';
import '../writeup.css';

/** The preview owns no editor state. A failed module load, bad expression or stale turn
 * cannot replace the textarea, its selection or a queued document revision. */
function Preview({
  source,
  select,
}: {
  source: string;
  select: (source: string, from: number, to: number) => void;
}) {
  const [preview, setPreview] = useState({ html: '', error: '', source: '' });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void import('../writeup-preview')
        .then(({ renderWriteUp }) => {
          if (active) setPreview({ html: renderWriteUp(source), error: '', source });
        })
        .catch((error: unknown) => {
          if (active)
            setPreview({
              html: '',
              source,
              error: error instanceof Error ? error.message : 'Preview unavailable.',
            });
        });
    }, 60);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [source]);
  return (
    <section
      className="writeup-preview"
      aria-label="Live preview"
      onClick={(event) => {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest<HTMLButtonElement>('button[data-from][data-to]');
        if (button) select(preview.source, Number(button.dataset.from), Number(button.dataset.to));
      }}
    >
      <h3>Live preview</h3>
      {preview.error ? (
        <p>{preview.error} Your source is still editable.</p>
      ) : (
        <div className="writeup-prose" dangerouslySetInnerHTML={{ __html: preview.html }} />
      )}
    </section>
  );
}

function selectSource(field: HTMLTextAreaElement | null, from: number, to: number) {
  if (!field) return;
  field.focus();
  field.setSelectionRange(from, to);
  const line = field.value.slice(0, from).split('\n').length - 1;
  field.scrollTop = Math.max(
    0,
    line * parseFloat(getComputedStyle(field).lineHeight) - field.clientHeight / 2,
  );
}

interface WriteUpProps {
  readonly store: EditorStore;
  readonly source: string;
  readonly active: boolean;
}

export const WriteUpPanel = memo(function WriteUpPanel({ store, source, active }: WriteUpProps) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState('');
  return (
    <div aria-hidden={!active} className="writeup">
      <div className="writeup-heading">
        <label htmlFor="writeup-source">Markdown + LaTeX</label>
        <button
          type="button"
          onClick={() => {
            try {
              downloadText(
                store.getSnapshot().writeUp,
                documentFileName(store.current().doc).replace(/\.geo$/u, '.md'),
              );
              setError('');
            } catch {
              setError('Markdown could not be downloaded. You can still copy the source.');
            }
          }}
        >
          Download .md
        </button>
      </div>
      <textarea
        ref={input}
        id="writeup-source"
        aria-label="Write-up source"
        spellCheck={false}
        placeholder={'Write your solution. Use $…$ for math or $$…$$ for a display equation.'}
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
      {error && <p role="alert">{error}</p>}
      {active && (
        <Preview
          source={source}
          select={(rendered, from, to) => {
            if (rendered === store.getSnapshot().writeUp) selectSource(input.current, from, to);
          }}
        />
      )}
    </div>
  );
});
