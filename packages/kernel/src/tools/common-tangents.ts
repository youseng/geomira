/**
 * Common tangents of two curves (internal; ADR-0045): the Pair behind tangent(c1, c2, selectors)
 * (the line) and tangent_point(c1, c2, selectors) (its touch point on the FIRST curve). Up to four
 * candidates; a selector judges the touch point T on the first curve (as tangent_from judges its
 * touch point), and the line is the tangent of the first curve at T.
 *
 * Two circles (closed form, every field): with w = O₂ − O₁, s = |w|², the touch points on c1 are
 * the points T = O₁ + u with |u| = r₁ and u·w = r₁(r₁ − r₂) (external tangents) or
 * u·w = r₁(r₁ + r₂) (internal ones):
 *     T = O₁ + (a/s)·w ∓ √(r₁²·(s − (r₁ ∓ r₂)²))/s · rot90(w),   a = r₁² ∓ r₁r₂.
 * The counts are decided as ADR-0006 decides tangency, on gaps measured as LENGTHS with the band:
 * d − |r₁ − r₂| for the external pair, d − (r₁ + r₂) for the internal pair (clearly negative:
 * none; within the band: one double tangent, the common tangent at the touch point of two tangent
 * circles; clearly positive: two). When a root is not representable over Q, the exact signs of
 * s − (r₁ ± r₂)² decide (from q = s − r₁² − r₂² and r₁²r₂²). Circles that nearly coincide (the
 * external gap and |r₁ − r₂| both within the band) are decided on the half distance between the
 * external touch points, as ADR-0027 decides circle ∩ circle. The low-level selector is orient(±):
 * the sign of cross(O₂ − O₁, T − O₁), the side of the line of centres where T lies (the label of
 * circle ∩ circle); orientation-dependent (SPEC §7), so the GUI writes it only when nothing
 * reflection-equivariant decides.
 *
 * A conic among the curves: the dual problem (dual-tangents.ts), floats only.
 */
import { inexact, isInexact, type Field, type Inexact } from '@geomira/num/field';
import { abs, isZeroVec, two, vAdd, vDot, vRot90, vScale, vSub } from '../geom';
import type { BranchShape, EvalContext, Signature } from '../tool';
import {
  undef,
  type Circle,
  type Conic,
  type Line,
  type Undefined,
  type Value,
  type Vec,
} from '../value';
import { arcStatus } from './arc-range';
import { degenerateCircle } from './args';
import { conicTangentAt } from './conic-pairs';
import { asPoint, midOff, type Cand, type Count, type Pair } from './pairs';

/** What a call gives: the common tangent (tangent) or its touch point (tangent_point). */
export type TangentOut = 'line' | 'point';

/** A curve of a common-tangent call. */
export type Curve2<T> = Circle<T> | Conic<T>;

function shape(tool: string, circles: boolean): BranchShape {
  return {
    candidates: 4,
    low: circles ? 'orient' : 'none',
    ...(circles ? { alsoLow: 'along' as const } : {}),
    other: false,
    describe: `${tool}(${circles ? 'c1, c2' : 'k1, k2'})`,
  };
}

/** The BranchShapes of the common-tangent overloads (ADR-0045). */
export const COMMON_SHAPES = {
  line: { circles: shape('tangent', true), conics: shape('tangent', false) },
  point: { circles: shape('tangent_point', true), conics: shape('tangent_point', false) },
} as const;

/** The common-tangent overloads of tangent and tangent_point (ADR-0045). */
export function commonSignatures(out: 'line' | 'point'): Signature[] {
  const s = out === 'line' ? COMMON_SHAPES.line : COMMON_SHAPES.point;
  return [
    { params: ['round', 'round'], branch: s.circles, radical: true },
    { params: ['conic', 'conic'], branch: s.conics, radical: true },
    { params: ['round', 'conic'], branch: s.conics, radical: true },
    { params: ['conic', 'round'], branch: s.conics, radical: true },
  ];
}

