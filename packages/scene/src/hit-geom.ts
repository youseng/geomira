/**
 * Screen-space geometry of display paths for hit-testing (internal): distances from the
 * cursor to a path, the pieces (segments and arcs) a path consists of, their pairwise
 * intersections, and the nearest point of a curve. Plain float geometry in CSS pixels;
 * every result is finite or absent (parallel segments, concentric or disjoint arcs, and
 * zero-length pieces have no intersection; a degenerate piece's nearest point is its end).
 * Arc angles are counter-clockwise as seen on the screen (display.ts).
 */
import { assertNever } from '@geomira/num/assert';
import type { Path } from './types';
import type { Vec2 } from './viewport';

const TAU = 2 * Math.PI;

export type Piece =
  | { readonly id: number; readonly kind: 'seg'; readonly a: Vec2; readonly b: Vec2 }
  | {
      readonly id: number;
      readonly kind: 'arc';
      readonly c: Vec2;
      readonly r: number;
      readonly from: number;
      readonly to: number;
    };

function finite(p: Vec2): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

/** Whether the screen angle a lies on the counter-clockwise span [from, to]. */
export function onSpan(a: number, from: number, to: number): boolean {
  const w = (((a - from) % TAU) + TAU) % TAU;
  return w <= to - from;
}

/** The screen angle of q seen from c (counter-clockwise as seen, y down). */
export function angleAt(c: Vec2, q: Vec2): number {
  return Math.atan2(c.y - q.y, q.x - c.x);
}

export function arcPoint(c: Vec2, r: number, a: number): Vec2 {
  return { x: c.x + r * Math.cos(a), y: c.y - r * Math.sin(a) };
}

function nearestOnSegment(a: Vec2, b: Vec2, q: Vec2): Vec2 {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const len2 = d.x * d.x + d.y * d.y;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((q.x - a.x) * d.x + (q.y - a.y) * d.y) / len2)) : 0;
  return { x: a.x + t * d.x, y: a.y + t * d.y };
}

function nearestOnArc(p: Extract<Piece, { kind: 'arc' }>, q: Vec2): Vec2 {
  const a = angleAt(p.c, q);
  if (onSpan(a, p.from, p.to) && (q.x !== p.c.x || q.y !== p.c.y)) return arcPoint(p.c, p.r, a);
  const [s, e] = [arcPoint(p.c, p.r, p.from), arcPoint(p.c, p.r, p.to)];
  return Math.hypot(s.x - q.x, s.y - q.y) <= Math.hypot(e.x - q.x, e.y - q.y) ? s : e;
}

function nearestOnPiece(p: Piece, q: Vec2): Vec2 {
  return p.kind === 'seg' ? nearestOnSegment(p.a, p.b, q) : nearestOnArc(p, q);
}

/** The segments and arcs of a stroked path (a dot has none). */
export function geometryOf(id: number, p: Path): Piece[] {
  switch (p.kind) {
    case 'dot':
      return [];
    case 'arc':
      return [{ id, kind: 'arc', c: p.c, r: p.r, from: p.from, to: p.to }];
    case 'poly': {
      const out: Piece[] = [];
      const n = p.closed ? p.pts.length : p.pts.length - 1;
      for (let i = 0; i < n; i++) {
        const [a, b] = [p.pts[i], p.pts[(i + 1) % p.pts.length]];
        if (a !== undefined && b !== undefined) out.push({ id, kind: 'seg', a, b });
      }
      return out;
    }
    default:
      return assertNever(p, 'path');
  }
}

/** Distance from q to a path: a dot's disc (0 inside), a polyline or an arc. */
export function pathDistance(p: Path, q: Vec2): number {
  if (p.kind === 'dot') return Math.max(0, Math.hypot(q.x - p.c.x, q.y - p.c.y) - p.r);
  let best = Infinity;
  for (const piece of geometryOf(0, p)) {
    const n = nearestOnPiece(piece, q);
    best = Math.min(best, Math.hypot(n.x - q.x, n.y - q.y));
  }
  return best;
}

/** The nearest point to q on any of the pieces, or undefined when there are none. */
export function nearestOn(pieces: readonly Piece[], q: Vec2): Vec2 | undefined {
  let best: Vec2 | undefined;
  let d = Infinity;
  for (const piece of pieces) {
    const n = nearestOnPiece(piece, q);
    const dn = Math.hypot(n.x - q.x, n.y - q.y);
    if (dn < d && finite(n)) [best, d] = [n, dn];
  }
  return best;
}

function segSeg(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2[] {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (den === 0) return [];
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [{ x: a.x + t * r.x, y: a.y + t * r.y }] : [];
}

function segArc(a: Vec2, b: Vec2, p: Extract<Piece, { kind: 'arc' }>): Vec2[] {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const f = { x: a.x - p.c.x, y: a.y - p.c.y };
  const A = d.x * d.x + d.y * d.y;
  const B = 2 * (f.x * d.x + f.y * d.y);
  const C = f.x * f.x + f.y * f.y - p.r * p.r;
  const disc = B * B - 4 * A * C;
  if (!(A > 0) || !(disc >= 0)) return [];
  const sq = Math.sqrt(disc);
  return [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]
    .filter((t) => t >= 0 && t <= 1)
    .map((t) => ({ x: a.x + t * d.x, y: a.y + t * d.y }))
    .filter((x) => onSpan(angleAt(p.c, x), p.from, p.to));
}

function arcArc(p: Extract<Piece, { kind: 'arc' }>, q: Extract<Piece, { kind: 'arc' }>): Vec2[] {
  const dx = q.c.x - p.c.x;
  const dy = q.c.y - p.c.y;
  const d = Math.hypot(dx, dy);
  if (!(d > 0) || d > p.r + q.r || d < Math.abs(p.r - q.r)) return [];
  const a = (d * d + p.r * p.r - q.r * q.r) / (2 * d);
  const h = Math.sqrt(Math.max(0, p.r * p.r - a * a));
  const m = { x: p.c.x + (a * dx) / d, y: p.c.y + (a * dy) / d };
  return [
    { x: m.x - (h * dy) / d, y: m.y + (h * dx) / d },
    { x: m.x + (h * dy) / d, y: m.y - (h * dx) / d },
  ].filter((x) => onSpan(angleAt(p.c, x), p.from, p.to) && onSpan(angleAt(q.c, x), q.from, q.to));
}

function meet(p: Piece, q: Piece): Vec2[] {
  if (p.kind === 'seg' && q.kind === 'seg') return segSeg(p.a, p.b, q.a, q.b);
  if (p.kind === 'seg' && q.kind === 'arc') return segArc(p.a, p.b, q);
  if (p.kind === 'arc' && q.kind === 'seg') return segArc(q.a, q.b, p);
  if (p.kind === 'arc' && q.kind === 'arc') return arcArc(p, q);
  return [];
}

/** Every intersection of a piece of `ps` with a piece of `qs` (finite points only). */
export function intersections(
  ps: readonly Piece[],
  qs: readonly Piece[],
): { a: number; b: number; p: Vec2 }[] {
  const out: { a: number; b: number; p: Vec2 }[] = [];
  for (const p of ps)
    for (const q of qs)
      for (const x of meet(p, q)) if (finite(x)) out.push({ a: p.id, b: q.id, p: x });
  return out;
}
