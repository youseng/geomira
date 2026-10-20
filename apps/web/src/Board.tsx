import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { hitTest } from '@geomira/scene/hit';
import { layout } from '@geomira/scene/display';
import type { Scene } from '@geomira/scene/types';
import { panViewport, zoomViewport, type Size, type Viewport } from '@geomira/scene/viewport';
import { drawDisplay, LIGHT_THEME, type UiState } from './render';

export interface BoardProps {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly scene: Scene;
  /** The viewport to show; null = let the parent fit it once the size is known. */
  readonly viewport: Viewport | null;
  readonly onViewport: (v: Viewport) => void;
  readonly onSize: (s: Size) => void;
  readonly selection: ReadonlySet<number>;
  readonly onSelect: (id: number | null) => void;
}

/** Wheel steps of 100 (one notch) zoom by this factor. */
const WHEEL_ZOOM = 1.15;
/** A pointer that moved less than this many px between down and up is a click. */
const CLICK_SLOP = 4;

/** The canvas's CSS size, kept in sync with its box; its pixel size is css × dpr (HiDPI). */
function useSurface(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onSize: (s: Size) => void,
): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    const resize = () => {
      const s = {
        width: Math.max(1, canvas.clientWidth),
        height: Math.max(1, canvas.clientHeight),
      };
      const ratio = window.devicePixelRatio;
      canvas.width = Math.max(1, Math.round(s.width * ratio));
      canvas.height = Math.max(1, Math.round(s.height * ratio));
      setSize(s);
      onSize(s);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [canvasRef, onSize]);
  return size;
}

/**
 * The drawing surface: a canvas sized to its box with devicePixelRatio device pixels per CSS
 * pixel (HiDPI). It redraws on every change of scene, viewport, size, hover or selection;
 * dragging pans, the wheel zooms about the cursor, a click selects the topmost hit.
 */
export function Board(props: BoardProps) {
  const { canvasRef, scene, viewport, onViewport, onSize, selection, onSelect } = props;
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);

  const size = useSurface(canvasRef, onSize);

  const display = useMemo(
    () => (size === null || viewport === null ? null : layout(scene, { viewport, size })),
    [scene, viewport, size],
  );

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (display === null || ctx === null || ctx === undefined) return;
    const ui: UiState = { hover, selection };
    drawDisplay(ctx, display, ui, LIGHT_THEME, window.devicePixelRatio);
  }, [canvasRef, display, hover, selection]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  return (
    <canvas
      ref={canvasRef}
      className="board"
      aria-label="Geometry canvas"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { ...local(e), moved: 0 };
      }}
      onPointerMove={(e) => {
        const q = local(e);
        const d = drag.current;
        if (d !== null && viewport !== null) {
          drag.current = { ...q, moved: d.moved + Math.hypot(q.x - d.x, q.y - d.y) };
          onViewport(panViewport(viewport, q.x - d.x, q.y - d.y));
        } else if (display !== null) {
          setHover(hitTest(display, q).hits[0]?.id ?? null);
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (d !== null && d.moved < CLICK_SLOP && display !== null)
          onSelect(hitTest(display, local(e)).hits[0]?.id ?? null);
      }}
      onPointerLeave={() => {
        setHover(null);
      }}
      onWheel={(e) => {
        if (viewport === null || size === null) return;
        const factor = WHEEL_ZOOM ** (-e.deltaY / 100);
        onViewport(zoomViewport({ viewport, size }, local(e), factor));
      }}
    />
  );
}
