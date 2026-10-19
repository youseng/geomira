import { useEffect, useRef } from 'react';
import { VERSION } from '@geomira/kernel';

/** Run 0 shell: the title and an empty drawing canvas, sized to its container. */
export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    const resize = () => {
      const ratio = window.devicePixelRatio;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Geomira</h1>
        <span className="app-version">v{VERSION}</span>
      </header>
      <main className="app-main">
        <canvas ref={canvasRef} className="board" aria-label="Geometry canvas" />
      </main>
    </div>
  );
}
