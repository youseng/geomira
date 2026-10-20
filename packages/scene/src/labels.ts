/**
 * Label placement (SPEC §13 "offsets as (angle, pixels)", ADR-0010). A label sits at its
 * ANCHOR moved by its offset: `dist` pixels in the direction `angle` (degrees,
 * counter-clockwise as seen on the screen). Anchors: a point's dot; the middle of the
 * visible part of a line, segment or ray; the point of a circle at 45° if it is visible,
 * else the middle of its first visible arc; a polygon's vertex centroid. A label whose
 * anchor is off the surface is not placed.
 *
 * Automatic direction (points without `label_angle`): of the eight compass directions,
 * preferring 45°, 135°, 315°, 225°, 90°, 0°, 270°, 180° in that order, the one farthest
 * (in angle) from the directions of the drawn curves that pass within NEAR_PX of the point;
 * so labels avoid the lines through their point. Other kinds default to 45°.
 *
 * The text box is aligned away from the anchor: left-aligned when the offset points right,
 * bottom-aligned when it points up, centred in between (renderer: textAlign/textBaseline).
 */
import { clipLine } from './clip';
import type { LabelRun } from './label-text';
import type { DisplayItem, Path, Primitive, Scene } from './types';
import type { Rect, Vec2, View } from './viewport';

export interface PlacedLabel {
  readonly id: number;
  readonly runs: readonly LabelRun[];
  readonly text: string;
  /** The anchor and the label's reference point (anchor + offset), screen px. */
  readonly anchor: Vec2;
  readonly at: Vec2;
  /** The offset direction actually used, degrees in [0, 360). */
  readonly angle: number;
  readonly align: 'left' | 'center' | 'right';
  readonly baseline: 'top' | 'middle' | 'bottom';
  readonly color: string | null;
  readonly opacity: number;
}

/** Curves passing this close to a point (px) block label directions. */
export const NEAR_PX = 3;

const PREFERRED = [45, 135, 315, 225, 90, 0, 270, 180];
const TILT = Math.sin(Math.PI / 8);
const TAU = 2 * Math.PI;

function surface(view: View): Rect {
  return { minX: 0, minY: 0, maxX: view.size.width, maxY: view.size.height };
}

function onSurface(view: View, p: Vec2): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= view.size.width && p.y <= view.size.height;
}

/** Screen angle (counter-clockwise as seen) of the direction a → b, radians. */
function screenAngle(a: Vec2, b: Vec2): number {
  return Math.atan2(a.y - b.y, b.x - a.x);
}

function inSpan(a: number, from: number, to: number): boolean {
  const w = (((a - from) % TAU) + TAU) % TAU;
  return w <= to - from;
}

function arcPoint(p: Extract<Path, { kind: 'arc' }>, a: number): Vec2 {
  return { x: p.c.x + p.r * Math.cos(a), y: p.c.y - p.r * Math.sin(a) };
}

function polyMiddle(view: View, pts: readonly Vec2[]): Vec2 | undefined {
  const [a, b] = [pts[0], pts[pts.length - 1]];
  if (a === undefined || b === undefined) return undefined;
  if (pts.length > 2) return pts[Math.floor(pts.length / 2)];
  const seg = clipLine(a, { x: b.x - a.x, y: b.y - a.y }, 0, 1, surface(view));
  return seg === null ? undefined : { x: (seg[0].x + seg[1].x) / 2, y: (seg[0].y + seg[1].y) / 2 };
}

function circleAnchor(view: View, paths: readonly Path[]): Vec2 | undefined {
  for (const p of paths)
    if (p.kind === 'arc' && inSpan(Math.PI / 4, p.from, p.to)) {
      const q = arcPoint(p, Math.PI / 4);
      if (onSurface(view, q)) return q;
    }
  for (const p of paths) {
    const q =
      p.kind === 'arc'
        ? arcPoint(p, (p.from + p.to) / 2)
        : p.kind === 'poly'
          ? polyMiddle(view, p.pts)
          : p.c;
    if (q !== undefined && onSurface(view, q)) return q;
  }
  return undefined;
}

function anchorOf(view: View, item: DisplayItem): Vec2 | undefined {
  const first = item.paths[0];
  const q =
    item.kind === 'point'
      ? first?.kind === 'dot'
        ? first.c
        : undefined
      : item.kind === 'circle'
        ? circleAnchor(view, item.paths)
        : item.kind === 'polygon' && item.fill !== null
          ? centroid(item.fill)
          : first?.kind === 'poly'
            ? polyMiddle(view, first.pts)
            : undefined;
  return q !== undefined && onSurface(view, q) ? q : undefined;
}

