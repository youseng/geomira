/**
 * Angle claims (SPEC §10.1).
 *   - Directed angles (POLYNOMIAL KINDS): `n∡ABC = ∡DEF` (dangle) in the complex form
 *     Im(z₁ⁿ·conj(z₂)) = 0 with z₁ = (C − B)·conj(A − B), z₂ = (F − E)·conj(D − E), NDG
 *     z₁ ≠ 0 and z₂ ≠ 0 (A ≠ B, C ≠ B, D ≠ E, F ≠ E); and `∡(l, m) = θ` (dangle_lines):
 *     Im(d_m·conj(d_l)·conj(w)) = 0 for a direction w of angle θ. All mod 180°.
 *   - Undirected angles (NOT polynomial: they need |cross|, an order): angle_eq, angle_sum,
 *     angle_diff. angle(A, B, C) = α ∈ [0°, 180°] has (cos α, sin α) ∝ (u·v, |u × v|), so
 *     α + σβ = θ iff w·conj(e^{iθ}) is a positive real, w = (c₁ + i s₁)(c₂ + iσ s₂): one
 *     condition (the imaginary part) and one order item (the real part, > 0). That is
 *     α + σβ ≡ θ mod 360°; at an end of θ's range (0° or 360° for a sum, ±180° for a
 *     difference) the other end is the same residue, so one more order item names the end:
 *     α = 0° at the low end (cos α > 0), α = 180° at the high end (ADR-0027).
 */
import { inexact, isInexact, type Field, type Inexact } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { cMul, cPow } from '@geomira/num/complex';
import {
  add,
  compare,
  div,
  formatRational,
  fromInteger,
  mul,
  rational,
  sub,
  type Rational,
} from '@geomira/num/rational';
import type { ToleranceContext } from '@geomira/num/tolerance';
import { abs, vCross, vDot, vSub } from '@geomira/kernel/geom';
import { undef, type Undefined, type Vec } from '@geomira/kernel/value';
import { MAX_ANGLE_MULTIPLE } from './constants';
import * as f from './float';
import { angleZ, imMulConj } from './kinds-incidence';
import {
  argLabel,
  badClaim,
  lineAt,
  litAt,
  pointsFrom,
  type Algebra,
  type ClaimArgs,
  type ClaimKindSpec,
  type OrderItem,
} from './kind';
import type { Ndg } from './ndg';

/** x mod m in [0, m) for rationals. */
function modulo(x: Rational, m: number): Rational {
  const mm = fromInteger(m);
  const q = div(x, mm);
  const floor = q.num >= 0n ? q.num / q.den : -((-q.num + q.den - 1n) / q.den);
  return sub(x, mul(rational(floor), mm));
}

const DEGREES_EXACT: Readonly<Record<string, readonly [number, number]>> = {
  '0': [1, 0],
  '45': [1, 1],
  '90': [0, 1],
  '135': [-1, 1],
};

/** A direction of angle θ (mod 180°): exact for multiples of 45°, else cos/sin of F. */
function lineDirection<T>(F: Field<T>, theta: Rational): Vec<T> | Inexact {
  const known = DEGREES_EXACT[formatRational(modulo(theta, 180))];
  if (known !== undefined) {
    const [x, y] = known.map((k) => F.fromRational(fromInteger(k)));
    if (x === undefined || y === undefined || isInexact(x) || isInexact(y))
      return inexact('unreachable');
    return { x, y };
  }
  return unitOf(F, theta);
}

/** (cos θ, sin θ): exact at multiples of 90°, else the field's trigonometry. */
function unitOf<T>(F: Field<T>, theta: Rational): Vec<T> | Inexact {
  const r = formatRational(modulo(theta, 360));
  const quarter: Readonly<Record<string, readonly [number, number]>> = {
    '0': [1, 0],
    '90': [0, 1],
    '180': [-1, 0],
    '270': [0, -1],
  };
  const known = quarter[r];
  const t = F.fromRational(theta);
  if (isInexact(t)) return t;
  const [x, y] =
    known === undefined ? [F.cos(t), F.sin(t)] : known.map((k) => F.fromRational(fromInteger(k)));
  if (x === undefined || y === undefined) return inexact('unreachable');
  if (isInexact(x)) return x;
  if (isInexact(y)) return y;
  return { x, y };
}

function sixPoints<T>(args: ClaimArgs<T>, from: number): readonly Vec<T>[] | undefined {
  const pts = pointsFrom(args.slice(from, from + 6), 0);
  return pts?.length === 6 ? pts : undefined;
}

/** A ≠ B, C ≠ B, D ≠ E, F ≠ E for the six points starting at argument `off`. */
function armsDistinct<T>(pts: readonly Vec<T>[], off: number): Ndg<T>[] {
  const pairs: readonly (readonly [number, number])[] = [
    [0, 1],
    [2, 1],
    [3, 4],
    [5, 4],
  ];
  return pairs.flatMap(([i, j]) => {
    const [a, b] = [pts[i], pts[j]];
    return a === undefined || b === undefined
      ? []
      : [
          {
            kind: 'distinct' as const,
            a,
            b,
            what: `${argLabel(i + off)} and ${argLabel(j + off)} coincide`,
          },
        ];
  });
}

