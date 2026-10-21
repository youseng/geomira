/**
 * The page's state and actions (host code over packages/editor): the long-lived objects
 * (editor store, test worker host and runs), the scene of the current figure, and what the
 * header's buttons and the keyboard shortcuts do. Every change is an edit of the store.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentEdit } from '@geomira/editor/edit';
import type { KeyAction } from '@geomira/editor/keymap';
import { debugReport } from '@geomira/editor/report';
import { encodeShare } from '@geomira/editor/share';
import { VERSION } from '@geomira/kernel';
import { createRegistry } from '@geomira/kernel/registry';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import type { Scene } from '@geomira/scene/types';
import { zoomViewport, type Size } from '@geomira/scene/viewport';
import { measureFrames, type FrameTimes } from './bench';
import { EXAMPLES } from './examples';
import { figureOf, viewportFor } from './figure';
import type { HeaderProps } from './Header';
import { LIGHT_THEME } from './render';
import { EditorStore, useSnapshot, type Snapshot } from './store';
import { TestRuns } from './test-runs';
import { TestHost } from './worker/host';

const BENCH_FRAMES = 120;

/** The test worker starts this long after the page (ms). */
const WARM_MS = 300;

export type Dialog =
  { readonly kind: 'share' | 'report'; readonly text: string } | { readonly kind: 'export' } | null;

export function reportOf(store: EditorStore): string {
  const agent = typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent;
  return debugReport(store.current(), { appVersion: VERSION, userAgent: agent });
}

/** The page's long-lived objects and the current snapshot and scene. */
export function usePage() {
  const [internal, setInternal] = useState<string | null>(null);
  const onInternal = useCallback((m: string) => {
    setInternal(m);
  }, []);
  const store = useMemo(
    () => new EditorStore({ registry: createRegistry() }, onInternal),
    [onInternal],
  );
  const runs = useMemo(() => new TestRuns(new TestHost(), onInternal), [onInternal]);
  useEffect(() => {
    // Off the critical path: the worker is ready before the first Test click.
    const id = setTimeout(() => {
      runs.warm();
    }, WARM_MS);
    return () => {
      clearTimeout(id);
    };
  }, [runs]);
  const snap = useSnapshot(store);
  const scene = useMemo(
    () => buildScene(snap.state.doc, snap.state.values.values),
    [snap.state.doc, snap.state.values],
  );
  const sceneRef = useRef<Scene>(scene);
  sceneRef.current = scene;
  const sceneOf = useCallback(() => sceneRef.current, []);
  return { internal, setInternal, onInternal, store, runs, snap, scene, sceneOf };
}

/** Fits the current figure into the canvas. */
export function useFit(store: EditorStore, size: Size | null, sceneOf: () => Scene) {
  return useCallback(() => {
    if (size === null) return;
    const viewport = viewportFor({ doc: store.current().doc, scene: sceneOf() }, size);
    store.apply({ kind: 'viewport', viewport });
  }, [size, store, sceneOf]);
}

/** What a keyboard shortcut does (the keymap is packages/editor's data). */
export function useKeyActions(
  store: EditorStore,
  fit: () => void,
  command: () => void,
  help: () => void,
) {
  return useCallback(
    (a: KeyAction) => {
      const s = store.current();
      switch (a.kind) {
        case 'tool':
          store.apply({ kind: 'tool', tool: a.tool });
          return;
        case 'undo':
        case 'redo':
          store.apply({ kind: a.kind });
          return;
        case 'cancel':
          if (s.drag !== null) store.apply({ kind: 'dragCancel' });
          else store.input({ kind: 'cancel' });
          return;
        case 'finish':
          store.input({ kind: 'finish' });
          return;
        case 'delete': {
          const edits: DocumentEdit[] = s.selection.map((id) => ({ kind: 'remove', id }));
          if (edits.length > 0) store.apply({ kind: 'batch', label: 'remove', edits });
          return;
        }
        case 'command':
          command();
          return;
        case 'help':
          help();
          return;
        case 'fit':
          fit();
          return;
      }
    },
    [store, fit, command, help],
  );
}

export interface HeaderEnv {
  readonly store: EditorStore;
  readonly runs: TestRuns;
  readonly snap: Snapshot;
  readonly size: Size | null;
  readonly ready: boolean;
  readonly fit: () => void;
  readonly canvas: () => HTMLCanvasElement | null;
  readonly setDialog: (d: Dialog) => void;
}

/** The header's state and actions. */
export function useHeader(env: HeaderEnv) {
  const { store, runs, snap, size, ready } = env;
  const state = snap.state;
  const [exampleId, setExampleId] = useState('');
  const [times, setTimes] = useState<FrameTimes | null>(null);
  const printed = useMemo(() => print(state.doc), [state.doc]);
  const open = (text: string, origin: 'file' | 'autosave') => {
    setTimes(null);
    runs.clear();
    store.openText(text, origin);
  };
  const props: HeaderProps = {
    exampleId,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    canRestore: ready && store.autosave.canRestore(printed),
    onExample: (id) => {
      const e = EXAMPLES.find((x) => x.id === id);
      if (e === undefined) return;
      setExampleId(id);
      open(e.text, 'file');
    },
    onFit: env.fit,
    onZoom: (factor) => {
      if (size === null) return;
      const centre = { x: size.width / 2, y: size.height / 2 };
      const viewport = zoomViewport({ viewport: state.viewport, size }, centre, factor);
      store.apply({ kind: 'viewport', viewport });
    },
    onUndo: () => store.apply({ kind: 'undo' }),
    onRedo: () => store.apply({ kind: 'redo' }),
    onShare: () => {
      const url = `${location.origin}${location.pathname}${encodeShare(state.doc)}`;
      env.setDialog({ kind: 'share', text: url });
    },
    onRestore: () => {
      const text = store.autosave.restore(printed);
      if (text === undefined) return;
      open(text, 'autosave');
      store.autosave.restored();
    },
    onReport: () => {
      env.setDialog({ kind: 'report', text: reportOf(store) });
    },
    onExport: () => {
      env.setDialog({ kind: 'export' });
    },
    onMeasure: () => {
      const ctx = env.canvas()?.getContext('2d');
      if (ctx === null || ctx === undefined || size === null) return;
      const registry = store.env.registry;
      const bench = { ctx, registry, size, viewport: state.viewport, dpr: devicePixelRatio };
      const figure = figureOf(state.doc, registry);
      setTimes(measureFrames(figure, { ...bench, theme: LIGHT_THEME }, BENCH_FRAMES));
      // Redraw the figure the measurement drew over.
      store.apply({ kind: 'viewport', viewport: { ...state.viewport } });
    },
  };
  return { props, times };
}
