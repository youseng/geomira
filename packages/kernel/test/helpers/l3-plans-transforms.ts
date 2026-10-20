/**
 * Argument plans for law L3 (Run 4): the transformation tools. The sampler has no
 * transform arguments of its own, and random angles are never multiples of 90° (the only
 * rotations that are exact over Q), so without plans L3 would compare almost nothing for
 * compose, inverse, apply and rotate. Points are dyadic (exact products in the float run);
 * one sample in eight uses an angle off the multiples of 90° (Inexact over Q, which L3
 * counts as "not exact") or a zero ratio (Undefined in both fields).
 */
import { rational, type Rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { call, lit, type Expr } from '../../src/expr';
import type { Capability } from '../../src/value';
import type { Builder } from './doc';

export const TRANSFORM_TOOLS = [
  'reflect',
  'rotate',
  'homothety',
  'translate',
  'spiral',
  'compose',
  'inverse',
  'apply',
];

function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('pick from an empty list');
  return x;
}

function dyadic(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(4097) - 2048), 256n);
}

function point(b: Builder, rng: Rng): Expr {
  const n = String(b.doc.objects.length);
  return b.add(`T_{${n}}`, call('point', [lit(dyadic(rng)), lit(dyadic(rng))]));
}

/** An angle in degrees: a multiple of 90° (exact), rarely 30°, 45° or 60° (Inexact over Q). */
function angle(rng: Rng): Expr {
  const off = rng.nextInt(8) === 0;
  const deg = off ? pick(rng, [30, 45, 60, -120]) : 90 * (rng.nextInt(9) - 4);
  return lit(rational(BigInt(deg)));
}

/** A homothety ratio: a non-zero rational, rarely 0. */
function ratio(rng: Rng): Expr {
  if (rng.nextInt(8) === 0) return lit(rational(0n));
  const n = BigInt(pick(rng, [-3, -2, -1, 1, 2, 3, 5]));
  return lit(rational(n, BigInt(rng.nextInt(4) + 1)));
}

/** A random exact map (nested once in two samples out of ten). */
export function randomMap(b: Builder, rng: Rng, depth = 0): Expr {
  const P = (): Expr => point(b, rng);
  const choices = [
    () => call('reflect', [call('line', [P(), P()])]),
    () => call('reflect', [P()]),
    () => call('rotate', [P(), angle(rng)]),
    () => call('homothety', [P(), ratio(rng)]),
    () => call('translate', [P(), P()]),
    () => call('spiral', [P(), P(), P(), P()]),
  ];
  if (depth > 0 || rng.nextInt(10) >= 2) return pick(rng, choices)();
  return rng.nextFloat() < 0.5
    ? call('compose', [randomMap(b, rng, 1), randomMap(b, rng, 1)])
    : call('inverse', [randomMap(b, rng, 1)]);
}

function imaged(b: Builder, rng: Rng, cap: Capability): Expr {
  const P = (): Expr => point(b, rng);
  if (cap === 'polygon') return call('polygon', [P(), P(), P()]);
  if (cap !== 'curve') return P();
  return pick(rng, [
    () => call(pick(rng, ['line', 'segment', 'ray']), [P(), P()]),
    () => call('circle', [P(), P(), P()]),
    () => call('circle', [P(), P()]),
    () => call('perp', [P(), call('line', [P(), P()])]),
  ])();
}

/**
 * Plans every argument of a transformation tool: transforms from `randomMap`, angles and
 * ratios for the number parameter, imaged objects through dyadic points.
 */
export function transformPlan(
  b: Builder,
  rng: Rng,
  tool: string,
  caps: readonly Capability[],
): Expr[] {
  return caps.map((cap) => {
    if (cap === 'transform') return randomMap(b, rng);
    if (cap === 'number') return tool === 'rotate' ? angle(rng) : ratio(rng);
    if (cap === 'linear') return call('line', [point(b, rng), point(b, rng)]);
    return imaged(b, rng, cap);
  });
}
