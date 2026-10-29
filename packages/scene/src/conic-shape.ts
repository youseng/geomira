/**
 * A conic value → its world shape (ADR-0042): type, centre (a parabola: its vertex), unit axis u
 * and the numbers of its parametrisation, from the coefficients of Q = ax² + 2bxy + cy² + 2dx +
 * 2ey + f by the eigenvectors of the quadratic part (floats; drawing only):
 *   - ellipse:   c + a·cos τ·u + b·sin τ·v, τ in [0, 2π);
 *   - hyperbola: c + σ·a·cosh τ·u + b·sinh τ·v, τ real, one branch for each σ = ±1 (u the
 *     transverse axis);
 *   - parabola:  c + a·τ²·u + τ·v, τ real (u along the axis, toward the opening);
 * with v = rot90(u). The type is decided as the kernel's (ac − b² over a² + 2b² + c², EPS): a
 * conic that close to a parabola is drawn as one; anything else from its centre and axes.
 * Degenerate cases: a non-finite number, an ellipse or hyperbola whose squared semi-axes are
 * not positive (no real point), or a parabola without linear part along its axis → unavailable.
 */
import type { Conic } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import { EPS } from '@geomira/num/tolerance';
import type { Shape } from './types';
import type { Vec2 } from './viewport';

export type ConicShape = Extract<Shape, { readonly kind: 'conic' }>;

/** uᵀ·M₂·u. */
function quad(k: Conic<number>, u: Vec2): number {
  return k.a * u.x * u.x + 2 * k.b * u.x * u.y + k.c * u.y * u.y;
}

function finite(xs: readonly number[]): boolean {
  return xs.every((x) => Number.isFinite(x));
}

/** The unit eigenvector of the quadratic part at angle ½·atan2(2b, a − c), and its quarter turn. */
function axes(k: Conic<number>): readonly [Vec2, Vec2] {
  const t = 0.5 * Math.atan2(2 * k.b, k.a - k.c);
  const u = { x: Math.cos(t), y: Math.sin(t) };
  return [u, { x: -u.y, y: u.x }];
}

function central(k: Conic<number>, delta: number): ConicShape | undefined {
  const c = { x: (k.b * k.e - k.c * k.d) / delta, y: (k.b * k.d - k.a * k.e) / delta };
  const kappa = k.d * c.x + k.e * c.y + k.f;
  const [u, v] = axes(k);
  const [lu, lv] = [quad(k, u), quad(k, v)];
  const [su, sv] = [-kappa / lu, -kappa / lv];
  if (!finite([c.x, c.y, su, sv])) return undefined;
  if (delta > 0) {
    return su > 0 && sv > 0
      ? { kind: 'conic', type: 'ellipse', c, u, a: Math.sqrt(su), b: Math.sqrt(sv) }
      : undefined;
  }
  if (su > 0 && sv < 0)
    return { kind: 'conic', type: 'hyperbola', c, u, a: Math.sqrt(su), b: Math.sqrt(-sv) };
  if (sv > 0 && su < 0)
    return { kind: 'conic', type: 'hyperbola', c, u: v, a: Math.sqrt(sv), b: Math.sqrt(-su) };
  return undefined;
}

function parabola(k: Conic<number>): ConicShape | undefined {
  const [p, q] = axes(k);
  // The axis is the eigenvector of the eigenvalue nearer 0; w is the other one.
  const [u0, w] = Math.abs(quad(k, p)) <= Math.abs(quad(k, q)) ? [p, q] : [q, p];
  const lambda = quad(k, w);
  const du = k.d * u0.x + k.e * u0.y;
  const dw = k.d * w.x + k.e * w.y;
  if (!(Math.abs(du) > 0) || !(Math.abs(lambda) > 0)) return undefined;
  const t0 = -dw / lambda;
  const s0 = ((dw * dw) / lambda - k.f) / (2 * du);
  const c = { x: s0 * u0.x + t0 * w.x, y: s0 * u0.y + t0 * w.y };
  const curv = -lambda / (2 * du);
  const u = curv > 0 ? u0 : { x: -u0.x, y: -u0.y };
  if (!finite([c.x, c.y, curv])) return undefined;
  return { kind: 'conic', type: 'parabola', c, u, a: Math.abs(curv), b: 0 };
}

/** The shape of a conic value, or undefined when it cannot be drawn (see the module comment). */
export function conicShapeOf(k: Conic<number>): ConicShape | undefined {
  const xs = [k.a, k.b, k.c, k.d, k.e, k.f];
  if (!finite(xs)) return undefined;
  const n = k.a * k.a + 2 * k.b * k.b + k.c * k.c;
  if (!(n > 0) || !Number.isFinite(n)) return undefined;
  const delta = k.a * k.c - k.b * k.b;
  return Math.abs(delta) / n <= EPS ? parabola(k) : central(k, delta);
}

/** The coordinates along u and v of parameter τ on branch σ. */
function local(s: ConicShape, sigma: 1 | -1, tau: number): readonly [number, number] {
  switch (s.type) {
    case 'ellipse':
      return [s.a * Math.cos(tau), s.b * Math.sin(tau)];
    case 'hyperbola':
      return [sigma * s.a * Math.cosh(tau), s.b * Math.sinh(tau)];
    case 'parabola':
      return [s.a * tau * tau, tau];
    default:
      return assertNever(s.type, 'conic type');
  }
}

/** The world point of parameter τ on branch σ (±1; ellipses and parabolas: 1). */
export function conicPoint(s: ConicShape, sigma: 1 | -1, tau: number): Vec2 {
  const v = { x: -s.u.y, y: s.u.x };
  const [x, y] = local(s, sigma, tau);
  return { x: s.c.x + x * s.u.x + y * v.x, y: s.c.y + x * s.u.y + y * v.y };
}
