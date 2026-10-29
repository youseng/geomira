/**
 * The drag-end rounding check on the objects that depend on the dragged one (ADR-0027):
 * rounding is refused when any of them changes kind (a selector flipped, an object became
 * undefined) or moves by more than DEPENDENT_PX on screen.
 */
import { coeffsOf, halfGradient, qDirection, qValue } from '@geomira/kernel/conic';
import type { Conic, Line, Value, Vec } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
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

/** A range's ends as points (null: unbounded on that side). */
function ends(l: Line<number>): readonly (Vec<number> | null)[] {
  const at = (t: number | null) =>
    t === null ? null : { x: l.p.x + t * l.d.x, y: l.p.y + t * l.d.y };
  return [at(l.lo), at(l.hi)];
}

/** Whether the two ranges have the same kind of ends, each moved by at most tol. */
function sameRange(a: Line<number>, b: Line<number>, tol: number): boolean {
  if ((a.outside === true) !== (b.outside === true)) return false;
  const eb = ends(b);
  return ends(a).every((p, i) => {
    const q = eb[i] ?? null;
    if (p === null || q === null) return p === null && q === null;
    return Math.hypot(p.x - q.x, p.y - q.y) <= tol;
  });
}

const DIRECTIONS: readonly Vec<number>[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
];

/** k's known point and the second points of the lines through it in DIRECTIONS (Vieta). */
function samples(k: Conic<number>): Vec<number>[] {
  const A = k.anchor;
  if (A === undefined) return [];
  const q = coeffsOf(k);
  const g = halfGradient(FloatField, q, A);
  const out = [A];
  for (const w of DIRECTIONS) {
    const t = (-2 * (g.x * w.x + g.y * w.y)) / qDirection(FloatField, q, w);
    const X = { x: A.x + t * w.x, y: A.y + t * w.y };
    if (Number.isFinite(X.x) && Number.isFinite(X.y)) out.push(X);
  }
  return out;
}

/** Every sample of `from` within tol of `to` (to first order, |Q|/|∇Q|). */
function samplesOn(from: Conic<number>, to: Conic<number>, tol: number): boolean {
  const q = coeffsOf(to);
  return samples(from).every((X) => {
    const g = halfGradient(FloatField, q, X);
    return Math.abs(qValue(FloatField, q, X)) <= 2 * Math.hypot(g.x, g.y) * tol;
  });
}

/**
 * Whether `b` is `a` moved by at most `px` on screen (lines: 100 px of `a` stay on b, and a
 * range's ends move by at most px; conics: sample points of each stay on the other, Run 16c
 * audit; a conic without a known point: its kind only).
 */
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
    return (
      lineDistance(b.p, b.d, a.p) <= tol &&
      lineDistance(b.p, b.d, far) <= tol &&
      sameRange(a, b, tol)
    );
  }
  if (a.kind === 'conic' && b.kind === 'conic') return samplesOn(a, b, tol) && samplesOn(b, a, tol);
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
