import { VERSION } from '@geomira/kernel';
import { EXAMPLES } from './examples';

export interface HeaderProps {
  readonly exampleId: string;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canRestore: boolean;
  readonly onExample: (id: string) => void;
  readonly onFit: () => void;
  readonly onZoom: (factor: number) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onShare: () => void;
  readonly onRestore: () => void;
  readonly onReport: () => void;
  readonly onMeasure: () => void;
}

function Actions(p: HeaderProps) {
  return (
    <>
      <button type="button" disabled={!p.canUndo} onClick={p.onUndo} title="Ctrl+Z">
        Undo
      </button>
      <button type="button" disabled={!p.canRedo} onClick={p.onRedo} title="Ctrl+Shift+Z">
        Redo
      </button>
      <button type="button" onClick={p.onShare}>
        Share link
      </button>
      <button type="button" disabled={!p.canRestore} onClick={p.onRestore}>
        Restore previous figure
      </button>
      <button type="button" onClick={p.onReport}>
        Debug report
      </button>
      <button type="button" onClick={p.onMeasure}>
        Measure frame time
      </button>
    </>
  );
}

/** The title, the example picker, the view, history, sharing and the debug report. */
export function Header(p: HeaderProps) {
  return (
    <header className="app-header">
      <h1>Geomira</h1>
      <span className="app-version">v{VERSION}</span>
      <select
        aria-label="Example"
        value={p.exampleId}
        onChange={(e) => {
          p.onExample(e.target.value);
        }}
      >
        <option value="">open an example…</option>
        {EXAMPLES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id}
          </option>
        ))}
      </select>
      <button type="button" onClick={p.onFit}>
        Fit
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => {
          p.onZoom(1.25);
        }}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => {
          p.onZoom(0.8);
        }}
      >
        −
      </button>
      <Actions {...p} />
    </header>
  );
}
