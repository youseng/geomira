import { useState } from 'react';
import { TRIANGLE_TYPES, type TriangleType } from '@geomira/claims/randomize';
import { FORMATS, type ExportFormat } from '@geomira/export/formats';
import { EXAMPLES } from './examples';
import { Glyph, SrOnly } from './icons';
import { Menu, MenuItem } from './Menu';

export interface HeaderProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canRestore: boolean;
  readonly triangleType: TriangleType;
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
  readonly onTriangleType: (t: TriangleType) => void;
  readonly onRandomize: () => void;
  /** Adds the claim and tests it; false when it was refused (the notice says why). */
  readonly onTestClaim: (text: string) => boolean;
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
        <Glyph>{'↶'}</Glyph>
        <SrOnly>Undo</SrOnly>
      </button>
      <button
        type="button"
        className="tb icon"
        disabled={!p.canRedo}
        onClick={p.onRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Glyph>{'↷'}</Glyph>
        <SrOnly>Redo</SrOnly>
      </button>
    </>
  );
}

function Randomize(p: HeaderProps) {
  return (
    <div className="seg">
      <button
        type="button"
        className="tb"
        onClick={p.onRandomize}
        title="Randomize: a new figure of the same construction, with a triangle of the chosen type"
      >
        <Glyph>{'⚄'}</Glyph>
        <span className="hide-narrow">Randomize</span>
      </button>
      <select
        className="tb triangle-type"
        aria-label="Triangle type"
        title="Triangle type for Randomize (the first three free points)"
        value={p.triangleType}
        onChange={(e) => {
          const t = TRIANGLE_TYPES.find((x) => x === e.target.value);
          if (t !== undefined) p.onTriangleType(t);
        }}
      >
        {TRIANGLE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A claim to add and test at once ("collinear(A, B, C)", "AB = CD", "claim …"). */
export function ClaimBox(p: {
  readonly label: string;
  readonly className: string;
  readonly onTestClaim: (text: string) => boolean;
}) {
  const [text, setText] = useState('');
  return (
    <form
      className={p.className}
      onSubmit={(e) => {
        e.preventDefault();
        if (p.onTestClaim(text)) setText('');
      }}
    >
      <input
        type="text"
        aria-label={p.label}
        placeholder="Test a claim: A, B, C collinear · ABCD cyclic · AB ⟂ CD · AB = CD"
        spellCheck={false}
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <button type="submit" className="tb" title="Add the claim and test it (local test)">
        <Glyph>{'▸'}</Glyph>
        Test
      </button>
    </form>
  );
}

function ViewMenu(p: HeaderProps) {
  return (
    <Menu label="View" glyph={'◇'} title="View: fit and zoom">
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
        </>
      )}
    </Menu>
  );
}

/**
 * The examples as a native select laid over a menu button (its label stays "Example"): the
 * button shows "Examples", the platform's own list opens on a click or a tap.
 */
function Examples(p: HeaderProps) {
  return (
    <div className="tb examples" title="Example figures">
      <Glyph>{'▤'}</Glyph>
      <span className="hide-narrow" aria-hidden="true">
        Examples
      </span>
      <Glyph>{'▾'}</Glyph>
      <select
        aria-label="Example"
        value=""
        onChange={(e) => {
          p.onExample(e.target.value);
        }}
      >
        <option value="">Examples</option>
        {EXAMPLES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id}
          </option>
        ))}
      </select>
    </div>
  );
}

function ExportMenu(p: HeaderProps) {
  return (
    <Menu label="Export" glyph={'⤓'} title="Export, share, restore">
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
            title="The autosaved figure from before (after opening a link: your own figure)"
          >
            Restore previous figure
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

/** Settings: the developer tools live here (or behind ?dev=1), not in the main bar. */
function SettingsMenu(p: HeaderProps) {
  return (
    <Menu label="Settings" glyph={'⚙'} title="Settings" iconOnly>
      {(close) => (
        <>
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
          <hr />
          <MenuItem
            onClick={p.onMeasure}
            close={close}
            title="Times drag and pan frames of this figure"
          >
            Measure frame time
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

function HelpMenu(p: HeaderProps) {
  return (
    <Menu label="Help" glyph="?" title="Help (?)" iconOnly>
      {(close) => (
        <>
          <MenuItem onClick={p.onHelp} close={close} kbd="?">
            Shortcuts and tools
          </MenuItem>
          <a className="menu-link" href="about.html">
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
          <MenuItem onClick={p.onReport} close={close} title="For a bug report">
            Debug report
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

/**
 * The top bar (Geomdraw's layout, Run 9b): brand; undo and redo; Randomize with its triangle
 * type; a claim to test; the View, Examples and Export menus; Settings; Help. On a phone the
 * buttons show their glyphs only; their accessible names stay the words they had.
 */
export function Header(p: HeaderProps) {
  return (
    <header className="topbar">
      <Brand />
      <History {...p} />
      <Randomize {...p} />
      <ClaimBox label="Claim to test" className="claim-form" onTestClaim={p.onTestClaim} />
      <div className="spacer" />
      <ViewMenu {...p} />
      <Examples {...p} />
      <ExportMenu {...p} />
      <SettingsMenu {...p} />
      <HelpMenu {...p} />
    </header>
  );
}
