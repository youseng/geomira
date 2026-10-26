/**
 * J (w ↦ w/|w|², pole at the origin) on a circle or arc (ADR-0032 decisions 6 and 7). The
 * pole's gap to the circle (circleGap, a length, with the band) decides:
 *   - off the circle → the circle with center c/s and r² = r²/s², s = |c|² − r² (the pole's
 *     power), and the anchor's image; an arc keeps its order when the pole is inside (s < 0)
 *     and swaps its ends when it is outside (s > 0): J reverses orientation, and inside it also
 *     exchanges the disc with its outside;
 *   - in the band → Undefined (ambiguous);
 *   - on the circle → the line w·c = ½: p = c/(2|c|²), d = rot90(c), chiral (a quarter turn of
 *     the direction from the pole to the center, decision 9). Its parameter τ increases along
 *     the counter-clockwise traversal from the pole, so an arc gives: a ray when an end is the
 *     pole; the two rays `outside` when the arc contains the pole (ADR-0031's side test); the
 *     segment [τ(from), τ(to)] otherwise. A full circle gives the full line.
 * Mod p: the side of the pole needs an order, so an arc is Inexact; full circles are exact.
 */
import type { Field, Inexact } from '@geomira/num/field';
import { vDot, vRot90, vScale, vSub, vec } from '../geom';
import { circleGap } from '../incidence';
import type { EvalContext } from '../tool';
import { arcStatus } from '../tools/arc-range';
import { undef, type Arc, type Circle, type Line, type Value, type Vec } from '../value';
import { jPoint, noOrder, poleTest, sideOf } from './j-core';

const ORIGIN = <T>(F: Field<T>): Vec<T> => vec(F.zero, F.zero);

/** The image circle of a circle off the pole; `side` 1: the pole outside, −1: inside. */
function offPole<T>(F: Field<T>, k: Circle<T>, side: 1 | -1 | 'none'): Value<T> | Inexact {
  const s = F.sub(vDot(F, k.c, k.c), k.r2);
  const inv = F.div(F.one, s);
  const base = {
    kind: 'circle' as const,
    c: vScale(F, k.c, inv),
    r2: F.mul(k.r2, F.mul(inv, inv)),
  };
  const withAnchor = k.anchor === undefined ? base : { ...base, anchor: jPoint(F, k.anchor) };
  if (k.arc === null) return { ...withAnchor, arc: null };
  if (side === 'none') return noOrder(F, 'an arc');
  const [from, to] = [jPoint(F, k.arc.from), jPoint(F, k.arc.to)];
  const arc: Arc<T> = side === 1 ? { from: to, to: from } : { from, to };
  return { ...withAnchor, arc };
}

/** The image line of a circle through the pole (with its range from the arc). */
function throughPole<T>(F: Field<T>, k: Circle<T>, ctx: EvalContext): Value<T> | Inexact {
  const cc = vDot(F, k.c, k.c);
  const p = vScale(F, k.c, F.div(F.one, F.add(cc, cc)));
  const d = vRot90(F, k.c);
  const base: Line<T> = { kind: 'line', p, d, lo: null, hi: null, chiral: true };
  if (k.arc === null) return base;
  const tau = (P: Vec<T>): T => F.div(vDot(F, vSub(F, jPoint(F, P), p), d), cc);
  const [f, t] = [poleTest(F, k.arc.from, ctx), poleTest(F, k.arc.to, ctx)];
  if (f !== 'pole' && f !== 'off') return f;
  if (t !== 'pole' && t !== 'off') return t;
  if (f === 'pole' && t === 'pole') return undef('the arc has coincident ends');
  if (f === 'pole') return { ...base, hi: tau(k.arc.to) };
  if (t === 'pole') return { ...base, lo: tau(k.arc.from) };
  const on = arcStatus(F, k, ORIGIN(F), ctx, 'center of inversion');
  if (on === 'in') return { ...base, lo: tau(k.arc.to), hi: tau(k.arc.from), outside: true };
  if (on === 'out') return { ...base, lo: tau(k.arc.from), hi: tau(k.arc.to) };
  return on.kind === 'inexact' ? noOrder(F, 'an arc') : on;
}

/** J of a circle value (pole at the origin). */
export function jCircle<T>(F: Field<T>, k: Circle<T>, ctx: EvalContext): Value<T> | Inexact {
  const gap = circleGap(F, ORIGIN(F), k);
  const side = sideOf(F.sign(gap, 'length', ctx));
  if (side === 'none')
    return F.isZero(gap, 'length', ctx) ? throughPole(F, k, ctx) : offPole(F, k, 'none');
  if (typeof side !== 'number') return side;
  return side === 0 ? throughPole(F, k, ctx) : offPole(F, k, side);
}
