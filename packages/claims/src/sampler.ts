/**
 * Samplers (SPEC §10.4). A sample is the user's document with its FREE inputs rewritten
 * (free.ts); images in derived layers and every other object are recomputed by evaluate.
 *   - LOCAL: a random similarity z ↦ s·R·(z − c) + c + b of the free points (c their
 *     centroid, s = 2^u with |u| ≤ 1), plus Gaussian noise σ = 0.02·scale; explicit radii
 *     are multiplied by s; glider parameters are perturbed locally (by an arc or a length
 *     of about σ); params by 2% of their range; no mirroring. It cannot cross a
 *     configuration boundary on purpose.
 *   - GLOBAL: the same similarity with σ = 0.3·scale; gliders uniform over their range
 *     (circle gliders uniform in angle, then converted to (u : v)); params uniform; the
 *     sample may be MIRRORED (x ↦ −x about c, before the similarity) WITHOUT flipping any
 *     selector. Gliders named by an `in_order` hypothesis on one object are drawn sorted.
 * Every sample is rounded to a coarse rational grid (scale / 2^10 for lengths, 2^−10 for
 * the dimensionless glider parameters, range / 2^10 for params) so that the exact rungs
 * can run on it; the same rounded document is evaluated by every rung and is the
 * counterexample document.
 */
import { assertNever } from '@geomira/num/assert';
import { fromInteger, rational, toNumber, ZERO, type Rational } from '@geomira/num/rational';
import { createRng, type Rng, type Seed } from '@geomira/num/rng';
import type { Document } from '@geomira/kernel/document';
import type { Value } from '@geomira/kernel/value';
import { GLOBAL_SIGMA, GRID_BITS, LOCAL_SIGMA, SIMILARITY_OCTAVES } from './constants';
import { readFree, writeFree, type Assignment, type FreeInput } from './free';
import { freeKey, type OrderedGroup, type Prepared } from './prepare';

export type Regime = 'local' | 'global';

interface Similarity {
  readonly s: number;
  readonly cos: number;
  readonly sin: number;
  readonly degrees: number;
  readonly c: readonly [number, number];
  readonly b: readonly [number, number];
  readonly mirrored: boolean;
}

/** x rounded to a multiple of 2^k, as an exact rational. */
export function dyadic(x: number, k: number): Rational {
  const m = BigInt(Math.round(x * 2 ** -k));
  return k >= 0 ? rational(m << BigInt(k)) : rational(m, 1n << BigInt(-k));
}

function centroid(prep: Prepared): readonly [number, number] {
  let [sx, sy, n] = [0, 0, 0];
  for (const input of prep.free) {
    if (input.kind !== 'point') continue;
    const v = readFree(prep.doc, input);
    if (v?.[0] === undefined || v[1] === undefined) continue;
    [sx, sy, n] = [sx + toNumber(v[0]), sy + toNumber(v[1]), n + 1];
  }
  return n === 0 ? [0, 0] : [sx / n, sy / n];
}

function similarity(rng: Rng, prep: Prepared, mirrored: boolean): Similarity {
  const theta = rng.uniform(0, 2 * Math.PI);
  const scale = prep.baseCtx.scale;
  return {
    s: 2 ** rng.uniform(-SIMILARITY_OCTAVES, SIMILARITY_OCTAVES),
    cos: Math.cos(theta),
    sin: Math.sin(theta),
    degrees: (theta * 180) / Math.PI,
    c: centroid(prep),
    b: [rng.uniform(-0.5, 0.5) * scale, rng.uniform(-0.5, 0.5) * scale],
    mirrored,
  };
}

function mapPoint(m: Similarity, x: number, y: number): readonly [number, number] {
  const dx = m.mirrored ? m.c[0] - x : x - m.c[0];
  const dy = y - m.c[1];
  return [
    m.s * (m.cos * dx - m.sin * dy) + m.c[0] + m.b[0],
    m.s * (m.sin * dx + m.cos * dy) + m.c[1] + m.b[1],
  ];
}

/** The exponent k of the length grid 2^k ≈ scale / 2^GRID_BITS. */
function gridExponent(scale: number): number {
  return Math.floor(Math.log2(scale)) - GRID_BITS;
}

interface Context {
  readonly prep: Prepared;
  readonly regime: Regime;
  readonly rng: Rng;
  readonly sim: Similarity;
  readonly sigma: number;
  readonly k: number;
}

function gliderObject(ctx: Context, input: FreeInput): Value<number> | undefined {
  return ctx.prep.gliderObjects.get(freeKey(input.id, input.path));
}

/** The t-range a line glider is drawn from (bounded sides as they are, open sides ±2·spread). */
function lineRange(ctx: Context, input: FreeInput, t0: number): readonly [number, number, number] {
  const l = gliderObject(ctx, input);
  const len = l?.kind === 'line' ? Math.hypot(l.d.x, l.d.y) : 0;
  const spread = len > 0 ? ctx.prep.baseCtx.scale / len : 1;
  const lo = l?.kind === 'line' && l.lo !== null ? l.lo : t0 - 2 * spread;
  const hi = l?.kind === 'line' && l.hi !== null ? l.hi : t0 + 2 * spread;
  return [lo, hi, spread];
}

function tExponent(spread: number): number {
  return Math.floor(Math.log2(spread)) - GRID_BITS;
}

