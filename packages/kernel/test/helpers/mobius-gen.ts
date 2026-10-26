/**
 * Seeded random Möbius maps and figures for the inversion laws (Run 14, ADR-0032), generic over
 * the field: an inversion inversion(O, k) (k ≠ 0, either sign), sometimes composed with random
 * similarities on either side; points, lines with every kind of range (full, segment, ray, the
 * two rays `outside`) and circles with an anchor and an arc whose points lie ON the circle
 * (rational points from the stereographic parameter). `samePointSet` compares two figures as
 * point sets (a line's base point, direction length and parameters may differ): exactly in
 * exact fields, within a relative 1e-9 in FloatField.
 */
import { isInexact, type Field } from '@geomira/num/field';
import { rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { composeMaps } from '../../src/transform/mobius';
import { mobius } from '../../src/transform/mobius';
import type { Circle, Line, TransformData, Value, Vec } from '../../src/value';
import { randomScalar, randomSimilarity } from './similarity-gen';

function q<T>(F: Field<T>, n: bigint, d = 1n): T {
  const v = F.fromRational(rational(n, d));
  if (isInexact(v)) throw new Error(v.reason);
  return v;
}

function vecOf<T>(F: Field<T>, rng: Rng): Vec<T> {
  return { x: randomScalar(F, rng), y: randomScalar(F, rng) };
}

/** The inversion with center O and power k as a map (the inversion tool's own matrix). */
export function inversionMap<T>(F: Field<T>, O: Vec<T>, k: T): TransformData<T> {
  const oo = F.add(F.mul(O.x, O.x), F.mul(O.y, O.y));
  return mobius(
    true,
    { re: O.x, im: O.y },
    { re: F.sub(k, oo), im: F.zero },
    { re: F.one, im: F.zero },
    { re: F.neg(O.x), im: O.y },
  );
}

/** inversion(O, k) for random O and k ≠ 0, alone or between random similarities. */
export function randomMobius<T>(F: Field<T>, rng: Rng): TransformData<T> {
  const J = inversionMap(F, vecOf(F, rng), randomScalar(F, rng, true));
  switch (rng.nextInt(4)) {
    case 0:
      return J;
    case 1:
      return composeMaps(F, randomSimilarity(F, rng), J);
    case 2:
      return composeMaps(F, J, randomSimilarity(F, rng));
    default:
      return composeMaps(F, randomSimilarity(F, rng), composeMaps(F, J, randomSimilarity(F, rng)));
  }
}

/** The rational point of the circle (c, r) at stereographic parameter s: c + r·((1 − s²), 2s)/(1 + s²). */
export function onCircle<T>(F: Field<T>, c: Vec<T>, r: T, s: T): Vec<T> {
  const ss = F.mul(s, s);
  const den = F.add(F.one, ss);
  return {
    x: F.add(c.x, F.div(F.mul(r, F.sub(F.one, ss)), den)),
    y: F.add(c.y, F.div(F.mul(r, F.add(s, s)), den)),
  };
}

/** A random line value with any range (outside: lo < hi). */
export function randomLine<T>(F: Field<T>, rng: Rng): Line<T> {
  const d = { x: randomScalar(F, rng, true), y: randomScalar(F, rng) };
  const base = { kind: 'line' as const, p: vecOf(F, rng), d, chiral: rng.nextFloat() < 0.5 };
  const [a, b] = [q(F, BigInt(rng.nextInt(7) - 3), 2n), q(F, BigInt(rng.nextInt(7) + 4), 2n)];
  switch (rng.nextInt(5)) {
    case 0:
      return { ...base, lo: null, hi: null };
    case 1:
      return { ...base, lo: a, hi: b };
    case 2:
      return { ...base, lo: a, hi: null };
    case 3:
      return { ...base, lo: null, hi: b };
    default:
      return { ...base, lo: a, hi: b, outside: true };
  }
}

/** A random circle with an anchor on it and, in some draws, an arc between two of its points. */
export function randomCircle<T>(F: Field<T>, rng: Rng): Circle<T> {
  const c = vecOf(F, rng);
  const r = q(F, BigInt(rng.nextInt(12) + 1), BigInt(rng.nextInt(3) + 1));
  const at = (): Vec<T> => onCircle(F, c, r, q(F, BigInt(rng.nextInt(21) - 10), 3n));
  const anchor = at();
  const [from, to] = [at(), at()];
  const same = F.eq(from.x, to.x) && F.eq(from.y, to.y);
  const arc = rng.nextFloat() < 0.5 && !same ? { from, to } : null;
  return { kind: 'circle', c, r2: F.mul(r, r), arc, anchor };
}

/** A random point, line (any range) or circle (with or without an arc). */
export function randomFigure<T>(F: Field<T>, rng: Rng): Value<T> {
  switch (rng.nextInt(3)) {
    case 0:
      return { kind: 'point', ...vecOf(F, rng) };
    case 1:
      return randomLine(F, rng);
    default:
      return randomCircle(F, rng);
  }
}

function close<T>(F: Field<T>, x: T, y: T): boolean {
  if (F.kind !== 'float') return F.eq(x, y);
  const [a, b] = [F.toNumber(x), F.toNumber(y)];
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function sameVec<T>(F: Field<T>, u: Vec<T>, v: Vec<T>): boolean {
  return close(F, u.x, v.x) && close(F, u.y, v.y);
}

function cross<T>(F: Field<T>, u: Vec<T>, v: Vec<T>): T {
  return F.sub(F.mul(u.x, v.y), F.mul(u.y, v.x));
}

/** The ends of a line's range as positions, and its parameter of a position. */
function ends<T>(F: Field<T>, l: Line<T>): Vec<T>[] {
  const at = (t: T): Vec<T> => ({
    x: F.add(l.p.x, F.mul(t, l.d.x)),
    y: F.add(l.p.y, F.mul(t, l.d.y)),
  });
  return [l.lo, l.hi].filter((t): t is T => t !== null).map(at);
}

/** Whether position X (on l's carrier) lies in l's range, using plain doubles. */
function inRange<T>(F: Field<T>, l: Line<T>, X: Vec<T>): boolean {
  const n = (x: T): number => F.toNumber(x);
  const [wx, wy, dx, dy] = [n(X.x) - n(l.p.x), n(X.y) - n(l.p.y), n(l.d.x), n(l.d.y)];
  const t = (wx * dx + wy * dy) / (dx * dx + dy * dy);
  const lo = l.lo === null ? -Infinity : n(l.lo);
  const hi = l.hi === null ? Infinity : n(l.hi);
  return l.outside === true ? t <= lo || t >= hi : t >= lo && t <= hi;
}

/** Probe positions of a line: around each end (±1/4 of |d|) and far out both ways. */
function probes<T>(F: Field<T>, l: Line<T>): Vec<T>[] {
  const out: Vec<T>[] = [];
  const step = (p: Vec<T>, t: T): Vec<T> => ({
    x: F.add(p.x, F.mul(t, l.d.x)),
    y: F.add(p.y, F.mul(t, l.d.y)),
  });
  const quarter = q(F, 1n, 4n);
  for (const e of ends(F, l)) out.push(step(e, quarter), step(e, F.neg(quarter)));
  const far = q(F, 1000000n);
  out.push(step(l.p, far), step(l.p, F.neg(far)));
  return out;
}

function sameLine<T>(F: Field<T>, u: Line<T>, v: Line<T>): boolean {
  const n2 = F.add(F.mul(u.d.x, u.d.x), F.mul(u.d.y, u.d.y));
  const m2 = F.add(F.mul(v.d.x, v.d.x), F.mul(v.d.y, v.d.y));
  const sin =
    F.kind === 'float' ? F.toNumber(cross(F, u.d, v.d)) ** 2 / F.toNumber(F.mul(n2, m2)) : 0;
  if (F.kind === 'float' ? sin > 1e-18 : !F.eq(cross(F, u.d, v.d), F.zero)) return false;
  const off = cross(F, u.d, { x: F.sub(v.p.x, u.p.x), y: F.sub(v.p.y, u.p.y) });
  if (F.kind === 'float' ? !close(F, F.div(F.mul(off, off), n2), F.zero) : !F.eq(off, F.zero))
    return false;
  const [eu, ev] = [ends(F, u), ends(F, v)];
  if (eu.length !== ev.length || !eu.every((e) => ev.some((f) => sameVec(F, e, f)))) return false;
  if ((u.outside === true) !== (v.outside === true) && eu.length === 2) return false;
  if (F.kind === 'modp') return true;
  return [...probes(F, u), ...probes(F, v)].every((X) => inRange(F, u, X) === inRange(F, v, X));
}

function sameCircle<T>(F: Field<T>, u: Circle<T>, v: Circle<T>): boolean {
  if (!sameVec(F, u.c, v.c) || !close(F, u.r2, v.r2)) return false;
  if (u.arc === null || v.arc === null) return u.arc === v.arc;
  return sameVec(F, u.arc.from, v.arc.from) && sameVec(F, u.arc.to, v.arc.to);
}

/** Whether two figures are the same point set (see the module doc). */
export function samePointSet<T>(F: Field<T>, u: Value<T>, v: Value<T>): boolean {
  if (u.kind === 'point') return v.kind === 'point' && sameVec(F, u, v);
  if (u.kind === 'line') return v.kind === 'line' && sameLine(F, u, v);
  if (u.kind === 'circle') return v.kind === 'circle' && sameCircle(F, u, v);
  return false;
}

/** Whether a value is a figure with a range or an arc (Inexact through an inversion mod p). */
export function isRanged<T>(v: Value<T>): boolean {
  return (
    (v.kind === 'line' && (v.lo !== null || v.hi !== null)) ||
    (v.kind === 'circle' && v.arc !== null)
  );
}
