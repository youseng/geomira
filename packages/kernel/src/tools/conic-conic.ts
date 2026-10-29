/**
 * Conic ∩ conic and conic ∩ circle (internal; ADR-0043), as a Pair for select.ts with up to four
 * candidates. In floats the candidates come from the pencil of the two curves (conic-pencil.ts);
 * over Q and mod p they are roots of a quartic and are never approximated (Inexact). The
 * selector other(P, Q, R) gives the fourth common point without square roots, exact in every
 * field: with M the midpoint of PQ, D = Q₂(M)·Q₁ − Q₁(M)·Q₂ is the member of the pencil that
 * vanishes on line PQ, so D = PQ·m with m the line through R and the fourth point S; m is
 * perpendicular to ∇D(R) and S is the other point of m ∩ k₁ by Vieta. A circle stays a circle: it
 * is read as the coefficients |X − O|² − r² only here.
 */
import { inexact, isInexact, type Field, type Inexact } from '@geomira/num/field';
import { fromNumber } from '@geomira/num/rational';
import {
  circleCoeffs,
  coeffsOf,
  conicProblem,
  halfGradient,
  homCentre,
  qDirection,
  qValue,
  quadNorm,
  type Coeffs,
} from '../conic';
import { pencilCoincidence, pencilPoints, polish, type PencilInput } from '../conic-pencil';
import {
  isZeroNormalized,
  signNormalized,
  two,
  vAdd,
  vCross,
  vDot,
  vRot90,
  vScale,
  vSub,
} from '../geom';
import type { BranchShape, EvalContext } from '../tool';
import { undef, type Circle, type Conic, type Undefined, type Vec } from '../value';
import { degenerateCircle } from './args';
import { offArcs, onArcs } from './arc-range';
import { asPoint, type Cand, type Pair } from './pairs';

export const CONIC_CONIC: BranchShape = {
  candidates: 4,
  low: 'none',
  other: true,
  describe: 'conic ∩ conic',
};

/** A curve conic ∩ conic takes: a conic, or a circle (read as its coefficients). */
export type Round<T> = Conic<T> | Circle<T>;

/** Over Q and mod p: the common points are roots of a quartic. */
function quartic(name: string): Inexact {
  return inexact(
    `the common points of two conics are roots of a quartic, not representable in ${name}: other(P, Q, R) gives the fourth point exactly`,
  );
}

function coeffs<T>(F: Field<T>, k: Round<T>): Coeffs<T> {
  return k.kind === 'conic' ? coeffsOf(k) : circleCoeffs(F, k);
}

/** Exact fields: the coefficient vectors are proportional (every 2×2 minor is zero). */
function proportional<T>(F: Field<T>, a: Coeffs<T>, b: Coeffs<T>): boolean {
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++)
      if (!F.eq(F.mul(a[i] ?? F.zero, b[j] ?? F.zero), F.mul(a[j] ?? F.zero, b[i] ?? F.zero)))
        return false;
  return true;
}

/** A curve's reference point for the pencil's frame (ADR-0043 decision 3), as numbers. */
function referenceOf<T>(F: Field<T>, k: Round<T>): Vec<number> {
  const num = (v: Vec<T>) => ({ x: F.toNumber(v.x), y: F.toNumber(v.y) });
  if (k.kind === 'circle') return num(k.c);
  if (k.anchor !== undefined) return num(k.anchor);
  const [x, y, w] = homCentre(F, coeffsOf(k)).map((v) => F.toNumber(v));
  const c = { x: (x ?? 0) / (w ?? 0), y: (y ?? 0) / (w ?? 0) };
  return Number.isFinite(c.x) && Number.isFinite(c.y) ? c : { x: 0, y: 0 };
}

/** The pencil's input: both curves as float coefficients and the frame's origin. */
function pencilInput<T>(F: Field<T>, a: Round<T>, b: Round<T>, ctx: EvalContext): PencilInput {
  const num = (q: Coeffs<T>): Coeffs<number> => {
    const [c0, c1, c2, c3, c4, c5] = q.map((v) => F.toNumber(v));
    return [c0 ?? 0, c1 ?? 0, c2 ?? 0, c3 ?? 0, c4 ?? 0, c5 ?? 0];
  };
  const [r1, r2] = [referenceOf(F, a), referenceOf(F, b)];
  const o = { x: (r1.x + r2.x) / 2, y: (r1.y + r2.y) / 2 };
  return { q1: num(coeffs(F, a)), q2: num(coeffs(F, b)), o, ctx };
}

/**
 * Why the two curves coincide (exact fields: proportional coefficients; floats: decision 4 of
 * ADR-0043, with the band), or undefined.
 */
