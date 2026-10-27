/**
 * The page's state and actions (host code over packages/editor): the long-lived objects
 * (editor store, test worker host and runs), the scene of the current figure, and what the
 * header's buttons and the keyboard shortcuts do. Every change is an edit of the store.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { TriangleType } from '@geomira/claims/randomize';
import type { DocumentEdit } from '@geomira/editor/edit';
import { randomizeEdit } from '@geomira/editor/randomize';
import { cycleView } from '@geomira/editor/views';
import type { ExportFormat } from '@geomira/export/formats';
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
import { BUILD } from './build-info';
import { browserPwa, startPwa } from './pwa-browser';
import { EXAMPLES } from './examples';
import { figureOf, viewportFor } from './figure';
import { fitMargin } from './hooks';
import type { HeaderProps } from './Header';
import { LIGHT_THEME } from './render';
import { useSettled } from './settled';
import { shareUrl } from './share-url';
import { EditorStore, useSnapshot, type Snapshot } from './store';
import { TestRuns } from './test-runs';
import { DiscoveryRuns } from './discovery-runs';
import { TestHost } from './worker/host';

const BENCH_FRAMES = 120;

/** The test worker starts this long after the page (ms). */
const WARM_MS = 300;

export type Dialog =
  | { readonly kind: 'share' | 'report'; readonly text: string }
  | { readonly kind: 'export'; readonly format: ExportFormat }
  | null;

/** Developer readouts are on from the start with `?dev=1` in the address (Run 9b). */
export function devFlag(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).get('dev') === '1';
}

/** A fresh seed from the platform's cryptographic source (host code, ADR-0013 decision 9). */
function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

export function reportOf(store: EditorStore): string {
  const agent = typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent;
  // The build id tells which copy a report comes from (an offline copy may be old; Run 12).
  return debugReport(store.current(), {
    appVersion: `${VERSION} (build ${BUILD})`,
    userAgent: agent,
  });
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
  const host = useMemo(() => new TestHost(), []);
  const runs = useMemo(() => new TestRuns(host, onInternal), [host, onInternal]);
  const discovery = useMemo(
    () => new DiscoveryRuns(host, browserTimer, onInternal),
    [host, onInternal],
  );
  useEffect(
    () =>
      runs.onClear(() => {
        discovery.clear();
      }),
    [runs, discovery],
  );
  const pwa = useMemo(browserPwa, []);
  useEffect(() => startPwa(pwa, window, document), [pwa]);
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
  const about = useMemo(() => ({ pwa, host }), [pwa, host]);
  return {
    ...{ internal, setInternal, onInternal, store, runs, discovery },
    ...{ snap, scene, sceneOf, about },
  };
}

/** The browser's timer for the discovery jobs' time budgets. */
function browserTimer(f: () => void, ms: number): () => void {
  const id = setTimeout(f, ms);
  return () => {
    clearTimeout(id);
  };
}

