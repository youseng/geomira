/**
 * Random figures for the selector tests (Run 3b): a branchable call (line ∩ circle, circle
 * ∩ circle, tangent_point, tangent_from) on free points chosen so that it has two
 * candidates, and those candidates computed INDEPENDENTLY of the kernel's pairs.ts, in
 * plain doubles: the quadratic formula for line ∩ circle, the radical line for two
 * circles, the polar for tangents. The lines are line(U, V) (achiral) or perp_bisector(U,
 * V) (chiral).
 */
import { fromNumber } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { call, lit, type Expr, type RefExpr } from '../../src/expr';
import type { Value } from '../../src/value';
import { Builder } from './doc';

export type V = readonly [number, number];

export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
export const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: V, b: V): number => a[0] * b[1] - a[1] * b[0];
export const rot = (a: V): V => [-a[1], a[0]];
export const len = (a: V): number => Math.hypot(a[0], a[1]);
export const unit = (deg: number): V => [
  Math.cos((deg * Math.PI) / 180),
  Math.sin((deg * Math.PI) / 180),
];
export const mirror = (a: V): V => [-a[0], a[1]];

export type Kind = 'lc' | 'cc' | 'tp' | 'tf';

export interface BranchFigure {
  readonly b: Builder;
  readonly kind: Kind;
  readonly tool: 'intersect' | 'tangent_point' | 'tangent_from';
  readonly args: readonly Expr[];
  /** The two candidates (touch points for tf), independent of the kernel. */
  readonly cands: readonly [V, V];
  /** lc: the line's p and d (as evaluated: line(U, V) or perp_bisector(U, V)). */
  readonly line?: { readonly p: V; readonly d: V; readonly chiral: boolean };
  /** cc: the centres O₁, O₂; tp/tf: P and O (orient's reference: from → to). */
  readonly orient?: { readonly from: V; readonly to: V };
  /** A circle of the pair (for on_arc, inside…) and its centre and radius. */
  readonly circle: { readonly ref: RefExpr; readonly c: V; readonly r: number };
  /** The scale of the figure's free points (an estimate: their bounding box diagonal). */
  readonly free: V[];
}

export function freePoint(b: Builder, free: V[], name: string, p: V): RefExpr {
  free.push(p);
  return b.add(name, call('point', [lit(fromNumber(p[0])), lit(fromNumber(p[1]))]));
}

/** The intersections of the line p + t·d with the circle (c, r), t increasing. */
export function lineCircle(p: V, d: V, c: V, r: number): [V, V] | undefined {
  const w = sub(p, c);
  const [a, h, k] = [dot(d, d), dot(d, w), dot(w, w) - r * r];
  const disc = h * h - a * k;
  if (!(disc > 0)) return undefined;
  const s = Math.sqrt(disc);
  return [add(p, mul(d, (-h - s) / a)), add(p, mul(d, (-h + s) / a))];
}

/** The intersections of two circles: [below, above] the line of centres O₁ → O₂. */
export function circleCircle(c1: V, r1: number, c2: V, r2: number): [V, V] | undefined {
  const w = sub(c2, c1);
  const d = len(w);
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (!(h2 > 0)) return undefined;
  const e = mul(w, 1 / d);
  const m = add(c1, mul(e, a));
  const off = mul(rot(e), Math.sqrt(h2));
  return [sub(m, off), add(m, off)];
}

/** The touch points of the tangents from P to (c, r). */
export function touchPoints(P: V, c: V, r: number): [V, V] | undefined {
  const w = sub(P, c);
  const q = dot(w, w);
  if (!(q > r * r)) return undefined;
  const m = add(c, mul(w, (r * r) / q));
  const off = mul(rot(w), (r * Math.sqrt(q - r * r)) / q);
  return [sub(m, off), add(m, off)];
}

function circleAround(rng: Rng, b: Builder, free: V[], tag: string, O: V, r: number): RefExpr {
  const o = freePoint(b, free, `O_${tag}`, O);
  const a = freePoint(b, free, `A_${tag}`, add(O, mul(unit(rng.uniform(0, 360)), r)));
  return b.add(`c_${tag}`, call('circle', [o, a]));
}

/** A random point in [−20, 20]². */
export function anywhere(rng: Rng): V {
  return [rng.uniform(-20, 20), rng.uniform(-20, 20)];
}

/**
 * A figure of the given kind with two candidates. `through`: a point the pair's curves
 * must both pass through (for other(P)); then the line is line(P, R), the circles are
 * circle(O, P), and for tangents P lies on the tangent at a point T of c (`through` = T).
 */
