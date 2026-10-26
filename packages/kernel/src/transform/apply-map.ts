/**
 * apply(T, X) for both map types (ADR-0032 decisions 5 and 6), the one implementation behind
 * `apply`, derived layers and drag-through. A similarity is applied by similarity.ts. A Möbius
 * map with c = 0 is the similarity (a/d)·ẑ + b/d. Otherwise M = S₂ ∘ J ∘ S₁ with
 * S₁(z) = ẑ + d/c (an isometry taking the pole to the origin), J(w) = w/|w|² and
 * S₂(w) = a/c + e·w̄, e = (bc − ad)/c²; J is applied per kind:
 *   - point: the pole → Undefined (its image is at infinity); within the band → ambiguous;
 *   - line, segment, ray, two rays: j-lines.ts; circle, arc: j-circles.ts (kinds exchange);
 *   - polygon → Undefined (its sides would become arcs); segment mark → Undefined (lengths are
 *     not kept); angle mark → the mark on the tangents of the image arms (angles are kept,
 *     orientation reversed: the arms swap); text → its anchor's image;
 *   - number, transform, string → Undefined (never imaged); Undefined and Inexact pass.
 */
import { assertNever } from '@geomira/num/assert';
import { cAbs2, cAdd, cConj, cDiv, cMul, cNeg, complex, type Complex } from '@geomira/num/complex';
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { vAdd, vSub } from '../geom';
import { applySimilarity, similarity } from '../similarity';
import type { EvalContext } from '../tool';
import {
  undef,
  type AngleMark,
  type Mobius,
  type Similarity,
  type TransformData,
  type Value,
  type Vec,
} from '../value';
import { AT_POLE, jPoint, poleTest } from './j-core';
import { jCircle } from './j-circles';
import { jLine } from './j-lines';
import { determinant, hasNoPole } from './mobius';

const toC = <T>(v: Vec<T>): Complex<T> => complex(v.x, v.y);
const toV = <T>(z: Complex<T>): Vec<T> => ({ x: z.re, y: z.im });

/** The factors S₁, S₂ of a map with a pole (c ≠ 0). */
function factors<T>(F: Field<T>, m: Mobius<T>): readonly [Similarity<T>, Similarity<T>] {
  const one = complex(F.one, F.zero);
  const e = cDiv(F, cNeg(F, determinant(F, m)), cMul(F, m.c, m.c));
  return [similarity(m.anti, one, cDiv(F, m.d, m.c)), similarity(true, e, cDiv(F, m.a, m.c))];
}

/** A point position through J (the pole excluded), or the reason. */
function jPos<T>(F: Field<T>, w: Vec<T>, ctx: EvalContext): Vec<T> | Value<T> {
  const t = poleTest(F, w, ctx);
  if (t === 'pole') return undef(AT_POLE);
  return t === 'off' ? jPoint(F, w) : t;
}

/** The image of a direction v at w under J's derivative: −v̄/w̄² = −v̄·w²/|w|⁴. */
function jDirection<T>(F: Field<T>, w: Vec<T>, v: Vec<T>): Vec<T> {
  const z = toC(w);
  const n = cAbs2(F, z);
  const num = cNeg(F, cMul(F, cConj(F, toC(v)), cMul(F, z, z)));
  return toV(cDiv(F, num, complex(F.mul(n, n), F.zero)));
}

/** J of an angle mark: on the tangents of the image arms, arms swapped (J reverses angles). */
function jMark<T>(F: Field<T>, m: AngleMark<T>, ctx: EvalContext): Value<T> {
  const b = jPos(F, m.b, ctx);
  if ('kind' in b) return b;
  const arm = (p: Vec<T>): Vec<T> => vAdd(F, b, jDirection(F, m.b, vSub(F, p, m.b)));
  return { ...m, b, from: arm(m.to), to: arm(m.from) };
}

/** J of any value (pole at the origin). */
function applyJ<T>(F: Field<T>, v: Value<T>, ctx: EvalContext): Value<T> {
  switch (v.kind) {
    case 'point': {
      const p = jPos(F, v, ctx);
      return 'kind' in p ? p : { kind: 'point', ...p };
    }
    case 'line':
      return jLine(F, v, ctx);
    case 'circle':
      return jCircle(F, v, ctx);
    case 'polygon':
      return undef('apply: an inversion maps the sides of a polygon to arcs, so it has no image');
    case 'segment_mark':
      return undef('apply: an inversion does not keep lengths, so a segment mark has no image');
    case 'angle_mark':
      return jMark(F, v, ctx);
    case 'text': {
      const at = jPos(F, v.at, ctx);
      return 'kind' in at ? at : { ...v, at };
    }
    case 'number':
    case 'transform':
    case 'string':
      return undef(`apply does not map a ${v.kind}`);
    case 'undefined':
    case 'inexact':
      return v;
    default:
      return assertNever(v, 'value');
  }
}

/** The image of v under a Möbius map. */
function applyMobius<T>(F: Field<T>, m: Mobius<T>, v: Value<T>, ctx: EvalContext): Value<T> {
  if (hasNoPole(F, m))
    return applySimilarity(F, similarity(m.anti, cDiv(F, m.a, m.d), cDiv(F, m.b, m.d)), v);
  const [s1, s2] = factors(F, m);
  const w = applyJ(F, applySimilarity(F, s1, v), ctx);
  return w.kind === 'undefined' || w.kind === 'inexact' ? w : applySimilarity(F, s2, w);
}

/** apply(t, v) for either map type (t valid: mapProblem passed). */
export function applyMap<T>(
  F: Field<T>,
  t: TransformData<T>,
  v: Value<T>,
  ctx: EvalContext,
): Value<T> {
  switch (t.type) {
    case 'similarity':
      return applySimilarity(F, t, v);
    case 'mobius':
      return applyMobius(F, t, v, ctx);
    default:
      return assertNever(t, 'transform');
  }
}

/**
 * The local scale factor |f′(x)| of a map at x (floats; for the editor's drag-end rounding):
 * |a| for a similarity, |ad − bc|/|c·x̂ + d|² for a Möbius map (|a/d| when c = 0).
 * Degenerate: x at the pole (a zero denominator), or a non-finite result → 1 (the rounding is
 * then not scaled).
 */
export function localScale(t: TransformData<number>, x: Vec<number>): number {
  const F = FloatField;
  if (t.type === 'similarity') return finiteScale(Math.hypot(t.a.re, t.a.im));
  const den = cAbs2(F, cAdd(F, cMul(F, t.c, t.anti ? cConj(F, toC(x)) : toC(x)), t.d));
  return den > 0 ? finiteScale(Math.sqrt(cAbs2(F, determinant(F, t))) / den) : 1;
}

function finiteScale(k: number): number {
  return Number.isFinite(k) && k > 0 ? k : 1;
}
