/** Where the style card goes (ADR-0029): next to its anchor, inside the viewport. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { around, CARD_GAP, CARD_MARGIN, placeCard, type Box } from '../src/card-place';

const card = { width: 270, height: 300 };
const desktop = { width: 1280, height: 800 };
const phone = { width: 390, height: 664 };

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function boxOf(p: { left: number; top: number }, c = card): Box {
  return { left: p.left, top: p.top, right: p.left + c.width, bottom: p.top + c.height };
}

describe('placeCard', () => {
  it('right of the anchor, top-aligned, when it fits', () => {
    expect(placeCard(around(100, 200, 8), card, desktop)).toEqual({
      left: 108 + CARD_GAP,
      top: 192,
    });
  });

  it('left of the anchor near the right edge (an Objects panel row)', () => {
    const row = { left: 1000, top: 300, right: 1270, bottom: 324 };
    expect(placeCard(row, card, desktop)).toEqual({ left: 1000 - CARD_GAP - 270, top: 300 });
  });

  it('slides up to stay inside near the bottom', () => {
    expect(placeCard(around(100, 780, 8), card, desktop).top).toBe(800 - 300 - CARD_MARGIN);
  });

  it('on a phone: below or above the anchor when neither side has room', () => {
    // Aligned with the anchor's left edge, slid left to stay inside: 390 − 270 − 6 = 114.
    expect(placeCard(around(195, 100, 8), card, phone)).toEqual({ left: 114, top: 116 });
    expect(placeCard(around(195, 600, 8), card, phone)).toEqual({
      left: 114,
      top: 592 - CARD_GAP - 300,
    });
  });

  it('degenerate: no room anywhere clamps into the viewport; non-finite input gives the corner', () => {
    const tiny = { width: 300, height: 320 };
    const p = placeCard(around(150, 160, 8), card, tiny);
    expect(p.left).toBeGreaterThanOrEqual(CARD_MARGIN);
    expect(p.top).toBeGreaterThanOrEqual(CARD_MARGIN);
    expect(placeCard(around(Number.NaN, 1, 1), card, desktop)).toEqual({
      left: CARD_MARGIN,
      top: CARD_MARGIN,
    });
  });

  it('law: inside the viewport, and off the anchor whenever the viewport has room for that', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1280 }),
        fc.integer({ min: 0, max: 800 }),
        fc.constantFrom(desktop, phone),
        (x, y, view) => {
          const anchor = around(x, y, 8);
          const b = boxOf(placeCard(anchor, card, view));
          expect(b.left).toBeGreaterThanOrEqual(CARD_MARGIN);
          expect(b.top).toBeGreaterThanOrEqual(CARD_MARGIN);
          expect(b.right).toBeLessThanOrEqual(view.width - CARD_MARGIN);
          expect(b.bottom).toBeLessThanOrEqual(view.height - CARD_MARGIN);
          if (x <= view.width && y <= view.height) expect(overlaps(b, anchor)).toBe(false);
        },
      ),
      { seed: 29, numRuns: 500 },
    );
  });
});
