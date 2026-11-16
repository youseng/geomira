import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Tab } from './panel-types';
import { panelWidth, readWorkspace, writeWorkspace, type WorkspacePrefs } from './workspace-prefs';

export function useViewport() {
  const [view, setView] = useState({ width: 1440, height: 800 });
  useEffect(() => {
    const update = () => {
      setView({
        width: window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);
  return view;
}
export function useWorkspace() {
  const [prefs, setPrefs] = useState(readWorkspace);
  const [pan, setPan] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [guide, setGuide] = useState(false);
  const view = useViewport();
  const update = useCallback((patch: Partial<WorkspacePrefs>) => {
    setPrefs((old) => {
      const next = { ...old, ...patch };
      writeWorkspace(next);
      return next;
    });
  }, []);
  const remember = useCallback((id: string) => {
    setPrefs((old) => {
      const next = { ...old, recent: [id, ...old.recent.filter((x) => x !== id)].slice(0, 5) };
      writeWorkspace(next);
      return next;
    });
  }, []);
  const style: CSSProperties & Record<string, string> = {
    '--sidebar-width': `${String(panelWidth(prefs.width, view.width))}px`,
    '--workspace-height': `${String(view.height)}px`,
  };
  return {
    prefs,
    update,
    view,
    style,
    pan,
    setPan,
    guide,
    setGuide,
    remember,
    toolsExpanded,
    setToolsExpanded,
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;

/** Keep the text component mounted when panels collapse or the phone sheet closes. */
export function usePanels(workspace: Workspace) {
  const [tab, setTab] = useState<Tab>('Text');
  const [open, setOpen] = useState(false);
  const showTab = useCallback(
    (t: Tab) => {
      setTab(t);
      setOpen(true);
      workspace.update({ collapsed: false });
    },
    [workspace.update],
  );
  const toggleHelp = useCallback(() => {
    setTab((t) => (t === 'Help' ? 'Text' : 'Help'));
    setOpen(true);
    workspace.update({ collapsed: false });
  }, [workspace.update]);
  const close = useCallback(() => {
    setOpen(false);
    if (window.innerWidth > 760) workspace.update({ collapsed: true });
  }, [workspace.update]);
  return { tab, open, showTab, toggleHelp, close };
}
