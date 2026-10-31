/**
 * The world bounds of a scene, for "fit to the figure": points, the finite ends of segments
 * and rays, a point of each full line, circles' bounding boxes (an arc counts as its
 * circle), an ellipse's box, a parabola's vertex, a hyperbola's vertex nearest the rest of the
 * figure (both when nothing else bounds it; never its centre, which is not on the curve: Run
 * 16c audit), polygon vertices, an angle mark's vertex, a segment mark's ends, a text's anchor, a distance measurement's ends. Null for a scene
 * with no primitive. Sums that overflow are
 * skipped (a circle of radius 1e300 at 1e300 contributes nothing), so the result is finite.
 */
import { assertNever } from '@geomira/num/assert';
import type { Scene, Shape } from './types';
import type { Rect, Vec2 } from './viewport';

function pointsOf(s: Shape): Vec2[] {
  switch (s.kind) {
    case 'point':
      return [s.at];
    case 'line': {
      const at = (t: number) => ({ x: s.p.x + t * s.u.x, y: s.p.y + t * s.u.y });
      const ends = [s.lo, s.hi].filter((t): t is number => t !== null).map(at);
      return ends.length > 0 ? ends : [s.p];
    }
    case 'circle':
      return [
        { x: s.c.x - s.r, y: s.c.y - s.r },
        { x: s.c.x + s.r, y: s.c.y + s.r },
      ];
    case 'conic':
      // An ellipse's box (by its larger semi-axis); a parabola: its vertex; a hyperbola: its
      // vertices (sceneBounds keeps the one nearest the rest of the figure).
      if (s.type === 'ellipse') {
        const m = Math.max(s.a, s.b);
        return [
          { x: s.c.x - m, y: s.c.y - m },
          { x: s.c.x + m, y: s.c.y + m },
        ];
      }
      return s.type === 'parabola'
        ? [s.c]
        : [1, -1].map((g) => ({ x: s.c.x + g * s.a * s.u.x, y: s.c.y + g * s.a * s.u.y }));
    case 'polygon':
      return [...s.pts];
    case 'angle_mark':
      return [s.b];
    case 'segment_mark':
    case 'distance':
      return [s.p, s.q];
    case 'text':
      return [s.at];
    default:
      return assertNever(s, 'shape');
  }
}

function grow(r: Rect | null, q: Vec2): Rect | null {
  if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return r;
  return r === null
    ? { minX: q.x, maxX: q.x, minY: q.y, maxY: q.y }
    : {
        minX: Math.min(r.minX, q.x),
        maxX: Math.max(r.maxX, q.x),
        minY: Math.min(r.minY, q.y),
        maxY: Math.max(r.maxY, q.y),
      };
}

const isHyperbola = (s: Shape) => s.kind === 'conic' && s.type === 'hyperbola';

export function sceneBounds(scene: Scene): Rect | null {
  let r: Rect | null = null;
  for (const p of scene.primitives)
    if (!isHyperbola(p.shape)) for (const q of pointsOf(p.shape)) r = grow(r, q);
  // A hyperbola: its vertex nearest the centre of the rest (both when there is no rest).
  const rest = r;
  for (const p of scene.primitives) {
    if (!isHyperbola(p.shape)) continue;
    const vs = pointsOf(p.shape);
    if (rest === null) {
      for (const q of vs) r = grow(r, q);
      continue;
    }
    const o = { x: (rest.minX + rest.maxX) / 2, y: (rest.minY + rest.maxY) / 2 };
    const d = (q: Vec2) => Math.hypot(q.x - o.x, q.y - o.y);
    const near = vs.reduce((a, b) => (d(b) < d(a) ? b : a));
    r = grow(r, near);
  }
  return r;
}
