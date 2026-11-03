import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { toolPreview } from '@geomira/editor/preview';
import type { ToolState } from '@geomira/editor/tool-state';
import { layout, type DisplayList } from '@geomira/scene/display';
import { hitTest } from '@geomira/scene/hit';
import type { Scene, Undrawable } from '@geomira/scene/types';
import { toWorld, type Size, type Vec2, type Viewport } from '@geomira/scene/viewport';
import { around, type Box } from './card-place';
import {
  ESTIMATED_METRICS,
  Gestures,
  pressedObject,
  type Hold,
  type LabelMetrics,
} from './gestures';
import { timeout } from './long-press';
import { drawDisplay, drawPreview, LIGHT_THEME, measuredWidth, type UiState } from './render';
import type { EditorStore } from './store';
import { useSurface, useWheelZoom } from './surface';

export interface BoardProps {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly store: EditorStore;
  readonly scene: Scene;
  readonly viewport: Viewport;
  readonly hover: number | null;
  readonly selection: readonly number[];
  /** The objects of a hovered discovery fact, ringed (ADR-0035). */
  readonly highlight: readonly number[];
  /** The active tool's state: the live preview follows it (ADR-0024). */
  readonly toolState: ToolState;
  readonly onSize: (s: Size) => void;
  /** The curves of the current display that cannot be placed at its zoom (ADR-0023). */
  readonly onUndrawable: (u: readonly Undrawable[]) => void;
  /** Opens the style card of an object next to `anchor` (viewport px; ADR-0029). */
  readonly onStyle: (id: number, anchor: Box) => void;
}

/** The anchor around a pressed spot: the hit radius's square (the card goes beside it). */
const ANCHOR_PX = 10;

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
 * gestures.ts (tools, drags, pan, pinch); the wheel zooms about the cursor (surface.ts). The viewport is
 * also written to data attributes, so end-to-end tests can aim at world coordinates.
 */
/**
 * Draws each frame: the display list with hover and selection halos, then the active tool's
 * preview at the cursor; returns the cursor and its setter for the pointer handlers.
 */
function useFrame(props: BoardProps, display: DisplayList | null) {
  const { canvasRef, store, hover, selection, toolState, highlight } = props;
  const selected = useMemo(() => new Set(selection), [selection]);
  const ringed = useMemo(() => new Set(highlight), [highlight]);
  const fonts = useLabelFace();
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const preview = usePreview(store, display, cursor, toolState);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (display === null || ctx === null || ctx === undefined) return;
    const ui: UiState = { hover, selection: selected, highlight: ringed };
    drawDisplay(ctx, display, ui, LIGHT_THEME, window.devicePixelRatio);
    if (preview !== null) drawPreview(ctx, preview, LIGHT_THEME, window.devicePixelRatio);
  }, [canvasRef, display, hover, selected, ringed, fonts, preview]);
  return { cursor, setCursor };
}

/**
 * How the canvas measures label runs (the renderer's own measure, ADR-0049), so a press is
 * on a label exactly where it is drawn; the scene's estimate without a 2D context.
 */
function labelMetrics(canvas: HTMLCanvasElement | null): LabelMetrics {
  const ctx = canvas?.getContext('2d');
  return ctx === null || ctx === undefined
    ? ESTIMATED_METRICS
    : { width: measuredWidth(ctx, LIGHT_THEME), px: LIGHT_THEME.fontSize };
}

/**
 * The pointer gestures, with the long press of touch (ADR-0029): it opens the style card of
 * the object under the finger (or of the label under it, ADR-0049), as a right-click does.
 */
function useGestures(props: BoardProps): Gestures {
  const { store, canvasRef } = props;
  const onStyle = useRef(props.onStyle);
  onStyle.current = props.onStyle;
  return useMemo(() => {
    const metrics = () => labelMetrics(canvasRef.current);
    const hold: Hold = {
      schedule: timeout,
      onHold: (q, display) => {
        const id = pressedObject(display, q, metrics());
        const r = canvasRef.current?.getBoundingClientRect();
        if (id !== undefined && r !== undefined)
          onStyle.current(id, around(r.left + q.x, r.top + q.y, ANCHOR_PX));
      },
    };
    return new Gestures(store, hold, metrics);
  }, [store, canvasRef]);
}

export function Board(props: BoardProps) {
  const { canvasRef, store, scene, viewport, onSize, onUndrawable, onStyle } = props;
  const gestures = useGestures(props);
  const size = useSurface(canvasRef, onSize);
  useWheelZoom(canvasRef, store, size);
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
      // Focusable from code only: the focus returns here after an example is chosen.
      tabIndex={-1}
      data-cx={viewport.cx}
      data-cy={viewport.cy}
      data-zoom={viewport.zoom}
      onPointerDown={(e) => {
        // The right button opens the style card (contextmenu below): no press, no click.
        if (display === null || (e.pointerType === 'mouse' && e.button === 2)) return;
        // Leave a focused field first, so its blur (the text panel applies its draft) comes
        // before the press starts a drag, which would refuse the text (Run 10 audit).
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused !== e.currentTarget) focused.blur();
        e.currentTarget.setPointerCapture(e.pointerId);
        gestures.down(e.pointerId, local(e), display, e.pointerType !== 'mouse');
      }}
      onContextMenu={(e) => {
        // No browser menu on the canvas; on an object or its label, its style card (ADR-0029).
        e.preventDefault();
        if (display === null) return;
        const id = pressedObject(display, local(e), labelMetrics(canvasRef.current));
        if (id === undefined) return;
        gestures.endPress();
        onStyle(id, around(e.clientX, e.clientY, ANCHOR_PX));
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
    />
  );
}
