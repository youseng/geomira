/**
 * Arcs (internal; Run 13, ADR-0031). A Circle value with `arc = { from, to }` is the arc
 * running counter-clockwise from `from` to `to` (SPEC §4). A point X of the carrier circle
 * lies on that arc iff it is on the right of the chord from → to (or on the chord's line,
 * which meets the circle only at the ends): −cross(to − from, X − from) ≥ 0, the side test
 * the claims' on() already uses (ADR-0008 decision 4). As for segments (range.ts), this is a
 * DECISION with the band: the side measured as a length (the distance from the chord's
 * line); outside → not on the arc; within the band (near an end) → ambiguous; mod p (no
 * order) → Inexact. Tools whose results lie ON the curve (intersect, other, on,
 * tangent_point, tangent_from) honour the arc; tools that use the circle as a whole
 * (center, radius, power, tangent, polar, pole, radical_axis, radical_center, inside and
 * outside) use the carrier circle, as foot and parallel extend a segment to its line.
 */
import { assertNever } from '@geomira/num/assert';
import { inexact, type Field, type Inexact } from '@geomira/num/field';
import { isZeroVec, signNormalized, vCross, vDot, vSub } from '../geom';
import type { EvalContext } from '../tool';
import { undef, type Circle, type Undefined, type Vec } from '../value';

type Side = 'in' | 'out' | 'band' | 'none' | 'ends';

/** The side decision of X against c's arc (c.arc not null). */
function side<T>(
  F: Field<T>,
  arc: NonNullable<Circle<T>['arc']>,
  X: Vec<T>,
  ctx: EvalContext,
): Side {
  const chord = vSub(F, arc.to, arc.from);
  if (isZeroVec(F, chord, ctx)) return 'ends';
  const g = F.neg(vCross(F, chord, vSub(F, X, arc.from)));
  const s = signNormalized(F, g, vDot(F, chord, chord), 'length', ctx);
  switch (s) {
    case 1:
    case 0:
      return 'in';
    case -1:
      return 'out';
    case 'ambiguous':
      return 'band';
    case 'none':
      return 'none';
    default:
      return assertNever(s, 'field sign');
  }
}

/**
 * 'in' or 'out' of c's arc for a point X of its carrier (`what`: "intersection", "other
 * intersection", "touch point"). Degenerate cases: a full circle (arc null) → always 'in';
 * an arc whose ends coincide → Undefined; X within the band of the chord's line (near an
 * end) → Undefined (ambiguous); mod p → Inexact.
 */
export function arcStatus<T>(
  F: Field<T>,
  c: Circle<T>,
  X: Vec<T>,
  ctx: EvalContext,
  what: string,
): 'in' | 'out' | Undefined | Inexact {
  if (c.arc === null) return 'in';
  const s = side(F, c.arc, X, ctx);
  switch (s) {
    case 'in':
    case 'out':
      return s;
    case 'band':
      return undef(`ambiguous: the ${what} is within the band of an end of the arc`);
    case 'none':
      return inexact(`whether the ${what} lies on the arc needs an order, which ${F.name} lacks`);
    case 'ends':
      return undef('the arc has coincident ends');
    default:
      return assertNever(s, 'arc side');
  }
}

/** The reason for a point outside an arc. */
export function outsideArc(what: string): Undefined {
  return undef(`no ${what}: it lies outside the arc`);
}

/** 'in' when X is on every arc of `circles`, 'out' when it is off one, else the reason. */
function onAll<T>(
  F: Field<T>,
  circles: readonly Circle<T>[],
  X: Vec<T>,
  ctx: EvalContext,
  what: string,
): 'in' | 'out' | Undefined | Inexact {
  for (const c of circles) {
    const s = arcStatus(F, c, X, ctx, what);
    if (s !== 'in') return s;
  }
  return 'in';
}

/**
 * Why X (a point of each circle's carrier) is not on the arcs of `circles`, or undefined
 * when it is on all of them (full circles always are).
 */
export function offArcs<T>(
  F: Field<T>,
  circles: readonly Circle<T>[],
  X: Vec<T>,
  ctx: EvalContext,
  what: string,
): Undefined | Inexact | undefined {
  const s = onAll(F, circles, X, ctx, what);
  if (s === 'in') return undefined;
  return s === 'out' ? outsideArc(what) : s;
}

/**
 * The candidates on every arc of `circles`: outside ones dropped; none left → "no
 * <what>: it lies outside the arc"; an ambiguous or Inexact decision → that value.
 */
export function onArcs<T, C extends { readonly at: Vec<T> }>(
  F: Field<T>,
  circles: readonly Circle<T>[],
  list: readonly C[],
  ctx: EvalContext,
  what: string,
): readonly C[] | Undefined | Inexact {
  if (circles.every((c) => c.arc === null)) return list;
  const kept: C[] = [];
  for (const cand of list) {
    const s = onAll(F, circles, cand.at, ctx, what);
    if (s === 'in') kept.push(cand);
    else if (s !== 'out') return s;
  }
  return kept.length > 0 ? kept : outsideArc(what);
}

/**
 * A glider's point X of c's carrier, clamped to c's arc: X itself on the arc or within the
 * band of an end (where clamping moves it by less than the band), else the nearer end.
 * Clamping is continuous except where both ends are equally far (on the other side of the
 * circle): the choice of end is a decision there, so within the band → Undefined
 * (ambiguous). Degenerate cases: mod p → Inexact; coincident ends → Undefined.
 */
export function clampToArc<T>(
  F: Field<T>,
  c: Circle<T>,
  X: Vec<T>,
  ctx: EvalContext,
): Vec<T> | Undefined | Inexact {
  if (c.arc === null) return X;
  const s = side(F, c.arc, X, ctx);
  if (s === 'in' || s === 'band') return X;
  if (s === 'ends') return undef('the arc has coincident ends');
  if (s === 'none') return inexact(`clamping to an arc needs an order, which ${F.name} lacks`);
  const [a, b] = [vSub(F, X, c.arc.from), vSub(F, X, c.arc.to)];
  const nearer = F.sign(F.sub(vDot(F, b, b), vDot(F, a, a)), 'area', ctx);
  if (nearer === 1) return c.arc.from;
  if (nearer === -1) return c.arc.to;
  return undef('ambiguous: the glider is equally far from both ends of the arc');
}
