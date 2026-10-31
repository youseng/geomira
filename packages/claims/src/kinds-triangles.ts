/**
 * Similar and congruent triangles (ADR-0051), POLYNOMIAL KINDS over any Field. The vertices
 * correspond in order: A ↔ D, B ↔ E, C ↔ F. Both triangles must be proper (NDG: A, B, C not
 * collinear, and D, E, F not collinear), so a claim about a flat triangle is never true or
 * false.
 *
 *   similar(A, B, C, D, E, F): directly OR oppositely similar (the olympiad meaning of
 *     △ABC ∼ △DEF): the sides are proportional, |AB|²|EF|² = |DE|²|BC|² and
 *     |CA|²|EF|² = |FD|²|BC|² (SSS; with proper triangles the third ratio follows).
 *   similar_direct: the same orientation, (B − A)/(C − A) = (E − D)/(F − D) as complex
 *     numbers: (B − A)(F − D) − (C − A)(E − D) = 0, two real conditions.
 *   similar_opposite: opposite orientations, (B − A)/(C − A) = conj((E − D)/(F − D)):
 *     (B − A)·conj(F − D) − (C − A)·conj(E − D) = 0.
 *   congruent: directly or oppositely congruent: |BC|² = |EF|², |CA|² = |FD|², |AB|² = |DE|².
 *   congruent_direct / congruent_opposite: the similarity of that orientation and
 *     |AB|² = |DE|².
 *
 * A reflection of the whole figure keeps every one of these (it reverses both triangles), so
 * the orientation kinds are not orientation-dependent claims (L16).
 */
import { vDot, vSub } from '@geomira/kernel/geom';
import type { Vec } from '@geomira/kernel/value';
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import * as f from './float';
import {
  argLabel,
  badClaim,
  pointsFrom,
  type Algebra,
  type ClaimArgs,
  type ClaimKindSpec,
} from './kind';
import type { Ndg } from './ndg';

type Six<T> = readonly [Vec<T>, Vec<T>, Vec<T>, Vec<T>, Vec<T>, Vec<T>];

/** Exactly six points, as a tuple. */
export function six<T>(args: ClaimArgs<T>): Six<T> | undefined {
  const pts = pointsFrom(args, 0);
  if (pts?.length !== 6) return undefined;
  const [a, b, c, d, e, g] = pts;
  if (a === undefined || b === undefined || c === undefined) return undefined;
  if (d === undefined || e === undefined || g === undefined) return undefined;
  return [a, b, c, d, e, g];
}

function d2<T>(F: Field<T>, a: Vec<T>, b: Vec<T>): T {
  const w = vSub(F, b, a);
  return vDot(F, w, w);
}

/** The squared sides opposite each vertex: |BC|², |CA|², |AB|². */
function sides<T>(F: Field<T>, a: Vec<T>, b: Vec<T>, c: Vec<T>): readonly [T, T, T] {
  return [d2(F, b, c), d2(F, c, a), d2(F, a, b)];
}

/** Both triangles proper: the NDG items of every kind here. */
function proper<T>(p: Six<T>): Ndg<T>[] {
  const [a, b, c, d, e, g] = p;
  const l = (i: number) => argLabel(i);
  return [
    { kind: 'noncollinear', a, b, c, what: `${l(0)}, ${l(1)}, ${l(2)} are collinear` },
    { kind: 'noncollinear', a: d, b: e, c: g, what: `${l(3)}, ${l(4)}, ${l(5)} are collinear` },
  ];
}

/** u·v or u·conj(v) of complex numbers stored as vectors. */
function cmul<T>(F: Field<T>, u: Vec<T>, v: Vec<T>, conj: boolean): Vec<T> {
  const vy = conj ? F.neg(v.y) : v.y;
  return { x: F.sub(F.mul(u.x, v.x), F.mul(u.y, vy)), y: F.add(F.mul(u.x, vy), F.mul(u.y, v.x)) };
}

/** (B − A)(F − D) − (C − A)(E − D), with conj on the second factors when opposite. */
function orientedDiff<T>(F: Field<T>, p: Six<T>, opposite: boolean): Vec<T> {
  const [a, b, c, d, e, g] = p;
  const l = cmul(F, vSub(F, b, a), vSub(F, g, d), opposite);
  const r = cmul(F, vSub(F, c, a), vSub(F, e, d), opposite);
  return vSub(F, l, r);
}

type Mode = 'any' | 'direct' | 'opposite';

