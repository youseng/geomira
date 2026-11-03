/**
 * The claim kinds of v1 (SPEC §10.1) and the POLYNOMIAL KINDS whitelist of the mod-p rung,
 * as data. Nothing outside this module enumerates claim kinds.
 */
import { ANGLE_KINDS } from './kinds-angles';
import { CONIC_KINDS } from './kinds-conics';
import { CURVE_KINDS } from './kinds-curves';
import { INCIDENCE_KINDS } from './kinds-incidence';
import { LENGTH_KINDS } from './kinds-lengths';
import { METRIC_KINDS } from './kinds-metric';
import { PROJECTIVE_KINDS } from './kinds-projective';
import { TRIANGLE_KINDS } from './kinds-triangles';
import type { ClaimKindSpec } from './kind';
import { withHints } from './kind-hints';

export const CLAIM_KINDS: readonly ClaimKindSpec[] = Object.freeze(
  [
    ...INCIDENCE_KINDS,
    ...CURVE_KINDS,
    ...METRIC_KINDS,
    ...ANGLE_KINDS,
    ...PROJECTIVE_KINDS,
    ...CONIC_KINDS,
    ...TRIANGLE_KINDS,
    ...LENGTH_KINDS,
  ].map(withHints),
);

/**
 * SPEC §10.1: collinear, concyclic, concurrent, parallel, perpendicular, on, tangent, equal
 * points, length and ratio equalities, directed angles, and (ADR-0040) cross ratios and harmonic
 * quadruples of points and of lines, (ADR-0042) six points on a conic, and (ADR-0051) similar and
 * congruent triangles and AB·CD = EF·GH. Undirected angles and AB + CD = EF are not polynomial
 * kinds. The mod-p rung is never used for any other kind (law L17).
 */
export const POLYNOMIAL_KINDS: readonly string[] = Object.freeze(
  CLAIM_KINDS.filter((k) => k.polynomial).map((k) => k.name),
);

/** The kind named `name`, or undefined. */
export function claimKind(name: string): ClaimKindSpec | undefined {
  return CLAIM_KINDS.find((k) => k.name === name);
}
