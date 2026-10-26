/**
 * Ranges of segments and rays (internal): whether the point with parameter t lies on a
 * line-like value's range [lo, hi], or on the two rays t ≤ lo, t ≥ hi when the line is
 * `outside` (ADR-0032). A DECISION with the band (ADR-0003 item 15): outside → not on it;
 * within the band of an end → ambiguous; mod p (no order) → Inexact.
 */
import { inexact, type Field, type Inexact } from '@geomira/num/field';
import type { EvalContext } from '../tool';
import { undef, type Line, type Undefined } from '../value';

export function rangeName<T>(l: Line<T>): string {
  if (l.outside === true) return 'pair of rays';
  return l.lo !== null && l.hi !== null ? 'segment' : 'ray';
}

/** rangeStatus on the two rays t ≤ lo, t ≥ hi: on one ray (or at an end) → 'in'. */
function outsideStatus<T>(
  F: Field<T>,
  l: Line<T>,
  lo: T,
  hi: T,
  t: T,
  ctx: EvalContext,
  what: string,
): 'in' | 'out' | Undefined | Inexact {
  const signs = [
    F.sign(F.sub(lo, t), 'dimensionless', ctx),
    F.sign(F.sub(t, hi), 'dimensionless', ctx),
  ];
  if (signs.includes('none'))
    return inexact(
      `whether the ${what} lies on the ${rangeName(l)} needs an order, which ${F.name} lacks`,
    );
  if (signs.some((s) => s === 0 || s === 1)) return 'in';
  if (signs.includes('ambiguous'))
    return undef(`ambiguous: the ${what} is within the band of an end of the ${rangeName(l)}`);
  return 'out';
}

/**
 * 'in' or 'out' of l's range for parameter t of `what` ("intersection", "other
 * intersection"). Degenerate cases: within the band of an end → Undefined (ambiguous); a
 * bounded range mod p → Inexact; an unbounded line → always 'in'.
 */
export function rangeStatus<T>(
  F: Field<T>,
  l: Line<T>,
  t: T,
  ctx: EvalContext,
  what: string,
): 'in' | 'out' | Undefined | Inexact {
  if (l.outside === true && l.lo !== null && l.hi !== null)
    return outsideStatus(F, l, l.lo, l.hi, t, ctx, what);
  const gaps = [l.lo === null ? null : F.sub(t, l.lo), l.hi === null ? null : F.sub(l.hi, t)];
  for (const gap of gaps) {
    if (gap === null) continue;
    const s = F.sign(gap, 'dimensionless', ctx);
    if (s === -1) return 'out';
    if (s === 'ambiguous') {
      return undef(`ambiguous: the ${what} is within the band of an end of the ${rangeName(l)}`);
    }
    if (s === 'none') {
      return inexact(
        `whether the ${what} lies on the ${rangeName(l)} needs an order, which ${F.name} lacks`,
      );
    }
  }
  return 'in';
}

/** The reason for a point outside l's range. */
export function outsideReason<T>(l: Line<T>, what: string): Undefined {
  return undef(`no ${what}: it lies outside the ${rangeName(l)}`);
}

/**
 * Why parameter t of `what` ("intersection", "other intersection") is not in l's range
 * [lo, hi], or undefined when it is (rangeStatus as one value).
 */
export function outOfRange<T>(
  F: Field<T>,
  l: Line<T>,
  t: T,
  ctx: EvalContext,
  what: string,
): Undefined | Inexact | undefined {
  const s = rangeStatus(F, l, t, ctx, what);
  if (s === 'in') return undefined;
  return s === 'out' ? outsideReason(l, what) : s;
}
