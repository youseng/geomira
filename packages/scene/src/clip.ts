/**
 * Clipping to a world rectangle (SPEC §13). The layout clips every shape to the visible
 * world rectangle grown by a margin BEFORE mapping it to the screen, so screen coordinates
 * stay within a few thousand pixels whatever the figure's scale (law L9): no canvas call
 * ever sees a huge or non-finite number.
 *
 * Total on finite input. Degenerate cases: a line whose clipped ends overflow (a carrier
 * ~1e308 away) is not visible; an empty parameter range (lo > hi) is not visible; a circle
 * whose crossing points cannot be computed is treated by its bounding box (fully inside →
 * full, disjoint → none); a polygon clipped to nothing is not visible.
 */
import type { Rect, Vec2 } from './viewport';

const TAU = 2 * Math.PI;

function finite(v: Vec2): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y);
}

export function inside(r: Rect, p: Vec2): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
}

/** The parameter interval of p + t·u inside [lo, hi] on one axis's slab. */
function slab(
  p: number,
  u: number,
  min: number,
  max: number,
  t: [number, number],
): [number, number] {
  if (u === 0) return p >= min && p <= max ? t : [1, 0];
  const a = (min - p) / u;
  const b = (max - p) / u;
  return [Math.max(t[0], Math.min(a, b)), Math.min(t[1], Math.max(a, b))];
}

/**
 * The visible part of the line p + t·u, t in [lo, hi] (null = unbounded; u a unit vector),
 * as its two ends, or null when nothing of it is inside `r`.
 */
export function clipLine(
  p: Vec2,
  u: Vec2,
  lo: number | null,
  hi: number | null,
  r: Rect,
): [Vec2, Vec2] | null {
  let t: [number, number] = [lo ?? -Infinity, hi ?? Infinity];
  t = slab(p.x, u.x, r.minX, r.maxX, t);
  t = slab(p.y, u.y, r.minY, r.maxY, t);
  if (!(t[0] <= t[1])) return null;
  const a = { x: p.x + t[0] * u.x, y: p.y + t[0] * u.y };
  const b = { x: p.x + t[1] * u.x, y: p.y + t[1] * u.y };
  return finite(a) && finite(b) ? [a, b] : null;
}

/** An angle in [0, 2π). */
export function wrap(a: number): number {
  const w = a % TAU;
  return w < 0 ? w + TAU : w;
}

/** A counter-clockwise angular span [from, to], from in [0, 2π), from < to ≤ from + 2π. */
export interface Span {
  readonly from: number;
  readonly to: number;
}

export type CircleClip =
  { readonly kind: 'none' } | { readonly kind: 'spans'; readonly spans: readonly Span[] };

const FULL: Span = { from: 0, to: TAU };

/** The angles at which the circle crosses the rectangle's edges. */
function crossings(c: Vec2, radius: number, r: Rect): number[] {
  const out: number[] = [];
  const edge = (offset: number, lo: number, hi: number, along: number, vertical: boolean) => {
    const q = offset / radius;
    if (!(Math.abs(q) < 1)) return;
    const h = radius * Math.sqrt((1 - q) * (1 + q));
    for (const s of [h, -h]) {
      const pos = along + s;
      if (pos < lo || pos > hi) continue;
      out.push(wrap(vertical ? Math.atan2(s, offset) : Math.atan2(offset, s)));
    }
  };
  edge(r.minX - c.x, r.minY, r.maxY, c.y, true);
  edge(r.maxX - c.x, r.minY, r.maxY, c.y, true);
  edge(r.minY - c.y, r.minX, r.maxX, c.x, false);
  edge(r.maxY - c.y, r.minX, r.maxX, c.x, false);
  return out.filter((a) => Number.isFinite(a)).sort((a, b) => a - b);
}

function pointAt(c: Vec2, radius: number, a: number): Vec2 {
  return { x: c.x + radius * Math.cos(a), y: c.y + radius * Math.sin(a) };
}

/** The visible spans of the full circle (c, radius) in `r`. */
function visibleSpans(c: Vec2, radius: number, r: Rect): Span[] {
  const box = { minX: c.x - radius, maxX: c.x + radius, minY: c.y - radius, maxY: c.y + radius };
  if (box.maxX < r.minX || box.minX > r.maxX || box.maxY < r.minY || box.minY > r.maxY) return [];
  if (box.minX >= r.minX && box.maxX <= r.maxX && box.minY >= r.minY && box.maxY <= r.maxY)
    return [FULL];
  const xs = crossings(c, radius, r);
  if (xs.length === 0) return inside(r, pointAt(c, radius, 0)) ? [FULL] : [];
  const spans: Span[] = [];
  for (const [i, a] of xs.entries()) {
    const b = i + 1 < xs.length ? (xs[i + 1] ?? a) : (xs[0] ?? a) + TAU;
    if (b - a > 0 && inside(r, pointAt(c, radius, (a + b) / 2))) spans.push({ from: a, to: b });
  }
  return spans;
}

/** The common part of two spans (zero, one or two spans). */
export function intersectSpans(s: Span, t: Span): Span[] {
  const out: Span[] = [];
  for (const shift of [-TAU, 0, TAU]) {
    const from = Math.max(s.from, t.from + shift);
    const to = Math.min(s.to, t.to + shift);
    if (to > from) out.push({ from, to });
  }
  return out;
}

/**
 * The visible part of a circle, or of its counter-clockwise arc from angle `arc.from` to
 * `arc.to` (an arc whose ends coincide is the full circle), as counter-clockwise spans.
 */
export function clipCircle(
  c: Vec2,
  radius: number,
  arc: { readonly from: number; readonly to: number } | null,
  r: Rect,
): CircleClip {
  const spans = visibleSpans(c, radius, r);
  const own: Span =
    arc === null
      ? FULL
      : (() => {
          const from = wrap(arc.from);
          const len = wrap(arc.to - arc.from);
          return { from, to: from + (len === 0 ? TAU : len) };
        })();
  const out = arc === null ? spans : spans.flatMap((s) => intersectSpans(s, own));
  return out.length === 0 ? { kind: 'none' } : { kind: 'spans', spans: out };
}

/** The polygon clipped to `r` (Sutherland–Hodgman); fewer than 3 vertices → []. */
export function clipPolygon(pts: readonly Vec2[], r: Rect): Vec2[] {
  type Edge = { readonly keep: (p: Vec2) => boolean; readonly cut: (a: Vec2, b: Vec2) => Vec2 };
  const lerpX = (x: number) => (a: Vec2, b: Vec2) => ({
    x,
    y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x),
  });
  const lerpY = (y: number) => (a: Vec2, b: Vec2) => ({
    x: a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y),
    y,
  });
  const edges: Edge[] = [
    { keep: (p) => p.x >= r.minX, cut: lerpX(r.minX) },
    { keep: (p) => p.x <= r.maxX, cut: lerpX(r.maxX) },
    { keep: (p) => p.y >= r.minY, cut: lerpY(r.minY) },
    { keep: (p) => p.y <= r.maxY, cut: lerpY(r.maxY) },
  ];
  let poly: Vec2[] = [...pts];
  for (const e of edges) {
    const next: Vec2[] = [];
    for (const [i, b] of poly.entries()) {
      const a = poly[(i + poly.length - 1) % poly.length] ?? b;
      if (e.keep(b)) {
        if (!e.keep(a)) next.push(e.cut(a, b));
        next.push(b);
      } else if (e.keep(a)) next.push(e.cut(a, b));
    }
    poly = next;
  }
  return poly.length >= 3 && poly.every(finite) ? poly : [];
}
