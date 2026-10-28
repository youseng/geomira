/**
 * The value types of SPEC §4 (re-exported by value.ts, the public module): kept apart from the
 * runtime tables and functions so that internal modules (value-numbers.ts) can read them
 * without an import cycle (ADR-0042).
 */
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

/**
 * A conic (ADR-0042): the points with Q(x, y) = a·x² + 2b·xy + c·y² + 2d·x + 2e·y + f = 0, i.e.
 * (x, y, 1)·M·(x, y, 1)ᵀ = 0 with the symmetric matrix M = [[a, b, d], [b, c, e], [d, e, f]].
 * NORMAL FORM (the scale): det M = a² + 2b² + c², which fixes the factor (a conic scaled by λ has
 * det λ³·det and a² + 2b² + c² scaled by λ²), so one point set has one value and float and exact
 * runs agree entry by entry. Every conic value is non-degenerate (det M ≠ 0) and has real points;
 * its type (ellipse, parabola, hyperbola) is derived from ac − b², never stored. `anchor` is a
 * known point of the conic (gliders, conic_to_circle), as for circles. A circle is never a conic.
 */
export interface Conic<T> {
  readonly kind: 'conic';
  readonly a: T;
  readonly b: T;
  readonly c: T;
  readonly d: T;
  readonly e: T;
  readonly f: T;
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
  | Conic<T>
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