function coincidence<T>(
  F: Field<T>,
  a: Round<T>,
  b: Round<T>,
  ctx: EvalContext,
): Undefined | undefined {
  const why =
    F.kind === 'float'
      ? pencilCoincidence(pencilInput(F, a, b, ctx))
      : proportional(F, coeffs(F, a), coeffs(F, b))
        ? 'the conics coincide'
        : undefined;
  return why === undefined ? undefined : undef(why);
}

/** FloatField's candidates (numbers) as points of F (F is FloatField here: no rounding). */
function floatCandidates<T>(
  F: Field<T>,
  a: Round<T>,
  b: Round<T>,
  ctx: EvalContext,
): readonly Cand<T>[] | Undefined | Inexact {
  const r = pencilPoints(pencilInput(F, a, b, ctx));
  if (r.kind === 'undefined') return undef(r.reason);
  const out: Cand<T>[] = [];
  for (const p of r.points) {
    const [x, y] = [F.fromRational(fromNumber(p.at.x)), F.fromRational(fromNumber(p.at.y))];
    if (isInexact(x)) return x;
    if (isInexact(y)) return y;
    out.push({ at: { x, y }, side: 0 });
  }
  return out;
}

/** A float point polished by Newton steps on both curves (floats only: no rounding of T). */
function polished<T>(
  F: Field<T>,
  a: Round<T>,
  b: Round<T>,
  X: Vec<T>,
  ctx: EvalContext,
): Vec<T> | Inexact {
  const inp = pencilInput(F, a, b, ctx);
  const Y = polish(inp, { x: F.toNumber(X.x), y: F.toNumber(X.y) });
  const [x, y] = [F.fromRational(fromNumber(Y.x)), F.fromRational(fromNumber(Y.y))];
  if (isInexact(x)) return x;
  return isInexact(y) ? y : { x, y };
}

/** Why P and Q are not two distinct points (a length with the band; exact fields: P = Q). */
function apartProblem<T>(
  F: Field<T>,
  P: Vec<T>,
  Q: Vec<T>,
  ctx: EvalContext,
): Undefined | undefined {
  const w = vSub(F, P, Q);
  const s = signNormalized(F, vDot(F, w, w), vDot(F, w, w), 'length', ctx);
  const zero = F.eq(w.x, F.zero) && F.eq(w.y, F.zero);
  if (zero || s === 0) return undef('other(P, Q, R) needs three distinct points');
  if (s === 'ambiguous')
    return undef('ambiguous: other(P, Q, R): two of the points are within the band of each other');
  return undefined;
}

/** a·x + b·y coefficient-wise: a member of the pencil. */
function combine<T>(F: Field<T>, s: T, q1: Coeffs<T>, t: T, q2: Coeffs<T>): Coeffs<T> {
  const c = (i: number) => F.add(F.mul(s, q1[i] ?? F.zero), F.mul(t, q2[i] ?? F.zero));
  return [c(0), c(1), c(2), c(3), c(4), c(5)];
}

/**
 * The fourth common point S given three distinct common points P, Q, R (module comment).
 * Degenerate cases: two of P, Q, R coincide → Undefined (within the band: ambiguous); P, Q, R
 * collinear → Undefined; m in an asymptotic direction of k₁ → Undefined (S is at infinity),
 * inside the band → ambiguous.
 */
export function fourthPoint<T>(
  F: Field<T>,
  q1: Coeffs<T>,
  q2: Coeffs<T>,
  [P, Q, R]: readonly [Vec<T>, Vec<T>, Vec<T>],
  ctx: EvalContext,
): Vec<T> | Undefined {
  const bad =
    apartProblem(F, P, Q, ctx) ?? apartProblem(F, P, R, ctx) ?? apartProblem(F, Q, R, ctx);
  if (bad !== undefined) return bad;
  const [u, v] = [vSub(F, Q, P), vSub(F, R, P)];
  const n = F.mul(vDot(F, u, u), vDot(F, v, v));
  if (isZeroNormalized(F, vCross(F, u, v), n, 'dimensionless', ctx))
    return undef(
      'other(P, Q, R): the three points are collinear, so they are not three common points of two conics',
    );
  const M = vScale(F, vAdd(F, P, Q), F.div(F.one, two(F)));
  const D = combine(F, qValue(F, q2, M), q1, F.neg(qValue(F, q1, M)), q2);
  const w = vRot90(F, halfGradient(F, D, R));
  const alpha = qDirection(F, q1, w);
  const ww = vDot(F, w, w);
  const sa = signNormalized(F, alpha, F.mul(F.mul(ww, ww), quadNorm(F, q1)), 'dimensionless', ctx);
  if (sa === 'ambiguous')
    return undef('ambiguous: the fourth common point is within the band of infinity');
  if (sa === 0 || F.eq(alpha, F.zero)) return undef('the fourth common point is at infinity');
  const beta = F.mul(two(F), vDot(F, halfGradient(F, q1, R), w));
  return vSub(F, R, vScale(F, w, F.div(beta, alpha)));
}

