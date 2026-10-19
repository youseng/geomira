/** Numeric limits shared by the evaluator and the evaluation context (internal). */

/**
 * The largest magnitude of a FloatField argument a tool computes with (2^200 ≈ 1.6e60).
 * Every v1 formula is a polynomial of degree ≤ 4 in its arguments whose divisors are at
 * least (EPS·scale)², so with arguments below this bound no intermediate overflows and
 * no NaN or ±Infinity reaches a zero test, a square root or atan2 (law L1). Beyond it the
 * numbers are not representable for geometry in this field: Inexact (ADR-0003). The
 * circle tools of Run 3a keep every intermediate below about 2^852 (ADR-0004).
 */
export const FLOAT_ARG_LIMIT = 2 ** 200;
