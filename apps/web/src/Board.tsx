import { useEffect, useMemo, useState, type RefObject } from 'react';
import { toolPreview } from '@geomira/editor/preview';
import type { ToolState } from '@geomira/editor/tool-state';
import { layout, type DisplayList } from '@geomira/scene/display';
import { hitTest } from '@geomira/scene/hit';
import type { Scene, Undrawable } from '@geomira/scene/types';
import {
  toWorld,
  zoomViewport,
  type Size,
  type Vec2,
  type Viewport,
} from '@geomira/scene/viewport';
import { Gestures } from './gestures';
import { drawDisplay, drawPreview, LIGHT_THEME, type UiState } from './render';
import type { EditorStore } from './store';

export interface BoardProps {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly store: EditorStore;
  readonly scene: Scene;
  readonly viewport: Viewport;
  readonly hover: number | null;
  readonly selection: readonly number[];
  /** The active tool's state: the live preview follows it (ADR-0024). */
  readonly toolState: ToolState;
  readonly onSize: (s: Size) => void;
  /** The curves of the current display that cannot be placed at its zoom (ADR-0023). */
  readonly onUndrawable: (u: readonly Undrawable[]) => void;
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
 * The label face (an @font-face of local fonts) loads on first use; a canvas does not redraw
 * by itself when it arrives, so the board draws again once it has loaded (Run 9b).
 */
function useLabelFace(): number {
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts.load(`${String(LIGHT_THEME.fontSize)}px ${LIGHT_THEME.fontFamily}`).then(
      () => {
        if (live) setLoaded((n) => n + 1);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return loaded;
}

/** The display list of the scene in the view; reports its undrawable curves (ADR-0023). */
function useDisplay(
  scene: Scene,
  viewport: Viewport,
  size: Size | null,
  onUndrawable: (u: readonly Undrawable[]) => void,
): DisplayList | null {
  const display = useMemo(
    () => (size === null ? null : layout(scene, { viewport, size })),
    [scene, viewport, size],
  );
  useEffect(() => {
    if (display !== null) onUndrawable(display.undrawable);
  }, [display, onUndrawable]);
  return display;
}

/**
 * The live preview of the active tool at the cursor (ADR-0024), laid out in the view; null
 * when the tool previews nothing there or the cursor is off the canvas.
 */
function usePreview(
  store: EditorStore,
  display: DisplayList | null,
  cursor: Vec2 | null,
  toolState: ToolState,
): DisplayList | null {
  return useMemo(() => {
    if (display === null || cursor === null) return null;
    const s = store.current();
    if (s.tool === 'move' || s.toolState !== toolState) return null;
    const world = toWorld(display.view, cursor);
    const scene = toolPreview(s, hitTest(display, cursor), world, store.env);
    return scene === null ? null : layout(scene, display.view);
  }, [store, display, cursor, toolState]);
}

/**
 * The drawing surface: the display list of the scene in the editor's viewport, drawn by the
 * canvas renderer (HiDPI) with hover and selection halos. Pointer input goes through
 * gestures.ts (tools, drags, pan, pinch); the wheel zooms about the cursor. The viewport is
 * also written to data attributes, so end-to-end tests can aim at world coordinates.
 */
/**
 * Draws each frame: the display list with hover and selection halos, then the active tool's
 * preview at the cursor; returns the cursor and its setter for the pointer handlers.
 */
function useFrame(props: BoardProps, display: DisplayList | null) {
  const { canvasRef, store, hover, selection, toolState } = props;
  const selected = useMemo(() => new Set(selection), [selection]);
  const fonts = useLabelFace();
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const preview = usePreview(store, display, cursor, toolState);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (display === null || ctx === null || ctx === undefined) return;
    const ui: UiState = { hover, selection: selected };
    drawDisplay(ctx, display, ui, LIGHT_THEME, window.devicePixelRatio);
    if (preview !== null) drawPreview(ctx, preview, LIGHT_THEME, window.devicePixelRatio);
  }, [canvasRef, display, hover, selected, fonts, preview]);
  return { cursor, setCursor };
}

export function Board(props: BoardProps) {
  const { canvasRef, store, scene, viewport, onSize, onUndrawable } = props;
  const gestures = useMemo(() => new Gestures(store), [store]);
  const size = useSurface(canvasRef, onSize);
  const display = useDisplay(scene, viewport, size, onUndrawable);
  const { cursor, setCursor } = useFrame(props, display);
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
        // Leave a focused field first, so its blur (the text panel applies its draft) comes
        // before the press starts a drag, which would refuse the text (Run 10 audit).
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused !== e.currentTarget) focused.blur();
        e.currentTarget.setPointerCapture(e.pointerId);
        gestures.down(e.pointerId, local(e), display);
      }}
      onPointerMove={(e) => {
        if (display === null) return;
        gestures.move(e.pointerId, local(e), display);
        // The preview follows a mouse while a construction tool is active (not a drag's frames).
        const tooling = e.pointerType === 'mouse' && store.current().tool !== 'move';
        if (tooling || cursor !== null) setCursor(tooling ? local(e) : null);
      }}
      onPointerUp={(e) => {
        if (display !== null) gestures.up(e.pointerId, local(e), display);
      }}
      onPointerCancel={(e) => {
        gestures.cancel(e.pointerId);
      }}
      onPointerLeave={() => {
        gestures.leave();
        setCursor(null);
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
