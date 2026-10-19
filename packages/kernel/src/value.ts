/**
 * Values (SPEC §4), generic over the number type T of a Field<T>. A Value never holds NaN
 * or ±Infinity: degenerate input gives Undefined with a reason, and a number that is not
 * representable in the field gives Inexact. Unbounded line ranges are `null` (ADR-0003).
 *
 * Reserved kinds, documented only (Phase 2 / later runs, no code): IdealPoint (the common
 * direction of parallel lines; v1 parallel lines are Undefined), Conic, Locus. Capability
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
 * The points p + t·d for t in [lo, hi]; d ≠ 0, not normalised; `null` bounds are
 * unbounded. Line: (null, null); segment AB: p = A, d = B − A, [0, 1]; ray: [0, null).
 * `chiral` records how d behaves when the whole figure is mirrored (SPEC §4): directions
 * from two points are achiral, every 90° turn toggles the flag, parallels keep it.
 */
export interface Line<T> {
  readonly kind: 'line';
  readonly p: Vec<T>;
  readonly d: Vec<T>;
  readonly lo: T | null;
  readonly hi: T | null;
  readonly chiral: boolean;
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

/** z ↦ a·z + b, or a·z̄ + b when `anti`. Reserved, documented only: 'mobius', 'projective'. */
export interface Similarity<T> {
  readonly type: 'similarity';
  readonly anti: boolean;
  readonly a: Complex<T>;
  readonly b: Complex<T>;
}

export interface Transform<T> {
  readonly kind: 'transform';
  readonly t: Similarity<T>;
}

/** A degenerate or invalid result, with the reason shown to the user. */
export interface Undefined {
  readonly kind: 'undefined';
  readonly reason: string;
}

export type DefinedValue<T> = Point<T> | Line<T> | Circle<T> | Num<T> | Polygon<T> | Transform<T>;

export type Value<T> = DefinedValue<T> | Undefined | Inexact;

export type ValueKind = Value<unknown>['kind'];

/** Every kind of the Value union (unknown future kinds are not in it). */
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

/** Whether a value's kind belongs to the Value union (false for future or test-only kinds). */
export function isKnownKind(v: { readonly kind: string }): boolean {
  return VALUE_KINDS.some((k) => k === v.kind);
}

/** Capabilities (SPEC §4): what a tool parameter accepts. */
export type Capability =
  'point' | 'curve' | 'linear' | 'round' | 'number' | 'transform' | 'polygon';

export const CAPABILITIES: readonly Capability[] = Object.freeze([
  'point',
  'curve',
  'linear',
  'round',
  'number',
  'transform',
  'polygon',
]);

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

/** Every field element inside a value (coordinates, bounds, radii…), in a fixed order. */
export function numbersOf<T>(v: Value<T>): T[] {
  switch (v.kind) {
    case 'point':
      return [v.x, v.y];
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
      return [v.t.a.re, v.t.a.im, v.t.b.re, v.t.b.im];
    case 'undefined':
    case 'inexact':
      return [];
    default:
      return assertNever(v, 'value');
  }
}
