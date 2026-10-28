/**
 * Values (SPEC §4), generic over the number type T of a Field<T>. A Value never holds NaN
 * or ±Infinity: degenerate input gives Undefined with a reason, and a number that is not
 * representable in the field gives Inexact. Unbounded line ranges are `null` (ADR-0003).
 *
 * The display values of SPEC §6.2 (ADR-0011, Run 8a): AngleMark, SegmentMark, Text, and the
 * Str a text shows. They are values like any other (images map them, the scene draws them),
 * but no claim or construction tool takes them.
 *
 * IdealPoint (ADR-0040, Run 16a): the point at infinity of the lines with a direction, the
 * meeting point of parallel lines. Reserved kinds, documented only: Conic (Run 16b), Locus. Capability
 * tests accept any `{ kind: string }`, so a future kind matches no capability and every
 * existing tool rejects it with Undefined("<tool> does not accept …").
 */
import { assertNever } from '@geomira/num/assert';
import type { Complex } from '@geomira/num/complex';
import type { Inexact } from '@geomira/num/field';
import type { Rational } from '@geomira/num/rational';

export type { Inexact } from '@geomira/num/field';

/** A pair of coordinates (a position or a direction). */
export interface Vec<T> {
  readonly x: T;
  readonly y: T;
}

export interface Point<T> extends Vec<T> {
  readonly kind: 'point';
}

/**
 * The point at infinity of the lines with direction `d` (ADR-0040): d ≠ 0 is a REPRESENTATIVE
 * (d and λd, λ ≠ 0, are the same point; never normalised, so float and exact runs agree entry by
 * entry). `chiral` is SPEC §4's flag of d, kept by a line built through the ideal point.
 */
export interface IdealPoint<T> {
  readonly kind: 'ideal_point';
  readonly d: Vec<T>;
  readonly chiral: boolean;
}

/**
 * The points p + t·d for t in [lo, hi]; d ≠ 0, not normalised; `null` bounds are
 * unbounded. Line: (null, null); segment AB: p = A, d = B − A, [0, 1]; ray: [0, null).
 * `chiral` records how d behaves when the whole figure is mirrored (SPEC §4): directions
 * from two points are achiral, every 90° turn toggles the flag, parallels keep it.
 * `outside` (ADR-0032, SPEC §18 E5): the two rays t ≤ lo and t ≥ hi instead (lo < hi, both
 * bounded): the image of a segment through the center of an inversion. Absent = false.
 */
export interface Line<T> {
  readonly kind: 'line';
  readonly p: Vec<T>;
  readonly d: Vec<T>;
  readonly lo: T | null;
  readonly hi: T | null;
  readonly chiral: boolean;
  readonly outside?: true;
}

/** An arc runs counter-clockwise from `from` to `to` (points on the circle). */
export interface Arc<T> {
  readonly from: Vec<T>;
  readonly to: Vec<T>;
}

/** Centre c, squared radius r2 > 0; `anchor` is a known point on the circle (gliders). */
export interface Circle<T> {
  readonly kind: 'circle';
  readonly c: Vec<T>;
  readonly r2: T;
  readonly arc: Arc<T> | null;
  readonly anchor?: Vec<T>;
}

/** A number; `exact` is its exact value when it comes from exact literals (ADR-0003). */
export interface Num<T> {
  readonly kind: 'number';
  readonly v: T;
  readonly exact?: Rational;
}

export interface Polygon<T> {
  readonly kind: 'polygon';
  readonly pts: readonly Vec<T>[];
}

/**
 * An angle mark at vertex `b` (ADR-0011): the arcs (or the right-angle square) of the
 * convex angle between the rays b → from and b → to, running COUNTER-CLOCKWISE from the arm
 * through `from` to the arm through `to`, swept angle in (0°, 180°). `from` and `to` are
 * points on the arms (the A and C of mark_angle(A, B, C), in counter-clockwise order), so a
 * map takes them along; an anti-similarity swaps them (a reflection reverses a mark's
 * orientation). `arcs` (1–3) is the number of arcs; `right` draws the square of a right angle.
 */
export interface AngleMark<T> {
  readonly kind: 'angle_mark';
  readonly b: Vec<T>;
  readonly from: Vec<T>;
  readonly to: Vec<T>;
  readonly arcs: number;
  readonly right: boolean;
}

/** Tick marks (1–3) across the middle of the segment from `p` to `q` (ADR-0011). */
export interface SegmentMark<T> {
  readonly kind: 'segment_mark';
  readonly p: Vec<T>;
  readonly q: Vec<T>;
  readonly ticks: number;
}

