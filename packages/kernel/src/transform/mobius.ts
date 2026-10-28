/**
 * Möbius maps (ADR-0032; SPEC §4 `Transform`, §18 E3), field-generic: z ↦ (a·ẑ + b)/(c·ẑ + d)
 * with ẑ = z̄ when `anti`, as a matrix [[a, b], [c, d]] defined up to a non-zero factor and never
 * normalised (float and exact runs agree entry by entry, law L3). Every function here is a
 * polynomial in the entries, so it is exact over Q and mod p.
 *
 * The transform union: a similarity stays a Similarity under compose and inverse with another
 * similarity (similarity.ts, unchanged); a similarity or Möbius map with a Möbius map is a
 * product of 2×2 matrices; a similarity or projective map with a projective map a product of
 * 3×3 matrices (projective.ts, ADR-0040); a Möbius map with a pole and a projective map are kept
 * as a Composite of their factors (ADR-0040 decision 8: merged by type only, never by a numeric
 * test, so every field builds the same shape). No product collapses (ADR-0019 decision 2:
 * determinants multiply), so compose and inverse never test their result; a map is degenerate
 * where it is built (inversion with k = 0).
 */
import { assertNever } from '@geomira/num/assert';
import { cAdd, cConj, cMul, cNeg, cSub, complex, type Complex } from '@geomira/num/complex';
import type { Field, Inexact } from '@geomira/num/field';
import { composeSimilarities, inverseSimilarity, similarityProblem } from '../similarity';
import {
  undef,
  type Mobius,
  type Projective,
  type Similarity,
  type TransformData,
  type Undefined,
} from '../value';
import { composeProjective, inverseProjective, projectiveProblem } from './projective';

/** The Möbius map z ↦ (a·ẑ + b)/(c·ẑ + d) (no validity check). */
export function mobius<T>(
  anti: boolean,
  a: Complex<T>,
  b: Complex<T>,
  c: Complex<T>,
  d: Complex<T>,
): Mobius<T> {
  return { type: 'mobius', anti, a, b, c, d };
}

/** A similarity or Möbius map as a matrix: a similarity a·ẑ + b is [[a, b], [0, 1]]. */
export function asMobius<T>(F: Field<T>, t: Similarity<T> | Mobius<T>): Mobius<T> {
  switch (t.type) {
    case 'similarity':
      return mobius(t.anti, t.a, t.b, complex(F.zero, F.zero), complex(F.one, F.zero));
    case 'mobius':
      return t;
    default:
      return assertNever(t, 'transform');
  }
}

/** ad − bc, the determinant of the matrix. */
export function determinant<T>(F: Field<T>, m: Mobius<T>): Complex<T> {
  return cSub(F, cMul(F, m.a, m.d), cMul(F, m.b, m.c));
}

function isZeroC<T>(F: Field<T>, z: Complex<T>): boolean {
  return F.eq(z.re, F.zero) && F.eq(z.im, F.zero);
}

/** Whether the map has no pole: c = 0 exactly (it is then a similarity). */
export function hasNoPole<T>(F: Field<T>, m: Mobius<T>): boolean {
  return isZeroC(F, m.c);
}

/**
 * Why `m` is not a valid Möbius map, or undefined when it is. Degenerate cases:
 *   - ad − bc = 0 exactly (every field; also a = b = c = d = 0) → Undefined "the map is not
 *     invertible (ad − bc = 0)";
 *   - FloatField: ad − bc not finite (also whenever an entry is not finite), or a determinant
 *     whose squared size is not a positive finite double with a finite reciprocal → Inexact
 *     "beyond the double range" (ADR-0019 decision 3: a limit of doubles, not a collapse).
 * Mod p (p ≡ 3 mod 4), |z|² = 0 only for z = 0.
 */
export function mobiusProblem<T>(
  F: Field<T>,
  m: Mobius<T>,
  tool: string,
): Undefined | Inexact | undefined {
  const det = determinant(F, m);
  const beyond: Inexact = {
    kind: 'inexact',
    reason: `${tool}: the map is beyond the double range`,
  };
  if (isZeroC(F, det)) return undef(`${tool}: the map is not invertible (ad − bc = 0)`);
  if (F.kind !== 'float') return undefined;
  const [dr, di] = [F.toNumber(det.re), F.toNumber(det.im)];
  const n = dr * dr + di * di;
  // n ≥ 0; n = 0 (underflow) fails the reciprocal test.
  return Number.isFinite(n) && Number.isFinite(1 / n) ? undefined : beyond;
}

/**
 * Why a map of any type is not valid (similarityProblem, mobiusProblem, projectiveProblem; a
 * composite: the first problem of its maps).
 */