export function branchFigure(rng: Rng, kind: Kind, through = false): BranchFigure | undefined {
  const b = new Builder();
  const free: V[] = [];
  const O = anywhere(rng);
  const r = rng.uniform(3, 15);
  const T = add(O, mul(unit(rng.uniform(0, 360)), r));
  const c = through
    ? b.add('c_1', call('circle', [freePoint(b, free, 'O_1', O), freePoint(b, free, 'T', T)]))
    : circleAround(rng, b, free, '1', O, r);
  const r1 = len(sub(through ? T : (free[1] ?? O), O));
  const circle = { ref: c, c: O, r: r1 };
  if (kind === 'lc') return lineFigure(rng, b, free, circle, through ? T : undefined);
  if (kind === 'cc') return circlesFigure(rng, b, free, circle, through ? T : undefined);
  return tangentFigure(rng, b, free, circle, kind, through ? T : undefined);
}

function lineFigure(
  rng: Rng,
  b: Builder,
  free: V[],
  circle: BranchFigure['circle'],
  T: V | undefined,
): BranchFigure | undefined {
  const { c: O, r } = circle;
  const Q = T ?? add(O, mul(unit(rng.uniform(0, 360)), r * rng.uniform(0, 0.9)));
  const v = mul(unit(rng.uniform(0, 360)), rng.uniform(1, 10));
  const chiral = T === undefined && rng.nextFloat() < 0.5;
  const [u, w] = chiral ? [add(Q, v), sub(Q, v)] : [Q, add(Q, v)];
  const U = T === undefined ? freePoint(b, free, 'U', u) : b.ref('T');
  const W = freePoint(b, free, 'W', w);
  const l = b.add('l_1', call(chiral ? 'perp_bisector' : 'line', [U, W]));
  const p = chiral ? mul(add(u, w), 0.5) : u;
  const d = chiral ? rot(sub(w, u)) : sub(w, u);
  const cands = lineCircle(p, d, O, r);
  if (cands === undefined) return undefined;
  return {
    b,
    kind: 'lc',
    tool: 'intersect',
    args: [l, circle.ref],
    cands,
    line: { p, d, chiral },
    circle,
    free,
  };
}

function circlesFigure(
  rng: Rng,
  b: Builder,
  free: V[],
  circle: BranchFigure['circle'],
  T: V | undefined,
): BranchFigure | undefined {
  const { c: O, r } = circle;
  const r2 = rng.uniform(3, 15);
  const lo = Math.abs(r - r2) + 0.5;
  const hi = r + r2 - 0.5;
  if (!(lo < hi)) return undefined;
  const O2 =
    T === undefined
      ? add(O, mul(unit(rng.uniform(0, 360)), rng.uniform(lo, hi)))
      : add(T, mul(unit(rng.uniform(0, 360)), r2));
  const o2 = freePoint(b, free, 'O_2', O2);
  const c2 =
    T === undefined
      ? b.add(
          'c_2',
          call('circle', [
            o2,
            freePoint(b, free, 'A_2', add(O2, mul(unit(rng.uniform(0, 360)), r2))),
          ]),
        )
      : b.add('c_2', call('circle', [o2, b.ref('T')]));
  const R2 = T === undefined ? r2 : len(sub(T, O2));
  const cands = circleCircle(O, r, O2, R2);
  if (cands === undefined) return undefined;
  return {
    b,
    kind: 'cc',
    tool: 'intersect',
    args: [circle.ref, c2],
    cands,
    orient: { from: O, to: O2 },
    circle,
    free,
  };
}

function tangentFigure(
  rng: Rng,
  b: Builder,
  free: V[],
  circle: BranchFigure['circle'],
  kind: 'tp' | 'tf',
  T: V | undefined,
): BranchFigure | undefined {
  const { c: O, r } = circle;
  const P =
    T === undefined
      ? add(O, mul(unit(rng.uniform(0, 360)), r * rng.uniform(1.1, 4)))
      : add(T, mul(rot(sub(T, O)), rng.uniform(0.2, 2) * (rng.nextFloat() < 0.5 ? 1 : -1)));
  const p = freePoint(b, free, 'P', P);
  const cands = touchPoints(P, O, r);
  if (cands === undefined) return undefined;
  const tool = kind === 'tp' ? 'tangent_point' : 'tangent_from';
  return { b, kind, tool, args: [p, circle.ref], cands, orient: { from: P, to: O }, circle, free };
}

/** The point a branch result stands for: a point itself, or a tangent line's touch point p. */
export function resultPoint(v: Value<number>): V | undefined {
  if (v.kind === 'point') return [v.x, v.y];
  if (v.kind === 'line') return [v.p.x, v.p.y];
  return undefined;
}

/** The diagonal of the bounding box of the free points (≥ 1): SPEC §3.1's scale. */
export function scaleOf(free: readonly V[]): number {
  const xs = free.map((p) => p[0]);
  const ys = free.map((p) => p[1]);
  return Math.max(
    1,
    Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
  );
}
