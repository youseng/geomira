/**
 * Bug-fix round (ADR-0028): the wheel zoomed by deltaY in pixels whatever its unit, and a
 * trackpad pinch (a ctrl+wheel) also zoomed the whole page, because React's onWheel is
 * passive and cannot preventDefault. The zoom now reads deltaMode (pixels, lines, pages); the
 * canvas's own non-passive listener is checked in e2e/flows-review.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import { WHEEL_LINE_PX, WHEEL_PAGE_PX, wheelFactor } from '../src/surface';

describe('wheel zoom factor', () => {
  it('one notch (100 px) zooms by 1.15, either way', () => {
    expect(wheelFactor(-100, 0)).toBeCloseTo(1.15, 12);
    expect(wheelFactor(100, 0)).toBeCloseTo(1 / 1.15, 12);
    expect(wheelFactor(0, 0)).toBe(1);
  });

  it('lines and pages are scaled to pixels', () => {
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-3 * WHEEL_LINE_PX, 0), 12);
    expect(wheelFactor(1, 2)).toBeCloseTo(wheelFactor(WHEEL_PAGE_PX, 0), 12);
    // Three lines is about one notch, not a 0.4 % step.
    expect(wheelFactor(-3, 1)).toBeGreaterThan(1.1);
  });

  it('is always finite and positive, even for huge deltas or an unknown mode', () => {
    for (const [d, m] of [
      [1e9, 0],
      [-1e9, 2],
      [5, 7],
    ] as const) {
      const f = wheelFactor(d, m);
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThan(0);
    }
  });
});
