/**
 * Rounding at drag end (SPEC §12): coordinates are rounded to the FINER of the power-of-ten
 * grid 10^(⌊log10 scale⌋ − 4) and the power of ten just below 0.1 px at the current zoom
 * (the largest power of ten g with g·zoom ≤ 0.1), and stored as exact decimals. Rounding a
 * coordinate moves it by at most g/2, so a rounded point moves by at most g/√2 < 0.1 px on
 * screen. Exponents are decided exactly on rationals (a float log10 can be off by one at a
 * power of ten), and the rounded value is an exact rational with a power-of-ten
 * denominator, so the text format prints it as a short decimal.
 *
 * Glider parameters are rounded on grids derived from the same g, so the glider's point
 * moves by at most g/2 (see `parameterStep`).
 */
import { decimalText, floorLog10, pow10, roundTo } from '@geomira/num/decimal';
import { div, fromNumber, tryToNumber } from '@geomira/num/rational';

// The exact decimal helpers live in num since Run 9b (Randomize writes decimals too).
export { decimalText, floorLog10, pow10, roundTo };

/** Pixels: a rounded point moves by less than this on screen (SPEC §12). */
export const ROUNDING_PX = 0.1;

/**
 * The exponent e of the drag grid 10^e for a figure of `scale` at `zoom` px per unit: the
 * finer of ⌊log10 scale⌋ − 4 and ⌊log10(0.1 / zoom)⌋. `zoom` and `scale` must be finite
 * and positive (the caller's viewport and context guarantee it).
 */
export function gridExponent(scale: number, zoom: number): number {
  const byScale = floorLog10(fromNumber(scale)) - 4;
  const byPixels = floorLog10(div(fromNumber(ROUNDING_PX), fromNumber(zoom)));
  return Math.min(byScale, byPixels);
}

/**
 * The exponent of a glider parameter's grid, so that rounding the parameter moves its point
 * by at most half the drag grid 10^e: for a line parameter t the point moves |Δt|·|d|; for an
 * angle in degrees r·|Δθ|·π/180; for a stereographic ratio w (the smaller of u, v over the
 * larger, |w| ≤ 1) at most 2r·|Δw|. `size` is |d| or r (finite, > 0).
 */
export function parameterStep(form: 'line' | 'angle' | 'stereo', e: number, size: number): number {
  const g = tryToNumber(pow10(e)) ?? Number.MAX_VALUE;
  const bound =
    form === 'line' ? g / size : form === 'angle' ? (g * 180) / (Math.PI * size) : g / (2 * size);
  // A step of at most `bound` moves the point by at most half the grid.
  return Number.isFinite(bound) && bound > 0 ? floorLog10(fromNumber(bound)) : e;
}
