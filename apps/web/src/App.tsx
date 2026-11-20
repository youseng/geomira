import { CLAIM_TESTING } from './features';
import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Undrawable } from '@geomira/scene/types';
import type { Size } from '@geomira/scene/viewport';
import { AboutContext } from './about';
import { Board } from './Board';
import { useDiscoveryCanvas } from './discovery-view';
import { CommandBar } from './CommandBar';
import { TextDialog } from './Dialogs';
import { ExportDialog } from './ExportDialog';
import { Header, type HeaderProps } from './Header';
import { DocumentFiles } from './DocumentFiles';
import { ShareDialog } from './ShareDialog';
import { PersistencePanel } from './PersistencePanel';
import { useAutosave, useFitOnOpen, useInternalErrors, useStartup } from './hooks';
import { useFit, useHeader, usePageShortcuts, usePage, type Dialog } from './page';
import { SidePanel } from './SidePanel';
import { useSettled } from './settled';
import { SelectionBar } from './SelectionBar';
import { ClaimChips, DevBox, Stage } from './Stage';
import type { EditorStore } from './store';
import { StyleCard, usePreviewScene, useStyleCard } from './StyleCard';
import { Palette, StatusLine, ToolHint } from './ToolBar';
import { usePanels, useWorkspace } from './workspace';
import { ToolSearch } from './ToolSearch';
import { WorkspaceActions } from './WorkspaceActions';
import { GettingStarted } from './GettingStarted';
import { WorkspaceNotices } from './WorkspaceNotices';
import { chooseTool } from '@geomira/editor/selection-tool';
import type { ToolId } from '@geomira/editor/tool-state';

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
  if (dialog.kind === 'share')
    return (
      <ShareDialog text={dialog.text} problem={dialog.problem} store={p.store} onClose={onClose} />
    );
  return (
    <TextDialog
      title="Debug report"
      text={dialog.text}
      copyLabel="Copy debug report"
      multiline
      onClose={onClose}
    />
  );
}

/** The bars do not change during a drag: they render the settled state (note F of Run 9a). */
const Tools = memo(Palette);
const Hint = memo(ToolHint);
const Status = memo(StatusLine);
const Commands = memo(CommandBar);

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

function useClaimBox(props: HeaderProps['claimBox']) {
  const test = useStable(props.test);
  const complete = useStable(props.complete);
  return useMemo(() => ({ test, complete }), [test, complete]);
}

