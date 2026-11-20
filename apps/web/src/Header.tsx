import type { ReactNode } from 'react';
import { CLAIM_TESTING } from './features';
import { FORMATS, type ExportFormat } from '@geomira/export/formats';
import { SINGLE_FILE, SITE_URL } from './build-info';
import { EXAMPLES } from './examples';
import { HeaderIcon } from './HeaderIcon';
import { usePanelCeiling } from './WorkspaceActions';
import { SrOnly, ZoomIcon } from './icons';
import { ClaimBox, type ClaimBoxHost } from './ClaimBox';
import { Menu, MenuItem } from './Menu';

export interface HeaderProps {
  readonly search?: ReactNode;
  readonly panels?: { readonly expanded: boolean; readonly toggle: () => void };
  readonly workspaceActions?: (close: () => void) => ReactNode;
  readonly persistence?: ReactNode;
  readonly documents?: ReactNode;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canRestore: boolean;
  readonly stats: boolean;
  readonly onExample: (id: string) => void;
  readonly onFit: () => void;
  readonly onZoom: (factor: number) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onShare: () => void;
  readonly onRestore: () => void;
  readonly onReport: () => void;
  readonly onExport: (format: ExportFormat) => void;
  readonly onMeasure: () => void;
  /** The claim box: adds a claim and tests it, completes it, says what it could not read. */
  readonly claimBox: ClaimBoxHost;
  readonly onStats: (on: boolean) => void;
  readonly onHelp: () => void;
}

/** The brand: one heading "Geomira"; the logotype (upright "Geom", italic "ira") is CSS. */
function Brand() {
  return (
    <div className="brand">
      <h1>Geomira</h1>
    </div>
  );
}

function History(p: HeaderProps) {
  return (
    <>
      <button
        type="button"
        className="tb icon"
        disabled={!p.canUndo}
        onClick={p.onUndo}
        title="Undo (Ctrl+Z)"
      >
        <HeaderIcon name="undo" />
        <SrOnly>Undo</SrOnly>
      </button>
      <button
        type="button"
        className="tb icon"
        disabled={!p.canRedo}
        onClick={p.onRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <HeaderIcon name="redo" />
        <SrOnly>Redo</SrOnly>
      </button>
    </>
  );
}

/** Direct viewport controls in the workspace header. */
function ZoomControls(p: { readonly onZoom: (f: number) => void; readonly onFit: () => void }) {
  return (
    <div className="zoomctl" role="group" aria-label="Canvas view">
      <button
        className="tb icon"
        type="button"
        title="Zoom in"
        onClick={() => {
          p.onZoom(1.25);
        }}
      >
        <ZoomIcon kind="in" />
        <SrOnly>Zoom in</SrOnly>
      </button>
      <button
        className="tb icon"
        type="button"
        title="Zoom out"
        onClick={() => {
          p.onZoom(0.8);
        }}
      >
        <ZoomIcon kind="out" />
        <SrOnly>Zoom out</SrOnly>
      </button>
      <button type="button" className="tb icon" title="Fit the figure (0)" onClick={p.onFit}>
        <ZoomIcon kind="fit" />
        <SrOnly>Fit</SrOnly>
      </button>
    </div>
  );
}

function ViewMenu(p: HeaderProps) {
  return (
    <Menu label="View" glyph="view" title="View and workspace">
      {(close) => (
        <>
          <MenuItem onClick={p.onFit} close={close} kbd="0">
            Fit the figure
          </MenuItem>
          <MenuItem
            onClick={() => {
              p.onZoom(1.25);
            }}
            close={close}
          >
            Zoom in by a quarter
          </MenuItem>
          <MenuItem
            onClick={() => {
              p.onZoom(0.8);
            }}
            close={close}
          >
            Zoom out by a fifth
          </MenuItem>
          <hr />
          {p.workspaceActions?.(close)}
        </>
      )}
    </Menu>
  );
}

/**
 * Whether a key on the CLOSED examples list is ignored: type-ahead letters and the arrows
 * would open another example at once, replacing the figure (ADR-0028). Space, Enter and
 * Alt+ArrowDown still open the list; a choice in the open list is made there.
 */
export function ignoredOnExamples(key: string, modified: boolean): boolean {
  if (modified) return false;
  const moves = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ];
  return (key.length === 1 && key !== ' ') || moves.includes(key);
}

