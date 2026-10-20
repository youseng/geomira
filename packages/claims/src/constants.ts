/**
 * Constants of the claim tester (SPEC §10.4, §10.5). None of them is a numeric tolerance:
 * every zero, band and noise-floor threshold comes from packages/num/src/tolerance.ts.
 */

/** LOCAL sampler: Gaussian noise on free points, σ = LOCAL_SIGMA·scale. */
export const LOCAL_SIGMA = 0.02;

/** GLOBAL sampler: Gaussian noise on free points, σ = GLOBAL_SIGMA·scale. */
export const GLOBAL_SIGMA = 0.3;

/**
 * The random similarity's scale factor is 2^u with u uniform in
 * [−SIMILARITY_OCTAVES, SIMILARITY_OCTAVES].
 */
export const SIMILARITY_OCTAVES = 1;

/** Exact rungs: samples are rounded to a grid of scale / 2^GRID_BITS (denominators ≈ 2^10). */
export const GRID_BITS = 10;

/** Rejection sampling: at most RETRY_FACTOR·N attempts for N figures. */
export const RETRY_FACTOR = 50;

/** Below this acceptance rate the hypotheses are reported as hard to satisfy. */
export const HARD_ACCEPTANCE = 0.05;

/**
 * Exact over Q: the size budget, in bits of numerator plus denominator, of every rational
 * the closure computes. A sample that exceeds it falls through to the next rung.
 */
export const EXACT_BUDGET_BITS = 4096;

/** A verdict other than INCONCLUSIVE needs at least this fraction of N valid samples. */
export const MIN_VALID_FRACTION = 0.5;

/** The largest multiplier n of a directed-angle claim `n∡ABC = ∡DEF`. */
export const MAX_ANGLE_MULTIPLE = 12;
