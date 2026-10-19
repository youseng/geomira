/**
 * Runner of the Run 3a theorem tests: random figures in three modes, each theorem checked
 * once against Field<T> (F.isZero is exact over Q and EPS-relative over floats).
 *   - float: six free points with random double coordinates;
 *   - rational: six free points on a grid of 1/64 (exact);
 *   - heronian: a triangle A, B, C with rational side lengths (vertices R·w² + centre for
 *     rational points w of the unit circle: every chord 2R·|sin(φ₁ − φ₂)| is rational), plus
 *     three grid points D, E, F, so that the side-length tools run exactly over Q.
 */
import { isInexact, type Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import {
  add,
  div,
  eq,
  fromNumber,
  mul,
  neg,
  rational,
  sub,
  type Rational,
} from '@geomira/num/rational';
import { FLOOR_DELTA, FLOOR_MAX } from '@geomira/num/tolerance';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { expect, it } from 'vitest';
import { call, lit, type RefExpr } from '../../src/expr';
import { abs, vCross, vDot, vSub } from '../../src/geom';
import type { Value, Vec } from '../../src/value';
import { Builder, contextOf, evalDoc, valueOf } from './doc';
import type { Figure } from './figure';
import { lawCount } from './laws';

export type Mode = 'float' | 'rational' | 'heronian';

/** The free points A, B, C, D, E, F. */
export type Six = readonly [RefExpr, RefExpr, RefExpr, RefExpr, RefExpr, RefExpr];

export interface Theorem {
  readonly name: string;
  readonly modes: readonly Mode[];
  /** Builds the construction on the free points A, B, C, D, E, F. */
  readonly build: (b: Builder, p: Six) => void;
  /** Objects that must be defined (a degenerate draw is skipped, counted below). */
  readonly required: readonly string[];
  readonly check: <T>(f: Figure<T>) => boolean;
}

export const FIGURES = lawCount(200);

type XY = readonly [Rational, Rational];

/** The rational point ((1 − t²) + 2t·i) / (1 + t²) of the unit circle. */
function unit(t: Rational): XY {
  const den = add(rational(1n), mul(t, t));
  return [div(sub(rational(1n), mul(t, t)), den), div(mul(rational(2n), t), den)];
}

/**
 * Three vertices R·w² + centre with rational side lengths (see the module comment), from
 * three distinct parameters t, so the vertices are distinct points of one circle.
 */
export function heronianTriangle(rng: Rng): XY[] {
  const r = rational(BigInt(rng.nextInt(20) + 4), BigInt(rng.nextInt(3) + 1));
  const centre: XY = [
    rational(BigInt(rng.nextInt(21) - 10)),
    rational(BigInt(rng.nextInt(21) - 10)),
  ];
  const ts: Rational[] = [];
  while (ts.length < 3) {
    const t = rational(BigInt(rng.nextInt(25) - 12), BigInt(rng.nextInt(6) + 1));
    // w² is the same point for t and −1/t (w ↦ −w), so those count as equal too.
    if (!ts.some((s) => eq(s, t) || eq(mul(s, t), rational(-1n)))) ts.push(t);
  }
  return ts.map((t) => {
    const [x, y] = unit(t);
    const [sx, sy] = [sub(mul(x, x), mul(y, y)), mul(rational(2n), mul(x, y))];
    return [add(centre[0], mul(r, sx)), add(centre[1], mul(r, sy))] as const;
  });
}

function coordinates(rng: Rng, mode: Mode): XY[] {
  const grid = (): Rational => rational(BigInt(rng.nextInt(4097) - 2048), 64n);
  const free = (): XY =>
    mode === 'float'
      ? [fromNumber(rng.uniform(-30, 30)), fromNumber(rng.uniform(-30, 30))]
      : [grid(), grid()];
  const extra = [free(), free(), free()];
  return mode === 'heronian'
    ? [...heronianTriangle(rng), ...extra]
    : [free(), free(), free(), ...extra];
}

function build(t: Theorem, xy: readonly XY[]): Builder {
  const b = new Builder();
  const free = (i: number): RefExpr => {
    const [x, y] = xy[i] ?? [rational(0n), rational(0n)];
    return b.add('ABCDEF'[i] ?? 'Z', call('point', [lit(x), lit(y)]));
  };
  t.build(b, [free(0), free(1), free(2), free(3), free(4), free(5)]);
  return b;
}

/**
 * ILL-CONDITIONED (SPEC §3.1) in FloatField: moving every free point by FLOOR_DELTA·scale
 * moves some value by more than FLOOR_MAX·scale. Such a figure (for example a triangle so
 * flat that its excenter is 10⁴ times farther than its size) is skipped and counted, as
 * the claim tester will do, instead of being judged with tolerances it cannot meet.
 */
function illConditioned(t: Theorem, xy: readonly XY[], base: Builder, scale: number): boolean {
  const shift = fromNumber(FLOOR_DELTA * scale);
  const moved = build(
    t,
    xy.map(([x, y], i) => [add(x, i % 2 === 0 ? shift : neg(shift)), add(y, shift)] as const),
  );
  const [e0, e1] = [evalDoc(base.doc, FloatField), evalDoc(moved.doc, FloatField)];
  return base.doc.objects.some((o) => {
    const [u, v] = [e0.values.get(o.id), e1.values.get(o.id)];
    if (u === undefined || v === undefined) return false;
    const [a, c] = [positions(u), positions(v)];
    return a.length !== c.length || a.some((x, k) => Math.abs(x - (c[k] ?? x)) > FLOOR_MAX * scale);
  });
}

/** The length-valued numbers of a value: point coordinates, circle centres and anchors. */
function positions(v: Value<number>): number[] {
  if (v.kind === 'point') return [v.x, v.y];
  if (v.kind !== 'circle') return [];
  return [v.c.x, v.c.y, ...(v.anchor === undefined ? [] : [v.anchor.x, v.anchor.y])];
}

function sample<T>(
  F: Field<T>,
  seed: number,
  mode: Mode,
  t: Theorem,
): Figure<T> | 'degenerate' | 'ill-conditioned' {
  const xy = coordinates(createRng(seed), mode);
  const b = build(t, xy);
  const ctx = contextOf(b.doc);
  const ev = evalDoc(b.doc, F, ctx);
  const f: Figure<T> = { F, ctx, get: (name) => valueOf(b.doc, ev, name) };
  if (t.required.some((n) => f.get(n).kind === 'undefined')) return 'degenerate';
  return mode === 'float' && illConditioned(t, xy, b, ctx.scale) ? 'ill-conditioned' : f;
}

function fieldOf(mode: Mode): Field<unknown> {
  return mode === 'float' ? FloatField : RationalField;
}

/**
 * One `it` per mode: the theorem holds on every figure that is not degenerate (a required
 * object Undefined) or ill-conditioned, and those are ≥ 90% of the figures.
 */
export function theoremTests(theorems: readonly Theorem[], seed: number): void {
  for (const t of theorems) {
    for (const mode of t.modes) {
      it(`${t.name} (${mode === 'float' ? 'FloatField' : `RationalField, ${mode}`})`, () => {
        const F = fieldOf(mode);
        const tally = { checked: 0, degenerate: 0, 'ill-conditioned': 0 };
        for (let i = 0; i < FIGURES; i += 1) {
          const f = sample(F, deriveSeed(seed, i), mode, t);
          if (typeof f === 'string') {
            tally[f] += 1;
            continue;
          }
          expect(t.check(f), `figure ${String(i)}`).toBe(true);
          tally.checked += 1;
        }
        const checked = tally.checked;
        process.stdout.write(
          `theorem (${mode}) ${t.name.split(':')[0] ?? t.name}: ${String(checked)} hold, ` +
            `${String(tally.degenerate)} degenerate, ${String(tally['ill-conditioned'])} ill-conditioned\n`,
        );
        expect(checked).toBeGreaterThan(FIGURES * 0.9);
      });
    }
  }
}

/** |P − Q|². */
export function d2<T>(F: Field<T>, P: Vec<T>, Q: Vec<T>): T {
  const w = vSub(F, P, Q);
  return vDot(F, w, w);
}

/** √x, failing the test loudly when the field cannot represent it. */
export function root<T>(F: Field<T>, x: T): T {
  const r = F.sqrt(x);
  if (isInexact(r)) throw new Error(r.reason);
  return r;
}

/** A, B, C are collinear (cross product zero as an area). */
export function collinear<T>(f: Figure<T>, a: Vec<T>, b: Vec<T>, c: Vec<T>): boolean {
  return f.F.isZero(vCross(f.F, vSub(f.F, b, a), vSub(f.F, c, a)), 'area', f.ctx);
}

export const ALL: readonly Mode[] = ['float', 'rational'];
export const SIDES: readonly Mode[] = ['float', 'heronian'];

function magnitude<T>(F: Field<T>, x: T, f: Figure<T>): T {
  const a = abs(F, x, 'area', f.ctx);
  if (isInexact(a)) throw new Error(a.reason);
  return a;
}

/**
 * x = y relative to their size: |x − y| ≤ EPS·(|x| + |y| + scale²) in FloatField, exact
 * equality over Q. Flat triangles have far-away centres and huge exradii, whose rounding
 * grows with their size, so an absolute area threshold would test the float format, not
 * the geometry.
 */
export function sameSize<T>(f: Figure<T>, x: T, y: T): boolean {
  const { F } = f;
  const s2 = F.fromRational(fromNumber(f.ctx.scale * f.ctx.scale));
  if (isInexact(s2)) throw new Error(s2.reason);
  const m = F.add(F.add(magnitude(F, x, f), magnitude(F, y, f)), s2);
  return F.isZero(F.div(F.sub(x, y), m), 'dimensionless', f.ctx);
}

/** Two points coincide relative to their size (each coordinate as in sameSize). */
export function nearPoints<T>(f: Figure<T>, a: Vec<T>, b: Vec<T>): boolean {
  const { F } = f;
  const s = F.fromRational(fromNumber(f.ctx.scale));
  if (isInexact(s)) throw new Error(s.reason);
  return [
    [a.x, b.x],
    [a.y, b.y],
  ].every(([p, q]) => {
    if (p === undefined || q === undefined) return false;
    const m = F.add(F.add(magnitude(F, p, f), magnitude(F, q, f)), s);
    return F.isZero(F.div(F.sub(p, q), m), 'dimensionless', f.ctx);
  });
}
