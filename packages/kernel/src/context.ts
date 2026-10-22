/**
 * The evaluation context of a document (SPEC §3.1): `scale` = the diameter of the bounding
 * box of the free points and explicit radii (≥ 1). Free points are the `point(x, y)` calls
 * with two literal arguments, anywhere in a definition (ADR-0003); an explicit radius is
 * the literal r of a `circle(O, r)` call, and counts as a diameter 2·|r| (ADR-0004).
 */
import { MAX_SCALE, toleranceContext } from '@geomira/num/tolerance';
import type { Document } from './document';
import { figureDiameter } from './figure-size';
import type { EvalContext } from './tool';

export type ContextResult =
  | { readonly ok: true; readonly ctx: EvalContext }
  | { readonly ok: false; readonly reason: string };

/**
 * The context for `doc`. Degenerate cases: no free point and no radius, or a single
 * point → scale 1; a radius beyond the float argument limit → ignored; a coordinate
 * beyond the double range or a diameter above MAX_SCALE → { ok: false }.
 */
export function evalContextFor(doc: Document): ContextResult {
  const diameter = figureDiameter(doc);
  if (diameter === undefined) {
    return { ok: false, reason: 'a free point lies beyond the range of double precision' };
  }
  if (!(diameter <= MAX_SCALE)) {
    return { ok: false, reason: 'the figure is larger than the largest supported scale' };
  }
  return { ok: true, ctx: toleranceContext(diameter) };
}

/** Why `ctx` is not a valid evaluation context, or undefined when it is. */
export function contextProblem(ctx: EvalContext): string | undefined {
  return ctx.scale >= 1 && ctx.scale <= MAX_SCALE
    ? undefined
    : `invalid figure scale ${String(ctx.scale)} (must be in [1, ${String(MAX_SCALE)}])`;
}
