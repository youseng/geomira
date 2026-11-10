/**
 * Box selection (ADR-0062): the objects of a scene that lie WHOLLY inside a world rectangle,
 * in draw order. "Wholly inside" (a window, not a crossing): a line through the whole canvas
 * is never caught by a box drawn around two points, which is what a box is drawn for.
 *
 * Per shape: a point, a text and an angle mark by their anchor; a segment, a segment mark and
 * a distance by both ends; a polygon by every vertex; a circle and an ellipse by their
 * bounding box (an arc by its circle's: an arc is selected with the box around its circle's
 * part it shows only if the whole circle fits; simple, and never selects by surprise).
 *
 * Degenerate cases: an unbounded line or ray, two rays (`outside`), a hyperbola and a
 * parabola are never wholly inside → never selected by a box (they are by a click); an empty
 * or inverted rectangle → nothing; objects that are not drawn (hidden, Undefined) are not in
 * the scene.
 */
import { assertNever } from '@geomira/num/assert';
import { inside } from './clip';
import type { Scene, Shape } from './types';
import type { Rect, Vec2 } from './viewport';

function along(p: Vec2, u: Vec2, t: number): Vec2 {
  return { x: p.x + t * u.x, y: p.y + t * u.y };
}

/** Whether the axis-parallel box of half-sizes (hx, hy) about c is inside r. */
function boxInside(r: Rect, c: Vec2, hx: number, hy: number): boolean {
  return inside(r, { x: c.x - hx, y: c.y - hy }) && inside(r, { x: c.x + hx, y: c.y + hy });
}

/** Whether the whole shape lies inside the rectangle (see the module comment). */
export function shapeInBox(s: Shape, r: Rect): boolean {
  switch (s.kind) {
    case 'point':
    case 'text':
      return inside(r, s.at);
    case 'angle_mark':
      return inside(r, s.b);
    case 'line':
      if (s.lo === null || s.hi === null || s.outside === true) return false;
      return inside(r, along(s.p, s.u, s.lo)) && inside(r, along(s.p, s.u, s.hi));
    case 'segment_mark':
    case 'distance':
      return inside(r, s.p) && inside(r, s.q);
    case 'polygon':
      return s.pts.length > 0 && s.pts.every((p) => inside(r, p));
    case 'circle':
      return boxInside(r, s.c, s.r, s.r);
    case 'conic': {
      if (s.type !== 'ellipse') return false;
      // c + a·cos τ·u + b·sin τ·v with v = rot90(u): the extents along x and y.
      const hx = Math.hypot(s.a * s.u.x, s.b * s.u.y);
      const hy = Math.hypot(s.a * s.u.y, s.b * s.u.x);
      return boxInside(r, s.c, hx, hy);
    }
    default:
      return assertNever(s, 'shape');
  }
}

/** The ids of the scene's objects wholly inside `r`, in draw order. */
export function inBox(scene: Scene, r: Rect): number[] {
  if (!(r.minX <= r.maxX && r.minY <= r.maxY)) return [];
  return scene.primitives.filter((p) => shapeInBox(p.shape, r)).map((p) => p.id);
}
