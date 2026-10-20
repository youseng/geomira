/**
 * The coincident-image decision (SPEC §13): does a managed image's value coincide with its
 * source's value WITHIN BAND? It uses the kernel's own decisions, measured as the kernel
 * measures them (ADR-0003 item 21, ADR-0004 item 1): points coincide when both coordinate
 * differences are within the band as lengths (the kernel's max-norm coincidence, at BAND
 * instead of EPS); a point lies on a carrier line by the normalised cross product as a
 * length; two directions are parallel by the normalised cross product (dimensionless);
 * two radii agree by rootGap as a length. "Within BAND" is the banded sign being 0 or
 * 'ambiguous'.
 *
 * Coincidence is of point SETS: a line coincides with its image when the carriers coincide
 * and the ranges are the same set (a segment's ends may swap; a ray's open side must point
 * the same way); a circle when centres and radii agree and both are full circles or the
 * same arc; a polygon when its vertices agree up to a cyclic shift in either direction.
 * Values of different kinds, Undefined or Inexact values, and any quantity that overflows
 * never coincide (both are then drawn or reported). Stateless and total.
 */
import { FloatField } from '@geomira/num/float-field';
import type { Dim, ToleranceContext } from '@geomira/num/tolerance';
import { signNormalized } from '@geomira/kernel/geom';
import { rootGap } from '@geomira/kernel/incidence';
import type { Circle, Line, Value, Vec } from '@geomira/kernel/value';

type V = Vec<number>;

function sub(a: V, b: V): V {
  return { x: a.x - b.x, y: a.y - b.y };
}

function cross(a: V, b: V): number {
  return a.x * b.y - a.y * b.x;
}

function dot(a: V, b: V): number {
  return a.x * b.x + a.y * b.y;
}

/** The banded sign of x is 0 or 'ambiguous' (non-finite: never). */
function withinBand(x: number, dim: Dim, ctx: ToleranceContext): boolean {
  if (!Number.isFinite(x)) return false;
  const s = FloatField.sign(x, dim, ctx);
  return s === 0 || s === 'ambiguous';
}

/** x / √n within the band (the kernel's normalised measure); n must be finite and > 0. */
function normalizedWithin(x: number, n: number, dim: Dim, ctx: ToleranceContext): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(n) || !(n > 0)) return false;
  if (!Number.isFinite(x / Math.sqrt(n))) return false;
  const s = signNormalized(FloatField, x, n, dim, ctx);
  return s === 0 || s === 'ambiguous';
}

export function pointsCoincide(a: V, b: V, ctx: ToleranceContext): boolean {
  const d = sub(a, b);
  return withinBand(d.x, 'length', ctx) && withinBand(d.y, 'length', ctx);
}

function sameCarrier(a: Line<number>, b: Line<number>, ctx: ToleranceContext): boolean {
  const parallel = normalizedWithin(
    cross(a.d, b.d),
    dot(a.d, a.d) * dot(b.d, b.d),
    'dimensionless',
    ctx,
  );
  return parallel && normalizedWithin(cross(sub(b.p, a.p), a.d), dot(a.d, a.d), 'length', ctx);
}

/** The finite ends of a line's range and the directions of its open sides. */
function extent(l: Line<number>): { ends: V[]; open: V[] } {
  const at = (t: number): V => ({ x: l.p.x + t * l.d.x, y: l.p.y + t * l.d.y });
  const ends: V[] = [];
  const open: V[] = [];
  if (l.lo === null) open.push({ x: -l.d.x, y: -l.d.y });
  else ends.push(at(l.lo));
  if (l.hi === null) open.push(l.d);
  else ends.push(at(l.hi));
  return { ends, open };
}

function sameRange(a: Line<number>, b: Line<number>, ctx: ToleranceContext): boolean {
  const [ea, eb] = [extent(a), extent(b)];
  if (ea.ends.length !== eb.ends.length) return false;
  const [a0, a1] = ea.ends;
  const [b0, b1] = eb.ends;
  const ends =
    a0 === undefined || b0 === undefined
      ? true
      : a1 === undefined || b1 === undefined
        ? pointsCoincide(a0, b0, ctx)
        : (pointsCoincide(a0, b0, ctx) && pointsCoincide(a1, b1, ctx)) ||
          (pointsCoincide(a0, b1, ctx) && pointsCoincide(a1, b0, ctx));
  const [oa] = ea.open;
  const [ob] = eb.open;
  const open = ea.open.length !== 1 || oa === undefined || ob === undefined || dot(oa, ob) > 0;
  return ends && open;
}

function circlesCoincide(a: Circle<number>, b: Circle<number>, ctx: ToleranceContext): boolean {
  if (!pointsCoincide(a.c, b.c, ctx)) return false;
  if (!withinBand(rootGap(FloatField, a.r2, b.r2), 'length', ctx)) return false;
  if (a.arc === null || b.arc === null) return a.arc === b.arc;
  return pointsCoincide(a.arc.from, b.arc.from, ctx) && pointsCoincide(a.arc.to, b.arc.to, ctx);
}

function polygonsCoincide(a: readonly V[], b: readonly V[], ctx: ToleranceContext): boolean {
  const n = a.length;
  if (n !== b.length || n === 0) return false;
  for (const dir of [1, -1]) {
    for (let k = 0; k < n; k++) {
      let all = true;
      for (let i = 0; i < n && all; i++) {
        const p = a[i];
        const q = b[(((k + dir * i) % n) + n) % n];
        all = p !== undefined && q !== undefined && pointsCoincide(p, q, ctx);
      }
      if (all) return true;
    }
  }
  return false;
}

/** Whether `image` coincides with `source` within BAND (see the module comment). */
export function coincides(
  image: Value<number>,
  source: Value<number>,
  ctx: ToleranceContext,
): boolean {
  if (image.kind === 'point' && source.kind === 'point') return pointsCoincide(image, source, ctx);
  if (image.kind === 'line' && source.kind === 'line')
    return sameCarrier(source, image, ctx) && sameRange(source, image, ctx);
  if (image.kind === 'circle' && source.kind === 'circle')
    return circlesCoincide(image, source, ctx);
  if (image.kind === 'polygon' && source.kind === 'polygon')
    return polygonsCoincide(image.pts, source.pts, ctx);
  return false;
}
