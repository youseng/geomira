/**
 * Gliders (SPEC §6.2): a point on an object, given by a parameter.
 *   - line-like: t, the point p + t·d, with t clamped to the range of a segment or ray;
 *   - circle with an anchor A: the homogeneous stereographic parameter (u : v) from the
 *     anchor. With e = A − O and f = rot90(e),
 *       X(u : v) = O + ((u² − v²)·e + 2uv·f) / (u² + v²),
 *     rational in u and v (exact over Q and mod p); X(u : 0) = A, X(0 : v) = −A + 2O,
 *     and X lies on the line through A with direction u·f − v·e;
 *   - any circle, by angle: X = O + r·(cos θ, sin θ) (θ in degrees from the +x axis); the
 *     only form for circle(O, r), which has no rational point to project from.
 *   - a conic (ADR-0042): (u : v) on the pencil through its known point (conic-glider.ts).
 * `gliderParameter` inverts `gliderPoint` exactly for points on the object (round trip),
 * `dragParameter` maps any cursor position to a parameter (the drag map).
 */
import { assertNever } from '@geomira/num/assert';
import { inexact, isInexact, type Field, type Inexact } from '@geomira/num/field';
import { isZeroVec, two, vAdd, vDot, vRot90, vScale, vSub } from './geom';
import type { EvalContext } from './tool';
import { conicDragParameter, conicGliderParameter, conicGliderPoint } from './conic-glider';
import { clampToArc } from './tools/arc-range';
import { degenerateCircle, degenerateLine } from './tools/args';
import {
  pointOf,
  undef,
  type Circle,
  type Line,
  type Undefined,
  type Value,
  type Vec,
} from './value';

export type GliderForm = 'line' | 'stereo' | 'angle';

export type GliderParameter<T> =
  | { readonly form: 'line'; readonly t: T }
  | { readonly form: 'stereo'; readonly u: T; readonly v: T }
  | { readonly form: 'angle'; readonly degrees: T };

type Result<T> = GliderParameter<T> | Undefined | Inexact;

function along<T>(F: Field<T>, l: Line<T>, X: Vec<T>): T {
  return F.div(vDot(F, vSub(F, X, l.p), l.d), vDot(F, l.d, l.d));
}

/** Whether a clamped parameter is the Undefined of clampOutside (field elements are never). */
function isUndefinedValue(x: unknown): x is Undefined {
  return typeof x === 'object' && x !== null && 'kind' in x && x.kind === 'undefined';
}

/**
 * t on the two rays t ≤ lo, t ≥ hi (ADR-0032): unchanged on them; in the gap, the nearer end.
 * Which end is a decision: the middle of the gap within the band → Undefined (ambiguous), as
 * the far point of an arc glider (ADR-0031 decision 7). Mod p → Inexact.
 */
function clampOutside<T>(
  F: Field<T>,
  lo: T,
  hi: T,
  t: T,
  ctx: EvalContext,
): T | Inexact | Undefined {
  const below = F.sign(F.sub(lo, t), 'dimensionless', ctx);
  const above = F.sign(F.sub(t, hi), 'dimensionless', ctx);
  if (below === 'none' || above === 'none')
    return inexact(`clamping to two rays needs an order, which ${F.name} lacks`);
  if (below !== -1 || above !== -1) return t;
  const mid = F.sign(F.sub(F.sub(t, lo), F.sub(hi, t)), 'dimensionless', ctx);
  if (mid === -1) return lo;
  if (mid === 1) return hi;
  return undef('ambiguous: the glider is in the middle of the gap between the two rays');
}

/**
 * t clamped to l's range. Clamping is continuous (no decision can jump), so there is no
 * band case, except between two rays (clampOutside). Degenerate: a bounded range mod p (no
 * order) → Inexact.
 */
function clamp<T>(F: Field<T>, l: Line<T>, t: T, ctx: EvalContext): T | Inexact | Undefined {
  if (l.outside === true && l.lo !== null && l.hi !== null)
    return clampOutside(F, l.lo, l.hi, t, ctx);
  const below = l.lo === null ? 1 : F.sign(F.sub(t, l.lo), 'dimensionless', ctx);
  const above = l.hi === null ? 1 : F.sign(F.sub(l.hi, t), 'dimensionless', ctx);
  if (below === 'none' || above === 'none') {
    return inexact(`clamping to a segment or ray needs an order, which ${F.name} lacks`);
  }
  if (below === -1 && l.lo !== null) return l.lo;
  if (above === -1 && l.hi !== null) return l.hi;
  return t;
}

