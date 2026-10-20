/**
 * Values → shapes. A drawable value (point, line, circle, polygon) becomes a world Shape;
 * numbers and transforms are not drawn; Undefined and Inexact are reported with their
 * reason. Every number of a Shape is finite (L9): a value whose derived numbers are not
 * (a direction or radius that overflows; impossible for kernel values, which are finite,
 * but checked so a hand-made value cannot slip through) is reported as unavailable.
 */
import { assertNever } from '@geomira/num/assert';
import { isKnownKind, type Value } from '@geomira/kernel/value';
import type { Vec2 } from './viewport';
import type { Shape } from './types';

export type ShapeResult =
  | { readonly kind: 'shape'; readonly shape: Shape }
  | { readonly kind: 'none' }
  | { readonly kind: 'unavailable'; readonly reason: string };

const NOT_FINITE: ShapeResult = {
  kind: 'unavailable',
  reason: 'not representable for drawing (a coordinate is not a finite number)',
};

function finiteVec(v: Vec2): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y);
}

function angleOf(c: Vec2, p: Vec2): number {
  return Math.atan2(p.y - c.y, p.x - c.x);
}

/** A unit direction; a zero or non-finite direction gives undefined. */
export function unit(d: Vec2): Vec2 | undefined {
  const n = Math.hypot(d.x, d.y);
  if (!(n > 0) || !Number.isFinite(n)) return undefined;
  const u = { x: d.x / n, y: d.y / n };
  return finiteVec(u) ? u : undefined;
}

function lineShape(v: Extract<Value<number>, { kind: 'line' }>): ShapeResult {
  const u = unit(v.d);
  if (u === undefined || !finiteVec(v.p)) return NOT_FINITE;
  const n = Math.hypot(v.d.x, v.d.y);
  const lo = v.lo === null ? null : v.lo * n;
  const hi = v.hi === null ? null : v.hi * n;
  if ((lo !== null && !Number.isFinite(lo)) || (hi !== null && !Number.isFinite(hi)))
    return NOT_FINITE;
  return { kind: 'shape', shape: { kind: 'line', p: v.p, u, lo, hi } };
}

function circleShape(v: Extract<Value<number>, { kind: 'circle' }>): ShapeResult {
  const r = Math.sqrt(v.r2);
  if (!finiteVec(v.c) || !(r > 0) || !Number.isFinite(r)) return NOT_FINITE;
  if (v.arc === null) return { kind: 'shape', shape: { kind: 'circle', c: v.c, r, arc: null } };
  if (!finiteVec(v.arc.from) || !finiteVec(v.arc.to)) return NOT_FINITE;
  const arc = { from: angleOf(v.c, v.arc.from), to: angleOf(v.c, v.arc.to) };
  return { kind: 'shape', shape: { kind: 'circle', c: v.c, r, arc } };
}

/**
 * The shape of a value. Degenerate cases: see the module comment; a kind outside the Value
 * union → unavailable ("a … cannot be drawn").
 */
export function shapeOf(v: Value<number>): ShapeResult {
  // A kind outside the Value union (a future or test-only kind, SPEC §18 E2) is not drawn.
  if (!isKnownKind(v)) return { kind: 'unavailable', reason: `a ${v.kind} cannot be drawn` };
  switch (v.kind) {
    case 'point':
      return finiteVec(v)
        ? { kind: 'shape', shape: { kind: 'point', at: { x: v.x, y: v.y } } }
        : NOT_FINITE;
    case 'line':
      return lineShape(v);
    case 'circle':
      return circleShape(v);
    case 'polygon':
      return v.pts.every(finiteVec)
        ? { kind: 'shape', shape: { kind: 'polygon', pts: v.pts.map((p) => ({ x: p.x, y: p.y })) } }
        : NOT_FINITE;
    case 'number':
    case 'transform':
      return { kind: 'none' };
    case 'undefined':
    case 'inexact':
      return { kind: 'unavailable', reason: v.reason };
    default:
      return assertNever(v, 'value');
  }
}
