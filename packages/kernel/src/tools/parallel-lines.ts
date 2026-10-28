/**
 * Parallel lines (internal; ADR-0040): whether two lines meet, are parallel or coincide (on the
 * sine of their angle and the distance between them, as intersect decides since Run 2), and the
 * ideal point where two parallel FULL lines meet. A segment or a ray contains no point at
 * infinity.
 */
import type { Field } from '@geomira/num/field';
import { isZeroNormalized, isZeroVec, vCross, vDot, vSub } from '../geom';
import type { EvalContext } from '../tool';
import type { IdealPoint, Line } from '../value';

/** Whether a line is a full line (no range): only full lines contain their point at infinity. */
export function isFull<T>(l: Line<T>): boolean {
  return l.lo === null && l.hi === null && l.outside !== true;
}

/** Parallelism and coincidence of two lines (sines and a distance, as lineLine decides). */
export function parallelism<T>(
  F: Field<T>,
  a: Line<T>,
  b: Line<T>,
  ctx: EvalContext,
): 'meet' | 'parallel' | 'coincident' {
  const [aa, bb] = [vDot(F, a.d, a.d), vDot(F, b.d, b.d)];
  if (!isZeroNormalized(F, vCross(F, a.d, b.d), F.mul(aa, bb), 'dimensionless', ctx)) return 'meet';
  const on = isZeroNormalized(F, vCross(F, vSub(F, b.p, a.p), a.d), aa, 'length', ctx);
  return on ? 'coincident' : 'parallel';
}

/**
 * Two parallel FULL lines meet at their ideal point (ADR-0040): a's direction and flag. Undefined
 * (the JS value) when they are not two parallel distinct full lines, so the caller goes on with
 * lineLinePair. A line without direction is the pair's to report.
 */
export function idealMeet<T>(
  F: Field<T>,
  a: Line<T>,
  b: Line<T>,
  ctx: EvalContext,
): IdealPoint<T> | undefined {
  if (!isFull(a) || !isFull(b) || isZeroVec(F, a.d, ctx) || isZeroVec(F, b.d, ctx))
    return undefined;
  return parallelism(F, a, b, ctx) === 'parallel'
    ? { kind: 'ideal_point', d: a.d, chiral: a.chiral }
    : undefined;
}
