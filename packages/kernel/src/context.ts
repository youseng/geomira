/**
 * The evaluation context of a document (SPEC §3.1): `scale` = the diameter of the bounding
 * box of the free points and explicit radii (≥ 1). Free points are the `point(x, y)` calls
 * with two literal arguments, anywhere in a definition (ADR-0003); an explicit radius is
 * the literal r of a `circle(O, r)` call, and counts as a diameter 2·|r| (ADR-0004).
 */
import { tryToNumber, type Rational } from '@geomira/num/rational';
import { MAX_SCALE, toleranceContext } from '@geomira/num/tolerance';
import type { Document } from './document';
import type { Expr } from './expr';
import { FLOAT_ARG_LIMIT } from './limits';
import type { EvalContext } from './tool';

export type ContextResult =
  | { readonly ok: true; readonly ctx: EvalContext }
  | { readonly ok: false; readonly reason: string };

function freePoints(e: Expr, out: (readonly [Rational, Rational])[], radii: Rational[]): void {
  if (e.kind !== 'call') return;
  const [x, y] = e.args;
  if (e.tool === 'point' && e.args.length === 2 && x?.kind === 'lit' && y?.kind === 'lit') {
    out.push([x.value, y.value]);
  }
  if (e.tool === 'circle' && e.args.length === 2 && y?.kind === 'lit') radii.push(y.value);
  for (const a of e.args) freePoints(a, out, radii);
}

/** max − min of a non-empty list (a loop: no argument-count limit). */
function spread(v: readonly number[]): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of v) {
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return hi - lo;
}

/**
 * 2·max |r| over the explicit radii (0 when there is none). A radius beyond the float
 * argument limit does not count: the float run makes such a circle Inexact anyway, and
 * the exact runs ignore the scale (ADR-0004).
 */
function radiiDiameter(radii: readonly Rational[]): number {
  let d = 0;
  for (const r of radii) {
    const x = Math.abs(tryToNumber(r) ?? Infinity);
    if (x <= FLOAT_ARG_LIMIT) d = Math.max(d, 2 * x);
  }
  return d;
}

/**
 * The context for `doc`. Degenerate cases: no free point and no radius, or a single
 * point → scale 1; a radius beyond the float argument limit → ignored; a coordinate
 * beyond the double range or a diameter above MAX_SCALE → { ok: false }.
 */
export function evalContextFor(doc: Document): ContextResult {
  const pts: (readonly [Rational, Rational])[] = [];
  const radii: Rational[] = [];
  for (const o of doc.objects) freePoints(o.def, pts, radii);
  const fromRadii = radiiDiameter(radii);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [x, y] of pts) {
    const [fx, fy] = [tryToNumber(x), tryToNumber(y)];
    if (fx === undefined || fy === undefined) {
      return { ok: false, reason: 'a free point lies beyond the range of double precision' };
    }
    xs.push(fx);
    ys.push(fy);
  }
  const diameter = Math.max(xs.length === 0 ? 0 : Math.hypot(spread(xs), spread(ys)), fromRadii);
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
