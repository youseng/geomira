/**
 * The canvas as a surface (host code): its pixel size follows its CSS size times the
 * devicePixelRatio, also when the ratio changes (a window moved to another screen, a browser
 * zoom: ADR-0028), and the wheel zooms about the cursor, in the wheel's own unit, with the
 * page's own zoom prevented (a trackpad pinch is a ctrl+wheel: ADR-0028).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
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

/** What watchPixelRatio needs of the window. */
export interface RatioSource {
  readonly devicePixelRatio: number;
  matchMedia(query: string): {
    addEventListener(type: 'change', f: () => void): void;
    removeEventListener(type: 'change', f: () => void): void;
  };
}

/**
 * Calls `onChange` whenever the devicePixelRatio changes (a resolution media query on the
 * current ratio, renewed after each change); returns the unsubscribe.
 */
export function watchPixelRatio(win: RatioSource, onChange: () => void): () => void {
  const at = () => win.matchMedia(`(resolution: ${String(win.devicePixelRatio)}dppx)`);
  let query = at();
  const changed = () => {
    query.removeEventListener('change', changed);
    query = at();
    query.addEventListener('change', changed);
    onChange();
  };
  query.addEventListener('change', changed);
  return () => {
    query.removeEventListener('change', changed);
  };
}

/** The canvas's CSS size, kept in sync with its box; its pixel size is css × dpr (HiDPI). */
export function useSurface(
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
    // A new ratio (another screen, a browser zoom) needs new pixels, and a redraw.
    const unwatch = watchPixelRatio(window, resize);
    return () => {
      observer.disconnect();
      unwatch();
    };
  }, [canvasRef, onSize]);
  return size;
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