/** The tangent of a curve at its point T (chiral: a quarter turn of a direction). */
export function tangentLineAt<T>(F: Field<T>, k: Curve2<T>, T0: Vec<T>): Line<T> {
  if (k.kind === 'conic') return conicTangentAt(F, k, T0);
  const p = { x: T0.x, y: T0.y };
  return { kind: 'line', p, d: vRot90(F, vSub(F, T0, k.c)), lo: null, hi: null, chiral: true };
}

/** The foot of the centre of c on the line: the touch point of a tangent of c. */
function footOn<T>(F: Field<T>, c: Circle<T>, l: Line<T>): Vec<T> {
  const t = F.div(vDot(F, vSub(F, c.c, l.p), l.d), vDot(F, l.d, l.d));
  return vAdd(F, l.p, vScale(F, l.d, t));
}

/**
 * The candidates whose touch points lie on the arcs of circle arguments (an arc of the first
 * curve: T; of the second: the foot of its centre on the tangent). Degenerate cases: none left →
 * Undefined; a touch point within the band of an arc's end → Undefined (ambiguous); mod p →
 * Inexact.
 */
export function onTheArcs<T>(
  F: Field<T>,
  [a, b]: readonly [Curve2<T>, Curve2<T>],
  list: readonly Cand<T>[],
  ctx: EvalContext,
): readonly Cand<T>[] | Undefined | Inexact {
  const arcA = a.kind === 'circle' && a.arc !== null ? a : undefined;
  const arcB = b.kind === 'circle' && b.arc !== null ? b : undefined;
  if (arcA === undefined && arcB === undefined) return list;
  const kept: Cand<T>[] = [];
  for (const c of list) {
    const sa = arcA === undefined ? 'in' : arcStatus(F, arcA, c.at, ctx, 'touch point');
    const sb =
      arcB === undefined
        ? 'in'
        : arcStatus(F, arcB, footOn(F, arcB, tangentLineAt(F, a, c.at)), ctx, 'touch point');
    for (const s of [sa, sb]) if (typeof s !== 'string') return s;
    if (sa === 'in' && sb === 'in') kept.push(c);
  }
  return kept.length > 0 ? kept : undef('no common tangent touches the arcs');
}

type N3 = 0 | 1 | 2;

/** How many tangents a gap gives: clearly negative none, within the band one, else two. */
function fromSign(s: -1 | 0 | 1 | 'ambiguous'): N3 {
  return s === -1 ? 0 : s === 1 ? 2 : 1;
}

/** a = r₁² ∓ r₁r₂ and rad = r₁²(s − (r₁ ∓ r₂)²)/s² of the external (E) and internal (I) pairs. */
interface Positions<T> {
  readonly aE: T;
  readonly aI: T;
  readonly radE: T;
  readonly radI: T;
}

/** The counts and the data of the positions (Inexact when a root is not representable). */
interface Plan<T> {
  readonly ext: N3;
  readonly int: N3;
  readonly pos: Positions<T> | Inexact;
}

const NO_ORDER = (F: { readonly name: string }): Inexact =>
  inexact(
    `the common tangents of two circles need square roots and an order, which ${F.name} lacks`,
  );

