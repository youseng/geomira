/**
 * Label placement (SPEC §13 "offsets as (angle, pixels)", ADR-0010). A label sits at its
 * ANCHOR moved by its offset: `dist` pixels in the direction `angle` (degrees,
 * counter-clockwise as seen on the screen). Anchors: a point's dot; the middle of the
 * visible part of a line, segment or ray; the point of a circle at 45° if it is visible,
 * else the middle of its first visible arc; a polygon's vertex centroid; an angle mark's
 * outermost arc at its middle (or the corner of its square); a segment mark's middle tick; a
 * text's anchor (ADR-0011). A label whose anchor is off the surface is not placed.
 *
 * Automatic direction (points without `label_angle`): of the eight compass directions,
 * preferring 45°, 135°, 315°, 225°, 90°, 0°, 270°, 180° in that order, the one farthest
 * (in angle) from the directions of the drawn curves that pass within NEAR_PX of the point;
 * so labels avoid the lines through their point. An angle mark's label points along the
 * bisector of its angle, out of the angle; other kinds default to 45°. A text without
 * `label_angle` is centred on its anchor (its string is the label, at distance 0 by default).
 *
 * The text box is aligned away from the anchor: left-aligned when the offset points right,
 * bottom-aligned when it points up, centred in between (renderer: textAlign/textBaseline).
 */
import { clipLine } from './clip';
import { boxesOverlap, labelBox, MIN_CLEAR_DEG } from './label-box';
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

/** The middle of the outermost arc of an angle mark (arcs are laid out innermost first). */
function markAnchor(paths: readonly Path[]): Vec2 | undefined {
  const last = paths[paths.length - 1];
  if (last?.kind === 'arc') return arcPoint(last, (last.from + last.to) / 2);
  return last?.kind === 'poly' ? last.pts[1] : undefined;
}