export function mapProblem<T>(
  F: Field<T>,
  t: TransformData<T>,
  tool: string,
): Undefined | Inexact | undefined {
  switch (t.type) {
    case 'similarity':
      return similarityProblem(F, t, tool);
    case 'mobius':
      return mobiusProblem(F, t, tool);
    case 'projective':
      return projectiveProblem(F, t, tool);
    case 'composite':
      for (const x of t.maps) {
        const p = mapProblem(F, x, tool);
        if (p !== undefined) return p;
      }
      return undefined;
    default:
      return assertNever(t, 'transform');
  }
}

function conjM<T>(F: Field<T>, m: Mobius<T>): Mobius<T> {
  return mobius(m.anti, cConj(F, m.a), cConj(F, m.b), cConj(F, m.c), cConj(F, m.d));
}

/** The matrix product of the entries (orientation set by the caller). */
function product<T>(F: Field<T>, s: Mobius<T>, t: Mobius<T>, anti: boolean): Mobius<T> {
  const mul = (x: Complex<T>, y: Complex<T>, z: Complex<T>, w: Complex<T>): Complex<T> =>
    cAdd(F, cMul(F, x, y), cMul(F, z, w));
  return mobius(
    anti,
    mul(s.a, t.a, s.b, t.c),
    mul(s.a, t.b, s.b, t.d),
    mul(s.c, t.a, s.d, t.c),
    mul(s.c, t.b, s.d, t.d),
  );
}

/** A map that is not a composite (the factors of a Composite). */
type Factor<T> = Similarity<T> | Mobius<T> | Projective<T>;

/**
 * s ∘ t (t first) as ONE map, when the two are of one family (a similarity with any, Möbius
 * with Möbius, projective with projective), else undefined (a Möbius map and a projective map).
 * Two similarities: composeSimilarities. Möbius: M_s·M_t when s is direct and M_s·conj(M_t)
 * when s is anti (s then reads conj of t's value); anti = anti_s xor anti_t. Projective: the
 * 3×3 product. Decided by type only, never by a numeric test.
 */
function composeFactors<T>(F: Field<T>, s: Factor<T>, t: Factor<T>): Factor<T> | undefined {
  if (s.type === 'similarity' && t.type === 'similarity') return composeSimilarities(F, s, t);
  if (s.type !== 'projective' && t.type !== 'projective') {
    const [ms, mt] = [asMobius(F, s), asMobius(F, t)];
    return product(F, ms, s.anti ? conjM(F, mt) : mt, s.anti !== t.anti);
  }
  if (s.type === 'mobius' || t.type === 'mobius') return undefined;
  return composeProjective(F, s, t);
}

/** The factors of a map, the first applied first. */
function factorsOf<T>(t: TransformData<T>): readonly Factor<T>[] {
  return t.type === 'composite' ? t.maps : [t];
}

/** The maps applied in order, adjacent maps of one family merged; one map is returned as is. */
function chain<T>(F: Field<T>, maps: readonly Factor<T>[]): TransformData<T> {
  const out: Factor<T>[] = [];
  for (const f of maps) {
    const top = out[out.length - 1];
    const merged = top === undefined ? undefined : composeFactors(F, f, top);
    if (merged !== undefined) out[out.length - 1] = merged;
    else out.push(f);
  }
  const [only] = out;
  return out.length === 1 && only !== undefined ? only : { type: 'composite', maps: out };
}

/**
 * s ∘ t (t first): the factors of t, then those of s, merged where one map results (the
 * composition of two similarities, of Möbius maps, of projective maps, or of a similarity with
 * either); a Möbius map with a pole next to a projective map stays a Composite (ADR-0040).
 */
export function composeMaps<T>(
  F: Field<T>,
  s: TransformData<T>,
  t: TransformData<T>,
): TransformData<T> {
  return chain(F, [...factorsOf(t), ...factorsOf(s)]);
}

/**
 * The inverse map: inverseSimilarity, or the adjugate [[d, −b], [−c, a]] of a Möbius map
 * (conjugated when anti: w = M(z̄) gives z = conj(M⁻¹(w)) = conj(M⁻¹)(w̄)). Degenerate: an
 * invalid map is the caller's to exclude (mapProblem).
 */
export function inverseMap<T>(F: Field<T>, t: TransformData<T>): TransformData<T> {
  switch (t.type) {
    case 'similarity':
    case 'mobius':
    case 'projective':
      return inverseFactor(F, t);
    case 'composite':
      return chain(
        F,
        [...t.maps].reverse().map((x) => inverseFactor(F, x)),
      );
    default:
      return assertNever(t, 'transform');
  }
}

/** The inverse of one factor (of the same type). */
function inverseFactor<T>(F: Field<T>, t: Factor<T>): Factor<T> {
  switch (t.type) {
    case 'similarity':
      return inverseSimilarity(F, t);
    case 'mobius': {
      const adj = mobius(t.anti, t.d, cNeg(F, t.b), cNeg(F, t.c), t.a);
      return t.anti ? conjM(F, adj) : adj;
    }
    case 'projective':
      return inverseProjective(F, t);
    default:
      return assertNever(t, 'transform');
  }
}