/** Fits the current figure into the canvas. */
export function useFit(store: EditorStore, size: Size | null, sceneOf: () => Scene) {
  return useCallback(() => {
    if (size === null) return;
    const viewport = viewportFor({ doc: store.current().doc, scene: sceneOf() }, size, fitMargin());
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
        case 'view':
          store.run((st, env) => cycleView(st, a.step, env));
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
  readonly showTab: (tab: 'Claims' | 'Help') => void;
  /** Fits the view once the figure an edit made is drawn. */
  readonly fitAfterEdit: () => void;
}

/** The claim box: adds `claim …` as one edit and starts its local test (SPEC §10.5). */
function testClaim(env: HeaderEnv, text: string): boolean {
  const t = text.trim();
  if (t === '') return false;
  const r = env.store.command(/^claim\b/u.test(t) ? t : `claim ${t}`);
  if (r === undefined) return false;
  if (r.kind === 'error') {
    env.store.setNotice({ tone: 'refusal', text: r.reason, diagnostics: r.diagnostics });
    return false;
  }
  const doc = r.result.state.doc;
  const claim = doc.claims[doc.claims.length - 1];
  if (claim !== undefined) env.runs.start(doc, claim.id, 'local');
  env.showTab('Claims');
  return true;
}

/** Randomize: a new figure through packages/claims' sampler, one undoable edit. */
function randomize(env: HeaderEnv, type: TriangleType): void {
  const r = randomizeEdit(env.store.current(), env.store.env, type, freshSeed());
  if (r.kind === 'refused') {
    env.store.setNotice({ tone: 'refusal', text: `Randomize: ${r.reason}.` });
    return;
  }
  if (env.store.apply(r.edit).ok) env.fitAfterEdit();
}

/** Zooms about the canvas's centre. */
function zoomBy(env: HeaderEnv, factor: number): void {
  const { store, size } = env;
  if (size === null) return;
  const centre = { x: size.width / 2, y: size.height / 2 };
  const viewport = zoomViewport({ viewport: store.current().viewport, size }, centre, factor);
  store.apply({ kind: 'viewport', viewport });
}

/** Times drag and pan frames of the current figure on the canvas (Settings, ?dev=1). */
function measure(env: HeaderEnv): FrameTimes | null {
  const { store, size } = env;
  const state = store.current();
  const ctx = env.canvas()?.getContext('2d');
  if (ctx === null || ctx === undefined || size === null) return null;
  const registry = store.env.registry;
  const bench = { ctx, registry, size, viewport: state.viewport, dpr: devicePixelRatio };
  const times = measureFrames(
    figureOf(state.doc, registry),
    { ...bench, theme: LIGHT_THEME },
    BENCH_FRAMES,
  );
  // Redraw the figure the measurement drew over.
  store.apply({ kind: 'viewport', viewport: { ...state.viewport } });
  return times;
}

/** The header's actions that keep no state of their own. */
function actions(env: HeaderEnv) {
  const { store } = env;
  return {
    onTestClaim: (text: string) => testClaim(env, text),
    onHelp: () => {
      env.showTab('Help');
    },
    onFit: env.fit,
    onZoom: (factor: number) => {
      zoomBy(env, factor);
    },
    onUndo: () => store.apply({ kind: 'undo' }),
    onRedo: () => store.apply({ kind: 'redo' }),
    onShare: () => {
      const url = shareUrl(location.href, encodeShare(store.current().doc));
      env.setDialog({ kind: 'share', text: url });
    },
    onReport: () => {
      env.setDialog({ kind: 'report', text: reportOf(store) });
    },
    onExport: (format: ExportFormat) => {
      env.setDialog({ kind: 'export', format });
    },
  };
}

/**
 * Opens example `id`: its test runs start afresh, and it is not autosaved before its first
 * edit, so browsing examples never pushes the user's own figure out (ADR-0028). False when
 * there is no such example.
 */
export function openExample(store: EditorStore, runs: { clear(): void }, id: string): boolean {
  const e = EXAMPLES.find((x) => x.id === id);
  if (e === undefined) return false;
  runs.clear();
  store.openText(e.text, 'example');
  return true;
}

/** The header's state and actions. */
export function useHeader(env: HeaderEnv) {
  const { store, runs, snap, ready } = env;
  const state = snap.state;
  const [times, setTimes] = useState<FrameTimes | null>(null);
  const [triangleType, setTriangleType] = useState<TriangleType>('acute');
  const [stats, setStats] = useState(devFlag);
  // The text of the settled state: a drag frame does not print the document (note F).
  const settled = useSettled(state);
  const printed = useMemo(() => print(settled.doc), [settled.doc]);
  // Re-render when the autosave writes the slots: "Restore previous figure" depends on them.
  const { subscribe, getVersion } = store.autosave;
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const props: HeaderProps = {
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    canRestore: ready && store.autosave.canRestore(printed),
    triangleType,
    stats,
    onExample: (id) => {
      if (!openExample(store, runs, id)) return;
      setTimes(null);
      // Off the hidden list, so a letter is a shortcut, not another example (ADR-0028).
      env.canvas()?.focus({ preventScroll: true });
    },
    onTriangleType: setTriangleType,
    onRandomize: () => {
      randomize(env, triangleType);
    },
    onStats: setStats,
    ...actions(env),
    onRestore: () => {
      const text = store.autosave.restore(printed);
      if (text === undefined) return;
      setTimes(null);
      runs.clear();
      store.openText(text, 'autosave');
      store.autosave.restored();
    },
    onMeasure: () => {
      const t = measure(env);
      if (t !== null) setTimes(t);
    },
  };
  return { props, times, stats, settled };
}