function zOf<T>(F: Field<T>, pts: readonly Vec<T>[], k: 0 | 3): Vec<T> | undefined {
  const [a, b, c] = [pts[k], pts[k + 1], pts[k + 2]];
  return a === undefined || b === undefined || c === undefined ? undefined : angleZ(F, a, b, c);
}

function multipleOf(args: ClaimArgs<unknown>): number | Undefined {
  const n = litAt(args, 0);
  if (n?.den !== 1n || n.num < 1n || n.num > BigInt(MAX_ANGLE_MULTIPLE)) {
    return undef(
      `dangle: the multiple n must be an integer from 1 to ${String(MAX_ANGLE_MULTIPLE)}`,
    );
  }
  return Number(n.num);
}

function dangleAlgebra<T>(F: Field<T>, args: ClaimArgs<T>): Algebra<T> | Undefined {
  const n = multipleOf(args);
  if (typeof n !== 'number') return n;
  const pts = sixPoints(args, 1);
  const [z1, z2] = pts === undefined ? [] : [zOf(F, pts, 0), zOf(F, pts, 3)];
  if (pts === undefined || z1 === undefined || z2 === undefined) return badClaim('dangle');
  const zn = cPow(F, { re: z1.x, im: z1.y }, n);
  return {
    conditions: [imMulConj(F, { x: zn.re, y: zn.im }, z2)],
    ndg: armsDistinct(pts, 1),
    order: [],
  };
}

/** |sin(n·∡ABC − ∡DEF)|, from unit complex numbers (no overflow for large n). */
function dangleResidual(args: ClaimArgs<number>): number {
  const n = multipleOf(args);
  const pts = sixPoints(args, 1);
  const [z1, z2] = pts === undefined ? [] : [zOf(FloatField, pts, 0), zOf(FloatField, pts, 3)];
  if (typeof n !== 'number' || z1 === undefined || z2 === undefined) return Infinity;
  const [m1, m2] = [f.norm(z1), f.norm(z2)];
  if (!(m1 > 0 && m2 > 0)) return Infinity;
  const u = cPow(FloatField, { re: z1.x / m1, im: z1.y / m1 }, n);
  return Math.abs(imMulConj(FloatField, { x: u.re, y: u.im }, { x: z2.x / m2, y: z2.y / m2 }));
}

function linesTheta<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
): { z: Vec<T>; w: Vec<T> } | Undefined | Inexact {
  const [l, m, theta] = [lineAt(args, 0), lineAt(args, 1), litAt(args, 2)];
  if (l === undefined || m === undefined || theta === undefined) return badClaim('dangle_lines');
  const w = lineDirection(F, theta);
  if (isInexact(w)) return w;
  return { z: { x: vDot(F, l.d, m.d), y: vCross(F, l.d, m.d) }, w };
}

/** Which end of its range θ is, if any: there α + σβ ≡ θ mod 360° has two solutions. */
type End = 'low' | 'high' | undefined;

/** At an end of θ's range, α must be 0° (low) or 180° (high): the sign of cos α. */
function endItem<T>(
  F: Field<T>,
  p1: Vec<T>,
  end: End,
  sigma: 1 | -1,
  theta: Rational,
): OrderItem<T>[] {
  if (end === undefined) return [];
  const other = formatRational(
    end === 'low' ? add(theta, fromInteger(360)) : sub(theta, fromInteger(360)),
  );
  return [
    {
      value: end === 'low' ? p1.x : F.neg(p1.x),
      norm: F.add(F.mul(p1.x, p1.x), F.mul(p1.y, p1.y)),
      dim: 'dimensionless',
      strict: true,
      what: `the ${sigma === 1 ? 'sum' : 'difference'} is ${other}°, not ${formatRational(theta)}°`,
    },
  ];
}

/** Linear form α + σβ = θ of two undirected angles (σ = ±1). */
function undirected<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
  sigma: 1 | -1,
  theta: Rational,
  ctx: ToleranceContext,
  end?: End,
): Algebra<T> | Undefined | Inexact {
  const pts = sixPoints(args, 0);
  if (pts === undefined) return badClaim('angle');
  const parts: Vec<T>[] = [];
  for (const k of [0, 3] as const) {
    const [a, b, c] = [pts[k], pts[k + 1], pts[k + 2]];
    if (a === undefined || b === undefined || c === undefined) return badClaim('angle');
    const [u, v] = [vSub(F, a, b), vSub(F, c, b)];
    const s = abs(F, vCross(F, u, v), 'area', ctx);
    if (isInexact(s)) return s;
    parts.push({ x: vDot(F, u, v), y: s });
  }
  const [p1, p2] = parts;
  const e = unitOf(F, theta);
  if (p1 === undefined || p2 === undefined) return badClaim('angle');
  if (isInexact(e)) return e;
  const w = cMul(F, { re: p1.x, im: p1.y }, { re: p2.x, im: sigma === 1 ? p2.y : F.neg(p2.y) });
  const we = cMul(F, w, { re: e.x, im: F.neg(e.y) });
  const n2 = F.add(F.mul(w.re, w.re), F.mul(w.im, w.im));
  return {
    conditions: [we.im],
    ndg: armsDistinct(pts, 0),
    order: [
      {
        value: we.re,
        norm: n2,
        dim: 'dimensionless',
        strict: true,
        what: 'the angles differ by a half turn',
      },
      ...endItem(F, p1, end, sigma, theta),
    ],
  };
}

