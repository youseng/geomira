import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EditorStore } from './store';
import type { WriteUpLive } from './writeup-live';

type Mode = 'Live' | 'Source';

function useWriteUpModule(store: EditorStore, active: boolean, setMode: (mode: Mode) => void) {
  const host = useRef<HTMLDivElement>(null),
    fallback = useRef<HTMLTextAreaElement>(null);
  const editor = useRef<WriteUpLive | null>(null);
  const [opened, setOpened] = useState(active);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formatError, setFormatError] = useState('');
  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);
  useEffect(() => {
    if (!opened) return;
    const events = new AbortController();
    void import('./writeup-live')
      .then(({ WriteUpLive }) => {
        function mount() {
          if (events.signal.aborted || !host.current) return;
          editor.current = new WriteUpLive(host.current, store, setFormatError);
          setLoadError('');
          setReady(true);
        }
        // Keep an in-progress fallback edit and its IME focus until the writer leaves it.
        if (fallback.current && document.activeElement === fallback.current)
          fallback.current.addEventListener('blur', mount, { once: true, signal: events.signal });
        else mount();
      })
      .catch(() => {
        if (events.signal.aborted) return;
        setLoadError('Live formatting could not load. You can keep writing in Source.');
        setMode('Source');
      });
    return () => {
      events.abort();
      editor.current?.destroy();
      editor.current = null;
    };
  }, [opened, attempt, store, setMode]);
  function retry() {
    setLoadError('');
    setAttempt((i) => i + 1);
  }
  return { host, fallback, editor, ready, loadError, formatError, retry };
}

export function useWriteUpEditor(store: EditorStore, source: string, active: boolean) {
  const [mode, setMode] = useState<Mode>('Live');
  const focusRequested = useRef(false);
  const { host, fallback, editor, ready, loadError, formatError, retry } = useWriteUpModule(
    store,
    active,
    setMode,
  );
  useLayoutEffect(() => {
    editor.current?.update(active, mode === 'Live');
    if (active && focusRequested.current) {
      if (editor.current) editor.current.focus();
      else fallback.current?.focus();
      focusRequested.current = false;
    }
  }, [mode, ready, source, active, editor, fallback]);
  function choose(next: Mode) {
    if (store.writeUpComposing) return;
    if (next === 'Live' && loadError) retry();
    if (next === mode && editor.current) {
      editor.current.focus();
      return;
    }
    focusRequested.current = true;
    setMode(next);
  }
  return {
    mode,
    ready,
    choose,
    host,
    fallback,
    message: loadError || (mode === 'Live' ? formatError : ''),
  };
}
