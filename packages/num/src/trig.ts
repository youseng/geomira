/**
 * Exact special values of trigonometry in degrees, shared by FloatField and RationalField
 * so both fields agree bit for bit on them. By Niven's theorem, the only rational values
 * of sin at a rational number of degrees are 0, ±1/2 and ±1, all at multiples of 30°;
 * and the only rational values of tan there are 0 and ±1, so atan2 is a rational number
 * of degrees only on the axes and the diagonals.
 */

/** 2·sin(r°) for r in {0, 30, …, 330} where it is rational; undefined otherwise. */
const TWICE_SIN: Readonly<Record<number, number>> = Object.freeze({
  0: 0,
  30: 1,
  90: 2,
  150: 1,
  180: 0,
  210: -1,
  270: -2,
  330: -1,
});

/** 2·sin(n°) for an integer n when it is rational, else undefined. */
export function twiceSinOfInteger(n: bigint): number | undefined {
  const r = Number(((n % 360n) + 360n) % 360n);
  return TWICE_SIN[r];
}

/** 2·cos(n°) for an integer n when it is rational, else undefined. */
export function twiceCosOfInteger(n: bigint): number | undefined {
  return twiceSinOfInteger(n + 90n);
}

/**
 * atan2 in degrees on the axes and diagonals, from the signs of y and x and whether
 * |y| = |x|; undefined elsewhere. Precondition: (y, x) ≠ (0, 0).
 */
export function specialAtan2(
  sy: -1 | 0 | 1,
  sx: -1 | 0 | 1,
  diagonal: boolean,
): number | undefined {
  if (sy === 0) return sx > 0 ? 0 : 180;
  if (sx === 0) return sy > 0 ? 90 : -90;
  if (!diagonal) return undefined;
  const a = sx > 0 ? 45 : 135;
  return sy > 0 ? a : -a;
}
