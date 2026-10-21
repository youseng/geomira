/**
 * Hit-testing (SPEC §13, law L8) on the DisplayList, the very paths the renderer draws:
 * an item is hit when the cursor is within `radius` px of one of its stroked paths (plus
 * half its stroke width), within its dot, or inside its polygon fill. Hits are listed top
 * first (the reverse of the draw order). Nothing that is not drawn can be hit: coincident
 * images, hidden objects, Undefined values and off-surface parts have no paths.
 *
 * VIRTUAL hits say what the cursor would make if no point is under it (for the editor's
 * tools; marks are not curves here, ADR-0011): the intersection of two drawn curves within `radius` of the cursor (the nearest
 * one), else the nearest point of the topmost curve under the cursor (a point on it),
 * else a free position. Each carries its screen and world position. The virtual hit is
 * 'none' when a point is hit (the point itself is the target) and when the view has a
 * problem (no hits then: its world positions would not be finite).
 */
import { geometryOf, intersections, nearestOn, pathDistance, type Piece } from './hit-geom';
import type { DisplayItem, DisplayList } from './display';
import type { ShapeKind } from './types';
import { toWorld, type Vec2 } from './viewport';

/** Default pick radius around the cursor, CSS px. */
export const HIT_RADIUS = 6;

/** At most this many curves under the cursor are intersected pairwise. */
const MAX_VIRTUAL_CURVES = 8;

/** Kinds whose strokes are figure curves (marks are signs, not curves to construct on). */
const CURVE_KINDS: readonly ShapeKind[] = ['line', 'circle', 'polygon'];

export interface Hit {
  readonly id: number;
  readonly name: string;
  readonly kind: ShapeKind;
  /** What was hit: a point's dot, a stroked curve or edge, or a polygon's interior. */
  readonly part: 'point' | 'curve' | 'fill';
  /** Distance from the cursor to the hit geometry, px (0 inside a dot or fill). */
  readonly distance: number;
}

export type VirtualHit =
  | {
      readonly kind: 'intersection';
      readonly a: number;
      readonly b: number;
      readonly at: Vec2;
      readonly world: Vec2;
    }
  | { readonly kind: 'on'; readonly curve: number; readonly at: Vec2; readonly world: Vec2 }
  | { readonly kind: 'free'; readonly at: Vec2; readonly world: Vec2 }
  | { readonly kind: 'none' };

export interface HitResult {
  readonly hits: readonly Hit[];
  readonly virtual: VirtualHit;
}

/** Inside by the nonzero winding rule, the canvas's default fill rule. */
function insidePolygon(pts: readonly Vec2[], q: Vec2): boolean {
  let winding = 0;
  for (const [i, a] of pts.entries()) {
    const b = pts[(i + 1) % pts.length] ?? a;
    const side = (b.x - a.x) * (q.y - a.y) - (q.x - a.x) * (b.y - a.y);
    if (a.y <= q.y && b.y > q.y && side > 0) winding++;
    else if (a.y > q.y && b.y <= q.y && side < 0) winding--;
  }
  return winding !== 0;
}

/** The hit of one item, or undefined. */
export function hitItem(item: DisplayItem, q: Vec2, radius: number): Hit | undefined {
  let best: Hit | undefined;
  const consider = (part: Hit['part'], distance: number) => {
    if (best === undefined || distance < best.distance)
      best = { id: item.id, name: item.name, kind: item.kind, part, distance };
  };
  for (const p of item.paths) {
    const d = pathDistance(p, q);
    if (p.kind === 'dot') {
      if (d <= radius) consider('point', d);
    } else if (d <= radius + item.style.width / 2) consider('curve', d);
  }
  if (item.fill !== null && best === undefined && insidePolygon(item.fill, q)) consider('fill', 0);
  return best;
}

function curvePieces(items: readonly DisplayItem[], ids: readonly number[]): Piece[][] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids.map((id) => (byId.get(id)?.paths ?? []).flatMap((p) => geometryOf(id, p)));
}

function virtualHit(display: DisplayList, hits: readonly Hit[], q: Vec2, radius: number) {
  const at = (p: Vec2) => ({ at: p, world: toWorld(display.view, p) });
  const curves = hits
    .filter((h) => h.part === 'curve' && CURVE_KINDS.includes(h.kind))
    .slice(0, MAX_VIRTUAL_CURVES);
  const pieces = curvePieces(
    display.items,
    curves.map((h) => h.id),
  );
  let best: { a: number; b: number; p: Vec2; d: number } | undefined;
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++)
      for (const x of intersections(pieces[i] ?? [], pieces[j] ?? [])) {
        const d = Math.hypot(x.p.x - q.x, x.p.y - q.y);
        if (d <= radius && (best === undefined || d < best.d)) best = { ...x, d };
      }
  if (best !== undefined)
    return { kind: 'intersection' as const, a: best.a, b: best.b, ...at(best.p) };
  const top = pieces[0];
  const on = top === undefined ? undefined : nearestOn(top, q);
  const first = curves[0];
  if (on !== undefined && first !== undefined)
    return { kind: 'on' as const, curve: first.id, ...at(on) };
  return { kind: 'free' as const, ...at(q) };
}

/** What the cursor at `q` (screen px) hits in `display` (see the module comment). */
export function hitTest(display: DisplayList, q: Vec2, radius: number = HIT_RADIUS): HitResult {
  if (display.problem !== null || !Number.isFinite(q.x) || !Number.isFinite(q.y))
    return { hits: [], virtual: { kind: 'none' } };
  const hits: Hit[] = [];
  for (let i = display.items.length - 1; i >= 0; i--) {
    const item = display.items[i];
    const h = item === undefined ? undefined : hitItem(item, q, radius);
    if (h !== undefined) hits.push(h);
  }
  const virtual: VirtualHit = hits.some((h) => h.part === 'point')
    ? { kind: 'none' }
    : virtualHit(display, hits, q, radius);
  return { hits, virtual };
}