function centroid(pts: readonly Vec2[]): Vec2 {
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

function segmentDirections(c: Vec2, a: Vec2, b: Vec2, out: number[]): void {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const len2 = d.x * d.x + d.y * d.y;
  if (!(len2 > 0)) return;
  const t = Math.max(0, Math.min(1, ((c.x - a.x) * d.x + (c.y - a.y) * d.y) / len2));
  const q = { x: a.x + t * d.x, y: a.y + t * d.y };
  if (Math.hypot(c.x - q.x, c.y - q.y) > NEAR_PX) return;
  const phi = screenAngle(a, b);
  const len = Math.sqrt(len2);
  if (t * len > NEAR_PX) out.push(phi + Math.PI);
  if ((1 - t) * len > NEAR_PX) out.push(phi);
}

/** Directions (radians) of the curves of `items` that pass within NEAR_PX of c. */
function blocked(c: Vec2, items: readonly DisplayItem[], self: number): number[] {
  const out: number[] = [];
  for (const item of items) {
    if (item.id === self || item.kind === 'point') continue;
    for (const p of item.paths) {
      if (p.kind === 'poly') {
        for (let i = 0; i + 1 < p.pts.length; i++) {
          const [a, b] = [p.pts[i], p.pts[i + 1]];
          if (a !== undefined && b !== undefined) segmentDirections(c, a, b, out);
        }
      } else if (p.kind === 'arc') {
        const a = Math.atan2(p.c.y - c.y, c.x - p.c.x);
        if (
          Math.abs(Math.hypot(c.x - p.c.x, c.y - p.c.y) - p.r) <= NEAR_PX &&
          inSpan(a, p.from, p.to)
        )
          out.push(a + Math.PI / 2, a - Math.PI / 2);
      }
    }
  }
  return out;
}

function gap(a: number, b: number): number {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return Math.min(d, TAU - d);
}

/**
 * The automatic direction of a point label, degrees: the first preferred direction whose
 * angular gap to every blocked direction is largest, gaps counted in whole degrees and
 * capped at 45° (a direction 45° clear of every curve is as good as any other, so the
 * preference order decides; rounding keeps that decision free of float noise).
 */
function autoAngle(c: Vec2, items: readonly DisplayItem[], self: number): number {
  const dirs = blocked(c, items, self);
  let best = PREFERRED[0] ?? 45;
  let bestGap = -1;
  for (const deg of PREFERRED) {
    const a = (deg * Math.PI) / 180;
    const g = dirs.reduce((m, d) => Math.min(m, gap(a, d)), Math.PI);
    const score = Math.min(45, Math.round((g * 180) / Math.PI));
    if (score > bestGap) [best, bestGap] = [deg, score];
  }
  return best;
}

function place(view: View, p: Primitive, item: DisplayItem, items: readonly DisplayItem[]) {
  const label = p.label;
  const anchor = anchorOf(view, item);
  if (label === null || anchor === undefined) return undefined;
  const angle = label.angle ?? (item.kind === 'point' ? autoAngle(anchor, items, item.id) : 45);
  const rad = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(rad), Math.sin(rad)];
  const placed: PlacedLabel = {
    id: p.id,
    runs: label.runs,
    text: label.text,
    anchor,
    at: { x: anchor.x + label.dist * cos, y: anchor.y - label.dist * sin },
    angle,
    align: cos > TILT ? 'left' : cos < -TILT ? 'right' : 'center',
    baseline: sin > TILT ? 'bottom' : sin < -TILT ? 'top' : 'middle',
    color: p.style.color,
    opacity: p.style.opacity,
  };
  return placed;
}

/** The labels of the drawn items, in draw order. */
export function placeLabels(
  scene: Scene,
  items: readonly DisplayItem[],
  view: View,
): PlacedLabel[] {
  const byId = new Map(scene.primitives.map((p) => [p.id, p]));
  const out: PlacedLabel[] = [];
  for (const item of items) {
    const p = byId.get(item.id);
    const placed = p === undefined ? undefined : place(view, p, item, items);
    if (placed !== undefined) out.push(placed);
  }
  return out;
}
