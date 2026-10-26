/**
 * J (w ↦ w/|w|², pole at the origin) on a line, segment, ray or pair of rays (ADR-0032
 * decisions 6 and 7). The carrier's distance to the pole decides, as a length with the band:
 *   - through the pole → the same carrier (base point the pole, same direction and chirality
 *     flag); the parameter maps by s(t) = 1/((t − t₀)|d|²), a decreasing bijection of the
 *     projective line (t₀ ↦ ∞, ∞ ↦ 0), so the arc (start, end) becomes (s(end), s(start)):
 *     a segment with an end at the pole → a ray, a segment containing the pole → the two rays
 *     `outside`, a ray from the pole → a ray, a ray pointing away from it → a segment ending at
 *     the pole;
 *   - in the band → Undefined (ambiguous);
 *   - off the pole → a circle through the pole (center F/(2|F|²), r² = 1/(4|F|²), F the foot of
 *     the pole; anchor J(p)), traversed counter-clockwise iff the pole is on the left of the
 *     directed line, so a range (start, end) becomes the arc J(start) → J(end) or its reverse,
 *     with J(∞) = the pole; a full line gives the full circle.
 * Mod p: no order, so a range (not a full line) is Inexact.
 */
import type { Field, Inexact } from '@geomira/num/field';
import { signNormalized, vAdd, vCross, vDot, vScale, vSub, vec } from '../geom';
import type { EvalContext } from '../tool';
import { undef, type Arc, type Line, type Undefined, type Value, type Vec } from '../value';
import { NEAR_POLE, jPoint, noOrder, poleTest, sideOf } from './j-core';
import { projRange, rangeFields, type End } from './proj-range';

const at = <T>(F: Field<T>, l: Line<T>, t: T): Vec<T> => vAdd(F, l.p, vScale(F, l.d, t));

/** Where an end lies: at ∞, at the pole, or before (−1) or after (1) the pole along d. */
type Where = 'inf' | 'pole' | 1 | -1;

/** An image end on the line through the pole: s(e) (∞ when e is the pole), and where e lies. */
type Mapped<T> = { readonly end: End<T>; readonly where: Where } | Undefined | Inexact;

/** The image parameter of an end e and where it lies. */
function mapEnd<T>(F: Field<T>, l: Line<T>, e: End<T>, ctx: EvalContext): Mapped<T> {
  const dd = vDot(F, l.d, l.d);
  if (e === 'inf') return { end: { at: F.zero }, where: 'inf' };
  const w = at(F, l, e.at);
  const pole = poleTest(F, w, ctx);
  if (pole === 'pole') return { end: 'inf', where: 'pole' };
  if (pole !== 'off') return pole;
  const side = sideOf(signNormalized(F, vDot(F, w, l.d), dd, 'length', ctx));
  if (side === 'none') return noOrder(F, 'a range');
  if (side === 0) return undef(NEAR_POLE);
  if (typeof side !== 'number') return side;
  // w = (e − t₀)·d on the carrier, so s(e) = 1/((e − t₀)|d|²) = (w·d)/(|w|²|d|²).
  const s = F.div(vDot(F, w, l.d), F.mul(vDot(F, w, w), dd));
  return { end: { at: s }, where: side };
}

/**
 * Whether the arc from `start` increasing to `end` contains the pole strictly inside. An end
 * before the pole has −1 (e < t₀), after it 1. The two rays `outside` run from hi through ∞
 * to lo: they contain the pole when it lies beyond hi or before lo.
 */
function containsPole(start: Where, end: Where, outside: boolean): boolean {
  if (outside) return start === -1 || end === 1;
  if (start === 'pole' || end === 'pole') return false;
  if (start === 'inf') return end === 1;
  if (end === 'inf') return start === -1;
  return start === -1 && end === 1;
}

/** The image of a line through the pole (decision 7, first case). */
function throughPole<T>(F: Field<T>, l: Line<T>, ctx: EvalContext): Value<T> {
  const base = { kind: 'line' as const, p: vec(F.zero, F.zero), d: l.d, chiral: l.chiral };
  const r = projRange(l);
  if (r === 'full') return { ...base, lo: null, hi: null };
  const [s, e] = [mapEnd(F, l, r.start, ctx), mapEnd(F, l, r.end, ctx)];
  if ('kind' in s) return s;
  if ('kind' in e) return e;
  const through = containsPole(s.where, e.where, l.outside === true);
  return { ...base, ...rangeFields(e.end, s.end, through) };
}

/** The image of a line off the pole, on the side `sigma` of the pole (decision 7, second case). */
function offPole<T>(F: Field<T>, l: Line<T>, sigma: 1 | -1 | 'none'): Value<T> {
  const dd = vDot(F, l.d, l.d);
  const cr = vCross(F, l.d, vSub(F, vec(F.zero, F.zero), l.p));
  // F = p − ((p·d)/|d|²)·d; |F|² = cr²/|d|²; center F/(2|F|²); r² = 1/(4|F|²) = |d|²/(4cr²).
  const foot = vSub(F, l.p, vScale(F, l.d, F.div(vDot(F, l.p, l.d), dd)));
  const cr2 = F.mul(cr, cr);
  const four = F.add(F.add(F.one, F.one), F.add(F.one, F.one));
  const c = vScale(F, foot, F.div(dd, F.add(cr2, cr2)));
  const base = {
    kind: 'circle' as const,
    c,
    r2: F.div(dd, F.mul(four, cr2)),
    anchor: jPoint(F, l.p),
  };
  const r = projRange(l);
  if (r === 'full') return { ...base, arc: null };
  if (sigma === 'none') return noOrder(F, 'a range');
  const img = (e: End<T>): Vec<T> =>
    e === 'inf' ? vec(F.zero, F.zero) : jPoint(F, at(F, l, e.at));
  const [from, to] = [img(r.start), img(r.end)];
  const arc: Arc<T> = sigma === 1 ? { from, to } : { from: to, to: from };
  return { ...base, arc };
}

/** J of a line value (pole at the origin). */
export function jLine<T>(F: Field<T>, l: Line<T>, ctx: EvalContext): Value<T> | Inexact {
  const dd = vDot(F, l.d, l.d);
  const cr = vCross(F, l.d, vSub(F, vec(F.zero, F.zero), l.p));
  const side = sideOf(signNormalized(F, cr, dd, 'length', ctx));
  if (side === 'none')
    return F.isZero(cr, 'length', ctx) ? throughPole(F, l, ctx) : offPole(F, l, 'none');
  if (typeof side !== 'number') return side;
  return side === 0 ? throughPole(F, l, ctx) : offPole(F, l, side);
}
