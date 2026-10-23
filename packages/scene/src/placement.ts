/**
 * Whether a curve can be placed at the view's zoom (ADR-0023, W10 of the Run 10 audit).
 *
 * The layout computes points of a circle as c + r·(cos θ, sin θ), and points of a line as
 * p + t·u, in world coordinates. In doubles each such point is off by about
 * ε·(|c| + r), or ε·(|p| + |t|), world units. Where that error exceeds PLACEMENT_PX pixels at
 * the view's zoom, the drawn curve would be garbage: a circle 10¹⁶ view widths in radius has
 * no reliable crossing with the view, and a line given by a point 10¹⁷ away cannot be placed
 * within a pixel. Such a curve is "not drawable at this zoom" when it may pass through the
 * view, rather than silently missing or drawn wrong.
 *
 * Results:
 *   - 'ok': placed within PLACEMENT_PX; the layout draws it as usual;
 *   - 'outside': it cannot pass through `rect`, whatever the rounding (not drawn, not listed);
 *   - 'unplaceable': it may pass through `rect`, but not within PLACEMENT_PX (listed).
 *
 * Degenerate cases:
 *   - a non-finite input gives 'unplaceable' when the bounding test cannot exclude it;
 *   - a zero radius is 'ok' (a dot-sized circle);
 *   - a bounded line (segment or ray) is measured from its part nearest to the view.
 */
import type { Shape } from './types';
import type { Rect, Vec2 } from './viewport';

/** The largest placement error, in px, at which a curve is still drawn. */
export const PLACEMENT_PX = 1 / 2;

/** A few rounding steps of one coordinate computation (sum, product, cos or sin). */
const ROUNDING = 4 * Number.EPSILON;

export type Placement = 'ok' | 'outside' | 'unplaceable';

type Curve = Extract<Shape, { readonly kind: 'circle' | 'line' }>;

function centerOf(r: Rect): Vec2 {
  return { x: (r.minX + r.maxX) / 2, y: (r.minY + r.maxY) / 2 };
}

function halfDiagonal(r: Rect): number {
  return Math.hypot((r.maxX - r.minX) / 2, (r.maxY - r.minY) / 2);
}

/** The world error of the curve's points near the view, and their distance from its center. */
function errorAndDistance(s: Curve, at: Vec2): { err: number; dist: number } {
  if (s.kind === 'circle') {
    const err = ROUNDING * (Math.abs(s.c.x) + Math.abs(s.c.y) + s.r);
    return { err, dist: Math.abs(Math.hypot(at.x - s.c.x, at.y - s.c.y) - s.r) };
  }
  let t = (at.x - s.p.x) * s.u.x + (at.y - s.p.y) * s.u.y;
  if (s.lo !== null) t = Math.max(t, s.lo);
  if (s.hi !== null) t = Math.min(t, s.hi);
  const q = { x: s.p.x + t * s.u.x, y: s.p.y + t * s.u.y };
  const err = ROUNDING * (Math.abs(s.p.x) + Math.abs(s.p.y) + Math.abs(t));
  return { err, dist: Math.hypot(at.x - q.x, at.y - q.y) };
}

/** Whether `s` can be placed within PLACEMENT_PX in `rect` at `zoom` px per world unit. */
export function curvePlacement(s: Curve, rect: Rect, zoom: number): Placement {
  const { err, dist } = errorAndDistance(s, centerOf(rect));
  if (dist > halfDiagonal(rect) + err) return 'outside';
  return err * zoom <= PLACEMENT_PX ? 'ok' : 'unplaceable';
}

/**
 * Whether a polygon's edges can be placed (ADR-0028): 'unplaceable' when one of them is,
 * as the segment a + t·(b − a) the layout clips; otherwise 'ok' (its vertices are exact).
 * Degenerate cases: a zero-length edge is a vertex ('ok'); an edge of non-finite length
 * is 'unplaceable'.
 */
export function polygonPlacement(pts: readonly Vec2[], rect: Rect, zoom: number): Placement {
  for (const [i, a] of pts.entries()) {
    const b = pts[(i + 1) % pts.length] ?? a;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!Number.isFinite(len)) return 'unplaceable';
    if (len === 0) continue;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const edge: Curve = { kind: 'line', p: a, u, lo: 0, hi: len };
    if (curvePlacement(edge, rect, zoom) === 'unplaceable') return 'unplaceable';
  }
  return 'ok';
}
