import { useLayoutEffect, useRef } from 'react';
import { MenuItem } from './Menu';
import type { Workspace } from './workspace';

export function usePanelCeiling() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const header = ref.current;
    const app = header?.closest<HTMLElement>('.app');
    if (!header || !app) return;
    const measure = () => {
      const box = header.getBoundingClientRect();
      app.style.setProperty('--top-controls-height', `${String(box.height)}px`);
      app.style.setProperty('--panel-ceiling', `${String(Math.max(0, box.bottom) + 4)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    app.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      app.removeEventListener('scroll', measure);
      window.removeEventListener('scroll', measure);
    };
  }, []);
  return ref;
}

export function WorkspaceActions({
  workspace,
  showPanels,
  hidePanels,
  close,
}: {
  workspace: Workspace;
  showPanels: () => void;
  hidePanels: () => void;
  close: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-pressed={workspace.pan}
        onClick={() => {
          close();
          workspace.setPan(!workspace.pan);
          workspace.dismissGuide();
          if (workspace.view.width <= 760) hidePanels();
        }}
      >
        Pan canvas
      </button>
      <MenuItem close={close} onClick={showPanels}>
        Show panels
      </MenuItem>
      {workspace.view.height < 450 && (
        <button
          type="button"
          aria-expanded={workspace.toolsExpanded}
          onClick={() => {
            close();
            workspace.setToolsExpanded(!workspace.toolsExpanded);
          }}
        >
          Show all tools
        </button>
      )}
      <MenuItem
        close={close}
        onClick={() => {
          workspace.setGuide(!workspace.guide);
          if (workspace.view.width <= 760) hidePanels();
        }}
      >
        Getting started
      </MenuItem>
    </>
  );
}
