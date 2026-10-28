/**
 * The claim kinds of v1 (SPEC §10.1) and the POLYNOMIAL KINDS whitelist of the mod-p rung,
 * as data. Nothing outside this module enumerates claim kinds.
 */
import { ANGLE_KINDS } from './kinds-angles';
import { CURVE_KINDS } from './kinds-curves';
import { INCIDENCE_KINDS } from './kinds-incidence';
import { METRIC_KINDS } from './kinds-metric';
import { PROJECTIVE_KINDS } from './kinds-projective';
import type { ClaimKindSpec } from './kind';
import { withHints } from './kind-hints';

export const CLAIM_KINDS: readonly ClaimKindSpec[] = Object.freeze(
  [...INCIDENCE_KINDS, ...CURVE_KINDS, ...METRIC_KINDS, ...ANGLE_KINDS, ...PROJECTIVE_KINDS].map(
    withHints,
  ),
);

/**
 * SPEC §10.1: collinear, concyclic, concurrent, parallel, perpendicular, on, tangent, equal
 * points, length and ratio equalities, directed angles, and (ADR-0040) cross ratios and harmonic
 * quadruples of points and of lines. Undirected angles are not
 * polynomial kinds. The mod-p rung is never used for any other kind (law L17).
 */
export const POLYNOMIAL_KINDS: readonly string[] = Object.freeze(
  CLAIM_KINDS.filter((k) => k.polynomial).map((k) => k.name),
);

/** The kind named `name`, or undefined. */
export function claimKind(name: string): ClaimKindSpec | undefined {
  return CLAIM_KINDS.find((k) => k.name === name);
}
