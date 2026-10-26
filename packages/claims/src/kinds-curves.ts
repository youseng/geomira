/**
 * Claim kinds about curves: on(P, curve) and tangent(curve, curve), both POLYNOMIAL KINDS.
 * Their float decisions use the kernel's banded LENGTH gaps (note B, ADR-0006 item 6):
 * on measures |P − O| − r (rootGap) or the distance to the line, as incidence.ts does for
 * tangent(P, c) and other(P); tangent measures r − h (line and circle) or r₁ + r₂ − d and
 * d − |r₁ − r₂| (two circles), as the candidate count of intersect does. So a claim and a
 * construction never disagree about whether a point is on a curve or two curves touch.
 * on() honours ranges: a point of the carrier outside a segment, ray or arc is not on it
 * (an order item, so mod p such a claim falls through to the next rung).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import type { ToleranceContext } from '@geomira/num/tolerance';
import { vCross, vDot, vSub } from '@geomira/kernel/geom';
import { circleGap, rootGap } from '@geomira/kernel/incidence';
import { undef, type Circle, type Line, type Value, type Vec } from '@geomira/kernel/value';
import * as f from './float';
import {
  argLabel,
  badClaim,
  circleAt,
  lineAt,
  pointAt,
  type Algebra,
  type ClaimArgs,
  type ClaimKindSpec,
  type OrderItem,
} from './kind';

/**
 * The range of a line as order items: lo·|d|² ≤ (P − p)·d ≤ hi·|d|². The two rays `outside`
 * (ADR-0032) are one item, (t − lo·|d|²)(t − hi·|d|²) ≥ 0 with t = (P − p)·d: an area once
 * divided by |d|², so it is decided as an area.
 */
function rangeOrder<T>(F: Field<T>, P: Vec<T>, l: Line<T>): OrderItem<T>[] {
  const dd = vDot(F, l.d, l.d);
  const t = vDot(F, vSub(F, P, l.p), l.d);
  const what = `${argLabel(0)} lies outside the range of ${argLabel(1)}`;
  if (l.outside === true && l.lo !== null && l.hi !== null) {
    const value = F.mul(F.sub(t, F.mul(l.lo, dd)), F.sub(t, F.mul(l.hi, dd)));
    return [{ value, norm: F.mul(dd, dd), dim: 'area', strict: false, what }];
  }
  const out: OrderItem<T>[] = [];
  if (l.lo !== null)
    out.push({ value: F.sub(t, F.mul(l.lo, dd)), norm: dd, dim: 'length', strict: false, what });
  if (l.hi !== null)
    out.push({ value: F.sub(F.mul(l.hi, dd), t), norm: dd, dim: 'length', strict: false, what });
  return out;
}

/** A counter-clockwise arc from → to holds the points right of the chord from → to. */
function arcOrder<T>(F: Field<T>, P: Vec<T>, c: Circle<T>): OrderItem<T>[] {
  if (c.arc === null) return [];
  const chord = vSub(F, c.arc.to, c.arc.from);
  return [
    {
      value: F.neg(vCross(F, chord, vSub(F, P, c.arc.from))),
      norm: vDot(F, chord, chord),
      dim: 'length',
      strict: false,
      what: `${argLabel(0)} lies outside the arc of ${argLabel(1)}`,
    },
  ];
}

function onAlgebra<T>(F: Field<T>, args: ClaimArgs<T>): Algebra<T> | ReturnType<typeof badClaim> {
  const [P, l, c] = [pointAt(args, 0), lineAt(args, 1), circleAt(args, 1)];
  if (P === undefined) return badClaim('on');
  if (l !== undefined) {
    return { conditions: [vCross(F, l.d, vSub(F, P, l.p))], ndg: [], order: rangeOrder(F, P, l) };
  }
  if (c !== undefined) {
    const w = vSub(F, P, c.c);
    return { conditions: [F.sub(vDot(F, w, w), c.r2)], ndg: [], order: arcOrder(F, P, c) };
  }
  return badClaim('on');
}

/** The signed point–curve gap as a length (the kernel's incidence measure). */
function onGap(args: ClaimArgs<number>): number {
  const [P, l, c] = [pointAt(args, 0), lineAt(args, 1), circleAt(args, 1)];
  if (P === undefined) return Infinity;
  if (l !== undefined) return f.cross(f.sub(P, l.p), l.d) / f.norm(l.d);
  if (c !== undefined) return circleGap(FloatField, P, c);
  return Infinity;
}