/** The page's state, effects and actions. */
function useApp() {
  const page = usePage();
  const { store, snap, sceneOf, onInternal } = page;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const commandRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [ready, setReady] = useState(false);
  const workspace = useWorkspace();
  const panels = usePanels(workspace);
  const searchRef = useRef<HTMLInputElement>(null);
  const choose = (id: ToolId) => {
    workspace.setPan(false);
    workspace.dismissGuide();
    workspace.remember(id);
    store.run((s, env) => chooseTool(s, id, env));
  };
  useEffect(() => {
    workspace.setPan(false);
  }, [workspace.setPan, snap.state.toolState]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const onReady = useCallback(() => {
    setReady(true);
  }, []);
  useStartup(store, page.runs, onReady);
  useAutosave(store, snap, ready);
  useFitOnOpen(store, snap.fits, size, sceneOf);
  useInternalErrors(onInternal);
  const fit = useFit(store, size, sceneOf);
  usePageShortcuts(store, fit, commandRef, panels.toggleHelp, choose);
  const canvas = useCallback(() => canvasRef.current, []);
  const header = useHeader({
    ...{ store, runs: page.runs, snap, size, ready, fit, canvas, setDialog },
    showTab: panels.showTab,
  });
  const claimBox = useClaimBox(header.props.claimBox);
  const openClaims = useStable(() => {
    panels.showTab('Claims');
  });
  const style = useStyleCard(store);
  const { state } = snap;
  // The canvas previews the style card's draft (ADR-0029): a render override, not an edit.
  const styled = usePreviewScene(
    page.scene,
    state.doc,
    state.values.values,
    style.card,
    store.env.registry,
  );
  // A viewed special position or branch fix replaces it, a draft too (ADR-0035, ADR-0036).
  const found = useDiscoveryCanvas(page.discovery, store, styled, state.doc);
  return {
    ...{ page, canvasRef, commandRef, setSize, panels, dialog, setDialog, header, size },
    ...{ workspace, searchRef, choose },
    ...useUndrawable(),
    ...{ claimBox, openClaims, style, shown: found.scene, highlight: found.highlight },
  };
}

/** First-use guide anchored inside the drawing area. */
function CanvasGuide({ app }: { app: ReturnType<typeof useApp> }) {
  return (
    <GettingStarted
      workspace={app.workspace}
      canvasHeight={app.size?.height ?? 200}
      fit={app.header.props.onFit}
      store={app.page.store}
      choose={app.choose}
      search={app.searchRef}
      text={() => {
        app.panels.showTab('Text');
      }}
      exportFigure={() => {
        app.setDialog({ kind: 'export', format: 'svg' });
      }}
    />
  );
}

/** The canvas: the figure, with the style card's draft previewed over it (ADR-0029). */
function Canvas({ app }: { app: ReturnType<typeof useApp> }) {
  const { state } = app.page.snap;
  return (
    <Board
      canvasRef={app.canvasRef}
      pan={app.workspace.pan}
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
      onName={style.setName}
      onClose={style.close}
    />
  );
}

function PageHeader({
  app,
  recoveryHost,
}: {
  app: ReturnType<typeof useApp>;
  recoveryHost: HTMLElement | null;
}) {
  return (
    <Header
      {...app.header.props}
      panels={{
        expanded: app.panels.expanded,
        toggle: () => {
          if (app.panels.expanded) app.panels.close();
          else app.panels.showTab(app.panels.tab);
        },
      }}
      search={
        <ToolSearch
          inputRef={app.searchRef}
          onChoose={app.choose}
          recent={app.workspace.prefs.recent}
        />
      }
      workspaceActions={(close) => (
        <WorkspaceActions
          workspace={app.workspace}
          close={close}
          hidePanels={app.panels.close}
          showPanels={() => {
            app.panels.showTab(app.panels.tab);
          }}
        />
      )}
      documents={<DocumentFiles store={app.page.store} />}
      persistence={
        <PersistencePanel
          outlet={recoveryHost}
          store={app.page.store}
          onRestore={() => {
            app.page.runs.clear();
          }}
        />
      }
    />
  );
}

function PanelView({ app }: { app: ReturnType<typeof useApp> }) {
  return (
    <SidePanel
      store={app.page.store}
      workspace={app.workspace}
      state={app.page.snap.state}
      scene={app.page.scene}
      undrawable={app.undrawable}
      runs={app.page.runs}
      discovery={app.page.discovery}
      tab={app.panels.tab}
      onTab={app.panels.showTab}
      open={app.panels.open}
      onClose={app.panels.close}
      claimBox={app.claimBox}
      onStyle={app.style.open}
    />
  );
}

/**
 * Geomira (SPEC §15) in Geomdraw's layout (Run 9b): the top bar, the tool palette, the canvas
 * with its tool controls, status line and live claim chips, the command line, the panels
 * and an object's style card (ADR-0029); over packages/editor (every change is an edit),
 * packages/scene (drawing, hit-testing) and packages/claims (badges here, tests in a Web
 * Worker).
 */
export function App() {
  const app = useApp();
  const { page, commandRef, dialog, setDialog, header, size } = app;
  const { store, snap, scene } = page;
  const settled = useSettled(snap.state);
  const [recoveryHost, setRecoveryHost] = useState<HTMLDivElement | null>(null);
  return (
    <AboutContext.Provider value={page.about}>
      <div
        className={`app${app.workspace.prefs.collapsed ? ' panel-collapsed' : ''}${app.workspace.view.height < 450 ? ` short-workspace${app.workspace.toolsExpanded ? ' show-palette' : ''}` : ''}`}
        style={app.workspace.style}
      >
        <PageHeader app={app} recoveryHost={recoveryHost} />
        <WorkspaceNotices
          page={page}
          command={commandRef}
          onRecoveryHost={setRecoveryHost}
          showTab={app.panels.showTab}
        />
        <Tools store={store} state={settled} onChoose={app.choose} />
        <Stage>
          <Canvas app={app} />
          <CanvasGuide app={app} />
          <DevBox
            scene={scene}
            undrawable={app.undrawable.length}
            stats={header.stats}
            times={header.times}
          />
          {CLAIM_TESTING && <ClaimChips store={store} state={snap.state} onOpen={app.openClaims} />}
          <div className="stage-footer">
            <Hint store={store} state={header.settled} />
            <SelectionBar store={store} state={header.settled} onProperties={app.style.open} />
            <Status state={settled} />
          </div>
        </Stage>
        <Commands store={store} inputRef={commandRef} onApplied={app.workspace.dismissGuide} />
        <Boundary onError={page.onInternal}>
          <PanelView app={app} />
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
