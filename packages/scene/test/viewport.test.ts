import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  fitViewport,
  panViewport,
  toScreen,
  toWorld,
  viewProblem,
  worldRect,
  zoomViewport,
  type View,
} from '../src/viewport';

const view: View = { viewport: { cx: 1, cy: 2, zoom: 50 }, size: { width: 800, height: 600 } };

describe('viewport: world (y up) ↔ screen (y down)', () => {
  it('the centre maps to the middle of the surface and y is flipped', () => {
    expect(toScreen(view, { x: 1, y: 2 })).toEqual({ x: 400, y: 300 });
    expect(toScreen(view, { x: 2, y: 3 })).toEqual({ x: 450, y: 250 });
    expect(toWorld(view, { x: 0, y: 0 })).toEqual({ x: -7, y: 8 });
  });

  it('toWorld ∘ toScreen = id (to rounding)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        (x, y) => {
          const w = toWorld(view, toScreen(view, { x, y }));
          expect(Math.abs(w.x - x)).toBeLessThanOrEqual(1e-9 * (1 + Math.abs(x)));
          expect(Math.abs(w.y - y)).toBeLessThanOrEqual(1e-9 * (1 + Math.abs(y)));
        },
      ),
    );
  });

  it('worldRect is the visible region (with margin)', () => {
    expect(worldRect(view, 0)).toEqual({ minX: -7, maxX: 9, minY: -4, maxY: 8 });
    expect(worldRect(view, 50)).toEqual({ minX: -8, maxX: 10, minY: -5, maxY: 9 });
  });

  it('pan moves the picture with the cursor; zoom keeps the anchor fixed', () => {
    const panned = { ...view, viewport: panViewport(view.viewport, 50, 50) };
    expect(toScreen(panned, { x: 1, y: 2 })).toEqual({ x: 450, y: 350 });
    const at = { x: 123, y: 456 };
    const w = toWorld(view, at);
    const z = { ...view, viewport: zoomViewport(view, at, 3) };
    expect(z.viewport.zoom).toBe(150);
    const back = toScreen(z, w);
    expect(back.x).toBeCloseTo(at.x, 9);
    expect(back.y).toBeCloseTo(at.y, 9);
  });

  it('zoom is clamped; a bad factor changes nothing', () => {
    expect(zoomViewport(view, { x: 0, y: 0 }, Infinity)).toBe(view.viewport);
    expect(zoomViewport(view, { x: 0, y: 0 }, 0)).toBe(view.viewport);
    expect(zoomViewport(view, { x: 0, y: 0 }, Number.NaN)).toBe(view.viewport);
    expect(zoomViewport(view, { x: 400, y: 300 }, 2 ** 700).zoom).toBe(MAX_ZOOM);
    expect(zoomViewport(view, { x: 400, y: 300 }, 2 ** -700).zoom).toBe(MIN_ZOOM);
  });
});

describe('viewProblem: views that cannot be drawn faithfully', () => {
  const vp = (cx: number, cy: number, zoom: number, w = 800, h = 600): View => ({
    viewport: { cx, cy, zoom },
    size: { width: w, height: h },
  });

  it('accepts ordinary views', () => {
    expect(viewProblem(view)).toBeUndefined();
    expect(viewProblem(vp(0, 0, MIN_ZOOM))).toBeUndefined();
    expect(viewProblem(vp(0, 0, MAX_ZOOM))).toBeUndefined();
  });

  it('refuses non-finite numbers, zoom ≤ 0, empty or huge surfaces', () => {
    expect(viewProblem(vp(Number.NaN, 0, 1))).toMatch(/finite/);
    expect(viewProblem(vp(0, Infinity, 1))).toMatch(/finite/);
    expect(viewProblem(vp(0, 0, 0))).toMatch(/zoom > 0/);
    expect(viewProblem(vp(0, 0, -1))).toMatch(/zoom > 0/);
    expect(viewProblem(vp(0, 0, 1, 0, 600))).toMatch(/surface/);
    expect(viewProblem(vp(0, 0, 1, 800, 1e9))).toMatch(/surface/);
  });

  it('refuses a visible region beyond the double range and a zoom beyond the precision', () => {
    expect(viewProblem(vp(0, 0, Number.MIN_VALUE))).toMatch(/double precision/);
    expect(viewProblem(vp(1e300, 0, 1e-10))).toMatch(/precision/);
    expect(viewProblem(vp(1e300, 0, 1e-290))).toBeUndefined();
    expect(viewProblem(vp(1e15, 0, 1e6))).toMatch(/precision/);
    expect(viewProblem(vp(1, 0, 1e6))).toBeUndefined();
  });
});

describe('fitViewport', () => {
  const size = { width: 800, height: 600 };

  it('shows the bounds inside the margin, centred', () => {
    const v = fitViewport({ minX: -1, minY: -1, maxX: 3, maxY: 1 }, size, 50);
    expect(v).toEqual({ cx: 1, cy: 0, zoom: 175 });
  });

  it('degenerate bounds: none, a point, an overflowing extent, a margin with no room', () => {
    expect(fitViewport(null, size, 10)).toBe(DEFAULT_VIEWPORT);
    expect(fitViewport({ minX: 2, minY: 3, maxX: 2, maxY: 3 }, size, 10)).toEqual({
      cx: 2,
      cy: 3,
      zoom: DEFAULT_VIEWPORT.zoom,
    });
    const huge = fitViewport(
      { minX: -Number.MAX_VALUE, minY: 0, maxX: Number.MAX_VALUE, maxY: 0 },
      size,
      10,
    );
    expect(huge).toEqual({ cx: 0, cy: 0, zoom: MIN_ZOOM });
    expect(fitViewport({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, size, 1000).zoom).toBe(600);
    expect(fitViewport({ minX: Number.NaN, minY: 0, maxX: 1, maxY: 1 }, size, 0)).toBe(
      DEFAULT_VIEWPORT,
    );
  });
});