function Examples(p: { onExample: (id: string) => void }) {
  return (
    <label className="examples">
      <span>Examples</span>
      <select
        aria-label="Example"
        value=""
        onKeyDown={(e) => {
          if (ignoredOnExamples(e.key, e.altKey || e.ctrlKey || e.metaKey)) e.preventDefault();
        }}
        onChange={(e) => {
          p.onExample(e.target.value);
        }}
      >
        <option value="">Choose a figure…</option>
        {EXAMPLES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExportMenu(p: HeaderProps) {
  return (
    <Menu label="Export" glyph="export" title="Export, share, restore">
      {(close) => (
        <>
          {FORMATS.map((f) => (
            <MenuItem
              key={f.format}
              onClick={() => {
                p.onExport(f.format);
              }}
              close={close}
            >
              {f.label}
            </MenuItem>
          ))}
          <hr />
          <MenuItem onClick={p.onShare} close={close}>
            Share link
          </MenuItem>
          <MenuItem
            onClick={p.onRestore}
            close={close}
            disabled={!p.canRestore}
            title="The autosaved figure from before (after opening a link or an example: your own figure)"
          >
            Restore previous figure
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

function MoreMenu(p: HeaderProps) {
  return (
    <Menu label="More actions" glyph="more" title="More actions" iconOnly>
      {(close) => (
        <>
          <Examples
            onExample={(id) => {
              close();
              p.onExample(id);
            }}
          />
          <hr />
          <MenuItem onClick={p.onHelp} close={close} kbd="?">
            Shortcuts and tools
          </MenuItem>
          <a className="menu-link" href={SINGLE_FILE ? `${SITE_URL}about.html` : 'about.html'}>
            About Geomira
          </a>
          <a
            className="menu-link"
            href="https://github.com/youseng/geomira/blob/main/docs/language.md"
            target="_blank"
            rel="noreferrer"
          >
            Language reference
          </a>
          <hr />
          <label>
            <input
              type="checkbox"
              checked={p.stats}
              onChange={(e) => {
                p.onStats(e.target.checked);
              }}
            />
            Show object counts
          </label>
          <MenuItem onClick={p.onMeasure} close={close}>
            Measure frame time
          </MenuItem>
          <MenuItem onClick={p.onReport} close={close} title="For a bug report">
            Debug report
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

export function Header(p: HeaderProps) {
  const ref = usePanelCeiling();
  return (
    <header className="topbar" ref={ref}>
      <div className="document-group">
        <Brand />
        {p.documents}
        {p.persistence}
      </div>
      <div className="history-group">
        <History {...p} />
      </div>
      <section className="toolbar-search" aria-label="Workspace">
        {p.search}
      </section>
      {CLAIM_TESTING && <ClaimBox label="Claim to test" className="claim-form" host={p.claimBox} />}
      <ZoomControls onFit={p.onFit} onZoom={p.onZoom} />
      {p.panels && (
        <button
          type="button"
          className="tb icon panel-toggle"
          aria-label="Figure panels"
          aria-controls="figure-panel-body"
          aria-expanded={p.panels.expanded}
          title={p.panels.expanded ? 'Close figure panels' : 'Open figure panels'}
          onClick={p.panels.toggle}
        >
          <HeaderIcon name="panels" />
        </button>
      )}
      <div className="header-actions">
        <ViewMenu {...p} />
        <ExportMenu {...p} />
        <MoreMenu {...p} />
      </div>
    </header>
  );
}