/** The plan from the lengths r₁, r₂, d (all representable: floats, or rational radii and d). */
function lengthPlan<T>(
  F: Field<T>,
  c1: Circle<T>,
  s: T,
  [r1, r2, d]: readonly [T, T, T],
  ctx: EvalContext,
): Plan<T> | Undefined | Inexact {
  const diff = abs(F, F.sub(r1, r2), 'length', ctx);
  if (isInexact(diff)) return diff;
  const [gE, gI] = [F.sub(d, diff), F.sub(d, F.add(r1, r2))];
  const [sE, sI] = [F.sign(gE, 'length', ctx), F.sign(gI, 'length', ctx)];
  if (sE === 'none' || sI === 'none') return NO_ORDER(F);
  const s2 = F.mul(s, s);
  const radE = F.div(F.mul(c1.r2, F.mul(gE, F.add(d, diff))), s2);
  const radI = F.div(F.mul(c1.r2, F.mul(gI, F.add(d, F.add(r1, r2)))), s2);
  let ext = fromSign(sE);
  if (sE !== 1 && F.sign(diff, 'length', ctx) !== 1) {
    // Nearly coincident circles: the half distance between the external touch points decides.
    if (F.sign(F.mul(radE, s), 'area', ctx) !== 1)
      return undef('ambiguous: the circles nearly coincide');
    ext = 2;
  }
  const p = F.mul(r1, r2);
  const pos = { aE: F.sub(c1.r2, p), aI: F.add(c1.r2, p), radE, radI };
  return { ext, int: fromSign(sI), pos };
}

/**
 * The plan from exact signs when a root is not representable (over Q): s − (r₁ + r₂)² = q − 2p is
 * negative when q ≤ 0, else of the sign of q² − 4p²; s − (r₁ − r₂)² = q + 2p is positive when
 * q ≥ 0, else of the sign of 4p² − q² (q = s − r₁² − r₂², p = r₁r₂).
 */
function exactPlan<T>(
  F: Field<T>,
  c1: Circle<T>,
  c2: Circle<T>,
  s: T,
  ctx: EvalContext,
): Plan<T> | Inexact {
  const q = F.sub(F.sub(s, c1.r2), c2.r2);
  const p2 = F.mul(c1.r2, c2.r2);
  const sq = F.sign(q, 'area', ctx);
  const sd = F.sign(F.sub(F.mul(q, q), F.mul(F.mul(two(F), two(F)), p2)), 'area', ctx);
  if (sq === 'none' || sd === 'none' || sq === 'ambiguous' || sd === 'ambiguous')
    return NO_ORDER(F);
  const sI = sq !== 1 ? -1 : sd;
  const sE = sq !== -1 ? 1 : sd === 1 ? -1 : sd === -1 ? 1 : 0;
  const p = F.sqrt(p2);
  const plan = { ext: fromSign(sE), int: fromSign(sI) };
  if (isInexact(p)) return { ...plan, pos: p };
  const [s2, twoP] = [F.mul(s, s), F.add(p, p)];
  const pos = {
    aE: F.sub(c1.r2, p),
    aI: F.add(c1.r2, p),
    radE: F.div(F.mul(c1.r2, F.add(q, twoP)), s2),
    radI: F.div(F.mul(c1.r2, F.sub(q, twoP)), s2),
  };
  return { ...plan, pos };
}

function planOf<T>(
  F: Field<T>,
  c1: Circle<T>,
  c2: Circle<T>,
  s: T,
  ctx: EvalContext,
): Plan<T> | Undefined | Inexact {
  const [r1, r2, d] = [F.sqrt(c1.r2), F.sqrt(c2.r2), F.sqrt(s)];
  if (!isInexact(r1) && !isInexact(r2) && !isInexact(d))
    return lengthPlan(F, c1, s, [r1, r2, d], ctx);
  if (F.kind === 'modp') return NO_ORDER(F);
  return exactPlan(F, c1, c2, s, ctx);
}

/**
 * The common tangents of two circles (module comment). Degenerate cases: a circle with no
 * positive radius → Undefined; equal circles → Undefined (they coincide); concentric circles →
 * Undefined; one circle inside the other → Undefined; nearly coincident circles → Undefined
 * (ambiguous) unless the external touch points are apart beyond the band; tangent circles → the
 * common tangent at the touch point (a double candidate); square roots not representable →
 * Inexact over Q (always mod p).
 */
