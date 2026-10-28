/**
 * How a point at infinity is shown (ADR-0040 decision 5): it is never drawn; the Objects panel,
 * the scene's list of objects it does not draw and every export name its direction as an angle
 * from the x axis, in degrees modulo 180° (a direction and its opposite are the same point).
 */
import type { Vec } from './value';

/**
 * The direction's angle in [0°, 180°), rounded to 0.01°. Degenerate: a zero or non-finite
 * direction → NaN is never returned: the angle of (0, 0) is 0 (an ideal point's direction is
 * non-zero by construction).
 */
export function idealDegrees(d: Vec<number>): number {
  const a = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  const m = ((a % 180) + 180) % 180;
  const r = Math.round(m * 100) / 100;
  return Number.isFinite(r) && r < 180 ? r : 0;
}

/** "at infinity, direction 26.57°". */
export function atInfinityText(d: Vec<number>): string {
  return `at infinity, direction ${String(idealDegrees(d))}°`;
}
