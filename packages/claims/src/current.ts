/**
 * The CURRENT figure's judgement (internal): the seed of the noise-floor perturbations with
 * which the live badge (evalClaim, by default) and the local test's "true in the current
 * figure only" judge the figure on the screen, so the two can never disagree.
 */
import type { Seed } from '@geomira/num/rng';

export const CURRENT_FIGURE_SEED: Seed = 0;
