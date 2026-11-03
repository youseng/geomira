/**
 * ADR-0054 (mutation shard kernel-j: conic-pencil.ts): the pencil's behaviour at the edges the
 * Run 16c tests left open. The only degenerate member in the last sampling step of [0, π)
 * (θ within π/96 of π) is found; a four-point contact is one point of multiplicity four at the
 * mean of its two double candidates; an osculating circle in each quadrant gives the triple
 * point and the far point, and near the vertex (the fourth point within ∛EPS·scale) one point;
 * a figure 2²⁵ away from the world origin keeps its points (the near-infinity test measures
 * from the frame's origin); points with equal x are ordered by y; the Newton polish converges
 * quadratically, keeps the start when a step does not lower the gap, and keeps it when the two
 * gradients are parallel.
 */
import { describe, expect, it } from 'vitest';
import type { Coeffs } from '../src/conic';
import { pencilPoints, polish, type PencilInput, type PencilPoint } from '../src/conic-pencil';

type Q = Coeffs<number>;
const ELL: Q = [1, 0, 4, 0, 0, -4];
const UNIT: Q = [1, 0, 1, 0, 0, -1];
const ORIGIN = { x: 0, y: 0 };

function at(q1: Q, q2: Q, o = ORIGIN, scale = 4): PencilInput {
  return { q1, q2, o, ctx: { scale } };
}

function found(inp: PencilInput): readonly PencilPoint[] {
  const r = pencilPoints(inp);
  if (r.kind !== 'points') throw new Error(r.reason);
  return r.points;
}

/** The circle about (cx, cy) with radius² r2, as coefficients. */
const circle = (cx: number, cy: number, r2: number): Q => [
  1,
  0,
  1,
  -cx,
  -cy,
  cx * cx + cy * cy - r2,
];

/** q + k·p coefficient-wise. */
const plus = (q: Q, k: number, p: Q): Q => [
  q[0] + k * p[0],
  q[1] + k * p[1],
  q[2] + k * p[2],
  q[3] + k * p[3],
  q[4] + k * p[4],
  q[5] + k * p[5],
];

/** The osculating circle of ELL (x = 2 cos t, y = sin t) at parameter t. */
function osculating(t: number): Q {
  const T = { x: 2 * Math.cos(t), y: Math.sin(t) };
  const c = { x: 1.5 * Math.cos(t) ** 3, y: -3 * Math.sin(t) ** 3 };
  return circle(c.x, c.y, (T.x - c.x) ** 2 + (T.y - c.y) ** 2);
}

describe('the roots of the pencil', () => {
  it('the only degenerate member in the last sampling step is found', () => {
    // q1 = y(y − 3) + k·(x² + y² − 1): its pencil with the unit circle has one real degenerate
    // member, the lines y = 0 and y = 3, at θ ≈ π − 0.0097 for k = 1/100 (the last of the 96
    // sampling steps) and at θ ≈ 0.0098 for k = −1/100 (the first): the points (±1, 0) both times.
    const lines: Q = [0, 0, 1, 0, -1.5, 0];
    for (const k of [0.01, -0.01]) {
      const pts = found(at(plus(lines, k, UNIT), UNIT));
      expect(pts.map((p) => p.mult)).toEqual([1, 1]);
      expect(pts.map((p) => [p.at.x, p.at.y + 0])).toEqual([
        [expect.closeTo(-1, 14), expect.closeTo(0, 14)],
        [expect.closeTo(1, 14), expect.closeTo(0, 14)],
      ]);
    }
  });
});

describe('contacts', () => {
  it('a four-point contact: one point of multiplicity 4, the mean of its two double candidates', () => {
    // The circle of curvature of ELL at its vertex (2, 0): centre (3/2, 0), radius 1/2. Each line
    // of the chosen member touches at (2, ±5·10⁻⁹); merged by multiplicity, the mean is exact.
    // (In the other order the chosen member touches once: one point of multiplicity 2. The
    // multiplicity only decides the polish; the tools never show it.)
    const pts = found(at(ELL, circle(1.5, 0, 0.25)));
    expect(pts).toHaveLength(1);
    expect(pts[0]?.mult).toBe(4);
    expect(Math.abs((pts[0]?.at.x ?? 0) - 2)).toBeLessThan(1e-12);
    expect(Math.abs(pts[0]?.at.y ?? 1)).toBeLessThan(1e-12);
    const other = found(at(circle(1.5, 0, 0.25), ELL));
    expect(other.map((p) => [p.at.x, p.at.y])).toEqual([[2, 0]]);
  });

  for (const t of [0.6435, 2.4, -2.4, -0.6435])
    it(`an osculating circle at t = ${String(t)}: the triple point and the fourth point`, () => {
      // The osculating circle at t meets the ellipse again at −3t.
      const pts = found(at(ELL, osculating(t)));
      const T = { x: 2 * Math.cos(t), y: Math.sin(t) };
      const S = { x: 2 * Math.cos(-3 * t), y: Math.sin(-3 * t) };
      expect(pts.map((p) => p.mult).sort()).toEqual([1, 3]);
      const triple = pts.find((p) => p.mult === 3);
      const fourth = pts.find((p) => p.mult === 1);
      expect(Math.hypot((triple?.at.x ?? 0) - T.x, (triple?.at.y ?? 0) - T.y)).toBeLessThan(1e-5);
      expect(Math.hypot((fourth?.at.x ?? 0) - S.x, (fourth?.at.y ?? 0) - S.y)).toBeLessThan(1e-12);
    });

  it('near the vertex the fourth point within ∛EPS·scale joins the triple point', () => {
    // At t = 3·10⁻⁴ the fourth point (at −3t) is 1.2·10⁻³ from the triple point: below
    // ∛EPS·scale = 4·10⁻³, so one point of multiplicity 4; at t = 0.03 (0.12 apart) two points.
    const one = found(at(ELL, osculating(3e-4)));
    expect(one.map((p) => p.mult)).toEqual([4]);
    expect(Math.hypot((one[0]?.at.x ?? 0) - 2, (one[0]?.at.y ?? 0) - 3e-4)).toBeLessThan(1e-6);
    expect(found(at(ELL, osculating(0.03))).map((p) => p.mult)).toEqual([1, 3]);
  });
});