export function circleTangentsPair<T>(
  F: Field<T>,
  c1: Circle<T>,
  c2: Circle<T>,
  ctx: EvalContext,
  out: TangentOut,
): Pair<T> | Undefined {
  const bad = degenerateCircle(F, c1, ctx) ?? degenerateCircle(F, c2, ctx);
  if (bad !== undefined) return bad;
  const w = vSub(F, c2.c, c1.c);
  if (isZeroVec(F, w, ctx))
    return undef(
      F.isZero(F.sub(c1.r2, c2.r2), 'area', ctx)
        ? 'the circles coincide: every tangent is common'
        : 'concentric circles: no common tangent',
    );
  const s = vDot(F, w, w);
  const plan = planOf(F, c1, c2, s, ctx);
  const half = (a: T): Vec<T> => vAdd(F, c1.c, vScale(F, w, F.div(a, s)));
  const list = (): readonly Cand<T>[] | Undefined | Inexact => {
    if ('kind' in plan) return plan;
    const { pos } = plan;
    if (isInexact(pos)) return pos;
    const cands: Cand<T>[] = [];
    // along(±): the internal pair (+1) touches c1 further along O₁O₂ than the external (−1).
    for (const [n, a, rad, side2] of [
      [plan.ext, pos.aE, pos.radE, -1],
      [plan.int, pos.aI, pos.radI, 1],
    ] as const) {
      if (n === 0) continue;
      const c = midOff(F, n, half(a), rad, vRot90(F, w), false);
      if (isInexact(c)) return c;
      for (const x of c) cands.push({ at: x.at, side: x.side === 'measure' ? 0 : x.side, side2 });
    }
    return onTheArcs(F, [c1, c2], cands, ctx);
  };
  return {
    shape: out === 'line' ? COMMON_SHAPES.line.circles : COMMON_SHAPES.point.circles,
    noun: out === 'line' ? 'common tangent' : 'touch point',
    low: { kind: 'orient', from: c1.c, to: c2.c },
    ranged: c1.arc !== null || c2.arc !== null,
    count: () => {
      if ('kind' in plan) return plan;
      const n = plan.ext + plan.int;
      return n === 0 ? undef('no common tangent: one circle lies inside the other') : toCount(n);
    },
    list,
    output: (X) => outputOf(F, c1, X, out),
  };
}

/** 1–4 as a Count. */
export function toCount(n: number): Count {
  return n <= 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : 4;
}

/** The value of a candidate: the touch point, or the tangent of the first curve there. */
export function outputOf<T>(F: Field<T>, k: Curve2<T>, X: Vec<T>, out: TangentOut): Value<T> {
  return out === 'point' ? asPoint(X) : tangentLineAt(F, k, X);
}

/** The degenerate cases the common-tangent overloads add (each a test, degenerate.test.ts). */
export const COMMON_TANGENT_DEGENERATE: readonly string[] = [
  'two curves: no selector → Undefined (ambiguous: add a selector), in every field and whatever the count',
  'two circles: equal circles or concentric circles → Undefined',
  'two circles: one inside the other → Undefined (no common tangent)',
  'two circles: tangent circles → the common tangent at the touch point, one double candidate',
  'two circles: intersecting circles → the two external tangents only',
  'two circles: nearly coincident circles → Undefined (ambiguous) unless the external touch points are apart beyond the band',
  'two circles: square roots not representable → Inexact over Q; always Inexact mod p',
  'two curves: a touch point off an arc is not a candidate',
  'two curves: other(P) → Undefined (it does not apply); along(±) or orient(±) with a conic → Undefined',
  'two circles: along(−) keeps the external tangents, along(+) the internal ones; orient(±) the side of O₁O₂ where T lies (structural labels; a vanished branch is never replaced)',
  'a conic: the curves coincide → Undefined (within the band: ambiguous)',
  'a conic: no common tangent → Undefined',
  'a conic: the line at infinity (two parabolas) and an asymptote of the first curve are not candidates',
  'a conic: over Q and mod p the common tangents are roots of a quartic → Inexact',
];
