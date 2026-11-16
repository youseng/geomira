import type { Workspace } from './workspace';
import { panelWidth } from './workspace-prefs';

export function PanelResize({ workspace }: { workspace: Workspace }) {
  const width = panelWidth(workspace.prefs.width, workspace.view.width);
  return (
    <div
      className="panel-resizer"
      role="separator"
      aria-label="Resize panels"
      tabIndex={0}
      aria-orientation="vertical"
      aria-valuemin={240}
      aria-valuemax={Math.max(240, Math.min(560, workspace.view.width - 420))}
      aria-valuenow={width}
      aria-valuetext={`${String(width)} pixels wide`}
      onKeyDown={(e) => {
        const next =
          e.key === 'ArrowLeft'
            ? width + 20
            : e.key === 'ArrowRight'
              ? width - 20
              : e.key === 'Home'
                ? 240
                : e.key === 'End'
                  ? 560
                  : undefined;
        if (next !== undefined) {
          e.preventDefault();
          workspace.update({ width: panelWidth(next, window.innerWidth) });
        }
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          workspace.update({ width: panelWidth(window.innerWidth - e.clientX, window.innerWidth) });
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    />
  );
}
