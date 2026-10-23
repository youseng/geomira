/**
 * Bézier arcs (arc-bezier.ts, ADR-0028): the pieces stay within ARC_BEZIER_PX of the circle
 * at every screen radius up to and beyond the canvas's MAX_ARC_RADIUS, measured by sampling
 * the cubics themselves (not by the error formula the piece count uses).
 */
import { describe, expect, it } from 'vitest';
import { MAX_ARC_RADIUS } from '@geomira/scene/display';
import { ARC_BEZIER_PX, arcBeziers, bezierArcError, bezierPieces } from '../src/arc-bezier';

function sampledError(c: { x: number; y: number }, r: number, from: number, to: number): number {
  let worst = 0;
  for (const b of arcBeziers({ kind: 'arc', c, r, from, to }))
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const u = 1 - t;
      const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
      const x = w[0] * b.p0.x + w[1] * b.c0.x + w[2] * b.c1.x + w[3] * b.p1.x;
      const y = w[0] * b.p0.y + w[1] * b.c0.y + w[2] * b.c1.y + w[3] * b.p1.y;
      worst = Math.max(worst, Math.abs(Math.hypot(x - c.x, y - c.y) - r));
    }
  return worst;
}

describe('Bézier arcs at the screen’s size', () => {
  it('the error of one piece is the sampled error (quarter turn: 2.7·10⁻⁴ r)', () => {
    const q = sampledError({ x: 0, y: 0 }, 1, 0, Math.PI / 2);
    expect(bezierArcError(Math.PI / 2)).toBeCloseTo(q, 5);
    expect(q).toBeGreaterThan(2.7e-4);
  });

  it('full circles and arcs from 1 px to beyond MAX_ARC_RADIUS stay within ARC_BEZIER_PX', () => {
    for (const r of [1, 3.5, 40, 200, 1000, 5000, 20000, MAX_ARC_RADIUS, 4 * MAX_ARC_RADIUS])
      for (const [from, to] of [
        [0, 2 * Math.PI],
        [0.3, 1.1],
        [-2, 3],
        [1, 1.0001],
      ] as const) {
        const c = { x: 320 + r / 3, y: 240 - r / 7 };
        expect(sampledError(c, r, from, to)).toBeLessThanOrEqual(ARC_BEZIER_PX * (1 + 1e-6) + 1e-9);
      }
  });

  it('the pieces join end to end, from the start angle to the end angle', () => {
    const bs = arcBeziers({ kind: 'arc', c: { x: 10, y: 20 }, r: 300, from: -1, to: 2.5 });
    expect(bs.length).toBe(bezierPieces(300, 3.5));
    expect(bs[0]?.p0.x).toBeCloseTo(10 + 300 * Math.cos(-1), 9);
    expect(bs[0]?.p0.y).toBeCloseTo(20 - 300 * Math.sin(-1), 9);
    expect(bs.at(-1)?.p1.x).toBeCloseTo(10 + 300 * Math.cos(2.5), 9);
    for (let i = 1; i < bs.length; i++) expect(bs[i]?.p0).toEqual(bs[i - 1]?.p1);
  });

  it('degenerate input gives one piece', () => {
    expect(bezierPieces(0, 1)).toBe(1);
    expect(bezierPieces(10, 0)).toBe(1);
    expect(bezierPieces(Number.NaN, 1)).toBe(1);
    expect(bezierPieces(Number.POSITIVE_INFINITY, 1)).toBe(1);
  });
});
