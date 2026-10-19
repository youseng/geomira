/**
 * Incidence decisions (internal): "P lies on the circle" and "P lies on the line", used by
 * tangent(P, c) and other(a, b, P). Each is a DECISION with the banded sign of num
 * (ADR-0002): a gap of zero (within EPS·scale) is "on"; a gap inside the band is
 * ambiguous (Undefined, never silently on or off); anything larger is "not on". The gap
 * is measured as a length, so small circles and short segments are judged like large ones
 * (ADR-0004). In exact fields the tests are exact and need no normalisation.
 */
import { assertNever } from '@geomira/num/assert';
import { isInexact, type Field, type FieldSign } from '@geomira/num/field';
import { signNormalized, vCross, vDot, vSub } from './geom';
import type { EvalContext } from './tool';
import { undef, type Circle, type Line, type Undefined, type Vec } from './value';

/**
 * √a2 − √b2 as a length, from two squares a2, b2 ≥ 0: (a2 − b2) / (√a2 + √b2) when both
 * roots are representable (always in FloatField), else a2 − b2 (exact fields, where only
 * its zero and sign are used; they are the same). Measuring a discriminant this way keeps
 * a rounding residue of a zero tiny (no square root of it is taken) and judges small and
 * large circles alike (ADR-0004 item 1, ADR-0006). Degenerate: a2 = b2 = 0 → 0.
 */
export function rootGap<T>(F: Field<T>, a2: T, b2: T): T {
  const raw = F.sub(a2, b2);
  const [a, b] = [F.sqrt(a2), F.sqrt(b2)];
  if (isInexact(a) || isInexact(b)) return raw;
  const sum = F.add(a, b);
  return F.eq(sum, F.zero) ? raw : F.div(raw, sum);
}

/**
 * |P − O| − r as a length (rootGap of d² and r²). Degenerate: none (r2 > 0 is the
 * caller's check, so d + r > 0).
 */
export function circleGap<T>(F: Field<T>, P: Vec<T>, c: Circle<T>): T {
  const w = vSub(F, P, c.c);
  return rootGap(F, vDot(F, w, w), c.r2);
}

function decide(s: FieldSign, zero: () => boolean, what: string): Undefined | undefined {
  switch (s) {
    case 0:
      return undefined;
    case 'ambiguous':
      return undef(`ambiguous: within the band of incidence (${what})`);
    case 1:
    case -1:
      return undef(what);
    case 'none':
      return zero() ? undefined : undef(what);
    default:
      return assertNever(s, 'field sign');
  }
}

/**
 * Undefined unless P lies on c; `what` is the reason ("tangent(P, c) needs P on c").
 * Degenerate cases: P off c → Undefined(what); within the band → Undefined("ambiguous:
 * within the band of incidence (what)"); mod p (no order) → the exact zero test.
 */
export function requireOnCircle<T>(
  F: Field<T>,
  P: Vec<T>,
  c: Circle<T>,
  ctx: EvalContext,
  what: string,
): Undefined | undefined {
  const gap = circleGap(F, P, c);
  return decide(F.sign(gap, 'length', ctx), () => F.isZero(gap, 'length', ctx), what);
}

/**
 * Undefined unless P lies on the carrier line of l (the distance cross / |d| as a
 * length). Degenerate cases as requireOnCircle; l must have a direction (caller's check).
 */
export function requireOnLine<T>(
  F: Field<T>,
  P: Vec<T>,
  l: Line<T>,
  ctx: EvalContext,
  what: string,
): Undefined | undefined {
  const cross = vCross(F, vSub(F, P, l.p), l.d);
  const dd = vDot(F, l.d, l.d);
  const s = signNormalized(F, cross, dd, 'length', ctx);
  return decide(s, () => F.isZero(cross, 'length', ctx), what);
}
