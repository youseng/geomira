/**
 * Seeded random similarities and values of every kind (Run 4, law L13), generic over the
 * field: coordinates are small rationals converted with F.fromRational, so the same draw
 * is exact over Q and mod p and a double in FloatField. `sameValues` compares two values
 * structurally: exactly in exact fields, within a relative 1e-9 in FloatField.
 */
import { assertNever } from '@geomira/num/assert';
import { isInexact, type Field } from '@geomira/num/field';
import { rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { similarity } from '../../src/similarity';
import type { Similarity, Value, Vec } from '../../src/value';

const DENS = [1n, 2n, 3n, 4n, 5n, 7n, 8n];

export function randomScalar<T>(F: Field<T>, rng: Rng, nonZero = false): T {
  for (;;) {
    const n = BigInt(rng.nextInt(81) - 40);
    if (nonZero && n === 0n) continue;
    const v = F.fromRational(rational(n, DENS[rng.nextInt(DENS.length)] ?? 1n));
    if (isInexact(v)) throw new Error(v.reason);
    return v;
  }
}

function vecOf<T>(F: Field<T>, rng: Rng): Vec<T> {
  return { x: randomScalar(F, rng), y: randomScalar(F, rng) };
}

/** A non-zero direction (never both components 0). */
function dirOf<T>(F: Field<T>, rng: Rng): Vec<T> {
  return rng.nextFloat() < 0.5
    ? { x: randomScalar(F, rng, true), y: randomScalar(F, rng) }
    : { x: randomScalar(F, rng), y: randomScalar(F, rng, true) };
}

/** A random similarity: a ≠ 0, anti in half the draws. */
export function randomSimilarity<T>(F: Field<T>, rng: Rng): Similarity<T> {
  const a = dirOf(F, rng);
  const b = vecOf(F, rng);
  return similarity(rng.nextFloat() < 0.5, { re: a.x, im: a.y }, { re: b.x, im: b.y });
}

/** A random point, line / segment / ray (either flag), circle (anchor, arc) or polygon. */
export function randomValue<T>(F: Field<T>, rng: Rng): Value<T> {
  const P = () => vecOf(F, rng);
  switch (rng.nextInt(4)) {
    case 0:
      return { kind: 'point', ...P() };
    case 1: {
      const range = rng.nextInt(3);
      return {
        kind: 'line',
        p: P(),
        d: dirOf(F, rng),
        lo: range === 0 ? null : F.zero,
        hi: range === 2 ? F.one : null,
        chiral: rng.nextFloat() < 0.5,
      };
    }
    case 2: {
      const r = randomScalar(F, rng, true);
      const base = {
        kind: 'circle' as const,
        c: P(),
        r2: F.mul(r, r),
        arc: rng.nextFloat() < 0.3 ? { from: P(), to: P() } : null,
      };
      return rng.nextFloat() < 0.7 ? { ...base, anchor: P() } : base;
    }
    default:
      return { kind: 'polygon', pts: [P(), P(), P(), ...(rng.nextFloat() < 0.5 ? [P()] : [])] };
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

function sameBound<T>(F: Field<T>, u: T | null, v: T | null): boolean {
  return u === null || v === null ? u === v : close(F, u, v);
}

/** Whether two values are the same (kind, flags, ranges, numbers; see the module doc). */
export function sameValues<T>(F: Field<T>, u: Value<T>, v: Value<T>): boolean {
  switch (u.kind) {
    case 'point':
      return v.kind === 'point' && sameVec(F, u, v);
    case 'line':
      return (
        v.kind === 'line' &&
        sameVec(F, u.p, v.p) &&
        sameVec(F, u.d, v.d) &&
        sameBound(F, u.lo, v.lo) &&
        sameBound(F, u.hi, v.hi) &&
        u.chiral === v.chiral
      );
    case 'circle': {
      if (v.kind !== 'circle' || !sameVec(F, u.c, v.c) || !close(F, u.r2, v.r2)) return false;
      const arcs =
        u.arc === null || v.arc === null
          ? u.arc === v.arc
          : sameVec(F, u.arc.from, v.arc.from) && sameVec(F, u.arc.to, v.arc.to);
      const anchors =
        u.anchor === undefined || v.anchor === undefined
          ? u.anchor === v.anchor
          : sameVec(F, u.anchor, v.anchor);
      return arcs && anchors;
    }
    case 'polygon':
      return (
        v.kind === 'polygon' &&
        u.pts.length === v.pts.length &&
        u.pts.every((p, i) => {
          const q = v.pts[i];
          return q !== undefined && sameVec(F, p, q);
        })
      );
    case 'number':
      return v.kind === 'number' && close(F, u.v, v.v);
    case 'transform':
      return (
        v.kind === 'transform' &&
        u.t.anti === v.t.anti &&
        sameVec(F, { x: u.t.a.re, y: u.t.a.im }, { x: v.t.a.re, y: v.t.a.im }) &&
        sameVec(F, { x: u.t.b.re, y: u.t.b.im }, { x: v.t.b.re, y: v.t.b.im })
      );
    case 'undefined':
    case 'inexact':
      return v.kind === u.kind && v.reason === u.reason;
    default:
      return assertNever(u, 'value');
  }
}
