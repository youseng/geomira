/**
 * apply(T, X) for a projective map (ADR-0040 decision 9), per kind, with ℓ the line the map
 * sends to infinity (proj-side.ts):
 *   - point: on ℓ → the ideal point of its image direction (achiral, as a direction from
 *     positions); in the band → Undefined (ambiguous); otherwise the image point;
 *   - ideal point: its direction parallel to ℓ (a sine) → the ideal point of the image direction
 *     (its flag kept); in the band → Undefined; otherwise a point;
 *   - line, segment, ray, two rays: proj-lines.ts;
 *   - circle, conic → a conic (ADR-0042: never a circle, whatever the matrix; the known point
 *     mapped, dropped when it goes to infinity); an arc → Undefined (an arc of a conic is not
 *     an object);
 *   - polygon: every vertex strictly on one side of ℓ → the polygon of the images; a side that
 *     would pass through infinity → Undefined; in the band → Undefined; mod p (unless affine)
 *     → Inexact;
 *   - angle mark: the vertex's image, the arms mapped by the derivative, swapped when the map
 *     reverses orientation there (sign of det m · W(b)); no longer a right angle (`right` false:
 *     angles are not kept); vertex on ℓ → Undefined; mod p → Inexact;
 *   - segment mark → Undefined (lengths are not kept); text: its anchor's image;
 *   - number, transform, string → Undefined; Undefined and Inexact pass.
 */
import { assertNever } from '@geomira/num/assert';
import type { Field, Inexact } from '@geomira/num/field';
import { vAdd, vSub } from '../geom';
import type { EvalContext } from '../tool';
import {
  undef,
  type AngleMark,
  type IdealPoint,
  type Polygon,
  type Projective,
  type Value,
  type Vec,
} from '../value';
import { circleCoeffs, coeffsOf, mapConicBy, type Coeffs } from '../conic';
import { det3, homOf, mulHom, type Mat3 } from './projective';
import { projLine } from './proj-lines';
import {
  BEYOND,
  directionSide,
  finiteIn,
  isAffine,
  noOrderProj,
  onInfinityLine,
  positionSide,
} from './proj-side';

/** The reason for a position on ℓ where a finite image is needed. */
const TO_INFINITY = 'is sent to infinity';

/** The image of a position: a point, or the ideal point when it is on ℓ. */
export function projPosition<T>(
  F: Field<T>,
  m: Mat3<T>,
  x: Vec<T>,
  ctx: EvalContext,
): Vec<T> | IdealPoint<T> | Value<T> {
  const h = mulHom(F, m, homOf(F, x, true));
  if (!finiteIn(F, h)) return BEYOND;
  const on = onInfinityLine(F, m, x, ctx);
  if (on === 'on') return { kind: 'ideal_point', d: { x: h[0], y: h[1] }, chiral: false };
  if (on !== 'off') return on;
  return { x: F.div(h[0], h[2]), y: F.div(h[1], h[2]) };
}

/** A finite image position, or the reason (on ℓ: `what` is sent to infinity). */
function finitePosition<T>(
  F: Field<T>,
  m: Mat3<T>,
  x: Vec<T>,
  ctx: EvalContext,
  what: string,
): Vec<T> | Value<T> {
  const r = projPosition(F, m, x, ctx);
  if (!('kind' in r)) return r;
  return r.kind === 'ideal_point' ? undef(`apply: ${what} ${TO_INFINITY}`) : r;
}

function projIdeal<T>(F: Field<T>, m: Mat3<T>, v: IdealPoint<T>, ctx: EvalContext): Value<T> {
  const h = mulHom(F, m, homOf(F, v.d, false));
  if (!finiteIn(F, h)) return BEYOND;
  const s = directionSide(F, m, v.d, ctx);
  if (s === 'parallel') return { kind: 'ideal_point', d: { x: h[0], y: h[1] }, chiral: v.chiral };
  if (typeof s === 'object') return s;
  return { kind: 'point', x: F.div(h[0], h[2]), y: F.div(h[1], h[2]) };
}

