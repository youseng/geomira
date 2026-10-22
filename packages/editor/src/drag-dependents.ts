/**
 * The drag-end rounding check on the objects that depend on the dragged one (ADR-0027):
 * rounding is refused when any of them changes kind (a selector flipped, an object became
 * undefined) or moves by more than DEPENDENT_PX on screen.
 */
import type { Value, Vec } from '@geomira/kernel/value';
import { positionOf } from './drag';

/**
 * Pixels: the most another object may move when the dragged one is rounded. Larger than
 * ROUNDING_PX, since constructions may amplify the dragged point's tiny move.
 */
export const DEPENDENT_PX = 1;

/** The distance from q to the line through p with direction d (d ≠ 0). */
function lineDistance(p: Vec<number>, d: Vec<number>, q: Vec<number>): number {
  return Math.abs((q.x - p.x) * d.y - (q.y - p.y) * d.x) / Math.hypot(d.x, d.y);
}

/** Whether `b` is `a` moved by at most `px` on screen (lines: 100 px of `a` stay on b). */
function staysPut(a: Value<number>, b: Value<number>, zoom: number, px: number): boolean {
  const tol = px / zoom;
  if (a.kind === 'point' || a.kind === 'text') {
    const [p, q] = [positionOf(a), positionOf(b)];
    return p !== undefined && q !== undefined && Math.hypot(p.x - q.x, p.y - q.y) <= tol;
  }
  if (a.kind === 'circle' && b.kind === 'circle') {
    const moved = Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y);
    return moved <= tol && Math.abs(Math.sqrt(a.r2) - Math.sqrt(b.r2)) <= tol;
  }
  if (a.kind === 'line' && b.kind === 'line') {
    const n = Math.hypot(a.d.x, a.d.y);
    const far = { x: a.p.x + (a.d.x / n) * 100 * tol, y: a.p.y + (a.d.y / n) * 100 * tol };
    return lineDistance(b.p, b.d, a.p) <= tol && lineDistance(b.p, b.d, far) <= tol;
  }
  return a.kind === b.kind;
}

/**
 * Whether every object except `skip` keeps its kind and moves by at most DEPENDENT_PX on
 * screen between the values `before` and `after` (drag-end rounding, ADR-0027). Degenerate
 * cases: an object present in one map only, or of another kind → false.
 */
export function dependentsKept(
  before: ReadonlyMap<number, Value<number>>,
  after: ReadonlyMap<number, Value<number>>,
  zoom: number,
  skip: ReadonlySet<number>,
): boolean {
  if (before.size !== after.size) return false;
  for (const [id, a] of before) {
    if (skip.has(id)) continue;
    const b = after.get(id);
    if (b?.kind !== a.kind || !staysPut(a, b, zoom, DEPENDENT_PX)) return false;
  }
  return true;
}
