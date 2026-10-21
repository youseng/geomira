import { useEffect, useMemo, useState, type RefObject } from 'react';
import { layout } from '@geomira/scene/display';
import type { Scene } from '@geomira/scene/types';
import { zoomViewport, type Size, type Viewport } from '@geomira/scene/viewport';
import { Gestures } from './gestures';
import { drawDisplay, LIGHT_THEME, type UiState } from './render';
import type { EditorStore } from './store';

export interface BoardProps {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly store: EditorStore;
  readonly scene: Scene;
  readonly viewport: Viewport;
  readonly hover: number | null;
  readonly selection: readonly number[];
  readonly onSize: (s: Size) => void;
}

/** Wheel steps of 100 (one notch) zoom by this factor. */
const WHEEL_ZOOM = 1.15;

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
 * The drawing surface: the display list of the scene in the editor's viewport, drawn by the
 * canvas renderer (HiDPI) with hover and selection halos. Pointer input goes through
 * gestures.ts (tools, drags, pan, pinch); the wheel zooms about the cursor. The viewport is
 * also written to data attributes, so end-to-end tests can aim at world coordinates.
 */
export function Board(props: BoardProps) {
  const { canvasRef, store, scene, viewport, hover, selection, onSize } = props;
  const gestures = useMemo(() => new Gestures(store), [store]);
  const size = useSurface(canvasRef, onSize);
  const display = useMemo(
    () => (size === null ? null : layout(scene, { viewport, size })),
    [scene, viewport, size],
  );
  const selected = useMemo(() => new Set(selection), [selection]);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (display === null || ctx === null || ctx === undefined) return;
    const ui: UiState = { hover, selection: selected };
    drawDisplay(ctx, display, ui, LIGHT_THEME, window.devicePixelRatio);
  }, [canvasRef, display, hover, selected]);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  return (
    <canvas
      ref={canvasRef}
      className="board"
      aria-label="Geometry canvas"
      data-cx={viewport.cx}
      data-cy={viewport.cy}
      data-zoom={viewport.zoom}
      onPointerDown={(e) => {
        if (display === null) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        gestures.down(e.pointerId, local(e), display);
      }}
      onPointerMove={(e) => {
        if (display !== null) gestures.move(e.pointerId, local(e), display);
      }}
      onPointerUp={(e) => {
        if (display !== null) gestures.up(e.pointerId, local(e), display);
      }}
      onPointerCancel={(e) => {
        gestures.cancel(e.pointerId);
      }}
      onPointerLeave={() => {
        gestures.leave();
      }}
      onWheel={(e) => {
        if (size === null) return;
        const factor = WHEEL_ZOOM ** (-e.deltaY / 100);
        store.apply({
          kind: 'viewport',
          viewport: zoomViewport({ viewport, size }, local(e), factor),
        });
      }}
    />
  );
}