function stereo(phi: number): Rational[] {
  return [dyadic(Math.cos(phi / 2), -GRID_BITS), dyadic(Math.sin(phi / 2), -GRID_BITS)];
}

function radiusOf(ctx: Context, input: FreeInput): number {
  const c = gliderObject(ctx, input);
  return c?.kind === 'circle' ? Math.sqrt(c.r2) : ctx.prep.baseCtx.scale;
}

function sampleInput(ctx: Context, input: FreeInput, v: readonly Rational[]): Rational[] {
  const at = (i: number): number => toNumber(v[i] ?? ZERO);
  const local = ctx.regime === 'local';
  const g = () => ctx.rng.gaussian();
  switch (input.kind) {
    case 'point': {
      const [x, y] = mapPoint(ctx.sim, at(0), at(1));
      return [dyadic(x + ctx.sigma * g(), ctx.k), dyadic(y + ctx.sigma * g(), ctx.k)];
    }
    case 'radius': {
      const r = dyadic(at(0) * ctx.sim.s, ctx.k);
      return [r.num === 0n ? dyadic(2 ** ctx.k, ctx.k) : r];
    }
    case 'line-glider': {
      const [lo, hi, spread] = lineRange(ctx, input, at(0));
      const t = local
        ? at(0) + (ctx.sigma / ctx.prep.baseCtx.scale) * spread * g()
        : ctx.rng.uniform(lo, hi);
      return [dyadic(t, tExponent(spread))];
    }
    case 'stereo': {
      const phi = 2 * Math.atan2(at(1), at(0));
      return stereo(
        local ? phi + (ctx.sigma / radiusOf(ctx, input)) * g() : ctx.rng.uniform(0, 2 * Math.PI),
      );
    }
    case 'angle-glider': {
      const step = ((ctx.sigma / radiusOf(ctx, input)) * 180) / Math.PI;
      const theta = local ? at(0) + ctx.sim.degrees + step * g() : ctx.rng.uniform(0, 360);
      return [dyadic(theta, -GRID_BITS)];
    }
    case 'param':
      return [...v.slice(0, 2), paramValue(ctx, v, at(0), at(1), at(2))];
    default:
      return assertNever(input.kind, 'free input');
  }
}

/** A param's v: perturbed (local) or uniform (global), on the grid min + (max − min)·k/2^10. */
function paramValue(
  ctx: Context,
  v: readonly Rational[],
  lo: number,
  hi: number,
  x: number,
): Rational {
  const w = hi - lo;
  const raw =
    ctx.regime === 'local' ? x + LOCAL_SIGMA * w * ctx.rng.gaussian() : ctx.rng.uniform(lo, hi);
  const steps = 2 ** GRID_BITS;
  const k = Math.min(steps, Math.max(0, Math.round(((raw - lo) / w) * steps)));
  const [min, max] = v;
  if (min === undefined || max === undefined || !(w > 0)) return v[2] ?? fromInteger(0);
  const frac = rational(BigInt(k), BigInt(steps));
  return addFrac(min, max, frac);
}

function addFrac(min: Rational, max: Rational, frac: Rational): Rational {
  // min + (max − min)·frac, exactly.
  const num = min.num * max.den * frac.den + (max.num * min.den - min.num * max.den) * frac.num;
  return rational(num, min.den * max.den * frac.den);
}

/** Sorted parameters for the gliders of one in_order group (global regime). */
function orderedAssignments(ctx: Context, group: OrderedGroup): Assignment[] {
  const first = group.inputs[0];
  if (first === undefined) return [];
  if (group.form === 'stereo') {
    const phis = group.inputs.map(() => ctx.rng.uniform(0, 2 * Math.PI)).sort((x, y) => x - y);
    return group.inputs.map((input, i) => ({ input, values: stereo(phis[i] ?? 0) }));
  }
  const t0 = toNumber(readFree(ctx.prep.doc, first)?.[0] ?? fromInteger(0));
  const [lo, hi, spread] = lineRange(ctx, first, t0);
  const ts = group.inputs.map(() => ctx.rng.uniform(lo, hi)).sort((x, y) => x - y);
  return group.inputs.map((input, i) => ({
    input,
    values: [dyadic(ts[i] ?? 0, tExponent(spread))],
  }));
}

/**
 * Sample `seed` of `regime` (see the module comment): the prepared document (probes
 * included) with every free input redrawn. `mirrored` is honoured in the global regime
 * only.
 */
export function drawSample(
  prep: Prepared,
  regime: Regime,
  seed: Seed,
  mirrored: boolean,
): Document {
  const rng = createRng(seed);
  const sim = similarity(rng, prep, regime === 'global' && mirrored);
  const scale = prep.baseCtx.scale;
  const ctx: Context = {
    prep,
    regime,
    rng,
    sim,
    sigma: (regime === 'local' ? LOCAL_SIGMA : GLOBAL_SIGMA) * scale,
    k: gridExponent(scale),
  };
  const out: Assignment[] = [];
  for (const input of prep.free) {
    const v = readFree(prep.doc, input);
    if (v !== undefined) out.push({ input, values: sampleInput(ctx, input, v) });
  }
  if (regime === 'global') for (const g of prep.ordered) out.push(...orderedAssignments(ctx, g));
  return writeFree(prep.doc, out);
}
