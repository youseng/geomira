/**
 * Screen paths of the display values (ADR-0011), internal to the layout. Marks have a fixed
 * size in CSS pixels whatever the zoom (a mark is a sign on the figure, not a length of it):
 * the arcs of an angle mark have radii MARK_RADIUS + k·MARK_GAP, the right-angle square has
 * side RIGHT_SIDE, and ticks are TICK_LENGTH long and TICK_GAP apart. A mark is laid out when
 * its anchor (the vertex, the segment's middle) lies in the clipping rectangle shrunk by
 * MARK_EXTENT, so every coordinate stays within the layout's margin of the surface (L9).
 * A text's path is a dot of radius 0 at its anchor: the handle that hit-testing finds within
 * the pick radius; the text itself is the item's label.
 */
import { assertNever } from '@geomira/num/assert';
import { inside } from './clip';
import type { Path, Shape } from './types';
import { toScreen, type Rect, type Vec2, type View } from './viewport';

export const MARK_RADIUS = 14;
export const MARK_GAP = 4;
export const RIGHT_SIDE = 11;
export const TICK_LENGTH = 10;
export const TICK_GAP = 4;

/** How far a mark reaches from its anchor, px (the outermost arc; ticks are shorter). */
export const MARK_EXTENT = MARK_RADIUS + 2 * MARK_GAP;

function shrink(r: Rect, view: View): Rect {
  const m = MARK_EXTENT / view.viewport.zoom;
  return { minX: r.minX + m, maxX: r.maxX - m, minY: r.minY + m, maxY: r.maxY - m };
}

function along(c: Vec2, u: Vec2, t: number): Vec2 {
  return { x: c.x + t * u.x, y: c.y + t * u.y };
}

/** A screen direction (y down) of the world angle a. */
function screenDir(a: number): Vec2 {
  return { x: Math.cos(a), y: -Math.sin(a) };
}

function angleMarkPaths(view: View, s: Extract<Shape, { kind: 'angle_mark' }>, rect: Rect): Path[] {
  if (!inside(shrink(rect, view), s.b)) return [];
  const c = toScreen(view, s.b);
  if (s.right) {
    const [u, v] = [screenDir(s.from), screenDir(s.to)];
    const corner = along(along(c, u, RIGHT_SIDE), v, RIGHT_SIDE);
    return [
      {
        kind: 'poly',
        pts: [along(c, u, RIGHT_SIDE), corner, along(c, v, RIGHT_SIDE)],
        closed: false,
      },
    ];
  }
  const out: Path[] = [];
  for (let k = 0; k < s.arcs; k++)
    out.push({ kind: 'arc', c, r: MARK_RADIUS + k * MARK_GAP, from: s.from, to: s.to });
  return out;
}

function segmentMarkPaths(
  view: View,
  s: Extract<Shape, { kind: 'segment_mark' }>,
  rect: Rect,
): Path[] {
  const mid = { x: (s.p.x + s.q.x) / 2, y: (s.p.y + s.q.y) / 2 };
  const d = { x: s.q.x - s.p.x, y: s.p.y - s.q.y };
  const n = Math.hypot(d.x, d.y);
  if (!inside(shrink(rect, view), mid) || !(n > 0) || !Number.isFinite(n)) return [];
  const u = { x: d.x / n, y: d.y / n };
  const normal = { x: -u.y, y: u.x };
  const c = toScreen(view, mid);
  const out: Path[] = [];
  for (let k = 0; k < s.ticks; k++) {
    const at = along(c, u, (k - (s.ticks - 1) / 2) * TICK_GAP);
    out.push({
      kind: 'poly',
      pts: [along(at, normal, -TICK_LENGTH / 2), along(at, normal, TICK_LENGTH / 2)],
      closed: false,
    });
  }
  return out;
}

/** The paths of a display value's shape (other shapes: none; display.ts lays them out). */
export function markPaths(view: View, s: Shape, rect: Rect): Path[] {
  switch (s.kind) {
    case 'angle_mark':
      return angleMarkPaths(view, s, rect);
    case 'segment_mark':
      return segmentMarkPaths(view, s, rect);
    case 'text':
      return inside(rect, s.at) ? [{ kind: 'dot', c: toScreen(view, s.at), r: 0 }] : [];
    case 'point':
    case 'line':
    case 'circle':
    case 'polygon':
      return [];
    default:
      return assertNever(s, 'shape');
  }
}
