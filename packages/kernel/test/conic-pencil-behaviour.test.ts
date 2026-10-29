/**
 * Run 16c audit (mutation shard kernel-j: conic-pencil.ts): the pencil's points to full float
 * accuracy against closed forms (so the Newton polish counts), in the documented order (by x,
 * then y), a double point where two curves touch, and a common point far away kept, ambiguous
 * near infinity (beyond scale/BAND) or dropped at infinity (beyond scale/EPS).
 */
import { describe, expect, it } from 'vitest';
import type { Coeffs } from '../src/conic';
import { pencilPoints, type PencilInput } from '../src/conic-pencil';

type Line = readonly [number, number, number];
type XY = { x: number; y: number };

/** The coefficients of the product of two lines αx + βy + γ (Q = ax² + 2bxy + … + f). */
function product([a1, b1, c1]: Line, [a2, b2, c2]: Line): Coeffs<number> {
  return [
    a1 * a2,
    (a1 * b2 + a2 * b1) / 2,
    b1 * b2,
    (a1 * c2 + a2 * c1) / 2,
    (b1 * c2 + b2 * c1) / 2,
    c1 * c2,
  ];
}
const add = (p: Coeffs<number>, q: Coeffs<number>, k: number): Coeffs<number> => [
  p[0] + k * q[0],
  p[1] + k * q[1],
  p[2] + k * q[2],
  p[3] + k * q[3],
  p[4] + k * q[4],
  p[5] + k * q[5],
];

/** Q translated by (u, v): Q(x − u, y − v). */
function shifted([a, b, c, d, e, f]: Coeffs<number>, u: number, v: number): Coeffs<number> {
  const [d2, e2] = [d - a * u - b * v, e - b * u - c * v];
  const f2 = a * u * u + 2 * b * u * v + c * v * v - 2 * d * u - 2 * e * v + f;
  return [a, b, c, d2, e2, f2];
}

function points(inp: PencilInput): XY[] {
  const r = pencilPoints(inp);
  if (r.kind !== 'points') throw new Error(r.reason);
  return r.points.map((p) => p.at);
}

describe('the pencil of two conics', () => {
  const ELLIPSE: Coeffs<number> = [1, 0, 4, 0, 0, -4];
  const CIRCLE: Coeffs<number> = [1, 0, 1, 0, 0, -9 / 4];
  const [X, Y] = [Math.sqrt(5 / 3), Math.sqrt(7 / 12)];

  for (const [u, v] of [
    [0, 0],
    [1000, -700],
  ] as const)
    it(`four simple points to full float accuracy (offset ${String(u)}, ${String(v)})`, () => {
      const pts = points({
        q1: shifted(ELLIPSE, u, v),
        q2: shifted(CIRCLE, u, v),
        o: { x: u, y: v },
        ctx: { scale: 4 },
      });
      const want = [
        [-X, -Y],
        [-X, Y],
        [X, -Y],
        [X, Y],
      ];
      expect(pts).toHaveLength(4);
      // Float accuracy: the rounding of the coordinates (and of Q's terms, about 10⁶ far out).
      const tol = u === 0 ? 1e-14 : 3e-10;
      // By x then y; x values equal up to rounding are ordered by that rounding, so the points
      // are matched in a canonical order here.
      pts.sort((p, q) => Math.round((p.x - q.x) * 1e6) || p.y - q.y);
      for (const [i, [x, y]] of want.entries()) {
        expect(Math.abs((pts[i]?.x ?? 0) - u - (x ?? 0)), `x ${String(i)}`).toBeLessThan(tol);
        expect(Math.abs((pts[i]?.y ?? 0) - v - (y ?? 0)), `y ${String(i)}`).toBeLessThan(tol);
      }
    });

  it('near a tangency the polished points are accurate to a few units of rounding', () => {
    // The ellipse x²/4 + y² = 1 and the circle of radius 1 + 10⁻⁶: four points close in pairs.
    // Unpolished, the worst is about 8·10⁻¹⁴ off; the Newton polish brings it to about 10⁻¹⁴.
    const r2 = (1 + 1e-6) ** 2;
    const x = Math.sqrt((4 * (r2 - 1)) / 3);
    const y = Math.sqrt(r2 - x * x);
    const pts = points({
      q1: [1, 0, 4, 0, 0, -4],
      q2: [1, 0, 1, 0, 0, -r2],
      o: { x: 0, y: 0 },
      ctx: { scale: 4 },
    });
    expect(pts).toHaveLength(4);
    for (const p of pts)
      expect(
        Math.min(
          ...[
            [x, y],
            [-x, y],
            [x, -y],
            [-x, -y],
          ].map(([a, b]) => Math.hypot(p.x - (a ?? 0), p.y - (b ?? 0))),
        ),
      ).toBeLessThan(3e-14);
  });

  it('two curves touching twice: two double points, each where they touch', () => {
    const r = pencilPoints({
      q1: [1, 0, 4, 0, 0, -4],
      q2: [1, 0, 1, 0, 0, -1],
      o: { x: 0, y: 0 },
      ctx: { scale: 4 },
    });
    if (r.kind !== 'points') throw new Error(r.reason);
    expect(r.points.map((p) => p.mult)).toEqual([2, 2]);
    expect(
      r.points.map((p) => [Math.round(p.at.x * 1e6) / 1e6, Math.round(p.at.y * 1e6) / 1e6]),
    ).toEqual([
      [0, -1],
      [0, 1],
    ]);
  });

  /** The line through p and q as a unit form. */
  function through(p: XY, q: XY): Line {
    const [a, b] = [q.y - p.y, p.x - q.x];
    const n = Math.hypot(a, b);
    return [a / n, b / n, (q.x * p.y - p.x * q.y) / n];
  }

  /** Two hyperbolas through A(0, 0), B(2, 0), C(0, 2) and X(R, R/3 + 1): AB·CX + AC·BX, AB·CX − 2·AC·BX. */
  function throughFar(R: number): PencilInput {
    const [A, B, C, X] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: R, y: R / 3 + 1 },
    ];
    const [p, q] = [product(through(A, B), through(C, X)), product(through(A, C), through(B, X))];
    return { q1: add(p, q, 1), q2: add(p, q, -2), o: { x: 1, y: 1 }, ctx: { scale: 4 } };
  }

  it('a common point 10⁶ away is kept; near infinity it is ambiguous; at infinity it is dropped', () => {
    const near = points(throughFar(1e6));
    expect(near).toHaveLength(4);
    expect(Math.abs((near[3]?.x ?? 0) - 1e6) / 1e6).toBeLessThan(1e-9);
    expect(pencilPoints(throughFar(1e8))).toEqual({
      kind: 'undefined',
      reason: 'ambiguous: a common point is near infinity',
    });
    // A, B, C (their order by x then y is decided on rounding noise here: compared as a set).
    const far = points(throughFar(1e11)).map((p) => [
      Math.round(p.x * 1e9) / 1e9 + 0,
      Math.round(p.y * 1e9) / 1e9 + 0,
    ]);
    expect(far.sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0))).toEqual([
      [0, 0],
      [0, 2],
      [2, 0],
    ]);
  });
});
