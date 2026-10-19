import { assertNever } from './assert';

/**
 * Tolerances (SPEC §3.1). This is the ONLY file allowed to contain tolerance literals
 * (`pnpm rules` enforces it). Every zero test is relative to the figure scale, which is
 * passed explicitly in a ToleranceContext, never held globally.
 */

/** Relative tolerance of construction zero tests (lengths vs EPS·scale, areas vs EPS·scale²). */
export const EPS = 1e-9;

/** Relative DECISION band: a deciding quantity inside it is AMBIGUOUS, never silently decided. */
export const BAND = 1e-7;

/** Lower clamp of the noise floor, so that "0 < 100·0" cannot fail on exact-looking results. */
export const FLOOR_MIN = 1e-14;

/** A sample whose noise floor exceeds this is ILL-CONDITIONED (invalid, not false). */
export const FLOOR_MAX = 1e-6;

/** Size of each random perturbation of the free inputs, relative to the scale. */
export const FLOOR_DELTA = 1e-10;

/** Number of perturbations used to estimate the noise floor. */
export const FLOOR_SAMPLES = 3;

/** A residual below TRUE_FACTOR·floor is TRUE. */
export const TRUE_FACTOR = 100;

/** A residual above max(FALSE_FACTOR·floor, FALSE_ABS) is FALSE. */
export const FALSE_FACTOR = 1e4;

/** Absolute lower bound of the FALSE threshold: a residual of 1e-10 is never called false. */
export const FALSE_ABS = 1e-8;

/**
 * Largest accepted figure scale. Beyond it EPS·scale² approaches the double range and
 * the thresholds would stop meaning anything; such a figure is rejected loudly.
 */
export const MAX_SCALE = 1e100;

/** Physical dimension of a quantity, which decides the power of the scale in its threshold. */
export type Dim = 'length' | 'area' | 'dimensionless';

/** The explicit scale of an evaluation (SPEC §3.1: `ctx.scale`, ≥ 1). */
export interface ToleranceContext {
  readonly scale: number;
}

/** Result of a banded sign test. */
export type Sign3 = -1 | 0 | 1 | 'ambiguous';

/** Classification of a float claim residual against its noise floor. */
export type ResidualClass = 'true' | 'false' | 'ambiguous' | 'ill-conditioned';

/** Thresholds of classifyResidual for one floor estimate. */
export interface ResidualThresholds {
  /** The floor after the FLOOR_MIN clamp. */
  readonly floor: number;
  /** Residuals strictly below this are TRUE. */
  readonly trueBelow: number;
  /** Residuals strictly above this are FALSE. */
  readonly falseAbove: number;
}

/**
 * The context for a figure whose bounding-box diameter (free points and explicit radii)
 * is `diameter`. Degenerate cases: diameter < 1 (including 0, a single point) → scale 1,
 * as SPEC requires scale ≥ 1; negative, NaN, ±Infinity or above MAX_SCALE → RangeError.
 */
export function toleranceContext(diameter: number): ToleranceContext {
  if (!(diameter >= 0) || diameter > MAX_SCALE) {
    throw new RangeError(
      `figure diameter must be in [0, ${String(MAX_SCALE)}], got ${String(diameter)}`,
    );
  }
  return { scale: Math.max(1, diameter) };
}

function checkedScale(ctx: ToleranceContext): number {
  const s = ctx.scale;
  if (!(s >= 1 && s <= MAX_SCALE)) {
    throw new RangeError(`ctx.scale must be in [1, ${String(MAX_SCALE)}], got ${String(s)}`);
  }
  return s;
}

function scalePower(dim: Dim, s: number): number {
  switch (dim) {
    case 'length':
      return s;
    case 'area':
      return s * s;
    case 'dimensionless':
      return 1;
    default:
      return assertNever(dim, 'dimension');
  }
}

function checkedFinite(x: number, what: string): number {
  if (!Number.isFinite(x)) throw new RangeError(`${what}: non-finite input ${String(x)}`);
  return x;
}

/** EPS·scale^k for the dimension's power k. Degenerate: invalid ctx.scale → RangeError. */
export function zeroThreshold(dim: Dim, ctx: ToleranceContext): number {
  return EPS * scalePower(dim, checkedScale(ctx));
}

