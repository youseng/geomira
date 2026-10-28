/**
 * Projective maps (ADR-0040; SPEC §4 `Transform`, §18 E3), field-generic: a 3×3 matrix m (row by
 * row) acting on homogeneous columns (x, y, 1), defined up to a non-zero factor and never
 * normalised (float and exact runs agree entry by entry, law L3). Every function here is a
 * polynomial in the entries, so it is exact over Q and mod p. A similarity is the matrix of
 * z ↦ a·ẑ + b, so the two compose as matrices; no product collapses (ADR-0019 decision 2:
 * determinants multiply), so compose and inverse never test their result.
 */
import type { Field, Inexact } from '@geomira/num/field';
import { undef, type Projective, type Similarity, type Undefined, type Vec } from '../value';

export type Mat3<T> = Projective<T>['m'];

/** A homogeneous column (x, y, w): a point when w ≠ 0, an ideal point (x, y) when w = 0. */
export type Hom<T> = readonly [T, T, T];

/** The projective map of the matrix m (no validity check). */
export function projective<T>(m: Mat3<T>): Projective<T> {
  return { type: 'projective', m };
}

/** The entry (i, j), i, j ∈ {0, 1, 2}: the index is in range, so the fallback never applies. */
function at<T>(m: Mat3<T>, i: number, j: number): T {
  return m[i * 3 + j] ?? m[0];
}

/** The product a·b. */
export function mul3<T>(F: Field<T>, a: Mat3<T>, b: Mat3<T>): Mat3<T> {
  const e = (i: number, j: number): T =>
    F.add(
      F.add(F.mul(at(a, i, 0), at(b, 0, j)), F.mul(at(a, i, 1), at(b, 1, j))),
      F.mul(at(a, i, 2), at(b, 2, j)),
    );
  return [e(0, 0), e(0, 1), e(0, 2), e(1, 0), e(1, 1), e(1, 2), e(2, 0), e(2, 1), e(2, 2)];
}

/** The adjugate (the transposed cofactors): m·adj(m) = det(m)·I. */
export function adj3<T>(F: Field<T>, m: Mat3<T>): Mat3<T> {
  const c = (i0: number, i1: number, j0: number, j1: number): T =>
    F.sub(F.mul(at(m, i0, j0), at(m, i1, j1)), F.mul(at(m, i0, j1), at(m, i1, j0)));
  return [
    c(1, 2, 1, 2),
    F.neg(c(0, 2, 1, 2)),
    c(0, 1, 1, 2),
    F.neg(c(1, 2, 0, 2)),
    c(0, 2, 0, 2),
    F.neg(c(0, 1, 0, 2)),
    c(1, 2, 0, 1),
    F.neg(c(0, 2, 0, 1)),
    c(0, 1, 0, 1),
  ];
}

/** det m (expanded along the first row). */
export function det3<T>(F: Field<T>, m: Mat3<T>): T {
  const a = adj3(F, m);
  return F.add(
    F.add(F.mul(at(m, 0, 0), at(a, 0, 0)), F.mul(at(m, 0, 1), at(a, 1, 0))),
    F.mul(at(m, 0, 2), at(a, 2, 0)),
  );
}

/** m·v for a homogeneous column. */
export function mulHom<T>(F: Field<T>, m: Mat3<T>, v: Hom<T>): Hom<T> {
  const row = (i: number): T =>
    F.add(F.add(F.mul(at(m, i, 0), v[0]), F.mul(at(m, i, 1), v[1])), F.mul(at(m, i, 2), v[2]));
  return [row(0), row(1), row(2)];
}

/** The homogeneous column of a position (w = 1) or of a direction (w = 0). */
export function homOf<T>(F: Field<T>, v: Vec<T>, finite: boolean): Hom<T> {
  return [v.x, v.y, finite ? F.one : F.zero];
}

/** The matrix of the similarity z ↦ a·z + b, or a·z̄ + b when anti. */
export function similarityMatrix<T>(F: Field<T>, s: Similarity<T>): Mat3<T> {
  const [ar, ai, br, bi] = [s.a.re, s.a.im, s.b.re, s.b.im];
  return s.anti
    ? [ar, ai, br, ai, F.neg(ar), bi, F.zero, F.zero, F.one]
    : [ar, F.neg(ai), br, ai, ar, bi, F.zero, F.zero, F.one];
}

/** A similarity or a projective map as a projective map. */
export function asProjective<T>(F: Field<T>, t: Similarity<T> | Projective<T>): Projective<T> {
  return t.type === 'projective' ? t : projective(similarityMatrix(F, t));
}

/** s ∘ t (t first): the matrix product M_s·M_t. */
export function composeProjective<T>(
  F: Field<T>,
  s: Similarity<T> | Projective<T>,
  t: Similarity<T> | Projective<T>,
): Projective<T> {
  return projective(mul3(F, asProjective(F, s).m, asProjective(F, t).m));
}

/** The inverse map: the adjugate (a valid map has det ≠ 0, so it is the inverse up to a factor). */
export function inverseProjective<T>(F: Field<T>, p: Projective<T>): Projective<T> {
  return projective(adj3(F, p.m));
}

/**
 * Why `p` is not a valid projective map, or undefined when it is. Degenerate cases:
 *   - det m = 0 exactly (every field; also the zero matrix) → Undefined "the map is not
 *     invertible (its determinant is 0)";
 *   - FloatField: det m not a finite double, or with a reciprocal that is not finite → Inexact
 *     "beyond the double range" (ADR-0019 decision 3: a limit of doubles, not a collapse).
 */
export function projectiveProblem<T>(
  F: Field<T>,
  p: Projective<T>,
  tool: string,
): Undefined | Inexact | undefined {
  const det = det3(F, p.m);
  if (F.eq(det, F.zero)) return undef(`${tool}: the map is not invertible (its determinant is 0)`);
  if (F.kind !== 'float') return undefined;
  const n = F.toNumber(det);
  return Number.isFinite(n) && Number.isFinite(1 / n)
    ? undefined
    : { kind: 'inexact', reason: `${tool}: the map is beyond the double range` };
}

/** The third row (m₃₁, m₃₂, m₃₃): W(x, y) = m₃₁x + m₃₂y + m₃₃ vanishes on the line sent to infinity. */
export function wRow<T>(m: Mat3<T>): Hom<T> {
  return [at(m, 2, 0), at(m, 2, 1), at(m, 2, 2)];
}
