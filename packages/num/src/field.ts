/**
 * Number fields (SPEC §3.3). Every tool and claim is written once against Field<T> and
 * runs over FloatField (drawing), RationalField (the exact oracle) and ModPField (the
 * exact mod-p rung). Square roots and trigonometry are partial: where the result is not
 * representable in the field they return Inexact, which propagates like Undefined but
 * means "not representable in this field".
 */
import type { Rational } from './rational';
import type { Dim, ToleranceContext } from './tolerance';

/** "Not representable in this field", with the reason shown to the user. */
export interface Inexact {
  readonly kind: 'inexact';
  readonly reason: string;
}

/** Field sign: a banded sign in FloatField, exact in RationalField, 'none' mod p (no order). */
export type FieldSign = -1 | 0 | 1 | 'ambiguous' | 'none';

/** The fields of v1. */
export type FieldKind = 'float' | 'rational' | 'modp';

/**
 * A field of numbers. Element types must not be objects with `kind: 'inexact'`.
 * Preconditions shared by every implementation (violations throw RangeError, since they
 * are caller bugs and never a silent answer): div by an exact zero; sqrt of a negative
 * element (ordered fields); atan2(0, 0). Angles are in degrees.
 */
export interface Field<T> {
  readonly kind: FieldKind;
  readonly name: string;
  readonly zero: T;
  readonly one: T;
  add(a: T, b: T): T;
  sub(a: T, b: T): T;
  mul(a: T, b: T): T;
  div(a: T, b: T): T;
  neg(a: T): T;
  /** Exact equality of representations (for floats: ===). Tolerant tests use isZero. */
  eq(a: T, b: T): boolean;
  /** Zero test of a quantity of dimension `dim` (tolerance-aware in FloatField only). */
  isZero(x: T, dim: Dim, ctx: ToleranceContext): boolean;
  sign(x: T, dim: Dim, ctx: ToleranceContext): FieldSign;
  sqrt(x: T): T | Inexact;
  sin(degrees: T): T | Inexact;
  cos(degrees: T): T | Inexact;
  /** The direction of (x, y) in degrees, in (-180, 180]. */
  atan2(y: T, x: T): T | Inexact;
  fromRational(r: Rational): T | Inexact;
  toNumber(x: T): number;
}

export function inexact(reason: string): Inexact {
  return { kind: 'inexact', reason };
}

export function isInexact(x: unknown): x is Inexact {
  return typeof x === 'object' && x !== null && 'kind' in x && x.kind === 'inexact';
}

/** f(x) when x is a value; x itself when it is Inexact (propagation). */
export function mapExact<T, U>(x: T | Inexact, f: (value: T) => U | Inexact): U | Inexact {
  return isInexact(x) ? x : f(x);
}

/** All values, or the first Inexact among them (propagation over argument lists). */
export function allExact<T>(xs: readonly (T | Inexact)[]): T[] | Inexact {
  const values: T[] = [];
  for (const x of xs) {
    if (isInexact(x)) return x;
    values.push(x);
  }
  return values;
}

/** A field that records every divisor it is asked to divide by (NDG conditions). */
export interface DivisorLog<T> {
  readonly field: Field<T>;
  /** Divisors in call order, including one whose division then threw. */
  readonly divisors: readonly T[];
}

/** One square-root request and its outcome (for "unsupported" reasons and rung choice). */
export interface SqrtRequest<T> {
  readonly arg: T;
  readonly result: T | Inexact;
}

/** A field that records every square-root request. */
export interface SqrtLog<T> {
  readonly field: Field<T>;
  readonly requests: readonly SqrtRequest<T>[];
}

/** Wraps F so that every div(a, b) records b; all results are F's. The log is per wrapper. */
export function withDivisorLog<T>(F: Field<T>): DivisorLog<T> {
  const divisors: T[] = [];
  const field: Field<T> = {
    ...F,
    div: (a, b) => {
      divisors.push(b);
      return F.div(a, b);
    },
  };
  return { field, divisors };
}

/** Wraps F so that every sqrt(x) records x and its result; logs compose with withDivisorLog. */
export function withSqrtLog<T>(F: Field<T>): SqrtLog<T> {
  const requests: SqrtRequest<T>[] = [];
  const field: Field<T> = {
    ...F,
    sqrt: (x) => {
      const result = F.sqrt(x);
      requests.push({ arg: x, result });
      return result;
    },
  };
  return { field, requests };
}