/** The bisector direction of an angle mark, degrees (screen and world agree on angles). */
function bisector(paths: readonly Path[]): number | undefined {
  const p = paths[0];
  if (p?.kind === 'arc') return (((p.from + p.to) / 2) * 180) / Math.PI;
  if (p?.kind !== 'poly') return undefined;
  const [a, c, b] = p.pts;
  return a === undefined || b === undefined || c === undefined
    ? undefined
    : (screenAngle({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, c) * 180) / Math.PI;
}

function anchorOf(view: View, item: DisplayItem): Vec2 | undefined {
  const first = item.paths[0];
  const q =
    item.kind === 'point' || item.kind === 'text'
      ? first?.kind === 'dot'
        ? first.c
        : undefined
      : item.kind === 'angle_mark'
        ? markAnchor(item.paths)
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

/** A point farther than this from a segment's carrier line is surely not near it (cheap test). */
const CARRIER_PX = NEAR_PX + 1;

function segmentDirections(c: Vec2, a: Vec2, b: Vec2, out: number[]): void {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const len2 = d.x * d.x + d.y * d.y;
  if (!(len2 > 0)) return;
  // The distance to the segment is at least the distance to its carrier: reject far points
  // first, with a pixel to spare, so the exact test below decides every point it could accept.
  const cross = (c.x - a.x) * d.y - (c.y - a.y) * d.x;
  if (cross * cross > CARRIER_PX * CARRIER_PX * len2) return;
  const t = Math.max(0, Math.min(1, ((c.x - a.x) * d.x + (c.y - a.y) * d.y) / len2));
  const q = { x: a.x + t * d.x, y: a.y + t * d.y };
  if (Math.hypot(c.x - q.x, c.y - q.y) > NEAR_PX) return;
  const phi = screenAngle(a, b);
  const len = Math.sqrt(len2);
  if (t * len > NEAR_PX) out.push(phi + Math.PI);
  if ((1 - t) * len > NEAR_PX) out.push(phi);
}

/** A drawn curve's path with its screen bounding box grown by NEAR_PX (labels avoid curves). */
interface CurvePath {
  readonly id: number;
  readonly path: Path;
  readonly box: Rect;
}

function grownBox(p: Path): Rect {
  if (p.kind === 'poly') {
    const xs = p.pts.map((q) => q.x);
    const ys = p.pts.map((q) => q.y);
    return {
      minX: Math.min(...xs) - NEAR_PX,
      maxX: Math.max(...xs) + NEAR_PX,
      minY: Math.min(...ys) - NEAR_PX,
      maxY: Math.max(...ys) + NEAR_PX,
    };
  }
  const r = p.r + NEAR_PX;
  return { minX: p.c.x - r, maxX: p.c.x + r, minY: p.c.y - r, maxY: p.c.y + r };
}

/**
 * The paths a point label avoids (every stroke of every item but points), each with its grown
 * box. A point outside a path's box is farther than NEAR_PX from it (a segment lies in its
 * box; an arc in its circle's), so blocked() skips that path without changing its result.
 */
function curvePaths(items: readonly DisplayItem[]): CurvePath[] {
  return items.flatMap((item) =>
    item.kind === 'point'
      ? []
      : item.paths.flatMap((path) =>
          path.kind === 'dot' || (path.kind === 'poly' && path.pts.length === 0)
            ? []
            : [{ id: item.id, path, box: grownBox(path) }],
        ),
  );
}

/** Whether c can be within NEAR_PX of the circle of an arc (a cheap test, a pixel to spare). */
function nearRing(c: Vec2, p: Extract<Path, { kind: 'arc' }>): boolean {
  const [dx, dy] = [c.x - p.c.x, c.y - p.c.y];
  const d2 = dx * dx + dy * dy;
  const inner = Math.max(0, p.r - CARRIER_PX);
  const outer = p.r + CARRIER_PX;
  return d2 >= inner * inner && d2 <= outer * outer;
}

/** Directions (radians) of the curves that pass within NEAR_PX of c. */
function blocked(c: Vec2, curves: readonly CurvePath[], self: number): number[] {
  const out: number[] = [];
  for (const { id, path: p, box } of curves) {
    if (id === self || c.x < box.minX || c.x > box.maxX || c.y < box.minY || c.y > box.maxY)
      continue;
    if (p.kind === 'poly') {
      for (let i = 0; i + 1 < p.pts.length; i++) {
        const [a, b] = [p.pts[i], p.pts[i + 1]];
        if (a !== undefined && b !== undefined) segmentDirections(c, a, b, out);
      }
    } else if (p.kind === 'arc' && nearRing(c, p)) {
      const a = Math.atan2(p.c.y - c.y, c.x - p.c.x);
      if (
        Math.abs(Math.hypot(c.x - p.c.x, c.y - p.c.y) - p.r) <= NEAR_PX &&
        inSpan(a, p.from, p.to)
      )
        out.push(a + Math.PI / 2, a - Math.PI / 2);
    }
  }
  return out;
}

function gap(a: number, b: number): number {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return Math.min(d, TAU - d);
}

/**
 * The automatic directions of a point label, degrees, best first: each preferred direction
 * is scored by its angular gap to every blocked direction, in whole degrees and capped at
 * 45° (a direction 45° clear of every curve is as good as any other, so the preference order
 * decides; rounding keeps that decision free of float noise); higher scores first, ties in
 * preference order. The first is the direction a lone label takes.
 */
function autoAngles(c: Vec2, curves: readonly CurvePath[], self: number): readonly Ranked[] {
  const dirs = blocked(c, curves, self);
  const ranked = PREFERRED.map((deg, order) => {
    const a = (deg * Math.PI) / 180;
    const g = dirs.reduce((m, d) => Math.min(m, gap(a, d)), Math.PI);
    return { deg, order, score: Math.min(45, Math.round((g * 180) / Math.PI)) };
  });
  return ranked.sort((x, y) => y.score - x.score || x.order - y.order);
}

interface Ranked {
  readonly deg: number;
  readonly order: number;
  readonly score: number;
}

/** The label of `p` placed in direction `angle` (degrees) from `anchor`. */
function placedAt(p: Primitive, item: DisplayItem, anchor: Vec2, angle: number): PlacedLabel {
  const label = p.label;
  const rad = (angle * Math.PI) / 180;
  const centred = item.kind === 'text' && label?.angle === null;
  const [cos, sin] = centred ? [0, 0] : [Math.cos(rad), Math.sin(rad)];
  const dist = label?.dist ?? 0;
  return {
    id: p.id,
    runs: label?.runs ?? [],
    text: label?.text ?? '',
    anchor,
    at: { x: anchor.x + dist * cos, y: anchor.y - dist * sin },
    angle,
    align: cos > TILT ? 'left' : cos < -TILT ? 'right' : 'center',
    baseline: sin > TILT ? 'bottom' : sin < -TILT ? 'top' : 'middle',
    color: p.style.color,
    opacity: p.style.opacity,
  };
}

/** Whether a label's direction is chosen here (a point without `label_angle`). */
function automatic(p: Primitive, item: DisplayItem): boolean {
  return item.kind === 'point' && p.label !== null && p.label.angle === null;
}

/** A label with a fixed direction: explicit, or by kind (marks: the bisector; others 45°). */
function placeFixed(view: View, p: Primitive, item: DisplayItem): PlacedLabel | undefined {
  const anchor = anchorOf(view, item);
  if (p.label === null || anchor === undefined) return undefined;
  const angle =
    p.label.angle ??
    (item.kind === 'angle_mark' ? (((bisector(item.paths) ?? 45) % 360) + 360) % 360 : 45);
  return placedAt(p, item, anchor, angle);
}

/**
 * An automatic point label: the best direction for the curves through the point, unless its
 * box would overlap a label placed before it; then the next direction in rank order whose
 * box overlaps none and that keeps at least MIN_CLEAR_DEG from the curves; if every one
 * collides, the best direction after all (note C of Run 8b).
 */
function placeAuto(
  view: View,
  p: Primitive,
  item: DisplayItem,
  curves: readonly CurvePath[],
  taken: readonly Rect[],
): PlacedLabel | undefined {
  const anchor = anchorOf(view, item);
  if (anchor === undefined) return undefined;
  const ranked = autoAngles(anchor, curves, item.id);
  const best = ranked[0]?.score ?? 45;
  const first = placedAt(p, item, anchor, ranked[0]?.deg ?? 45);
  for (const r of ranked) {
    if (r.score < Math.min(best, MIN_CLEAR_DEG)) break;
    const l = r.deg === first.angle ? first : placedAt(p, item, anchor, r.deg);
    const box = labelBox(l);
    if (!taken.some((t) => boxesOverlap(box, t))) return l;
  }
  return first;
}

/**
 * The labels of the drawn items, in draw order. Labels with a fixed direction (explicit
 * `label_angle`, and every label that is not a point's) are placed first and never moved;
 * then the automatic point labels, in draw order, each avoiding the boxes of all labels
 * placed before it. Deterministic: the same display list gives the same placement.
 */
export function placeLabels(
  scene: Scene,
  items: readonly DisplayItem[],
  view: View,
): PlacedLabel[] {
  const byId = new Map(scene.primitives.map((p) => [p.id, p]));
  const placed = new Map<number, PlacedLabel>();
  for (const item of items) {
    const p = byId.get(item.id);
    const l = p === undefined || automatic(p, item) ? undefined : placeFixed(view, p, item);
    if (l !== undefined) placed.set(item.id, l);
  }
  const taken = [...placed.values()].map(labelBox);
  const curves = curvePaths(items);
  for (const item of items) {
    const p = byId.get(item.id);
    if (p === undefined || !automatic(p, item)) continue;
    const l = placeAuto(view, p, item, curves, taken);
    if (l === undefined) continue;
    placed.set(item.id, l);
    taken.push(labelBox(l));
  }
  return items.flatMap((item) => {
    const l = placed.get(item.id);
    return l === undefined ? [] : [l];
  });
}