/** |α + σβ − θ| in radians: not folded mod 2π, so the two ends of θ's range differ. */
function undirectedResidual(args: ClaimArgs<number>, sigma: 1 | -1, theta: number): number {
  const pts = sixPoints(args, 0);
  if (pts === undefined) return Infinity;
  const ang = (k: 0 | 3) => {
    const [a, b, c] = [pts[k], pts[k + 1], pts[k + 2]];
    if (a === undefined || b === undefined || c === undefined) return NaN;
    const [u, v] = [f.sub(a, b), f.sub(c, b)];
    return Math.atan2(Math.abs(f.cross(u, v)), f.dot(u, v));
  };
  const r = Math.abs(ang(0) + sigma * ang(3) - (theta * Math.PI) / 180);
  return Number.isFinite(r) ? r : Infinity;
}

/** θ of a linear form must lie in the range the form can reach. */
function thetaIn(
  theta: Rational | undefined,
  lo: number,
  hi: number,
  name: string,
): Rational | Undefined {
  if (theta === undefined) return badClaim(name);
  if (compare(theta, fromInteger(lo)) < 0 || compare(theta, fromInteger(hi)) > 0) {
    return undef(`${name}: θ must lie in [${String(lo)}°, ${String(hi)}°]`);
  }
  return theta;
}

function formKind(name: string, sigma: 1 | -1, lo: number, hi: number, doc: string): ClaimKindSpec {
  return {
    name,
    params: ['point', 'point', 'point', 'point', 'point', 'point', 'number'],
    polynomial: false,
    test: 'floor',
    doc,
    algebra: (F, args, ctx) => {
      const theta = thetaIn(litAt(args, 6), lo, hi, name);
      if ('kind' in theta) return theta;
      const end: End =
        compare(theta, fromInteger(lo)) === 0
          ? 'low'
          : compare(theta, fromInteger(hi)) === 0
            ? 'high'
            : undefined;
      return undirected(F, args, sigma, theta, ctx, end);
    },
    residual: (args) => {
      const t = args[6];
      return t?.kind === 'number' ? undirectedResidual(args, sigma, t.v) : Infinity;
    },
  };
}

export const ANGLE_KINDS: readonly ClaimKindSpec[] = [
  {
    name: 'dangle',
    params: ['integer', 'point', 'point', 'point', 'point', 'point', 'point'],
    polynomial: true,
    test: 'floor',
    doc: 'dangle(n, A, B, C, D, E, F): n∡ABC = ∡DEF (directed, mod 180°).',
    algebra: (F, args) => dangleAlgebra(F, args),
    residual: dangleResidual,
  },
  {
    name: 'dangle_lines',
    params: ['line', 'line', 'number'],
    polynomial: true,
    test: 'floor',
    doc: 'dangle_lines(l, m, θ): ∡(l, m) = θ (directed, mod 180°).',
    algebra: (F, args) => {
      const r = linesTheta(F, args);
      return 'kind' in r ? r : { conditions: [imMulConj(F, r.z, r.w)], ndg: [], order: [] };
    },
    residual: (args) => {
      const r = linesTheta(FloatField, args);
      return 'kind' in r
        ? Infinity
        : f.ratio(imMulConj(FloatField, r.z, r.w), f.norm(r.z) * f.norm(r.w));
    },
    needsTrig: (lits) => {
      const theta = lits[0];
      if (theta === undefined) return undefined;
      return DEGREES_EXACT[formatRational(modulo(theta, 180))] === undefined
        ? `∡(l, m) = ${formatRational(theta)}° needs cos and sin of θ`
        : undefined;
    },
  },
  {
    name: 'angle_eq',
    params: ['point', 'point', 'point', 'point', 'point', 'point'],
    polynomial: false,
    test: 'floor',
    doc: 'angle_eq(A, B, C, D, E, F): angle(A, B, C) = angle(D, E, F) (undirected).',
    algebra: (F, args, ctx) => undirected(F, args, -1, fromInteger(0), ctx),
    residual: (args) => undirectedResidual(args, -1, 0),
  },
  formKind(
    'angle_sum',
    1,
    0,
    360,
    'angle_sum(A, B, C, D, E, F, θ): angle(A, B, C) + angle(D, E, F) = θ.',
  ),
  formKind(
    'angle_diff',
    -1,
    -180,
    180,
    'angle_diff(A, B, C, D, E, F, θ): angle(A, B, C) − angle(D, E, F) = θ.',
  ),
];
