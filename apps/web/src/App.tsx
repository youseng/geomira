import {
  Component,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { Scene } from '@geomira/scene/types';
import type { Size } from '@geomira/scene/viewport';
import { Board } from './Board';
import { CommandBar } from './CommandBar';
import { ErrorBanner, TextDialog } from './Dialogs';
import { ExportDialog } from './ExportDialog';
import { Header } from './Header';
import { useAutosave, useFitOnOpen, useInternalErrors, useShortcuts, useStartup } from './hooks';
import { reportOf, useFit, useHeader, useKeyActions, usePage, type Dialog } from './page';
import { SidePanel, type Tab } from './SidePanel';
import { useSettled } from './settled';
import { ClaimChips, DevBox, NoticeLine, Stage, ZoomControls } from './Stage';
import type { EditorStore } from './store';
import { Palette, StatusLine, ToolHint } from './ToolBar';

/** Catches render errors: the page shows them as internal errors with the debug report. */
class Boundary extends Component<
  { readonly children: ReactNode; readonly onError: (m: string) => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: Error): void {
    this.props.onError(error.message);
  }
  override render(): ReactNode {
    return this.state.failed ? (
      <p className="muted">This panel failed to draw (see the error above).</p>
    ) : (
      this.props.children
    );
  }
}

function DialogView(p: {
  dialog: Dialog;
  onClose: () => void;
  store: EditorStore;
  size: Size | null;
  onError: (m: string) => void;
}) {
  const { dialog, onClose } = p;
  if (dialog === null) return null;
  if (dialog.kind === 'export')
    return (
      <ExportDialog
        state={p.store.current()}
        registry={p.store.env.registry}
        size={p.size}
        initialFormat={dialog.format}
        onClose={onClose}
        onError={p.onError}
      />
    );
  const share = dialog.kind === 'share';
  return (
    <TextDialog
      title={share ? 'Share link' : 'Debug report'}
      text={dialog.text}
      copyLabel={share ? 'Copy link' : 'Copy debug report'}
      multiline={!share}
      onClose={onClose}
    />
  );
}

/** The bars do not change during a drag: they render the settled state (note F of Run 9a). */
const Tools = memo(Palette);
const Hint = memo(ToolHint);
const Status = memo(StatusLine);
const Commands = memo(CommandBar);

/** Keyboard shortcuts; "/" focuses the command bar, "?" shows the help. */
function usePageShortcuts(
  store: EditorStore,
  fit: () => void,
  commandRef: RefObject<HTMLInputElement | null>,
  toggleHelp: () => void,
) {
  const focusCommand = useCallback(() => commandRef.current?.focus(), [commandRef]);
  useShortcuts(useKeyActions(store, fit, focusCommand, toggleHelp));
}

/** The panel tabs and, on a phone, whether the drawer is open. */
function usePanels() {
  const [tab, setTab] = useState<Tab>('Text');
  const [open, setOpen] = useState(false);
  const showTab = useCallback((t: Tab) => {
    setTab(t);
    setOpen(true);
  }, []);
  const toggleHelp = useCallback(() => {
    setTab((t) => (t === 'Help' ? 'Text' : 'Help'));
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  return { tab, open, showTab, toggleHelp, close };
}

/** Fits the view after an edit once its figure is drawn (Randomize moves the figure). */
function useFitAfterEdit(scene: Scene, fit: () => void) {
  const pending = useRef(false);
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    fit();
  }, [scene, fit]);
  return useCallback(() => {
    pending.current = true;
  }, []);
}

/** A callback with a stable identity that always calls the latest `f` (memoised panels keep). */
function useStable<A extends unknown[], R>(f: (...a: A) => R): (...a: A) => R {
  const ref = useRef(f);
  ref.current = f;
  return useCallback((...a: A) => ref.current(...a), []);
}

/** The page's state, effects and actions. */
function useApp() {
  const page = usePage();
  const { store, snap, sceneOf, onInternal } = page;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const commandRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [ready, setReady] = useState(false);
  const panels = usePanels();
  const [dialog, setDialog] = useState<Dialog>(null);
  const onReady = useCallback(() => {
    setReady(true);
  }, []);
  useStartup(store, page.runs, onReady);
  useAutosave(store, snap, ready);
  useFitOnOpen(store, snap.openCount, size, sceneOf);
  useInternalErrors(onInternal);
  const fit = useFit(store, size, sceneOf);
  const fitAfterEdit = useFitAfterEdit(page.scene, fit);
  usePageShortcuts(store, fit, commandRef, panels.toggleHelp);
  const canvas = useCallback(() => canvasRef.current, []);
  const header = useHeader({
    ...{ store, runs: page.runs, snap, size, ready, fit, canvas, setDialog },
    showTab: panels.showTab,
    fitAfterEdit,
  });
  const onTestClaim = useStable(header.props.onTestClaim);
  const openClaims = useStable(() => {
    panels.showTab('Claims');
  });
  return {
    ...{ page, canvasRef, commandRef, setSize, panels, dialog, setDialog, header, size },
    onTestClaim,
    openClaims,
  };
}

/** The canvas's top-left column: the active tool's controls, internal errors, notices. */
function StageTop({ app }: { app: ReturnType<typeof useApp> }) {
  const { page, header } = app;
  const { store, snap } = page;
  return (
    <div className="stage-top">
      <Hint store={store} state={header.settled} />
      {page.internal !== null && (
        <ErrorBanner
          message={page.internal}
          report={() => reportOf(store)}
          onClose={() => {
            page.setInternal(null);
          }}
        />
      )}
      <NoticeLine
        notice={snap.notice}
        onClose={() => {
          store.setNotice(null);
        }}
      />
    </div>
  );
}

/**
 * Geomira (SPEC §15) in Geomdraw's layout (Run 9b): the top bar, the tool palette, the canvas
 * with its hint, status line, live claim chips and zoom buttons, the command line and the
 * panels; over packages/editor (every change is an edit), packages/scene (drawing,
 * hit-testing) and packages/claims (badges here, tests in a Web Worker).
 */
export function App() {
  const app = useApp();
  const { page, canvasRef, commandRef, setSize, panels, dialog, setDialog, header, size } = app;
  const { store, snap, scene } = page;
  const { state } = snap;
  const settled = useSettled(state);
  return (
    <div className="app">
      <Header {...header.props} />
      <Tools store={store} state={settled} />
      <Stage>
        <Board
          canvasRef={canvasRef}
          store={store}
          scene={scene}
          viewport={state.viewport}
          hover={state.hover}
          selection={state.selection}
          onSize={setSize}
        />
        <StageTop app={app} />
        <DevBox scene={scene} stats={header.stats} times={header.times} />
        <ClaimChips store={store} state={state} onOpen={app.openClaims} />
        <ZoomControls onZoom={header.props.onZoom} onFit={header.props.onFit} />
        <Status state={settled} />
      </Stage>
      <Commands store={store} inputRef={commandRef} />
      <Boundary onError={page.onInternal}>
        <SidePanel
          store={store}
          state={state}
          scene={scene}
          runs={page.runs}
          tab={panels.tab}
          onTab={panels.showTab}
          open={panels.open}
          onClose={panels.close}
          onTestClaim={app.onTestClaim}
        />
      </Boundary>
      <DialogView
        dialog={dialog}
        store={store}
        size={size}
        onError={page.onInternal}
        onClose={() => {
          setDialog(null);
        }}
      />
    </div>
  );
}
