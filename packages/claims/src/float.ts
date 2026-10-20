/**
 * Float helpers for residuals (internal). Residuals are plain numbers, never Values; a
 * zero normaliser (which NDG decisions rule out before a residual is used) gives
 * +Infinity, which the noise-floor classification reports as ill-conditioned, never NaN.
 */
import type { Vec } from '@geomira/kernel/value';

export type V = Vec<number>;

export function sub(a: V, b: V): V {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function dot(a: V, b: V): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: V, b: V): number {
  return a.x * b.y - a.y * b.x;
}

export function norm(a: V): number {
  return Math.hypot(a.x, a.y);
}

export function dist(a: V, b: V): number {
  return norm(sub(a, b));
}

/** |x| / den, or +Infinity when den is not positive (see the module comment). */
export function ratio(x: number, den: number): number {
  const r = Math.abs(x) / den;
  return den > 0 && Number.isFinite(r) ? r : Infinity;
}

/** The largest of the values (0 for none). */
export function maxOf(xs: readonly number[]): number {
  let m = 0;
  for (const x of xs) m = Number.isNaN(x) ? Infinity : Math.max(m, x);
  return m;
}
