/**
 * The visible part of a conic (ADR-0042), as screen polylines: the parameter intervals of each
 * branch inside the clipping rectangle are found from the branch's crossings with the four
 * edges (closed forms: a cos/sin equation for an ellipse, a quadratic in e^τ for a hyperbola,
 * a quadratic for a parabola), then each interval is sampled until every chord is within
 * CONIC_SAGITTA px of the curve. A hyperbola's two branches are separate paths; nothing outside
 * the rectangle is computed, so every coordinate is finite and near the surface (L9), and what
 * is drawn is what is hit (L8: these are ordinary polylines).
 *
 * Placement (ADR-0023): a point of the curve is computed as c + x·u + y·v in doubles, off by
 * about ROUNDING·(|c| + |x| + |y|) world units; where that exceeds PLACEMENT_PX at the zoom on a
 * visible interval, the conic is not drawn and listed as not drawable at this zoom; so is a conic
 * that may pass through the rectangle while that error hides it from the crossings (mayPass).
 */
import { assertNever } from '@geomira/num/assert';
import { conicPoint, type ConicShape } from './conic-shape';
import { inside } from './clip';
import { PLACEMENT_PX, type Placement } from './placement';
import type { Path } from './types';
import { toScreen, type Rect, type Vec2, type View } from './viewport';

/** Largest distance, in px, between the curve and a chord of its polyline. */
export const CONIC_SAGITTA = 1 / 4;

/** Most points of one visible interval. */
const MAX_POINTS = 4096;

/** A few rounding steps of one coordinate computation. */
const ROUNDING = 4 * Number.EPSILON;

const TAU = 2 * Math.PI;

interface Span {
  readonly sigma: 1 | -1;
  readonly from: number;
  readonly to: number;
}

/** The real roots of αx² + βx + γ = 0 (a linear equation when α = 0), cancellation-free. */
function quadraticRoots(alpha: number, beta: number, gamma: number): number[] {
  if (alpha === 0) return beta === 0 ? [] : [-gamma / beta];
  const disc = beta * beta - 4 * alpha * gamma;
  if (!(disc >= 0)) return [];
  const q = -(beta + (beta >= 0 ? 1 : -1) * Math.sqrt(disc)) / 2;
  const roots = [q / alpha];
  if (q !== 0) roots.push(gamma / q);
  return roots.filter((x) => Number.isFinite(x));
}

/** The parameters where branch σ meets the line X·n = k (n a unit axis). */
function edgeCrossings(s: ConicShape, sigma: 1 | -1, n: Vec2, k: number): number[] {
  const v = { x: -s.u.y, y: s.u.x };
  const [un, vn] = [s.u.x * n.x + s.u.y * n.y, v.x * n.x + v.y * n.y];
  const K = k - (s.c.x * n.x + s.c.y * n.y);
  switch (s.type) {
    case 'ellipse': {
      const [A, B] = [s.a * un, s.b * vn];
      const R = Math.hypot(A, B);
      if (!(R > 0) || Math.abs(K) > R) return [];
      const base = Math.atan2(B, A);
      const off = Math.acos(Math.max(-1, Math.min(1, K / R)));
      return [base - off, base + off];
    }
    case 'hyperbola': {
      const [A, B] = [sigma * s.a * un, s.b * vn];
      return quadraticRoots(A + B, -2 * K, A - B)
        .filter((x) => x > 0)
        .map((x) => Math.log(x));
    }
    case 'parabola':
      return quadraticRoots(s.a * un, vn, -K);
    default:
      return assertNever(s.type, 'conic type');
  }
}

function allCrossings(s: ConicShape, sigma: 1 | -1, r: Rect): number[] {
  const X = { x: 1, y: 0 };
  const Y = { x: 0, y: 1 };
  return [
    ...edgeCrossings(s, sigma, X, r.minX),
    ...edgeCrossings(s, sigma, X, r.maxX),
    ...edgeCrossings(s, sigma, Y, r.minY),
    ...edgeCrossings(s, sigma, Y, r.maxY),
  ].filter((t) => Number.isFinite(t));
}

/** The parameter intervals of the conic inside `r`, branch by branch. */
export function conicSpans(s: ConicShape, r: Rect): Span[] {
  const spans: Span[] = [];
  const isIn = (sigma: 1 | -1, t: number) => inside(r, conicPoint(s, sigma, t));
  if (s.type === 'ellipse') {
    const ts = allCrossings(s, 1, r)
      .map((t) => ((t % TAU) + TAU) % TAU)
      .sort((a, b) => a - b);
    if (ts.length === 0) return isIn(1, 0) ? [{ sigma: 1, from: 0, to: TAU }] : [];
    for (const [i, t] of ts.entries()) {
      const next = i + 1 < ts.length ? (ts[i + 1] ?? t) : (ts[0] ?? t) + TAU;
      if (next > t && isIn(1, (t + next) / 2)) spans.push({ sigma: 1, from: t, to: next });
    }
    return spans;
  }
  const branches: (1 | -1)[] = s.type === 'hyperbola' ? [1, -1] : [1];
  for (const sigma of branches) {
    const ts = allCrossings(s, sigma, r).sort((a, b) => a - b);
    for (const [i, t] of ts.entries()) {
      const next = ts[i + 1];
      if (next !== undefined && next > t && isIn(sigma, (t + next) / 2))
        spans.push({ sigma, from: t, to: next });
    }
  }
  return spans;
}

