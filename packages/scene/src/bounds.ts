/**
 * The world bounds of a scene, for "fit to the figure": points, the finite ends of segments
 * and rays, a point of each full line, circles' bounding boxes (an arc counts as its
 * circle), an ellipse's box, a hyperbola's centre and a parabola's vertex (ADR-0042), polygon
 * vertices, an angle mark's vertex, a segment mark's ends, a text's anchor. Null for a scene
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
      // An ellipse's box (by its larger semi-axis); a hyperbola or parabola: its centre or vertex.
      return s.type === 'ellipse'
        ? [
            { x: s.c.x - Math.max(s.a, s.b), y: s.c.y - Math.max(s.a, s.b) },
            { x: s.c.x + Math.max(s.a, s.b), y: s.c.y + Math.max(s.a, s.b) },
          ]
        : [s.c];
    case 'polygon':
      return [...s.pts];
    case 'angle_mark':
      return [s.b];
    case 'segment_mark':
      return [s.p, s.q];
    case 'text':
      return [s.at];
    default:
      return assertNever(s, 'shape');
  }
}

export function sceneBounds(scene: Scene): Rect | null {
  let r: Rect | null = null;
  for (const p of scene.primitives)
    for (const q of pointsOf(p.shape)) {
      if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) continue;
      r =
        r === null
          ? { minX: q.x, maxX: q.x, minY: q.y, maxY: q.y }
          : {
              minX: Math.min(r.minX, q.x),
              maxX: Math.max(r.maxX, q.x),
              minY: Math.min(r.minY, q.y),
              maxY: Math.max(r.maxY, q.y),
            };
    }
  return r;
}