function projPolygon<T>(F: Field<T>, m: Mat3<T>, p: Polygon<T>, ctx: EvalContext): Value<T> {
  if (!isAffine(F, m)) {
    const sides = p.pts.map((x) => positionSide(F, m, x, ctx));
    const bad = sides.find((s) => typeof s !== 'number');
    if (bad !== undefined && typeof bad !== 'number') return bad;
    if (sides.some((s) => s === 0) || new Set(sides).size > 1)
      return undef('apply: a side of the polygon passes through infinity, so it has no image');
  }
  const pts: Vec<T>[] = [];
  for (const x of p.pts) {
    const r = finitePosition(F, m, x, ctx, 'a vertex');
    if ('kind' in r) return r;
    pts.push(r);
  }
  return { kind: 'polygon', pts };
}

/** The derivative's image of a direction v at x: (Mv)ₓᵧ·W(x) − (Mx)ₓᵧ·W(v) (over W(x)², > 0). */
function jacobian<T>(F: Field<T>, m: Mat3<T>, x: Vec<T>, v: Vec<T>): Vec<T> {
  const [X, V] = [mulHom(F, m, homOf(F, x, true)), mulHom(F, m, homOf(F, v, false))];
  return {
    x: F.sub(F.mul(V[0], X[2]), F.mul(X[0], V[2])),
    y: F.sub(F.mul(V[1], X[2]), F.mul(X[1], V[2])),
  };
}

function projMark<T>(F: Field<T>, m: Mat3<T>, mk: AngleMark<T>, ctx: EvalContext): Value<T> {
  if (F.kind === 'modp') return noOrderProj(F, 'an angle mark');
  const side = positionSide(F, m, mk.b, ctx);
  if (typeof side !== 'number') return side;
  if (side === 0) return undef(`apply: the vertex of the mark ${TO_INFINITY}`);
  const b = finitePosition(F, m, mk.b, ctx, 'the vertex of the mark');
  if ('kind' in b) return b;
  const arm = (p: Vec<T>): Vec<T> => vAdd(F, b, jacobian(F, m, mk.b, vSub(F, p, mk.b)));
  const [from, to] = [arm(mk.from), arm(mk.to)];
  if (!finiteIn(F, [from.x, from.y, to.x, to.y])) return BEYOND;
  // det of the derivative has the sign of det m · W(b)³: negative reverses the arms' order.
  const reverses = F.toNumber(det3(F, m)) > 0 !== (side === 1);
  return { ...mk, b, from: reverses ? to : from, to: reverses ? from : to, right: false };
}

/**
 * The image conic of coefficients q under m (the known point's image kept when it is a finite
 * point). Degenerate: as mapConicBy.
 */
function projConic<T>(
  F: Field<T>,
  m: Mat3<T>,
  q: Coeffs<T>,
  anchor: Vec<T> | undefined,
  ctx: EvalContext,
): Value<T> {
  const a = anchor === undefined ? undefined : projPosition(F, m, anchor, ctx);
  return mapConicBy(F, q, m, a === undefined || 'kind' in a ? undefined : a);
}

/** The image of any value under the projective map p (valid). */
export function applyProjective<T>(
  F: Field<T>,
  p: Projective<T>,
  v: Value<T>,
  ctx: EvalContext,
): Value<T> | Inexact {
  const m = p.m;
  switch (v.kind) {
    case 'point': {
      const r = projPosition(F, m, v, ctx);
      return 'kind' in r ? r : { kind: 'point', ...r };
    }
    case 'ideal_point':
      return projIdeal(F, m, v, ctx);
    case 'line':
      return projLine(F, m, v, ctx);
    case 'circle':
      return v.arc === null
        ? projConic(F, m, circleCoeffs(F, v), v.anchor, ctx)
        : undef(
            'apply: a projective map sends an arc to an arc of a conic, which is not an object',
          );
    case 'conic':
      return projConic(F, m, coeffsOf(v), v.anchor, ctx);
    case 'polygon':
      return projPolygon(F, m, v, ctx);
    case 'angle_mark':
      return projMark(F, m, v, ctx);
    case 'segment_mark':
      return undef('apply: a projective map does not keep lengths, so a segment mark has no image');
    case 'text': {
      const at = finitePosition(F, m, v.at, ctx, "the text's anchor");
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
