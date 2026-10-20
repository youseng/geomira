import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VERSION } from '@geomira/kernel';
import { createRegistry, type Registry } from '@geomira/kernel/registry';
import { zoomViewport, type Size, type Viewport } from '@geomira/scene/viewport';
import { measureFrames, type FrameTimes } from './bench';
import { Board } from './Board';
import { EXAMPLES } from './examples';
import { loadFigure, viewportFor, type Figure } from './figure';
import { LIGHT_THEME } from './render';
import { SidePanel } from './SidePanel';

const FIRST = EXAMPLES[0]?.id ?? '';
const BENCH_FRAMES = 120;

interface ToolbarProps {
  readonly exampleId: string;
  readonly onExample: (id: string) => void;
  readonly onFit: () => void;
  readonly onZoom: (factor: number) => void;
  readonly onMeasure: () => void;
}

function Toolbar({ exampleId, onExample, onFit, onZoom, onMeasure }: ToolbarProps) {
  return (
    <>
      <select
        aria-label="Example"
        value={exampleId}
        onChange={(e) => {
          onExample(e.target.value);
        }}
      >
        {EXAMPLES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id}
          </option>
        ))}
      </select>
      <button type="button" onClick={onFit}>
        Fit
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => {
          onZoom(1.25);
        }}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => {
          onZoom(0.8);
        }}
      >
        −
      </button>
      <button type="button" onClick={onMeasure}>
        Measure frame time
      </button>
    </>
  );
}

/** The figure state of the page: the example, its figure, the viewport and the size. */
function useFigure(registry: Registry) {
  const [exampleId, setExampleId] = useState(FIRST);
  const [figure, setFigure] = useState<Figure>(() => loadFigure(EXAMPLES[0]?.text ?? '', registry));
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    if (viewport === null && size !== null) setViewport(viewportFor(figure, size));
  }, [viewport, size, figure]);
  const choose = (id: string) => {
    setExampleId(id);
    setFigure(loadFigure(EXAMPLES.find((e) => e.id === id)?.text ?? '', registry));
    setViewport(null);
  };
  const onSize = useCallback((s: Size) => {
    setSize(s);
  }, []);
  return { exampleId, choose, figure, setFigure, viewport, setViewport, size, onSize };
}

/**
 * Run 7 development page: pick an example, pan (drag), zoom (wheel or buttons), fit, toggle
 * layers, select objects (click), and measure frame times. The figure is drawn by the
 * canvas renderer from the scene (packages/scene).
 */
export function App() {
  const registry = useMemo(() => createRegistry(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const f = useFigure(registry);
  const [selection, setSelection] = useState<ReadonlySet<number>>(new Set());
  const [times, setTimes] = useState<FrameTimes | null>(null);
  const zoomBy = (factor: number) => {
    if (f.viewport === null || f.size === null) return;
    const centre = { x: f.size.width / 2, y: f.size.height / 2 };
    f.setViewport(zoomViewport({ viewport: f.viewport, size: f.size }, centre, factor));
  };
  const measure = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx === null || ctx === undefined || f.viewport === null || f.size === null) return;
    const env = { ctx, registry, size: f.size, viewport: f.viewport, dpr: window.devicePixelRatio };
    setTimes(measureFrames(f.figure, { ...env, theme: LIGHT_THEME }, BENCH_FRAMES));
    f.setViewport({ ...f.viewport }); // redraw the figure the measurement drew over
  };
  return (
    <div className="app">
      <header className="app-header">
        <h1>Geomira</h1>
        <span className="app-version">v{VERSION}</span>
        <Toolbar
          exampleId={f.exampleId}
          onExample={(id) => {
            f.choose(id);
            setSelection(new Set());
            setTimes(null);
          }}
          onFit={() => {
            f.setViewport(null);
          }}
          onZoom={zoomBy}
          onMeasure={measure}
        />
      </header>
      <main className="app-main">
        <Board
          canvasRef={canvasRef}
          scene={f.figure.scene}
          viewport={f.viewport}
          onViewport={f.setViewport}
          onSize={f.onSize}
          selection={selection}
          onSelect={(id) => {
            setSelection(new Set(id === null ? [] : [id]));
          }}
        />
        <SidePanel
          figure={f.figure}
          registry={registry}
          onFigure={f.setFigure}
          selection={selection}
          times={times}
        />
      </main>
    </div>
  );
}