function chordGap(p: Vec2, a: Vec2, b: Vec2): number {
  const d = { x: b.x - a.x, y: b.y - a.y };
  const len = Math.hypot(d.x, d.y);
  if (!(len > 0)) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * d.y - (p.y - a.y) * d.x) / len;
}

/** Screen points of one interval, refined until each chord is within CONIC_SAGITTA. */
function sample(view: View, s: ConicShape, span: Span): Vec2[] {
  const at = (t: number) => toScreen(view, conicPoint(s, span.sigma, t));
  const pts: Vec2[] = [at(span.from)];
  const n0 = 16;
  const step = (span.to - span.from) / n0;
  const refine = (t0: number, p0: Vec2, t1: number, p1: Vec2, depth: number): void => {
    const tm = (t0 + t1) / 2;
    const pm = at(tm);
    if (depth > 0 && pts.length < MAX_POINTS && chordGap(pm, p0, p1) > CONIC_SAGITTA) {
      refine(t0, p0, tm, pm, depth - 1);
      refine(tm, pm, t1, p1, depth - 1);
      return;
    }
    pts.push(p1);
  };
  for (let i = 0; i < n0; i++) {
    const [t0, t1] = [span.from + i * step, i + 1 === n0 ? span.to : span.from + (i + 1) * step];
    refine(t0, at(t0), t1, at(t1), 20);
  }
  return pts;
}

/** The screen polylines of the visible part of `s`. */
export function conicPaths(view: View, s: ConicShape, r: Rect): Path[] {
  return conicSpans(s, r).map((span) => {
    const full = s.type === 'ellipse' && span.to - span.from >= TAU;
    return { kind: 'poly', pts: sample(view, s, span), closed: full };
  });
}

/**
 * Whether a conic with no visible interval found may still pass through `r` unseen: the
 * rounding of its points at r's centre (ROUNDING·size) is beyond PLACEMENT_PX at the zoom and
 * the curve is within that error of r (first-order distance |F|/|∇F| from r's centre, F the
 * local equation). Then the crossings cannot be trusted and the conic is not drawable, rather
 * than silently missing.
 */
function mayPass(s: ConicShape, r: Rect, zoom: number): boolean {
  const p = { x: (r.minX + r.maxX) / 2 - s.c.x, y: (r.minY + r.maxY) / 2 - s.c.y };
  const [X, Y] = [p.x * s.u.x + p.y * s.u.y, -p.x * s.u.y + p.y * s.u.x];
  const err =
    ROUNDING * (Math.abs(s.c.x) + Math.abs(s.c.y) + Math.abs(X) + Math.abs(Y) + s.a + s.b);
  if (!(err * zoom > PLACEMENT_PX)) return false;
  const [f, gx, gy] = localEquation(s, X, Y);
  const half = Math.hypot(r.maxX - r.minX, r.maxY - r.minY) / 2;
  return Math.abs(f) <= (half + err) * Math.hypot(gx, gy);
}

/** The local equation F(X, Y) = 0 of the shape and its gradient, at (X, Y). */
function localEquation(s: ConicShape, X: number, Y: number): readonly [number, number, number] {
  switch (s.type) {
    case 'ellipse':
      return [
        (X * X) / (s.a * s.a) + (Y * Y) / (s.b * s.b) - 1,
        (2 * X) / (s.a * s.a),
        (2 * Y) / (s.b * s.b),
      ];
    case 'hyperbola':
      return [
        (X * X) / (s.a * s.a) - (Y * Y) / (s.b * s.b) - 1,
        (2 * X) / (s.a * s.a),
        (-2 * Y) / (s.b * s.b),
      ];
    case 'parabola':
      return [X - s.a * Y * Y, 1, -2 * s.a * Y];
    default:
      return assertNever(s.type, 'conic type');
  }
}

/**
 * Whether the conic can be placed within PLACEMENT_PX at `zoom` (see the module comment):
 * 'outside' when no part of it is in `r`.
 */
export function conicPlacement(s: ConicShape, r: Rect, zoom: number): Placement {
  const spans = conicSpans(s, r);
  if (spans.length === 0) return mayPass(s, r, zoom) ? 'unplaceable' : 'outside';
  let size = Math.abs(s.c.x) + Math.abs(s.c.y);
  for (const sp of spans)
    for (const t of [sp.from, (sp.from + sp.to) / 2, sp.to]) {
      const q = conicPoint(s, sp.sigma, t);
      size = Math.max(
        size,
        Math.abs(s.c.x) + Math.abs(s.c.y) + Math.hypot(q.x - s.c.x, q.y - s.c.y),
      );
    }
  const err = ROUNDING * (size + s.a + s.b);
  return Number.isFinite(err) && err * zoom <= PLACEMENT_PX ? 'ok' : 'unplaceable';
}