function anchorOf<T>(c: Circle<T>): Vec<T> | Undefined {
  return (
    c.anchor ?? undef('this circle has no anchor (circle(O, r)): use an angle parameter on(c, θ)')
  );
}

/** X(u : v) on c. Degenerate: no anchor → Undefined; (0 : 0) (both within EPS) → Undefined. */
function stereoPoint<T>(F: Field<T>, c: Circle<T>, u: T, v: T, ctx: EvalContext): Value<T> {
  const a = anchorOf(c);
  if ('kind' in a) return a;
  if (F.isZero(u, 'dimensionless', ctx) && F.isZero(v, 'dimensionless', ctx)) {
    return undef('the glider parameter (0 : 0) is not a point');
  }
  const e = vSub(F, a, c.c);
  const [uu, vv] = [F.mul(u, u), F.mul(v, v)];
  // u² + v² > 0: one of u, v exceeds EPS (so no underflow); mod p (p ≡ 3 mod 4) it is
  // zero only when u ≡ v ≡ 0, which the zero test above rules out.
  const den = F.add(uu, vv);
  const num = vAdd(
    F,
    vScale(F, e, F.sub(uu, vv)),
    vScale(F, vRot90(F, e), F.mul(two(F), F.mul(u, v))),
  );
  const x = vAdd(F, c.c, vScale(F, num, F.div(F.one, den)));
  return pointOf(x.x, x.y);
}

/** O + r·(cos θ, sin θ). Degenerate: √r2, cos or sin not representable → Inexact. */
function anglePoint<T>(F: Field<T>, c: Circle<T>, degrees: T): Value<T> {
  const [r, cos, sin] = [F.sqrt(c.r2), F.cos(degrees), F.sin(degrees)];
  if (isInexact(r)) return r;
  if (isInexact(cos)) return cos;
  if (isInexact(sin)) return sin;
  return pointOf(F.add(c.c.x, F.mul(r, cos)), F.add(c.c.y, F.mul(r, sin)));
}

/**
 * The point of a glider on `obj`. Degenerate cases: a line with no direction or a circle
 * with no positive radius → Undefined; a bounded range mod p → Inexact; a parameter form
 * that does not fit the object (a line with (u : v), a line with an angle) → Undefined;
 * as in stereoPoint and anglePoint; on an arc, the point is clamped to the arc (the nearer
 * end; equally far → Undefined, ambiguous; mod p → Inexact: arc-range.ts clampToArc).
 */
export function gliderPoint<T>(
  F: Field<T>,
  obj: Value<T>,
  p: GliderParameter<T>,
  ctx: EvalContext,
): Value<T> {
  if (obj.kind === 'line') {
    if (p.form !== 'line') return undef('a glider on a line takes one parameter t');
    const bad = degenerateLine(F, obj, ctx);
    if (bad !== undefined) return bad;
    const t = clamp(F, obj, p.t, ctx);
    if (isInexact(t) || isUndefinedValue(t)) return t;
    const x = vAdd(F, obj.p, vScale(F, obj.d, t));
    return pointOf(x.x, x.y);
  }
  if (obj.kind === 'conic')
    return p.form === 'stereo'
      ? conicGliderPoint(F, obj, p.u, p.v, ctx)
      : undef('a glider on a conic takes (u : v)');
  if (obj.kind !== 'circle') return undef(`a glider needs a line or a circle, not ${obj.kind}`);
  const bad = degenerateCircle(F, obj, ctx);
  if (bad !== undefined) return bad;
  const X = circlePoint(F, obj, p, ctx);
  if (X.kind !== 'point') return X;
  const on = clampToArc(F, obj, X, ctx);
  return 'kind' in on ? on : pointOf(on.x, on.y);
}

/** The point of a circle glider (before an arc's clamp). */
function circlePoint<T>(
  F: Field<T>,
  c: Circle<T>,
  p: GliderParameter<T>,
  ctx: EvalContext,
): Value<T> {
  switch (p.form) {
    case 'line':
      return undef('a glider on a circle takes (u : v) or an angle');
    case 'stereo':
      return stereoPoint(F, c, p.u, p.v, ctx);
    case 'angle':
      return anglePoint(F, c, p.degrees);
    default:
      return assertNever(p, 'glider parameter');
  }
}

