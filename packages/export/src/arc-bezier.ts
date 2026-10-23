/**
 * Circle arcs as cubic Bézier pieces accurate at the screen's size (ADR-0028). One cubic with
 * control arms k·r, k = 4/3·tan(θ/4), on an arc of span θ stays within
 * r·(2/27)·sin⁶(θ/4)/cos²(θ/4) of the circle: 2.7·10⁻⁴·r for a quarter turn (Asymptote's
 * unitcircle, pgf's arcs), which is several pixels on a large circle. The error falls as θ⁶,
 * so an arc is cut into the fewest equal pieces that keep it within ARC_BEZIER_PX at its
 * screen radius.
 *
 * Degenerate cases: a span ≤ 0, a radius ≤ 0 or a non-finite input gives one piece
 * (bezierPieces); the count is capped at MAX_PIECES per full turn, which a screen radius up to
 * well beyond the canvas's MAX_ARC_RADIUS never reaches.
 */
import type { Path } from '@geomira/scene/types';
import type { Vec2 } from '@geomira/scene/viewport';

/**
 * Largest distance, in CSS px, between a written Bézier arc and its circle: a quarter of the
 * canvas's own ARC_SAGITTA for the arcs it samples. Asymptote's unitcircle meets it up to a
 * screen radius of about 229 px.
 */
export const ARC_BEZIER_PX = 1 / 16;

/** At most this many pieces per full turn. */
const MAX_PIECES = 256;

/** The largest distance between the circle of radius 1 and one piece of span θ (radians). */
export function bezierArcError(theta: number): number {
  const q = theta / 4;
  return ((2 / 27) * Math.sin(q) ** 6) / Math.cos(q) ** 2;
}

/** The number of equal pieces of an arc of screen radius rPx spanning `span` radians. */
export function bezierPieces(rPx: number, span: number): number {
  if (!(rPx > 0) || !(span > 0) || !Number.isFinite(rPx) || !Number.isFinite(span)) return 1;
  const most = Math.max(1, Math.ceil((MAX_PIECES * span) / (2 * Math.PI)));
  let n = Math.max(1, Math.ceil(span / (Math.PI / 2)));
  while (n < most && rPx * bezierArcError(span / n) > ARC_BEZIER_PX) n++;
  return n;
}

export interface BezierPiece {
  readonly p0: Vec2;
  readonly c0: Vec2;
  readonly c1: Vec2;
  readonly p1: Vec2;
}

/**
 * The Bézier pieces of a display arc, in screen coordinates (angles counter-clockwise as
 * seen, y down, as display.ts lays arcs out).
 */
export function arcBeziers(p: Extract<Path, { kind: 'arc' }>): BezierPiece[] {
  const n = bezierPieces(p.r, p.to - p.from);
  const s = (p.to - p.from) / n;
  const k = (4 / 3) * Math.tan(s / 4) * p.r;
  const at = (a: number) => ({ x: p.c.x + p.r * Math.cos(a), y: p.c.y - p.r * Math.sin(a) });
  // The tangent, counter-clockwise as seen: d/da of `at`, of length 1.
  const dir = (a: number) => ({ x: -Math.sin(a), y: -Math.cos(a) });
  const out: BezierPiece[] = [];
  for (let i = 0; i < n; i++) {
    const [a0, a1] = [p.from + i * s, p.from + (i + 1) * s];
    const [p0, p1, d0, d1] = [at(a0), at(a1), dir(a0), dir(a1)];
    out.push({
      p0,
      c0: { x: p0.x + k * d0.x, y: p0.y + k * d0.y },
      c1: { x: p1.x - k * d1.x, y: p1.y - k * d1.y },
      p1,
    });
  }
  return out;
}
