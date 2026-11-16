import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { ToolId } from '@geomira/editor/tool-state';
import { ToolSearch } from './ToolSearch';
import type { Workspace } from './workspace';

function usePanelCeiling(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const bar = ref.current;
    const app = bar?.closest<HTMLElement>('.app');
    if (bar === null || app === null || app === undefined) return;
    const measure = () => {
      app.style.setProperty(
        '--panel-ceiling',
        `${String(Math.max(0, bar.getBoundingClientRect().bottom + 4))}px`,
      );
      const controls = app.querySelector('.stage-top');
      app.style.setProperty(
        '--stage-controls-height',
        `${String((controls?.getBoundingClientRect().height ?? 0) + 12)}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    const header = app.querySelector('.topbar');
    if (header !== null) observer.observe(header);
    const controls = app.querySelector('.stage-top');
    if (controls !== null) observer.observe(controls);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [ref]);
}

function ShortPaletteControl({ workspace }: { workspace: Workspace }) {
  if (workspace.view.height >= 450) return null;
  return (
    <button
      type="button"
      className="tb"
      aria-label="Show all tools"
      aria-expanded={workspace.toolsExpanded}
      onClick={() => {
        workspace.setToolsExpanded(!workspace.toolsExpanded);
      }}
    >
      Tools
    </button>
  );
}

export function WorkspaceBar({
  workspace,
  inputRef,
  choose,
  showPanels,
  hidePanels,
}: {
  readonly workspace: Workspace;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly choose: (id: ToolId) => void;
  readonly showPanels: () => void;
  readonly hidePanels: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  usePanelCeiling(ref);
  return (
    <section ref={ref} className="workspace-bar" aria-label="Workspace">
      <ShortPaletteControl workspace={workspace} />
      <ToolSearch onChoose={choose} inputRef={inputRef} recent={workspace.prefs.recent} />
      <button
        type="button"
        className="tb"
        aria-label="Pan canvas"
        aria-pressed={workspace.pan}
        title="Pan by dragging, including over objects. Drawing and scrolling preferences are unchanged."
        onClick={() => {
          workspace.setPan(!workspace.pan);
          if (workspace.view.width <= 760) hidePanels();
        }}
      >
        Pan
      </button>
      <button type="button" className="tb" aria-label="Show panels" onClick={showPanels}>
        Panels
      </button>
      <button
        type="button"
        className="tb guide-trigger"
        aria-label="Getting started"
        onClick={() => {
          workspace.setGuide(!workspace.guide);
          if (workspace.view.width <= 760) hidePanels();
        }}
      >
        Guide
      </button>
    </section>
  );
}
