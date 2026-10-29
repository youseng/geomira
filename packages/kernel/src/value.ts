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
 * meeting point of parallel lines. Conic (ADR-0042, Run 16b). Reserved, documented only: Locus. Capability
 * tests accept any `{ kind: string }`, so a future kind matches no capability and every
 * existing tool rejects it with Undefined("<tool> does not accept …").
 */
import { assertNever } from '@geomira/num/assert';
import type { Inexact } from '@geomira/num/field';
import type { Rational } from '@geomira/num/rational';
import type { Line, Num, Point, Polygon, Undefined, Value, ValueKind } from './value-types';

export type { Inexact } from '@geomira/num/field';
export type {
  Vec,
  Point,
  IdealPoint,
  Line,
  Arc,
  Circle,
  Conic,
  Num,
  Polygon,
  AngleMark,
  SegmentMark,
  Text,
  Str,
  Similarity,
  Mobius,
  Projective,
  Composite,
  TransformData,
  Transform,
  Undefined,
  DefinedValue,
  Value,
  ValueKind,
} from './value-types';

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

/** The conic kind (ADR-0042), outside SPEC §4's frozen list above. */
export const CONIC_KINDS: readonly ValueKind[] = Object.freeze(['conic']);

/** Whether a value's kind belongs to the Value union (false for future or test-only kinds). */
export function isKnownKind(v: { readonly kind: string }): boolean {
  return [...VALUE_KINDS, ...DISPLAY_KINDS, ...PROJECTIVE_KINDS, ...CONIC_KINDS].some(
    (k) => k === v.kind,
  );
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
  | 'ppoint'
  | 'conic';

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

/** The capability of a conic (ADR-0042): only the overloads that declare it take one (E2). */
export const CONIC_CAPABILITIES: readonly Capability[] = Object.freeze(['conic']);

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
    case 'conic':
      return ['conic'];
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

export { numbersOf } from './value-numbers';
