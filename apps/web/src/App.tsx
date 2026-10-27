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
import type { Scene, Undrawable } from '@geomira/scene/types';
import type { Size } from '@geomira/scene/viewport';
import { AboutContext, UpdateBanner } from './about';
import { Board } from './Board';
import { useDiscoveryCanvas, ViewBanner } from './discovery-view';
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
import { StyleCard, usePreviewScene, useStyleCard } from './StyleCard';
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

/**
 * The ids of the curves the board cannot place at its zoom (ADR-0023), kept as the same array
 * while they do not change, so the memoised panels are not redrawn on every frame.
 */
function useUndrawable() {
  const [ids, setIds] = useState<readonly number[]>([]);
  const onUndrawable = useCallback((u: readonly Undrawable[]) => {
    setIds((prev) =>
      prev.length === u.length && u.every((x, i) => x.id === prev[i]) ? prev : u.map((x) => x.id),
    );
  }, []);
  return { undrawable: ids, onUndrawable };
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
  useFitOnOpen(store, snap.fits, size, sceneOf);
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
  const style = useStyleCard(store);
  const { state } = snap;
  // The canvas previews the style card's draft (ADR-0029): a render override, not an edit.
  const styled = usePreviewScene(page.scene, state.doc, state.values.values, style.card);
  // A viewed special position or branch fix replaces it, a draft too (ADR-0035, ADR-0036).
  const found = useDiscoveryCanvas(page.discovery, store, styled, state.doc);
  return {
    ...{ page, canvasRef, commandRef, setSize, panels, dialog, setDialog, header, size },
    ...useUndrawable(),
    ...{ onTestClaim, openClaims, style, shown: found.scene, highlight: found.highlight },
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
      <UpdateBanner
        onReload={() => {
          page.about.pwa.applyUpdate(() => {
            store.autosave.flush();
          });
        }}
      />
      <ViewBanner discovery={page.discovery} />
      <NoticeLine
        notice={snap.notice}
        onClose={() => {
          store.setNotice(null);
        }}
      />
    </div>
  );
}

/** The canvas: the figure, with the style card's draft previewed over it (ADR-0029). */
function Canvas({ app }: { app: ReturnType<typeof useApp> }) {
  const { state } = app.page.snap;
  return (
    <Board
      canvasRef={app.canvasRef}
      store={app.page.store}
      scene={app.shown}
      viewport={state.viewport}
      hover={state.hover}
      selection={state.selection}
      highlight={app.highlight}
      toolState={state.toolState}
      onSize={app.setSize}
      onUndrawable={app.onUndrawable}
      onStyle={app.style.open}
    />
  );
}

/** The style card of the object it was opened on, if any (ADR-0029). */
function StyleCardView({ app }: { app: ReturnType<typeof useApp> }) {
  const { style, page } = app;
  if (style.card === null) return null;
  return (
    <StyleCard
      key={style.card.id}
      store={page.store}
      state={page.snap.state}
      card={style.card}
      onDraft={style.setDraft}
      onClose={style.close}
    />
  );
}

/**
 * Geomira (SPEC §15) in Geomdraw's layout (Run 9b): the top bar, the tool palette, the canvas
 * with its hint, status line, live claim chips and zoom buttons, the command line, the panels
 * and an object's style card (ADR-0029); over packages/editor (every change is an edit),
 * packages/scene (drawing, hit-testing) and packages/claims (badges here, tests in a Web
 * Worker).
 */
export function App() {
  const app = useApp();
  const { page, commandRef, panels, dialog, setDialog, header, size } = app;
  const { store, snap, scene } = page;
  const { state } = snap;
  const settled = useSettled(state);
  return (
    <AboutContext.Provider value={page.about}>
      <div className="app">
        <Header {...header.props} />
        <Tools store={store} state={settled} />
        <Stage>
          <Canvas app={app} />
          <StageTop app={app} />
          <DevBox
            scene={scene}
            undrawable={app.undrawable.length}
            stats={header.stats}
            times={header.times}
          />
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
            undrawable={app.undrawable}
            runs={page.runs}
            discovery={page.discovery}
            tab={panels.tab}
            onTab={panels.showTab}
            open={panels.open}
            onClose={panels.close}
            onTestClaim={app.onTestClaim}
            onStyle={app.style.open}
          />
        </Boundary>
        <StyleCardView app={app} />
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
    </AboutContext.Provider>
  );
}