/** (1 + cos θ : sin θ), or (sin θ : 1 − cos θ) near the antipode: the same ratio. */
function stereoOf<T>(F: Field<T>, c: Circle<T>, X: Vec<T>, ctx: EvalContext): Result<T> {
  const a = anchorOf(c);
  if ('kind' in a) return a;
  const [w, e] = [vSub(F, X, c.c), vSub(F, a, c.c)];
  const cos = F.div(vDot(F, w, e), c.r2);
  const sin = F.div(vDot(F, w, vRot90(F, e)), c.r2);
  const s = F.sign(cos, 'dimensionless', ctx);
  const first = s === 'none' ? !F.eq(F.add(F.one, cos), F.zero) : s !== -1;
  return first
    ? { form: 'stereo', u: F.add(F.one, cos), v: sin }
    : { form: 'stereo', u: sin, v: F.sub(F.one, cos) };
}

function angleOf<T>(F: Field<T>, c: Circle<T>, X: Vec<T>, ctx: EvalContext): Result<T> {
  const w = vSub(F, X, c.c);
  if (isZeroVec(F, w, ctx)) return undef('the point is the center: it has no angle');
  const a = F.atan2(w.y, w.x);
  return isInexact(a) ? a : { form: 'angle', degrees: a };
}

function checked<T>(
  F: Field<T>,
  obj: Value<T>,
  form: GliderForm,
  ctx: EvalContext,
): Line<T> | Circle<T> | Undefined {
  if (obj.kind === 'line') {
    return form === 'line'
      ? (degenerateLine(F, obj, ctx) ?? obj)
      : undef('a glider on a line takes one parameter t');
  }
  if (obj.kind !== 'circle') return undef(`a glider needs a line or a circle, not ${obj.kind}`);
  if (form === 'line') return undef('a glider on a circle takes (u : v) or an angle');
  return degenerateCircle(F, obj, ctx) ?? obj;
}

/**
 * The parameter of a point X ON `obj` (exact; inverts gliderPoint): t (not clamped), the
 * stereographic (u : v) (proportional to the one X came from; (u : 0) at the anchor), or
 * the angle. Degenerate cases: as gliderPoint; the angle of the centre → Undefined; an
 * angle not representable → Inexact. A point off a circle gets the parameter of some point
 * of it: use dragParameter for arbitrary positions.
 */
export function gliderParameter<T>(
  F: Field<T>,
  obj: Value<T>,
  X: Vec<T>,
  form: GliderForm,
  ctx: EvalContext,
): Result<T> {
  if (obj.kind === 'conic')
    return form === 'stereo'
      ? conicGliderParameter(F, obj, X, ctx)
      : undef('a glider on a conic takes (u : v)');
  const o = checked(F, obj, form, ctx);
  if (o.kind === 'undefined') return o;
  if (o.kind === 'line') return { form: 'line', t: along(F, o, X) };
  return form === 'stereo' ? stereoOf(F, o, X, ctx) : angleOf(F, o, X, ctx);
}

/**
 * The drag map: the parameter of the point of `obj` nearest to the cursor (projection on
 * a line, clamped to its range; radial projection on a circle, which needs square roots:
 * Inexact over Q unless they are rational). Degenerate cases: as gliderPoint; the cursor at
 * the centre of a circle → Undefined (no nearest point).
 */
export function dragParameter<T>(
  F: Field<T>,
  obj: Value<T>,
  cursor: Vec<T>,
  form: GliderForm,
  ctx: EvalContext,
): Result<T> {
  if (obj.kind === 'conic')
    return form === 'stereo'
      ? conicDragParameter(F, obj, cursor, ctx)
      : undef('a glider on a conic takes (u : v)');
  const o = checked(F, obj, form, ctx);
  if (o.kind === 'undefined') return o;
  if (o.kind === 'line') {
    const t = clamp(F, o, along(F, o, cursor), ctx);
    return isInexact(t) || isUndefinedValue(t) ? t : { form: 'line', t };
  }
  const w = vSub(F, cursor, o.c);
  if (isZeroVec(F, w, ctx)) return undef('the cursor is at the center: no nearest point');
  if (form === 'angle') return angleOf(F, o, cursor, ctx);
  const [r, n] = [F.sqrt(o.r2), F.sqrt(vDot(F, w, w))];
  if (isInexact(r)) return r;
  if (isInexact(n)) return n;
  return stereoOf(F, o, vAdd(F, o.c, vScale(F, w, F.div(r, n))), ctx);
}