/** A text (a non-empty string, label grammar) anchored at `at` (ADR-0011). */
export interface Text<T> {
  readonly kind: 'text';
  readonly at: Vec<T>;
  readonly text: string;
}

/** A string (the value of a string literal); only `text` takes one (ADR-0011). */
export interface Str {
  readonly kind: 'string';
  readonly s: string;
}

/** z ↦ a·z + b, or a·z̄ + b when `anti`. Reserved, documented only: 'projective'. */
export interface Similarity<T> {
  readonly type: 'similarity';
  readonly anti: boolean;
  readonly a: Complex<T>;
  readonly b: Complex<T>;
}

/**
 * z ↦ (a·ẑ + b)/(c·ẑ + d), ẑ = z̄ when `anti` (ADR-0032): a Möbius map, defined up to a
 * non-zero factor (never normalised), valid when ad − bc ≠ 0. Inversions are anti.
 */
export interface Mobius<T> {
  readonly type: 'mobius';
  readonly anti: boolean;
  readonly a: Complex<T>;
  readonly b: Complex<T>;
  readonly c: Complex<T>;
  readonly d: Complex<T>;
}

/**
 * A projective map (ADR-0040): the 3×3 matrix `m`, row by row, acting on homogeneous columns
 * (x, y, 1); defined up to a non-zero factor and never normalised; valid when det m ≠ 0.
 */
export interface Projective<T> {
  readonly type: 'projective';
  readonly m: readonly [T, T, T, T, T, T, T, T, T];
}

/**
 * A composition kept as its factors (ADR-0040 decision 8): `maps` in the order they apply
 * (the first is applied first), adjacent maps of one family already merged, so it always mixes
 * a Möbius map with a pole and a projective map. Applying it applies each map in turn.
 */
export interface Composite<T> {
  readonly type: 'composite';
  readonly maps: readonly (Similarity<T> | Mobius<T> | Projective<T>)[];
}

export type TransformData<T> = Similarity<T> | Mobius<T> | Projective<T> | Composite<T>;

export interface Transform<T> {
  readonly kind: 'transform';
  readonly t: TransformData<T>;
}

/** A degenerate or invalid result, with the reason shown to the user. */
export interface Undefined {
  readonly kind: 'undefined';
  readonly reason: string;
}

export type DefinedValue<T> =
  | Point<T>
  | IdealPoint<T>
  | Line<T>
  | Circle<T>
  | Num<T>
  | Polygon<T>
  | Transform<T>
  | AngleMark<T>
  | SegmentMark<T>
  | Text<T>
  | Str;

export type Value<T> = DefinedValue<T> | Undefined | Inexact;

/**
 * The kinds of values, plus two STATIC kinds: 'mobius' (ADR-0032 decision 13) marks, beside
 * 'transform', a transformation that may be a Möbius map, whose images of lines and circles
 * may change kind; 'projective' (ADR-0040) one that may be a projective map, whose images of
 * points may be ideal points and the reverse. No value has either kind.
 */
export type ValueKind = Value<unknown>['kind'] | 'mobius' | 'projective';

/**
 * The kinds of SPEC §4's Value union. The display kinds ADR-0011 added are DISPLAY_KINDS;
 * together they are every kind of the union (unknown future kinds are in neither).
 */
export const VALUE_KINDS: readonly ValueKind[] = Object.freeze([
  'point',
  'line',
  'circle',
  'number',
  'polygon',
  'transform',
  'undefined',
  'inexact',
]);

/** The display kinds (ADR-0011): the marks, text, and the string a text shows. */
export const DISPLAY_KINDS: readonly ValueKind[] = Object.freeze([
  'angle_mark',
  'segment_mark',
  'text',
  'string',
]);

/** The kinds of the projective plane beyond SPEC §4's (ADR-0040): the ideal point. */
export const PROJECTIVE_KINDS: readonly ValueKind[] = Object.freeze(['ideal_point']);

/** Whether a value's kind belongs to the Value union (false for future or test-only kinds). */
export function isKnownKind(v: { readonly kind: string }): boolean {
  return [...VALUE_KINDS, ...DISPLAY_KINDS, ...PROJECTIVE_KINDS].some((k) => k === v.kind);
}

/**
 * Capabilities (SPEC §4): what a tool parameter accepts. ADR-0011 adds `annotation` (the
 * marks and text: what apply maps besides figures) and `string` (text's string).
 */
export type Capability =
  | 'point'
  | 'curve'
  | 'linear'
  | 'round'
  | 'number'
  | 'transform'
  | 'polygon'
  | 'annotation'
  | 'string'
  | 'ideal'
  | 'ppoint';

