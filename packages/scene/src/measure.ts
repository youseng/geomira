/**
 * Measurements on the figure (ADR-0048). A number object styled `show` whose definition is a
 * DRAWABLE MEASUREMENT is drawn as its value:
 *
 * - `dist(A, B)` of two points: a `distance` shape from A to B, drawn as the value's label at
 *   the middle of AB (no stroke), offset to the left of A → B as seen;
 * - `dist(P, l)` of a point and a line, segment or ray: the same, from P to its foot on the
 *   carrier line of l (the distance the kernel measures);
 * - `angle(A, B, C)`: an arc at B over the convex angle (the angle mark of ADR-0011, one arc)
 *   with the value in degrees at its middle, outside;
 * - `dangle(A, B, C)`: an arc at B from the direction of BA counter-clockwise by the value (the
 *   directed angle from line BA to line BC, mod 180°), the value in degrees.
 *
 * The arguments must be NAMED objects (references): the scene has the values of objects, not
 * of inline subexpressions (SPEC §5: they have no identity). Every other number (ratio, area,
 * power, radius, arithmetic, a measurement of inline expressions) is not drawn and says why
 * (`measureDef` gives the reason). Degenerate cases: a measured value that is Undefined or
 * Inexact is listed with its reason by the scene builder, never drawn; dist(A, A) and P on l
 * are 0 (defined): the label sits at A (the foot), offset straight up; an arm of zero length
 * (impossible for a defined angle) or a non-finite coordinate → not drawn, with a reason.
 *
 * The value is written with `digits` decimals (the style's, a whole number in [0, MAX_DIGITS];
 * absent or invalid: DEFAULT_DIGITS), angles with a degree sign; a style `label` text is a
 * prefix: `label="AB"` shows "AB = 3.61".
 */
import type { Style } from '@geomira/kernel/document';
import { assertNever } from '@geomira/num/assert';
import type { Expr } from '@geomira/kernel/expr';
import type { Value } from '@geomira/kernel/value';
import { parseLabel, type LabelRun } from './label-text';
import type { ShapeResult } from './shapes';
import type { Vec2 } from './viewport';

/** Decimals of a value shown when the style gives none (ADR-0048). */
export const DEFAULT_DIGITS = 2;

/** The most decimals a measurement shows (the language's `digits` bound). */
export const MAX_DIGITS = 10;

/** What a definition measures: object ids, or why it is not drawn. */
export type MeasureDef =
  | { readonly kind: 'distance'; readonly from: number; readonly to: number }
  | {
      readonly kind: 'angle';
      readonly a: number;
      readonly b: number;
      readonly c: number;
      /** dangle (directed, mod 180°) rather than angle (undirected). */
      readonly directed: boolean;
    }
  | { readonly kind: 'none'; readonly reason: string };

const ARITY: Readonly<Record<string, number>> = Object.freeze({ dist: 2, angle: 3, dangle: 3 });

/** The measurement a definition is (see the module comment), or why it is not drawn. */
export function measureDef(def: Expr): MeasureDef {
  if (def.kind !== 'call' || ARITY[def.tool] === undefined)
    return { kind: 'none', reason: 'only dist, angle and dangle measurements are drawn' };
  const ids = def.args.flatMap((a) => (a.kind === 'ref' ? [a.id] : []));
  if (ids.length !== def.args.length || ids.length !== ARITY[def.tool])
    return {
      kind: 'none',
      reason: `a measurement is drawn only when its arguments are named objects`,
    };
  const [a = -1, b = -1, c = -1] = ids;
  if (def.tool === 'dist') return { kind: 'distance', from: a, to: b };
  return { kind: 'angle', a, b, c, directed: def.tool === 'dangle' };
}

/** Whether a measurement is drawn degrees (an angle) or as a plain number. */
export function inDegrees(def: Expr): boolean {
  return measureDef(def).kind === 'angle';
}

/** The decimals a style asks for (DEFAULT_DIGITS when absent or not a whole number in range). */
export function digitsOf(style: Style): number {
  const d = style.digits;
  return d !== undefined && Number.isInteger(d) && d >= 0 && d <= MAX_DIGITS ? d : DEFAULT_DIGITS;
}

/**
 * A value as a measurement shows it: `digits` decimals (clamped to [0, MAX_DIGITS]), a degree
 * sign for angles; a value that rounds to zero is written without a minus sign. Degenerate: a
 * non-finite value (never a Num's, L1) → "undefined".
 */
export function formatMeasure(v: number, digits: number, degrees: boolean): string {
  if (!Number.isFinite(v)) return 'undefined';
  const d = Number.isInteger(digits) ? Math.min(MAX_DIGITS, Math.max(0, digits)) : DEFAULT_DIGITS;
  const s = v.toFixed(d);
  const t = /^-0(\.0*)?$/u.test(s) ? s.slice(1) : s;
  return degrees ? `${t}°` : t;
}