/** The conditions of a similarity of the given mode. */
function similarConditions<T>(F: Field<T>, p: Six<T>, mode: Mode): T[] {
  if (mode !== 'any') {
    const z = orientedDiff(F, p, mode === 'opposite');
    return [z.x, z.y];
  }
  const [a, b, c, d, e, g] = p;
  const [s1, s2] = [sides(F, a, b, c), sides(F, d, e, g)];
  return [
    F.sub(F.mul(s1[2], s2[0]), F.mul(s2[2], s1[0])),
    F.sub(F.mul(s1[1], s2[0]), F.mul(s2[1], s1[0])),
  ];
}

function algebra<T>(
  F: Field<T>,
  args: ClaimArgs<T>,
  name: string,
  mode: Mode,
  congruent: boolean,
): Algebra<T> | ReturnType<typeof badClaim> {
  const p = six(args);
  if (p === undefined) return badClaim(name);
  const [a, b, c, d, e, g] = p;
  const [s1, s2] = [sides(F, a, b, c), sides(F, d, e, g)];
  const ab = F.sub(s1[2], s2[2]);
  const equalSides = mode === 'any' ? [F.sub(s1[0], s2[0]), F.sub(s1[1], s2[1]), ab] : [ab];
  const conditions = congruent
    ? [...(mode === 'any' ? [] : similarConditions(F, p, mode)), ...equalSides]
    : similarConditions(F, p, mode);
  return { conditions, ndg: proper(p), order: [] };
}

/** |x − y| / (x + y) for lengths x, y ≥ 0. */
function rel(x: number, y: number): number {
  return f.ratio(x - y, x + y);
}

/** The float residual (dimensionless): the worst relative mismatch of the conditions. */
function residual(args: ClaimArgs<number>, mode: Mode, congruent: boolean): number {
  const p = six(args);
  if (p === undefined) return Infinity;
  const [a, b, c, d, e, g] = p;
  const [a1, b1, c1] = [f.dist(b, c), f.dist(c, a), f.dist(a, b)];
  const [a2, b2, c2] = [f.dist(e, g), f.dist(g, d), f.dist(d, e)];
  const parts: number[] = [];
  if (mode === 'any' && !congruent) parts.push(rel(c1 * a2, c2 * a1), rel(b1 * a2, b2 * a1));
  if (mode !== 'any') {
    const [u, w] = [f.sub(b, a), f.sub(c, a)];
    const [x, y] = [f.sub(e, d), f.sub(g, d)];
    const z = orientedDiff(FloatField, p, mode === 'opposite');
    parts.push(f.ratio(f.norm(z), f.norm(u) * f.norm(y) + f.norm(w) * f.norm(x)));
  }
  if (congruent) parts.push(rel(c1, c2));
  if (congruent && mode === 'any') parts.push(rel(a1, a2), rel(b1, b2));
  return f.maxOf(parts);
}

function kind(name: string, mode: Mode, congruent: boolean, doc: string): ClaimKindSpec {
  return {
    name,
    params: ['point', 'point', 'point', 'point', 'point', 'point'],
    polynomial: true,
    test: 'floor',
    doc,
    algebra: (F, args) => algebra(F, args, name, mode, congruent),
    residual: (args) => residual(args, mode, congruent),
  };
}

export const TRIANGLE_KINDS: readonly ClaimKindSpec[] = [
  kind(
    'similar',
    'any',
    false,
    'similar(A, B, C, D, E, F): △ABC ∼ △DEF (A ↔ D, B ↔ E, C ↔ F), directly or oppositely.',
  ),
  kind(
    'similar_direct',
    'direct',
    false,
    'similar_direct(A, B, C, D, E, F): △ABC ∼ △DEF with the same orientation.',
  ),
  kind(
    'similar_opposite',
    'opposite',
    false,
    'similar_opposite(A, B, C, D, E, F): △ABC ∼ △DEF with opposite orientations.',
  ),
  kind(
    'congruent',
    'any',
    true,
    'congruent(A, B, C, D, E, F): △ABC ≅ △DEF (A ↔ D, B ↔ E, C ↔ F), directly or oppositely.',
  ),
  kind(
    'congruent_direct',
    'direct',
    true,
    'congruent_direct(A, B, C, D, E, F): △ABC ≅ △DEF with the same orientation.',
  ),
  kind(
    'congruent_opposite',
    'opposite',
    true,
    'congruent_opposite(A, B, C, D, E, F): △ABC ≅ △DEF with opposite orientations.',
  ),
];