describe('the frame and the order', () => {
  it('a figure 2²³ away from the world origin keeps its four points', () => {
    // ELL and the circle x² + y² = 5/2 about (2²³, 2²³), the frame's origin there, scale 1:
    // every coefficient is exact; the points are (±√2, ±√(1/2)) from it. Measured from the
    // world origin (1.2·10⁷ > scale/BAND) they would be near infinity. The curves are evaluated
    // in world coordinates (Q about 2⁴⁸ there), so the points hold to about 10⁻²·scale only.
    const u = 2 ** 23;
    const shift = ([a, b, c, d, e, f]: Q): Q => [
      a,
      b,
      c,
      d - a * u - b * u,
      e - b * u - c * u,
      a * u * u + 2 * b * u * u + c * u * u - 2 * d * u - 2 * e * u + f,
    ];
    const pts = found(at(shift(ELL), shift(circle(0, 0, 2.5)), { x: u, y: u }, 1));
    const [X, Y] = [Math.SQRT2, Math.SQRT1_2];
    expect(pts).toHaveLength(4);
    for (const [i, [x, y]] of [
      [-X, -Y],
      [-X, Y],
      [X, -Y],
      [X, Y],
    ].entries()) {
      const p = pts[i]?.at ?? { x: 0, y: 0 };
      expect(Math.hypot(p.x - u - (x ?? 0), p.y - u - (y ?? 0)), `point ${String(i)}`).toBeLessThan(
        1e-2,
      );
    }
  });

  it('points with the same x are ordered by y', () => {
    // A circle touching ELL inside at (2, 0) (centre (1/2, 0), radius 3/2) meets it again at
    // (−2/3, ±√8/3), both x the same double; mirrored and rotated copies likewise.
    const inner = circle(0.5, 0, 2.25);
    const [x, y] = [-2 / 3, Math.sqrt(8) / 3];
    for (const [q1, q2] of [
      [ELL, inner],
      [inner, ELL],
    ] as const) {
      const pts = found(at(q1, q2));
      expect(pts.map((p) => [p.at.x, p.at.y, p.mult])).toEqual([
        [expect.closeTo(x, 14), expect.closeTo(-y, 14), 1],
        [expect.closeTo(x, 14), expect.closeTo(y, 14), 1],
        [expect.closeTo(2, 14), expect.closeTo(0, 14), 2],
      ]);
    }
    // Rotated by a quarter turn ((x, y) → (−y, x)) and mirrored: the two points share their y.
    const turn = ([a, b, c, d, e, f]: Q): Q => [c, -b, a, -e, d, f];
    const flip = ([a, b, c, d, e, f]: Q): Q => [a, -b, c, d, -e, f];
    for (const [k, sy] of [
      [turn, 1],
      [(q: Q) => flip(turn(q)), -1],
    ] as const) {
      const pts = found(at(k(ELL), k(inner)));
      expect(pts.map((p) => [p.at.x, p.at.y])).toEqual([
        [expect.closeTo(-y, 14), expect.closeTo(sy * x, 14)],
        [expect.closeTo(0, 14), expect.closeTo(sy * 2, 14)],
        [expect.closeTo(y, 14), expect.closeTo(sy * x, 14)],
      ]);
    }
  });
});

describe('the Newton polish', () => {
  const C32 = circle(0, 0, 2.25);
  const [X, Y] = [Math.sqrt(5 / 3), Math.sqrt(7 / 12)];

  it('converges quadratically: 10⁻³ off, three steps reach the rounding of the point', () => {
    for (const [dx, dy] of [
      [1e-3, -1e-3],
      [-1e-3, 5e-4],
    ] as const) {
      const P = polish({ q1: ELL, q2: C32 }, { x: X + dx, y: Y + dy });
      expect(Math.abs(P.x - X)).toBeLessThan(1e-14);
      expect(Math.abs(P.y - Y)).toBeLessThan(1e-14);
    }
  });

  it('keeps the start when a step does not lower the gap', () => {
    // Near the tangency of the unit circle and ELL at (0, ±1), from (1.2, 0.1) the first step
    // lands farther from both curves.
    expect(polish({ q1: UNIT, q2: ELL }, { x: 1.2, y: 0.1 })).toEqual({ x: 1.2, y: 0.1 });
    expect(polish({ q1: UNIT, q2: ELL }, { x: 0.99, y: 0.01 })).toEqual({ x: 0.99, y: 0.01 });
  });

  it('keeps the start where the two gradients are parallel', () => {
    // (0.6, 0.8) on the unit circle, the circle about (1.2, 1.6) of radius 2: both gradients
    // along (0.6, 0.8), so the Jacobian is 0; likewise (1, 0) with ELL (both along x).
    expect(polish({ q1: UNIT, q2: circle(1.2, 1.6, 4) }, { x: 0.6, y: 0.8 })).toEqual({
      x: 0.6,
      y: 0.8,
    });
    expect(polish({ q1: UNIT, q2: ELL }, { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
  });
});