export const CAPABILITIES: readonly Capability[] = Object.freeze([
  'point',
  'curve',
  'linear',
  'round',
  'number',
  'transform',
  'polygon',
  'annotation',
  'string',
]);

/**
 * The capabilities of the projective plane (ADR-0040), outside SPEC §4's list above (its frozen
 * test enumerates it): `ideal` (an ideal point) and `ppoint` (a point or an ideal point). Only the
 * signatures that declare them take an ideal point.
 */
export const PROJECTIVE_CAPABILITIES: readonly Capability[] = Object.freeze(['ideal', 'ppoint']);

/** The value kinds that have each capability. */
export function capabilityKinds(cap: Capability): readonly ValueKind[] {
  switch (cap) {
    case 'point':
      return ['point'];
    case 'curve':
      return ['line', 'circle'];
    case 'linear':
      return ['line'];
    case 'round':
      return ['circle'];
    case 'number':
      return ['number'];
    case 'transform':
      return ['transform'];
    case 'polygon':
      return ['polygon'];
    case 'annotation':
      return ['angle_mark', 'segment_mark', 'text'];
    case 'string':
      return ['string'];
    case 'ideal':
      return ['ideal_point'];
    case 'ppoint':
      return ['point', 'ideal_point'];
    default:
      return assertNever(cap, 'capability');
  }
}

/**
 * Whether a value (of any kind, including unknown future kinds) has a capability.
 * Undefined and Inexact have no capability.
 */
export function hasCapability(v: { readonly kind: string }, cap: Capability): boolean {
  return capabilityKinds(cap).some((k) => k === v.kind);
}

export function isPoint<T>(v: Value<T>): v is Point<T> {
  return v.kind === 'point';
}

export function isLine<T>(v: Value<T>): v is Line<T> {
  return v.kind === 'line';
}

export function isNum<T>(v: Value<T>): v is Num<T> {
  return v.kind === 'number';
}

export function isPolygon<T>(v: Value<T>): v is Polygon<T> {
  return v.kind === 'polygon';
}

/** Undefined or Inexact: a value that propagates instead of being computed with. */
export function isUnavailable<T>(v: Value<T>): v is Undefined | Inexact {
  return v.kind === 'undefined' || v.kind === 'inexact';
}

export function undef(reason: string): Undefined {
  return { kind: 'undefined', reason };
}

export function pointOf<T>(x: T, y: T): Point<T> {
  return { kind: 'point', x, y };
}

export function numOf<T>(v: T, exact?: Rational): Num<T> {
  return exact === undefined ? { kind: 'number', v } : { kind: 'number', v, exact };
}

/**
 * The entries of a map: a and b, then c and d for a Möbius map; a projective map's matrix row by
 * row; a composite's maps in turn.
 */
function transformNumbers<T>(t: TransformData<T>): T[] {
  switch (t.type) {
    case 'similarity':
      return [t.a.re, t.a.im, t.b.re, t.b.im];
    case 'mobius':
      return [t.a.re, t.a.im, t.b.re, t.b.im, t.c.re, t.c.im, t.d.re, t.d.im];
    case 'projective':
      return [...t.m];
    case 'composite':
      return t.maps.flatMap((x) => transformNumbers(x));
    default:
      return assertNever(t, 'transform');
  }
}

/** Every field element inside a value (coordinates, bounds, radii…), in a fixed order. */
export function numbersOf<T>(v: Value<T>): T[] {
  switch (v.kind) {
    case 'point':
      return [v.x, v.y];
    case 'ideal_point':
      return [v.d.x, v.d.y];
    case 'line':
      return [
        v.p.x,
        v.p.y,
        v.d.x,
        v.d.y,
        ...(v.lo === null ? [] : [v.lo]),
        ...(v.hi === null ? [] : [v.hi]),
      ];
    case 'circle': {
      const arc = v.arc === null ? [] : [v.arc.from.x, v.arc.from.y, v.arc.to.x, v.arc.to.y];
      const anchor = v.anchor === undefined ? [] : [v.anchor.x, v.anchor.y];
      return [v.c.x, v.c.y, v.r2, ...arc, ...anchor];
    }
    case 'number':
      return [v.v];
    case 'polygon':
      return v.pts.flatMap((p) => [p.x, p.y]);
    case 'transform':
      return transformNumbers(v.t);
    case 'angle_mark':
      return [v.b.x, v.b.y, v.from.x, v.from.y, v.to.x, v.to.y];
    case 'segment_mark':
      return [v.p.x, v.p.y, v.q.x, v.q.y];
    case 'text':
      return [v.at.x, v.at.y];
    case 'string':
    case 'undefined':
    case 'inexact':
      return [];
    default:
      return assertNever(v, 'value');
  }
}
