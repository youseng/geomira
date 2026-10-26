/**
 * Ranges of line-like values as arcs of the projective parameter line ℝ ∪ {∞} (ADR-0032
 * decision 7): a range is the arc from `start` to `end` in increasing t. [lo, hi] is
 * (lo, hi); the ray [lo, ∞) is (lo, ∞); (−∞, hi] is (∞, hi); the two rays `outside` (t ≤ lo or
 * t ≥ hi) are (hi, lo), through ∞. A full line has no ends. Internal to the transform code.
 */
import type { Line } from '../value';

/** A finite parameter, or ∞. */
export type End<T> = { readonly at: T } | 'inf';

/** A range as a projective arc, or 'full'. */
export type ProjRange<T> = 'full' | { readonly start: End<T>; readonly end: End<T> };

const fin = <T>(x: T | null): End<T> => (x === null ? 'inf' : { at: x });

/** The projective arc of l's range. */
export function projRange<T>(l: Line<T>): ProjRange<T> {
  if (l.outside === true && l.lo !== null && l.hi !== null)
    return { start: { at: l.hi }, end: { at: l.lo } };
  if (l.lo === null && l.hi === null) return 'full';
  return { start: fin(l.lo), end: fin(l.hi) };
}

/** The range fields of a line for an arc that does or does not pass through ∞. */
export type RangeFields<T> = Pick<Line<T>, 'lo' | 'hi'> & { readonly outside?: true };

/**
 * The fields of the arc (start, end), told whether it passes through ∞ strictly inside
 * (`throughInf`). Ends at ∞ give rays; an arc through ∞ gives the two rays `outside`; any
 * other arc the segment [start, end]. Degenerate: both ends at ∞ never occur (the caller maps
 * a full line to a full line).
 */
export function rangeFields<T>(start: End<T>, end: End<T>, throughInf: boolean): RangeFields<T> {
  if (start === 'inf') return { lo: null, hi: end === 'inf' ? null : end.at };
  if (end === 'inf') return { lo: start.at, hi: null };
  return throughInf ? { lo: end.at, hi: start.at, outside: true } : { lo: start.at, hi: end.at };
}
