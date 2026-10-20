/**
 * Similarity transformations (SPEC §4, §8.1), field-generic: z ↦ a·z + b (direct) or
 * z ↦ a·z̄ + b (anti). Everything here is a polynomial in the coordinates, so it is exact
 * over Q and mod p; the only division (`inverse`) is by |a|², which `similarityProblem`
 * guarantees is not zero. A Transform holds a Similarity in v1; 'mobius' and 'projective'
 * are reserved (SPEC §18 E3): when they arrive, `Transform.t` becomes a union and the
 * compiler points at every place (here and in tools/transforms.ts) that must switch on it.
 */
import { assertNever } from '@geomira/num/assert';
import {
  cAbs2,
  cAdd,
  cConj,
  cMul,
  cNeg,
  cScale,
  complex,
  type Complex,
} from '@geomira/num/complex';
import type { Field } from '@geomira/num/field';
import type { ToleranceContext } from '@geomira/num/tolerance';
import {
  undef,
  type Arc,
  type Circle,
  type Line,
  type Similarity,
  type Transform,
  type Undefined,
  type Value,
  type Vec,
} from './value';

function toC<T>(v: Vec<T>): Complex<T> {
  return complex(v.x, v.y);
}

function toV<T>(z: Complex<T>): Vec<T> {
  return { x: z.re, y: z.im };
}

/** The similarity z ↦ a·z + b, or a·z̄ + b when `anti` (no validity check). */
export function similarity<T>(anti: boolean, a: Complex<T>, b: Complex<T>): Similarity<T> {
  return { type: 'similarity', anti, a, b };
}

export function transformOf<T>(s: Similarity<T>): Transform<T> {
  return { kind: 'transform', t: s };
}

/** The identity map. */
export function identity<T>(F: Field<T>): Similarity<T> {
  return similarity(false, complex(F.one, F.zero), complex(F.zero, F.zero));
}

/**
 * Why `s` is not an invertible similarity, or undefined when it is: the scale factor a is
 * zero when BOTH its components are zero as dimensionless quantities (F.isZero: within EPS
 * in FloatField, exact elsewhere). Mod p (p ≡ 3 mod 4), |a|² = 0 only for a = 0, so a
 * valid a is always a valid divisor. Every Transform value a tool returns passes this.
 */
export function similarityProblem<T>(
  F: Field<T>,
  s: Similarity<T>,
  ctx: ToleranceContext,
  tool: string,
): Undefined | undefined {
  return F.isZero(s.a.re, 'dimensionless', ctx) && F.isZero(s.a.im, 'dimensionless', ctx)
    ? undef(`${tool}: the map collapses the plane (scale factor 0)`)
    : undefined;
}

/** The image of a position: a·ẑ + b. */
export function mapPoint<T>(F: Field<T>, s: Similarity<T>, p: Vec<T>): Vec<T> {
  const z = toC(p);
  return toV(cAdd(F, cMul(F, s.a, s.anti ? cConj(F, z) : z), s.b));
}

/** The image of a direction (the linear part): a·d̂. */
export function mapDirection<T>(F: Field<T>, s: Similarity<T>, d: Vec<T>): Vec<T> {
  const z = toC(d);
  return toV(cMul(F, s.a, s.anti ? cConj(F, z) : z));
}

/** The squared scale factor |a|² (lengths scale by |a|, areas by |a|²). */
export function scale2<T>(F: Field<T>, s: Similarity<T>): T {
  return cAbs2(F, s.a);
}

/**
 * s ∘ t (t first, then s; SPEC §6.2 `compose(T1, T2)`). With t: z ↦ a₂ẑ + b₂: a direct s
 * gives a₁a₂, a₁b₂ + b₁ (t's orientation); an anti s gives a₁·conj(a₂), a₁·conj(b₂) + b₁
 * (the opposite orientation).
 */
export function composeSimilarities<T>(
  F: Field<T>,
  s: Similarity<T>,
  t: Similarity<T>,
): Similarity<T> {
  const [a2, b2] = s.anti ? [cConj(F, t.a), cConj(F, t.b)] : [t.a, t.b];
  return similarity(s.anti !== t.anti, cMul(F, s.a, a2), cAdd(F, cMul(F, s.a, b2), s.b));
}

/**
 * The inverse map. Direct: z = (w − b)/a, so a' = conj(a)/|a|², b' = −b·a'. Anti:
 * z = conj(w − b)/conj(a), so a' = a/|a|², b' = −conj(b)·a'. Degenerate: a = 0 is the
 * caller's to exclude with `similarityProblem` (F.div would throw on an exact zero).
 */
export function inverseSimilarity<T>(F: Field<T>, s: Similarity<T>): Similarity<T> {
  const n = cAbs2(F, s.a);
  const inv = F.div(F.one, n);
  const a = cScale(F, s.anti ? s.a : cConj(F, s.a), inv);
  const b = cNeg(F, cMul(F, s.anti ? cConj(F, s.b) : s.b, a));
  return similarity(s.anti, a, b);
}

/**
 * An arc's image. A direct map keeps the counter-clockwise order; an anti map reverses it,
 * so the image of the arc from P to Q is the counter-clockwise arc from Q' to P'.
 */
function mapArc<T>(F: Field<T>, s: Similarity<T>, arc: Arc<T>): Arc<T> {
  const [from, to] = [mapPoint(F, s, arc.from), mapPoint(F, s, arc.to)];
  return s.anti ? { from: to, to: from } : { from, to };
}

/**
 * The image of a line, segment or ray: p' = s(p), d' = a·d̂, the same parameter range
 * (s(p + t·d) = p' + t·d'), and the same chirality flag (SPEC §4: transformed images keep
 * their input's flag).
 */
function mapLine<T>(F: Field<T>, s: Similarity<T>, l: Line<T>): Line<T> {
  return {
    kind: 'line',
    p: mapPoint(F, s, l.p),
    d: mapDirection(F, s, l.d),
    lo: l.lo,
    hi: l.hi,
    chiral: l.chiral,
  };
}

/** The image of a circle: centre, r² scaled by |a|², the anchor and the arc mapped. */
function mapCircle<T>(F: Field<T>, s: Similarity<T>, c: Circle<T>): Circle<T> {
  const base = {
    kind: 'circle' as const,
    c: mapPoint(F, s, c.c),
    r2: F.mul(scale2(F, s), c.r2),
    arc: c.arc === null ? null : mapArc(F, s, c.arc),
  };
  return c.anchor === undefined ? base : { ...base, anchor: mapPoint(F, s, c.anchor) };
}

/**
 * apply(s, X) for every kind (SPEC §8.1). Degenerate cases: a number or a transform has
 * no image → Undefined (numbers and maps are not imaged, ADR-0007); Undefined and Inexact
 * pass through unchanged (SPEC §6.3: transform of Undefined → Undefined).
 */
export function applySimilarity<T>(F: Field<T>, s: Similarity<T>, v: Value<T>): Value<T> {
  switch (v.kind) {
    case 'point':
      return { kind: 'point', ...mapPoint(F, s, v) };
    case 'line':
      return mapLine(F, s, v);
    case 'circle':
      return mapCircle(F, s, v);
    case 'polygon':
      return { kind: 'polygon', pts: v.pts.map((p) => mapPoint(F, s, p)) };
    case 'number':
    case 'transform':
      return undef(`apply does not map a ${v.kind}`);
    case 'undefined':
    case 'inexact':
      return v;
    default:
      return assertNever(v, 'value');
  }
}
