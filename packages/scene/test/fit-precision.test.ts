/**
 * fitViewport on a figure whose extent is only rounding noise. The nightly's label law
 * (run 42206353891 on main) generated Z' = (18.2, 0.5) and Z = homothety(Z', Z', 17.5): the
 * scene's bounds were 3.6·10⁻¹⁵ wide (two floats of one point), the fit zoomed to about
 * 5·10¹⁶ and the page said "Not drawn: zoomed in beyond the precision of the coordinates".
 * An extent the coordinates cannot resolve is one point: the default zoom, as for zero extent.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEWPORT, fitViewport, viewProblem } from '../src/viewport';

const size = { width: 640, height: 480 };

describe('fitViewport: an extent below the coordinates’ precision is one point', () => {
  it('the nightly case: a box one ulp wide at x = 18.2 is drawable, at the default zoom', () => {
    const b = { minX: 18.19999999999999, maxX: 18.2, minY: 0.5, maxY: 0.5 };
    const v = fitViewport(b, size, 40);
    expect(viewProblem({ viewport: v, size })).toBeUndefined();
    expect(v.zoom).toBe(DEFAULT_VIEWPORT.zoom);
  });

  it('a box a few ulps wide anywhere fits to a drawable view', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.integer({ min: 1, max: 8 }),
        (x, y, k) => {
          const dx = k * Number.EPSILON * Math.max(1, Math.abs(x));
          const b = { minX: x, maxX: x + dx, minY: y, maxY: y };
          expect(viewProblem({ viewport: fitViewport(b, size, 40), size })).toBeUndefined();
        },
      ),
    );
  });

  it('a small box the coordinates do resolve is still fitted (not the default zoom)', () => {
    const v = fitViewport({ minX: 18.2, maxX: 18.2 + 1e-6, minY: 0.5, maxY: 0.5 }, size, 40);
    expect(v.zoom).toBeGreaterThan(1e8);
    expect(viewProblem({ viewport: v, size })).toBeUndefined();
  });
});
