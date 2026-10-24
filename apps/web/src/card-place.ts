/**
 * Where a floating card goes (ADR-0029): next to its anchor (the object's spot on the canvas,
 * or its row in the Objects panel) and inside the viewport. Tried in order: right of the
 * anchor, left of it, below it, above it, each aligned with the anchor and slid along that
 * edge to stay inside; when none of them fits, the card is clamped into the viewport (it may
 * then cover the anchor). Pure: CSS px, viewport coordinates, y down.
 *
 * Degenerate cases: a card larger than the viewport is placed at the margin (its top-left
 * stays visible); a non-finite anchor or size gives the margin corner.
 */

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Extent {
  readonly width: number;
  readonly height: number;
}

/** The gap between the anchor and the card, and the card's margin to the viewport's edge. */
export const CARD_GAP = 8;
export const CARD_MARGIN = 6;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function finite(...xs: number[]): boolean {
  return xs.every((x) => Number.isFinite(x));
}

/** The anchor box of a point on the screen: a square of `r` px around it. */
export function around(x: number, y: number, r: number): Box {
  return { left: x - r, top: y - r, right: x + r, bottom: y + r };
}

/** The card's top-left corner (see the module comment). */
export function placeCard(anchor: Box, card: Extent, view: Extent): { left: number; top: number } {
  const m = CARD_MARGIN;
  const g = CARD_GAP;
  const { left, top, right, bottom } = anchor;
  if (!finite(left, top, right, bottom, card.width, card.height, view.width, view.height))
    return { left: m, top: m };
  const maxLeft = Math.max(m, view.width - card.width - m);
  const maxTop = Math.max(m, view.height - card.height - m);
  const fitsX = (x: number) => x >= m && x + card.width <= view.width - m;
  const fitsY = (y: number) => y >= m && y + card.height <= view.height - m;
  const sideTop = clamp(top, m, maxTop);
  const sideFits = card.height <= view.height - 2 * m;
  if (sideFits && fitsX(right + g)) return { left: right + g, top: sideTop };
  if (sideFits && fitsX(left - g - card.width))
    return { left: left - g - card.width, top: sideTop };
  const along = clamp(left, m, maxLeft);
  const acrossFits = card.width <= view.width - 2 * m;
  if (acrossFits && fitsY(bottom + g)) return { left: along, top: bottom + g };
  if (acrossFits && fitsY(top - g - card.height))
    return { left: along, top: top - g - card.height };
  return { left: clamp(right + g, m, maxLeft), top: sideTop };
}
