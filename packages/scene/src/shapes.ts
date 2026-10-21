/**
 * Values → shapes. A drawable value (point, line, circle, polygon, and the display values of
 * ADR-0011: angle and segment marks, text) becomes a world Shape; numbers, transforms and
 * strings are not drawn; Undefined and Inexact are reported with their
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

/** A count of marks the scene draws: a whole number from 1 to MAX_DRAWN_MARKS. */
const MAX_DRAWN_MARKS = 3;

function goodCount(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_DRAWN_MARKS;
}

/**
 * An angle mark: the angles of its arms and the convex span between them. The kernel stores
 * the arms counter-clockwise; the span is recomputed from the cross product in floats, so
 * a hand-made value in the other order still marks its convex angle. Degenerate: an arm of
 * zero length, or a value that is not finite → unavailable; a bad count → unavailable.
 */
function angleMarkShape(v: Extract<Value<number>, { kind: 'angle_mark' }>): ShapeResult {
  const u = { x: v.from.x - v.b.x, y: v.from.y - v.b.y };
  const w = { x: v.to.x - v.b.x, y: v.to.y - v.b.y };
  if (!finiteVec(v.b) || unit(u) === undefined || unit(w) === undefined) return NOT_FINITE;
  if (!goodCount(v.arcs)) return { kind: 'unavailable', reason: 'an angle mark needs 1 to 3 arcs' };
  const ccw = u.x * w.y - u.y * w.x >= 0;
  const [a, c] = ccw ? [u, w] : [w, u];
  const from = Math.atan2(a.y, a.x);
  let to = Math.atan2(c.y, c.x);
  if (to < from) to += 2 * Math.PI;
  const shape = { kind: 'angle_mark' as const, b: { x: v.b.x, y: v.b.y }, from, to };
  return { kind: 'shape', shape: { ...shape, arcs: v.arcs, right: v.right } };
}

function segmentMarkShape(v: Extract<Value<number>, { kind: 'segment_mark' }>): ShapeResult {
  if (!finiteVec(v.p) || !finiteVec(v.q)) return NOT_FINITE;
  if (!goodCount(v.ticks))
    return { kind: 'unavailable', reason: 'a segment mark needs 1 to 3 ticks' };
  const shape = {
    kind: 'segment_mark' as const,
    p: { x: v.p.x, y: v.p.y },
    q: { x: v.q.x, y: v.q.y },
  };
  return { kind: 'shape', shape: { ...shape, ticks: v.ticks } };
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
    case 'angle_mark':
      return angleMarkShape(v);
    case 'segment_mark':
      return segmentMarkShape(v);
    case 'text':
      if (v.text === '') return { kind: 'unavailable', reason: 'the text is empty' };
      return finiteVec(v.at)
        ? { kind: 'shape', shape: { kind: 'text', at: { x: v.at.x, y: v.at.y }, text: v.text } }
        : NOT_FINITE;
    case 'number':
    case 'transform':
    case 'string':
      return { kind: 'none' };
    case 'undefined':
    case 'inexact':
      return { kind: 'unavailable', reason: v.reason };
    default:
      return assertNever(v, 'value');
  }
}