/** The label runs of a measurement: the style's label as a prefix ("AB = "), then the value. */
export function measureRuns(style: Style, value: string): { text: string; runs: LabelRun[] } {
  const prefix = style.label ?? '';
  if (prefix === '') return { text: value, runs: [{ text: value, pos: 'base' }] };
  const tail = ` = ${value}`;
  const runs = [...parseLabel(prefix)];
  const last = runs[runs.length - 1];
  if (last?.pos === 'base') runs[runs.length - 1] = { text: last.text + tail, pos: 'base' };
  else runs.push({ text: tail, pos: 'base' });
  return { text: prefix + tail, runs };
}

/** The middle of pq (halves first, so it never overflows). */
export function middle(p: Vec2, q: Vec2): Vec2 {
  return { x: p.x / 2 + q.x / 2, y: p.y / 2 + q.y / 2 };
}

/**
 * The automatic label direction of a distance from p to q, degrees in [0, 360): to the left of
 * p → q as seen (the world's angles are the screen's as seen); straight up when p = q.
 */
export function distanceLabelAngle(p: Vec2, q: Vec2): number {
  const [dx, dy] = [q.x - p.x, q.y - p.y];
  if (!(Math.hypot(dx, dy) > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return 90;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return ((deg % 360) + 360) % 360;
}

function finiteVec(v: Vec2): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y);
}

const notDrawn = (reason: string): ShapeResult => ({ kind: 'none', reason });

/** The foot of p on the carrier line of l, or undefined (no direction, overflow). */
function footOn(p: Vec2, l: Extract<Value<number>, { kind: 'line' }>): Vec2 | undefined {
  const dd = l.d.x * l.d.x + l.d.y * l.d.y;
  if (!(dd > 0) || !Number.isFinite(dd)) return undefined;
  const t = ((p.x - l.p.x) * l.d.x + (p.y - l.p.y) * l.d.y) / dd;
  const q = { x: l.p.x + t * l.d.x, y: l.p.y + t * l.d.y };
  return finiteVec(q) ? q : undefined;
}

function distanceShape(
  m: Extract<MeasureDef, { kind: 'distance' }>,
  values: ReadonlyMap<number, Value<number>>,
): ShapeResult {
  const [a, b] = [values.get(m.from), values.get(m.to)];
  if (a?.kind !== 'point') return notDrawn('the measured objects have no position to draw at');
  const p = { x: a.x, y: a.y };
  const q =
    b?.kind === 'point' ? { x: b.x, y: b.y } : b?.kind === 'line' ? footOn(p, b) : undefined;
  if (q === undefined || !finiteVec(p) || !finiteVec(q))
    return notDrawn('the measured objects have no position to draw at');
  return { kind: 'shape', shape: { kind: 'distance', p, q } };
}

function angleShape(
  m: Extract<MeasureDef, { kind: 'angle' }>,
  values: ReadonlyMap<number, Value<number>>,
  degrees: number,
): ShapeResult {
  const [A, B, C] = [values.get(m.a), values.get(m.b), values.get(m.c)];
  if (A?.kind !== 'point' || B?.kind !== 'point' || C?.kind !== 'point')
    return notDrawn('the measured objects have no position to draw at');
  const u = { x: A.x - B.x, y: A.y - B.y };
  const w = { x: C.x - B.x, y: C.y - B.y };
  const b = { x: B.x, y: B.y };
  const ok = (v: Vec2) => finiteVec(v) && Math.hypot(v.x, v.y) > 0;
  if (!ok(u) || !ok(w) || !finiteVec(b))
    return notDrawn('an arm of the angle has no direction to draw');
  let from: number;
  let to: number;
  if (m.directed) {
    from = Math.atan2(u.y, u.x);
    to = from + (degrees * Math.PI) / 180;
  } else {
    const ccw = u.x * w.y - u.y * w.x >= 0;
    const [s, e] = ccw ? [u, w] : [w, u];
    from = Math.atan2(s.y, s.x);
    to = Math.atan2(e.y, e.x);
    if (to < from) to += 2 * Math.PI;
  }
  if (!Number.isFinite(to)) return notDrawn('an arm of the angle has no direction to draw');
  return { kind: 'shape', shape: { kind: 'angle_mark', b, from, to, arcs: 1, right: false } };
}

/**
 * The shape of a shown measurement whose value is the number `v` (see the module comment):
 * a `distance` or an `angle_mark` shape, or `none` with the reason it is not drawn.
 */
export function measureShape(
  def: Expr,
  v: number,
  values: ReadonlyMap<number, Value<number>>,
): ShapeResult {
  const m = measureDef(def);
  switch (m.kind) {
    case 'none':
      return notDrawn(m.reason);
    case 'distance':
      return distanceShape(m, values);
    case 'angle':
      return angleShape(m, values, v);
    default:
      return assertNever(m, 'measurement');
  }
}
