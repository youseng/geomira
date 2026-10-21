/**
 * The layout: Scene + View → DisplayList, the screen-space paths (CSS pixels, y down) that
 * the canvas renderer draws AND that hit-testing tests (law L8: one list, so what is hit is
 * exactly what is drawn). Shapes are clipped in world coordinates to the visible rectangle
 * grown by MARGIN_PX (clip.ts), then mapped by the viewport, so every coordinate is finite
 * and within MARGIN_PX of the surface (law L9). A View with a viewProblem gives an empty
 * list carrying the reason.
 *
 * Paths: a dot (points), a polyline (lines, segments, rays, polygon edges, and arcs whose
 * screen radius exceeds MAX_ARC_RADIUS, sampled finely enough that the chords stay within
 * ARC_SAGITTA of the circle), and an arc (screen centre and radius; `from` < `to` are
 * counter-clockwise angles as seen on the screen, i.e. in the world's orientation; the
 * renderer draws ctx.arc(x, y, r, −from, −to, true)). Marks and text (ADR-0011) are laid
 * out by mark-paths.ts: arcs and short polylines of a fixed pixel size, and a text's handle.
 */
import { assertNever } from '@geomira/num/assert';
import { clipCircle, clipLine, clipPolygon, inside, type Span } from './clip';
import { placeLabels, type PlacedLabel } from './labels';
import { markPaths } from './mark-paths';
import { MAX_WIDTH } from './style';
import type { DisplayItem, Path, Primitive, Scene } from './types';
import { toScreen, viewProblem, worldRect, type Rect, type Vec2, type View } from './viewport';

export type { DisplayItem, Path } from './types';

export interface DisplayList {
  readonly view: View;
  /** Back to front (the scene's order); only items with something on screen. */
  readonly items: readonly DisplayItem[];
  readonly labels: readonly PlacedLabel[];
  /** Why nothing is drawn (an invalid view), or null. */
  readonly problem: string | null;
}

/** Shapes are clipped this far outside the surface, so no stroke or dot is cut visibly. */
export const MARGIN_PX = MAX_WIDTH + 4;

/** Arcs with a larger screen radius are drawn as polylines. */
export const MAX_ARC_RADIUS = 1 << 15;

/** Largest distance, in px, between a sampled huge arc and its chords. */
export const ARC_SAGITTA = 1 / 4;

/** Most samples of one span of a huge arc. */
const MAX_ARC_SAMPLES = 2048;

function dotPaths(view: View, at: Vec2, r: number, rect: Rect): Path[] {
  return inside(rect, at) ? [{ kind: 'dot', c: toScreen(view, at), r }] : [];
}

function sampledArc(view: View, c: Vec2, radius: number, s: Span, rPx: number): Path {
  const step = Math.sqrt((8 * ARC_SAGITTA) / rPx);
  const n = Math.min(MAX_ARC_SAMPLES, Math.max(2, Math.ceil((s.to - s.from) / step)));
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = s.from + ((s.to - s.from) * i) / n;
    pts.push(toScreen(view, { x: c.x + radius * Math.cos(a), y: c.y + radius * Math.sin(a) }));
  }
  return { kind: 'poly', pts, closed: false };
}

function circlePaths(view: View, p: Extract<Primitive['shape'], { kind: 'circle' }>, rect: Rect) {
  const clip = clipCircle(p.c, p.r, p.arc, rect);
  if (clip.kind === 'none') return [];
  const rPx = p.r * view.viewport.zoom;
  return clip.spans.map((s): Path => {
    if (rPx > MAX_ARC_RADIUS || !Number.isFinite(rPx)) return sampledArc(view, p.c, p.r, s, rPx);
    return { kind: 'arc', c: toScreen(view, p.c), r: rPx, from: s.from, to: s.to };
  });
}

function polygonEdges(view: View, pts: readonly Vec2[], rect: Rect): Path[] {
  const out: Path[] = [];
  for (const [i, a] of pts.entries()) {
    const b = pts[(i + 1) % pts.length] ?? a;
    const u = { x: b.x - a.x, y: b.y - a.y };
    const seg = clipLine(a, u, 0, 1, rect);
    if (seg !== null)
      out.push({ kind: 'poly', pts: seg.map((q) => toScreen(view, q)), closed: false });
  }
  return out;
}

function itemOf(view: View, p: Primitive, rect: Rect): DisplayItem | null {
  const s = p.shape;
  let paths: Path[];
  let fill: Vec2[] | null = null;
  switch (s.kind) {
    case 'point':
      paths = dotPaths(view, s.at, p.style.width, rect);
      break;
    case 'line': {
      const seg = clipLine(s.p, s.u, s.lo, s.hi, rect);
      paths =
        seg === null
          ? []
          : [{ kind: 'poly', pts: seg.map((q) => toScreen(view, q)), closed: false }];
      break;
    }
    case 'circle':
      paths = circlePaths(view, s, rect);
      break;
    case 'polygon': {
      paths = polygonEdges(view, s.pts, rect);
      const f = clipPolygon(s.pts, rect);
      fill = f.length >= 3 ? f.map((q) => toScreen(view, q)) : null;
      break;
    }
    case 'angle_mark':
    case 'segment_mark':
    case 'text':
      paths = markPaths(view, s, rect);
      break;
    default:
      return assertNever(s, 'shape');
  }
  if (paths.length === 0 && fill === null) return null;
  return { id: p.id, name: p.name, kind: s.kind, style: p.style, paths, fill };
}

/** The display list of `scene` in `view` (see the module comment). */
export function layout(scene: Scene, view: View): DisplayList {
  const problem = viewProblem(view) ?? null;
  if (problem !== null) return { view, items: [], labels: [], problem };
  const rect = worldRect(view, MARGIN_PX);
  const items: DisplayItem[] = [];
  for (const p of scene.primitives) {
    const item = itemOf(view, p, rect);
    if (item !== null) items.push(item);
  }
  return { view, items, labels: placeLabels(scene, items, view), problem: null };
}
