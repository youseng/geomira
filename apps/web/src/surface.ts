/**
 * The canvas as a surface (host code): the wheel zooms about the cursor, in the wheel's own
 * unit, with the page's own zoom prevented (a trackpad pinch is a ctrl+wheel: ADR-0028).
 */
import { useEffect, useRef, type RefObject } from 'react';
import { zoomViewport, type Size } from '@geomira/scene/viewport';
import type { EditorStore } from './store';

/** Wheel steps of 100 px (one notch) zoom by this factor. */
const WHEEL_ZOOM = 1.15;
/** A wheel line (deltaMode 1) in pixels: three lines are about one notch. */
export const WHEEL_LINE_PX = 100 / 3;
/** A wheel page (deltaMode 2) in pixels. */
export const WHEEL_PAGE_PX = 800;
/** One wheel event zooms by at most ten notches (the factor stays finite and positive). */
const WHEEL_MAX_PX = 1000;

/** The zoom factor of a wheel event's deltaY in its deltaMode (0 pixels, 1 lines, 2 pages). */
export function wheelFactor(deltaY: number, deltaMode: number): number {
  const unit = deltaMode === 1 ? WHEEL_LINE_PX : deltaMode === 2 ? WHEEL_PAGE_PX : 1;
  const px = Math.max(-WHEEL_MAX_PX, Math.min(WHEEL_MAX_PX, deltaY * unit));
  return Number.isFinite(px) ? WHEEL_ZOOM ** (-px / 100) : 1;
}

/** The wheel zooms about the cursor; a native non-passive listener, so the page does not zoom. */
export function useWheelZoom(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  store: EditorStore,
  size: Size | null,
): void {
  const sizeRef = useRef(size);
  sizeRef.current = size;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = sizeRef.current;
      if (s === null) return;
      const r = canvas.getBoundingClientRect();
      const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      const view = { viewport: store.current().viewport, size: s };
      const factor = wheelFactor(e.deltaY, e.deltaMode);
      store.apply({ kind: 'viewport', viewport: zoomViewport(view, at, factor) });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [canvasRef, store]);
}
