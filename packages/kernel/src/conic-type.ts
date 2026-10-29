/**
 * The type decision of a conic (ADR-0042 decision 4 as amended by ADR-0044): the sign of
 * ac − b², with a parabola decided at the figure's scale in floats. Self-contained (coefficients
 * (a, b, c, d, e, f) of Q = ax² + 2bxy + cy² + 2dx + 2ey + f) so conic.ts can import it.
 */
import type { Field, FieldSign } from '@geomira/num/field';
import { sign3, type ToleranceContext } from '@geomira/num/tolerance';

type Six<T> = readonly [T, T, T, T, T, T];

/**
 * The largest real semi-axis of a central conic (centre to vertex), or Infinity when it has no
 * finite centre. At the centre C, Q(C + v) = Q(C) + vᵀA·v with Q(C) = d·Cx + e·Cy + f, so the
 * semi-axis along an eigenvector of A with eigenvalue λ is √(−Q(C)/λ) when that is real.
 */
function semiAxis([a, b, c, d, e, f]: Six<number>): number {
  const w = a * c - b * b;
  const C = { x: (b * e - c * d) / w, y: (b * d - a * e) / w };
  if (!Number.isFinite(C.x) || !Number.isFinite(C.y)) return Infinity;
  const qc = d * C.x + e * C.y + f;
  // The eigenvalue of larger magnitude directly, the other as w/λ₁ (no cancellation).
  const m = (a + c) / 2;
  const l1 = m + (m >= 0 ? 1 : -1) * Math.hypot((a - c) / 2, b);
  const squares = [l1, w / l1].map((lam) => -qc / lam);
  return Math.sqrt(Math.max(0, ...squares.filter((s) => Number.isFinite(s))));
}

/**
 * The sign of ac − b² as the type reads it: 1 an ellipse, −1 a hyperbola, 0 a parabola.
 * Degenerate cases: exact fields → the exact sign (mod p: 'none', no order); floats → 0 when
 * the conic's centre is at infinity for the figure, i.e. scale over its largest real semi-axis
 * within EPS (no finite centre: 0), 'ambiguous' within the band, else the sign of ac − b².
 * (ac − b² over a² + 2b² + c² is an aspect ratio: a thin hyperbola whose centre is in the figure
 * was called a parabola there; Run 16c audit.)
 */
export function parabolaSign<T>(F: Field<T>, q: Six<T>, ctx: ToleranceContext): FieldSign {
  const w = F.sub(F.mul(q[0], q[2]), F.mul(q[1], q[1]));
  if (F.kind !== 'float') return F.sign(w, 'dimensionless', ctx);
  const n = q.map((x) => F.toNumber(x));
  const A = semiAxis([n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 0, n[4] ?? 0, n[5] ?? 0]);
  const s = A > 0 ? sign3(ctx.scale / A, 'dimensionless', ctx) : 1;
  if (s !== 1) return s;
  const wn = F.toNumber(w);
  return wn > 0 ? 1 : wn < 0 ? -1 : 0;
}