/** The line and the circle of a tangency claim, in either order. */
function lineCircle<T>(args: ClaimArgs<T>): readonly [Line<T>, Circle<T>] | undefined {
  const [l0, l1, c0, c1] = [lineAt(args, 0), lineAt(args, 1), circleAt(args, 0), circleAt(args, 1)];
  if (l0 !== undefined && c1 !== undefined) return [l0, c1];
  if (l1 !== undefined && c0 !== undefined) return [l1, c0];
  return undefined;
}

function twoCircles<T>(args: ClaimArgs<T>): readonly [Circle<T>, Circle<T>] | undefined {
  const [a, b] = [circleAt(args, 0), circleAt(args, 1)];
  return a === undefined || b === undefined ? undefined : [a, b];
}

/** cross(O − p, d)² / |d|²: the squared distance from the centre to the line. */
function h2Of<T>(F: Field<T>, l: Line<T>, c: Circle<T>): { readonly cross: T; readonly dd: T } {
  return { cross: vCross(F, vSub(F, c.c, l.p), l.d), dd: vDot(F, l.d, l.d) };
}

function tangentAlgebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
): Algebra<T> | ReturnType<typeof badClaim> {
  const lc = lineCircle(args);
  if (lc !== undefined) {
    const { cross, dd } = h2Of(F, lc[0], lc[1]);
    return { conditions: [F.sub(F.mul(cross, cross), F.mul(lc[1].r2, dd))], ndg: [], order: [] };
  }
  const cc = twoCircles(args);
  if (cc === undefined) {
    return args.every((a: Value<T>) => a.kind === 'line')
      ? undef('tangent needs a circle: two lines are never tangent')
      : badClaim('tangent');
  }
  const [a, b] = cc;
  const w = vSub(F, b.c, a.c);
  const s = vDot(F, w, w);
  const m = F.sub(F.sub(s, a.r2), b.r2);
  const four = F.add(F.add(F.one, F.one), F.add(F.one, F.one));
  // (s − (r₁ + r₂)²)(s − (r₁ − r₂)²) = (s − R₁ − R₂)² − 4R₁R₂ with s = d², Rᵢ = rᵢ².
  const condition = F.sub(F.mul(m, m), F.mul(four, F.mul(a.r2, b.r2)));
  const what = `${argLabel(0)} and ${argLabel(1)} are the same circle`;
  return {
    conditions: [condition],
    ndg: [
      {
        kind: 'any',
        what,
        items: [
          { kind: 'distinct', a: a.c, b: b.c, what },
          { kind: 'distinct_radii', r2a: a.r2, r2b: b.r2, what },
        ],
      },
    ],
    order: [],
  };
}

/** The tangency gap as a length, with the kernel's formulas (smaller of the two for circles). */
function tangentGap(args: ClaimArgs<number>): number {
  const lc = lineCircle(args);
  if (lc !== undefined) {
    const { cross, dd } = h2Of(FloatField, lc[0], lc[1]);
    return rootGap(FloatField, lc[1].r2, (cross * cross) / dd);
  }
  const cc = twoCircles(args);
  if (cc === undefined) return Infinity;
  const [r1, r2, d] = [Math.sqrt(cc[0].r2), Math.sqrt(cc[1].r2), f.dist(cc[0].c, cc[1].c)];
  const ext = r1 + r2 - d;
  const int = d - Math.abs(r1 - r2);
  return Math.abs(ext) < Math.abs(int) ? ext : int;
}

export const CURVE_KINDS: readonly ClaimKindSpec[] = [
  {
    name: 'on',
    params: ['point', 'curve'],
    polynomial: true,
    test: 'incidence',
    doc: 'on(P, c): P lies on the curve (within its range for a segment, ray or arc).',
    algebra: (F, args) => onAlgebra(F, args),
    residual: (args, ctx: ToleranceContext) => f.ratio(onGap(args), ctx.scale),
    gap: (args) => onGap(args),
  },
  {
    name: 'tangent',
    params: ['curve', 'curve'],
    polynomial: true,
    test: 'tangency',
    doc: 'tangent(a, b): a line and a circle, or two circles, touch (ranges and arcs play no role).',
    algebra: (F, args) => tangentAlgebra(F, args),
    residual: (args, ctx: ToleranceContext) => f.ratio(tangentGap(args), ctx.scale),
    gap: (args) => tangentGap(args),
  },
];
