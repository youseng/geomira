import { Component, useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Size } from '@geomira/scene/viewport';
import { Board } from './Board';
import { CommandBar } from './CommandBar';
import { ErrorBanner, TextDialog } from './Dialogs';
import { ExportDialog } from './ExportDialog';
import { Header } from './Header';
import { useAutosave, useFitOnOpen, useInternalErrors, useShortcuts, useStartup } from './hooks';
import { reportOf, useFit, useHeader, useKeyActions, usePage, type Dialog } from './page';
import { SidePanel, type Tab } from './SidePanel';
import type { EditorStore, Notice } from './store';
import { ToolBar } from './ToolBar';

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

function NoticeLine({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  if (notice === null) return null;
  return (
    <div className={`notice notice-${notice.tone}`} role="status">
      {notice.text}
      {(notice.diagnostics ?? []).map((d) => (
        <div key={`${String(d.line)}:${String(d.column)}`}>
          Line {d.line}, column {d.column}: {d.message}. {d.hint}
        </div>
      ))}{' '}
      <button type="button" className="small" onClick={onClose}>
        Dismiss
      </button>
    </div>
  );
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

/** Keyboard shortcuts; "/" focuses the command bar, "?" shows the help. */
function usePageShortcuts(
  store: EditorStore,
  fit: () => void,
  commandRef: RefObject<HTMLInputElement | null>,
  setTab: (f: (t: Tab) => Tab) => void,
) {
  const focusCommand = useCallback(() => commandRef.current?.focus(), [commandRef]);
  const toggleHelp = useCallback(() => {
    setTab((t) => (t === 'Help' ? 'Text' : 'Help'));
  }, [setTab]);
  useShortcuts(useKeyActions(store, fit, focusCommand, toggleHelp));
}

/** The page's state, effects and actions. */
function useApp() {
  const page = usePage();
  const { store, snap, sceneOf, onInternal } = page;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const commandRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('Text');
  const [dialog, setDialog] = useState<Dialog>(null);
  const onReady = useCallback(() => {
    setReady(true);
  }, []);
  useStartup(store, onReady);
  useAutosave(store, snap, ready);
  useFitOnOpen(store, snap.openCount, size, sceneOf);
  useInternalErrors(onInternal);
  const fit = useFit(store, size, sceneOf);
  usePageShortcuts(store, fit, commandRef, setTab);
  const canvas = useCallback(() => canvasRef.current, []);
  const header = useHeader({ store, runs: page.runs, snap, size, ready, fit, canvas, setDialog });
  return { page, canvasRef, commandRef, size, setSize, tab, setTab, dialog, setDialog, header };
}

/**
 * Geomira (SPEC §15): the canvas with the GUI tools, the command bar and the panels, over
 * packages/editor (every change is an edit), packages/scene (drawing, hit-testing) and
 * packages/claims (badges here, tests in a Web Worker).
 */
export function App() {
  const { page, canvasRef, commandRef, size, setSize, tab, setTab, dialog, setDialog, header } =
    useApp();
  const { store, snap, scene } = page;
  const { state } = snap;
  return (
    <div className="app">
      <Header {...header.props} />
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
      <ToolBar store={store} state={state} />
      <CommandBar store={store} inputRef={commandRef} />
      <main className="app-main">
        <Board
          canvasRef={canvasRef}
          store={store}
          scene={scene}
          viewport={state.viewport}
          hover={state.hover}
          selection={state.selection}
          onSize={setSize}
        />
        <Boundary onError={page.onInternal}>
          <SidePanel
            store={store}
            state={state}
            scene={scene}
            runs={page.runs}
            times={header.times}
            tab={tab}
            onTab={setTab}
          />
        </Boundary>
      </main>
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
