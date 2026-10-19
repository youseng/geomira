/**
 * Argument narrowing for compute<T> (internal). The registry only calls compute with
 * arguments matching a signature; these helpers narrow the Value union without casts,
 * and a direct call with other arguments gets Undefined (never a throw).
 */
import type { Field } from '@geomira/num/field';
import type { EvalContext } from '../tool';
import { isZeroVec } from '../geom';
import {
  undef,
  type Circle,
  type Line,
  type Num,
  type Point,
  type Polygon,
  type Undefined,
  type Value,
  type Vec,
} from '../value';

export function badArgs(tool: string): Undefined {
  return undef(`${tool} received arguments it does not accept`);
}

export function pointAt<T>(args: readonly Value<T>[], i: number): Point<T> | undefined {
  const v = args[i];
  return v?.kind === 'point' ? v : undefined;
}

export function lineAt<T>(args: readonly Value<T>[], i: number): Line<T> | undefined {
  const v = args[i];
  return v?.kind === 'line' ? v : undefined;
}

export function circleAt<T>(args: readonly Value<T>[], i: number): Circle<T> | undefined {
  const v = args[i];
  return v?.kind === 'circle' ? v : undefined;
}

export function numAt<T>(args: readonly Value<T>[], i: number): Num<T> | undefined {
  const v = args[i];
  return v?.kind === 'number' ? v : undefined;
}

export function polygonAt<T>(args: readonly Value<T>[], i: number): Polygon<T> | undefined {
  const v = args[i];
  return v?.kind === 'polygon' ? v : undefined;
}

/** The arguments as points when there are exactly `n` and all are points. */
export function pointsOf<T>(args: readonly Value<T>[], n: number): Point<T>[] | undefined {
  const pts = args.flatMap((v) => (v.kind === 'point' ? [v] : []));
  return pts.length === n && args.length === n ? pts : undefined;
}

/** All arguments as points (any number), or undefined if one is not a point. */
export function allPoints<T>(args: readonly Value<T>[]): Point<T>[] | undefined {
  const pts = args.flatMap((v) => (v.kind === 'point' ? [v] : []));
  return pts.length === args.length ? pts : undefined;
}

/**
 * Undefined when the displacement b − a (already computed as `d`) is a zero length:
 * "coincident points" with the names of the tool's roles.
 */
export function coincident<T>(
  F: Field<T>,
  d: Vec<T>,
  ctx: EvalContext,
  what: string,
): Undefined | undefined {
  return isZeroVec(F, d, ctx) ? undef(`coincident points: ${what}`) : undefined;
}

/**
 * A line's direction is a valid divisor (not a zero length). Lines built by the v1 tools
 * always satisfy this; the check keeps every division total for any Line value.
 */
export function degenerateLine<T>(
  F: Field<T>,
  l: Line<T>,
  ctx: EvalContext,
): Undefined | undefined {
  return isZeroVec(F, l.d, ctx) ? undef('the line has no direction') : undefined;
}

/**
 * A circle's squared radius is positive (r2 > 0, SPEC §4). Circles built by the v1 tools
 * always satisfy this; the check keeps every division and square root total for any
 * Circle value. Degenerate: r2 zero (as an area) or negative → Undefined.
 */
export function degenerateCircle<T>(
  F: Field<T>,
  c: Circle<T>,
  ctx: EvalContext,
): Undefined | undefined {
  return F.isZero(c.r2, 'area', ctx) || F.sign(c.r2, 'area', ctx) === -1
    ? undef('the circle has no positive radius')
    : undefined;
}
