/**
 * The viewport (SPEC §13): the ONLY place where world coordinates (y up) and screen
 * coordinates (CSS pixels, y down, origin at the top-left corner) meet. A View is the
 * document's Viewport { cx, cy, zoom } (zoom = pixels per world unit) plus the size of the
 * drawing surface in CSS pixels; the device pixel ratio is the renderer's (HiDPI), never
 * the scene's.
 *
 * Totality: every function here is total on finite input. A View that cannot be drawn
 * faithfully (non-finite numbers, zoom ≤ 0, an empty surface, a world rectangle beyond the
 * double range, or a zoom so deep that one pixel is less than PIXEL_ULPS units in the last
 * place of the coordinates) has a `viewProblem`; the layout of such a view is empty and
 * carries the reason, so nothing is ever drawn from garbage coordinates.
 */
import type { Viewport } from '@geomira/kernel/document';

export type { Viewport } from '@geomira/kernel/document';

/** A position or displacement: world (y up) or screen (CSS px, y down), as the name says. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  /** CSS pixels, > 0. */
  readonly width: number;
  readonly height: number;
}

export interface View {
  readonly viewport: Viewport;
  readonly size: Size;
}

/** An axis-aligned rectangle (world or screen). */
export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The viewport of a document without one, before fitting: the origin at 50 px per unit. */
export const DEFAULT_VIEWPORT: Viewport = Object.freeze({ cx: 0, cy: 0, zoom: 50 });

/** Largest drawing surface side in CSS pixels (far beyond any screen; bounds every layout). */
export const MAX_SURFACE = 1 << 16;

/**
 * One pixel must span at least this many units in the last place of the view's largest
 * coordinate, so that screen positions are exact to 1/256 px (a precision bound of the
 * mapping, not a geometric tolerance).
 */
export const PIXEL_ULPS = 256;

/** Pixels per world unit is clamped to [MIN_ZOOM, MAX_ZOOM] by the pan/zoom helpers. */
export const MIN_ZOOM = 2 ** -600;
export const MAX_ZOOM = 2 ** 600;

function finite(...xs: readonly number[]): boolean {
  return xs.every((x) => Number.isFinite(x));
}

/** Half the visible width and height in world units (may overflow: see viewProblem). */
function halfExtent(view: View): Vec2 {
  return {
    x: view.size.width / 2 / view.viewport.zoom,
    y: view.size.height / 2 / view.viewport.zoom,
  };
}

/**
 * Why `view` cannot be drawn, or undefined. Degenerate cases: a non-finite centre or zoom,
 * zoom ≤ 0, a size that is not in (0, MAX_SURFACE], a world rectangle whose bounds
 * overflow, and a zoom deeper than the coordinates' precision (PIXEL_ULPS).
 */
export function viewProblem(view: View): string | undefined {
  const { cx, cy, zoom } = view.viewport;
  const { width, height } = view.size;
  if (!finite(cx, cy, zoom) || !(zoom > 0))
    return 'the viewport needs a finite centre and zoom > 0';
  if (!(width > 0 && height > 0 && width <= MAX_SURFACE && height <= MAX_SURFACE))
    return `the drawing surface must be between 0 and ${String(MAX_SURFACE)} pixels`;
  const h = halfExtent(view);
  const r = worldRect(view, 0);
  if (!finite(h.x, h.y, r.minX, r.maxX, r.minY, r.maxY))
    return 'the visible region exceeds the range of double precision';
  const magnitude = Math.max(Math.abs(cx), Math.abs(cy), h.x, h.y);
  if (Number.EPSILON * magnitude * zoom * PIXEL_ULPS > 1)
    return 'zoomed in beyond the precision of the coordinates';
  return undefined;
}

/** World → screen. */
export function toScreen(view: View, p: Vec2): Vec2 {
  const { cx, cy, zoom } = view.viewport;
  return {
    x: (p.x - cx) * zoom + view.size.width / 2,
    y: view.size.height / 2 - (p.y - cy) * zoom,
  };
}

/** Screen → world. */
export function toWorld(view: View, s: Vec2): Vec2 {
  const { cx, cy, zoom } = view.viewport;
  return {
    x: cx + (s.x - view.size.width / 2) / zoom,
    y: cy - (s.y - view.size.height / 2) / zoom,
  };
}

/** The visible world rectangle, grown by `marginPx` screen pixels on every side. */
export function worldRect(view: View, marginPx: number): Rect {
  const h = halfExtent(view);
  const m = marginPx / view.viewport.zoom;
  const { cx, cy } = view.viewport;
  return { minX: cx - h.x - m, maxX: cx + h.x + m, minY: cy - h.y - m, maxY: cy + h.y + m };
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The viewport after dragging the picture by (dx, dy) screen pixels. */
export function panViewport(vp: Viewport, dx: number, dy: number): Viewport {
  return { cx: vp.cx - dx / vp.zoom, cy: vp.cy + dy / vp.zoom, zoom: vp.zoom };
}

/**
 * The viewport after zooming by `factor` (> 1 zooms in) about the screen point `at`, which
 * keeps its world position. The zoom is clamped to [MIN_ZOOM, MAX_ZOOM]; a non-finite or
 * non-positive factor leaves the viewport unchanged.
 */
export function zoomViewport(view: View, at: Vec2, factor: number): Viewport {
  if (!(factor > 0) || !Number.isFinite(factor)) return view.viewport;
  const zoom = clampZoom(view.viewport.zoom * factor);
  const w = toWorld(view, at);
  const k = view.viewport.zoom / zoom;
  return {
    cx: w.x + (view.viewport.cx - w.x) * k,
    cy: w.y + (view.viewport.cy - w.y) * k,
    zoom,
  };
}

/**
 * The viewport that shows `bounds` (world) inside `size` with `marginPx` pixels to spare on
 * every side. Degenerate cases: no bounds → DEFAULT_VIEWPORT; a single point (zero extent)
 * → that point at the default zoom; a margin that leaves no room → the margin is ignored;
 * bounds too large or too small for the zoom range → the zoom is clamped. The result always
 * has a finite centre and a zoom in [MIN_ZOOM, MAX_ZOOM].
 */
export function fitViewport(bounds: Rect | null, size: Size, marginPx: number): Viewport {
  if (bounds === null || !finite(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY))
    return DEFAULT_VIEWPORT;
  const cx = bounds.minX / 2 + bounds.maxX / 2;
  const cy = bounds.minY / 2 + bounds.maxY / 2;
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  const roomW = size.width > 2 * marginPx ? size.width - 2 * marginPx : size.width;
  const roomH = size.height > 2 * marginPx ? size.height - 2 * marginPx : size.height;
  const zx = bw > 0 ? roomW / bw : Infinity;
  const zy = bh > 0 ? roomH / bh : Infinity;
  const z = Math.min(zx, zy);
  // z = ∞: zero extent (one point); z = 0: an extent that overflows the double range.
  const zoom = Number.isFinite(z) ? clampZoom(z) : DEFAULT_VIEWPORT.zoom;
  return { cx, cy, zoom };
}
