/**
 * apply(T, X) for both map types (ADR-0032 decisions 5 and 6), the one implementation behind
 * `apply`, derived layers and drag-through. A similarity is applied by similarity.ts. A Möbius
 * map with c = 0 is the similarity (a/d)·ẑ + b/d. Otherwise M = S₂ ∘ J ∘ S₁ with
 * S₁(z) = ẑ + d/c (an isometry taking the pole to the origin), J(w) = w/|w|² and
 * S₂(w) = a/c + e·w̄, e = (bc − ad)/c²; J is applied per kind:
 *   - point: the pole → Undefined (its image is at infinity); within the band → ambiguous;
 *   - line, segment, ray, two rays: j-lines.ts; circle, arc: j-circles.ts (kinds exchange);
 *   - conic → Undefined (a curve of degree 3 or 4, not an object; ADR-0042);
 *   - polygon → Undefined (its sides would become arcs); segment mark → Undefined (lengths are
 *     not kept); angle mark → the mark on the tangents of the image arms (angles are kept,
 *     orientation reversed: the arms swap); text → its anchor's image;
 *   - ideal point → Undefined (a Möbius map with a pole sends every point at infinity to one
 *     point, ADR-0040); with c = 0 the map is a similarity and maps its direction;
 *   - number, transform, string → Undefined (never imaged); Undefined and Inexact pass.
 * A projective map: proj-apply.ts (ADR-0040); a composite: its maps in turn.
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
import { applyProjective } from './proj-apply';
import { wOf } from './proj-side';
import { det3 } from './projective';

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
    case 'conic':
      return undef(
        'apply: a Möbius map with a pole sends a conic (that is not a circle) to a curve of degree 3 or 4, which is not an object',
      );
    case 'ideal_point':
      return undef(
        'apply: a Möbius map with a pole sends every point at infinity to one point, so a direction has no image of its own',
      );
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
  // An Undefined or Inexact result of J passes through S₂ unchanged (applySimilarity).
  return applySimilarity(F, s2, applyJ(F, applySimilarity(F, s1, v), ctx));
}

/**
 * apply(t, v) for any map type (t valid: mapProblem passed). A composite applies its maps in
 * turn, so its image is defined exactly where every step is (ADR-0040 decision 8).
 */
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
    case 'projective':
      return applyProjective(F, t, v, ctx);
    case 'composite':
      return t.maps.reduce<Value<T>>((x, m) => applyMap(F, m, x, ctx), v);
    default:
      return assertNever(t, 'transform');
  }
}

/**
 * The local scale factor |f′(x)| of a map at x (floats; for the editor's drag-end rounding):
 * |a| for a similarity, |ad − bc|/|c·x̂ + d|² for a Möbius map (|a/d| when c = 0),
 * √(|det m|/|W(x)|³) for a projective map (the square root of its Jacobian), the product along
 * the maps of a composite (each at the image of x so far). Degenerate: x at the pole or on the
 * line sent to infinity (a zero denominator), or a non-finite result → 1 (the rounding is then
 * not scaled).
 */
export function localScale(t: TransformData<number>, x: Vec<number>): number {
  const F = FloatField;
  switch (t.type) {
    case 'similarity':
      return finiteScale(Math.hypot(t.a.re, t.a.im));
    case 'mobius': {
      const den = cAbs2(F, cAdd(F, cMul(F, t.c, t.anti ? cConj(F, toC(x)) : toC(x)), t.d));
      return finiteScale(Math.sqrt(cAbs2(F, determinant(F, t))) / den);
    }
    case 'projective': {
      const w = Math.abs(wOf(F, t.m, x, true));
      return finiteScale(Math.sqrt(Math.abs(det3(F, t.m)) / (w * w * w)));
    }
    case 'composite': {
      let k = 1;
      let at: Vec<number> = x;
      for (const m of t.maps) {
        k *= localScale(m, at);
        const next = applyMap(F, m, { kind: 'point', ...at }, { scale: 1 });
        if (next.kind !== 'point') return finiteScale(k);
        at = next;
      }
      return finiteScale(k);
    }
    default:
      return assertNever(t, 'transform');
  }
}

function finiteScale(k: number): number {
  return Number.isFinite(k) && k > 0 ? k : 1;
}