/** Why a curve is not valid (an invalid conic, a circle without a positive radius), or undefined. */
function invalid<T>(F: Field<T>, k: Round<T>, ctx: EvalContext): Undefined | undefined {
  if (k.kind === 'circle') return degenerateCircle(F, k, ctx);
  const bad = conicProblem(F, k, ctx);
  return bad === undefined ? undefined : undef(bad.reason);
}

/**
 * Conic ∩ conic, conic ∩ circle (either order). Degenerate cases: an invalid curve → Undefined;
 * the conics coincide → Undefined (floats: nearly, ambiguous); no common point → Undefined; over
 * Q and mod p the candidates are Inexact (other(P, Q, R) is exact).
 */
export function conicConicPair<T>(
  F: Field<T>,
  a: Round<T>,
  b: Round<T>,
  ctx: EvalContext,
): Pair<T> | Undefined {
  const bad = invalid(F, a, ctx) ?? invalid(F, b, ctx);
  if (bad !== undefined) return bad;
  const [q1, q2] = [coeffs(F, a), coeffs(F, b)];
  const circles = [a, b].filter((k): k is Circle<T> => k.kind === 'circle');
  let memo: readonly Cand<T>[] | Undefined | Inexact | undefined;
  const cands = () =>
    (memo ??=
      coincidence(F, a, b, ctx) ??
      (F.kind === 'float' ? floatCandidates(F, a, b, ctx) : quartic(F.name)));
  const name = (k: Round<T>, i: string) => `the ${i} ${k.kind === 'circle' ? 'circle' : 'conic'}`;
  return {
    shape: CONIC_CONIC,
    noun: 'intersection',
    low: { kind: 'none' },
    ranged: circles.some((c) => c.arc !== null),
    count: () => {
      const c = cands();
      if ('kind' in c) return c;
      const n = c.length;
      return n === 0
        ? undef('no intersection: the conics do not meet')
        : n === 1
          ? 1
          : n === 2
            ? 2
            : n === 3
              ? 3
              : 4;
    },
    list: () => {
      const c = cands();
      return 'kind' in c ? c : onArcs(F, circles, c, ctx, 'intersection');
    },
    other: {
      arity: 3,
      curves: [
        { obj: a, name: name(a, 'first') },
        { obj: b, name: name(b, 'second') },
      ],
      point: (P, Q, R) => {
        if (Q === undefined || R === undefined) return undef('other(P, Q, R) needs three points');
        const same = coincidence(F, a, b, ctx);
        if (same !== undefined) return same;
        const S0 = fourthPoint(F, q1, q2, [P, Q, R], ctx);
        if ('kind' in S0) return S0;
        const S = F.kind === 'float' ? polished(F, a, b, S0, ctx) : S0;
        if ('kind' in S) return S;
        return offArcs(F, circles, S, ctx, 'other intersection') ?? S;
      },
    },
    output: asPoint,
  };
}

/** The degenerate cases conic ∩ conic adds to intersect (each a test, degenerate.test.ts). */
export const CONIC_CONIC_DEGENERATE: readonly string[] = [
  'conic ∩ conic: no selector → Undefined (ambiguous: add a selector), in every field and whatever the count',
  'conic ∩ conic: the conics coincide → Undefined (within the band in floats: ambiguous)',
  'conic ∩ conic: the conics do not meet → Undefined',
  'conic ∩ conic: tangency (a chord gap within the band) → the double point',
  'conic ∩ conic: three common points that merge (osculation, within ∛EPS) → one triple point',
  'conic ∩ conic: four common points that merge (a four-point contact) → one point',
  'conic ∩ conic: a common point at infinity is not a candidate (parallel parabolas, a shared asymptote)',
  'conic ∩ conic: a common point near infinity → Undefined (ambiguous)',
  'conic ∩ conic: over Q and mod p the candidates are roots of a quartic → Inexact (other(P, Q, R) is exact)',
  'conic ∩ conic: other(P, Q, R) → the fourth common point, exact in every field',
  'conic ∩ conic: other(P, Q, R) with two points coincident, collinear points, or a point off a curve → Undefined',
  'conic ∩ conic: other(P, Q, R) with the fourth point at infinity → Undefined',
  'conic ∩ conic: other(P) with one point, along(±) or orient(±) → Undefined (they do not apply)',
  'conic ∩ conic: near(P) with the nearest candidates equally far (within the band) → Undefined (ambiguous)',
  'conic ∩ circle: a candidate off an arc is not a candidate',
];