/** BAND·scale^k for the dimension's power k. Degenerate: invalid ctx.scale → RangeError. */
export function bandThreshold(dim: Dim, ctx: ToleranceContext): number {
  return BAND * scalePower(dim, checkedScale(ctx));
}

/**
 * Construction zero test: |x| ≤ EPS·scale^k (inclusive). Degenerate cases: NaN or ±Infinity
 * → RangeError (a caller bug, never a silent answer); invalid ctx.scale → RangeError.
 */
export function isZero(x: number, dim: Dim, ctx: ToleranceContext): boolean {
  return Math.abs(checkedFinite(x, 'isZero')) <= zeroThreshold(dim, ctx);
}

/** isZero for a length: |x| ≤ EPS·scale. Degenerate cases as isZero. */
export function isZeroLen(x: number, ctx: ToleranceContext): boolean {
  return isZero(x, 'length', ctx);
}

/** isZero for an area: |x| ≤ EPS·scale². Degenerate cases as isZero. */
export function isZeroArea(x: number, ctx: ToleranceContext): boolean {
  return isZero(x, 'area', ctx);
}

/** isZero for a dimensionless quantity: |x| ≤ EPS. Degenerate: non-finite → RangeError. */
export function isZeroDimless(x: number): boolean {
  return Math.abs(checkedFinite(x, 'isZeroDimless')) <= EPS;
}

/**
 * Banded sign for decisions (selectors, incidence in `other(P)`, hypotheses):
 * |x| ≤ EPS·scale^k → 0; EPS·scale^k < |x| < BAND·scale^k → 'ambiguous'; otherwise the
 * sign of x. So a decision between −1 and 1 always passes through 'ambiguous' or 0.
 * Degenerate cases: non-finite x or invalid ctx.scale → RangeError.
 */
export function sign3(x: number, dim: Dim, ctx: ToleranceContext): Sign3 {
  const a = Math.abs(checkedFinite(x, 'sign3'));
  if (a <= zeroThreshold(dim, ctx)) return 0;
  if (a < bandThreshold(dim, ctx)) return 'ambiguous';
  return x > 0 ? 1 : -1;
}

/**
 * Noise floor estimate: max over k of |r(x + δ_k) − r(x)|, clamped below at FLOOR_MIN.
 * Degenerate cases: no perturbed residual → RangeError; a NaN residual makes the floor
 * NaN (Math.max propagates it), which classifyResidual reports as ILL-CONDITIONED.
 */
export function noiseFloor(base: number, perturbed: readonly number[]): number {
  if (perturbed.length === 0) throw new RangeError('noiseFloor needs at least one perturbation');
  return Math.max(FLOOR_MIN, ...perturbed.map((r) => Math.abs(r - base)));
}

/**
 * The TRUE and FALSE thresholds for a floor estimate (after the FLOOR_MIN clamp).
 * Degenerate: a negative floor → RangeError.
 */
export function residualThresholds(floor: number): ResidualThresholds {
  if (floor < 0) throw new RangeError(`noise floor must be ≥ 0, got ${String(floor)}`);
  const f = Math.max(floor, FLOOR_MIN);
  return {
    floor: f,
    trueBelow: TRUE_FACTOR * f,
    falseAbove: Math.max(FALSE_FACTOR * f, FALSE_ABS),
  };
}

/**
 * SPEC §3.1 classification of a float residual (dimensionless, ≥ 0) against its floor:
 * floor > FLOOR_MAX → ill-conditioned; residual < 100·floor → true;
 * residual > max(1e4·floor, FALSE_ABS) → false; otherwise ambiguous.
 * Degenerate cases: NaN or +Infinity residual or floor → ill-conditioned (an invalid
 * sample, never false); a negative residual or floor (including −Infinity) → RangeError.
 */
export function classifyResidual(residual: number, floor: number): ResidualClass {
  if (residual < 0 || floor < 0) {
    throw new RangeError(
      `residual and floor must be ≥ 0, got ${String(residual)}, ${String(floor)}`,
    );
  }
  if (!Number.isFinite(residual) || !Number.isFinite(floor)) return 'ill-conditioned';
  const t = residualThresholds(floor);
  if (t.floor > FLOOR_MAX) return 'ill-conditioned';
  if (residual < t.trueBelow) return 'true';
  if (residual > t.falseAbove) return 'false';
  return 'ambiguous';
}
