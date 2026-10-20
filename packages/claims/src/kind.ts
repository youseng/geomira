/**
 * Claim kinds as data (SPEC §10.1, ADR-0008). Each kind defines, generically over
 * Field<T>, its `algebra`: the CONDITIONS (all must be 0 for the claim to hold), the NDG
 * items (non-degeneracy data, ndg.ts) and, for the few kinds that need one, ORDER items
 * (a sign that must also hold: a point within a segment's range, the half-turn of an
 * undirected angle sum). The float rung uses a dimensionless RESIDUAL (≥ 0) and, for
 * incidence and tangency, the kernel's banded length GAP, so a claim never disagrees with
 * a construction about whether a point is on a curve or two curves touch (note B).
 */
import { assertNever } from '@geomira/num/assert';
import type { Field, Inexact } from '@geomira/num/field';
import type { Rational } from '@geomira/num/rational';
import type { Dim, ToleranceContext } from '@geomira/num/tolerance';
import {
  undef,
  type Circle,
  type Line,
  type Undefined,
  type Value,
  type Vec,
} from '@geomira/kernel/value';
import type { Ndg } from './ndg';

/** What a claim argument must be: geometry (evaluated) or an exact literal. */
export type ClaimParam = 'point' | 'line' | 'circle' | 'curve' | 'integer' | 'number';

/** A sign that must hold for the claim to be true (decided like an NDG item in floats). */
export interface OrderItem<T> {
  /** Must be > 0 (strict) or ≥ 0. */
  readonly value: T;
  /** FloatField decides value / √norm as a quantity of dimension `dim`. */
  readonly norm: T;
  readonly dim: Dim;
  readonly strict: boolean;
  readonly what: string;
}

export interface Algebra<T> {
  readonly conditions: readonly T[];
  readonly ndg: readonly Ndg<T>[];
  readonly order: readonly OrderItem<T>[];
}

/**
 * How the float rung decides: 'floor' (the noise floor of SPEC §3.1 on the residual),
 * 'incidence' (the kernel's banded point–curve gap, then the floor), 'tangency' (a gap
 * within the band is a touch, as in the kernel's candidate count, then the floor).
 */
export type FloatTest = 'floor' | 'incidence' | 'tangency';

/** The evaluated arguments of a claim, in parameter order (literals as exact numbers). */
export type ClaimArgs<T> = readonly Value<T>[];

export interface ClaimKindSpec {
  readonly name: string;
  readonly params: readonly ClaimParam[];
  /** Further arguments of one kind (collinear(A, B, C, D, …)). */
  readonly rest?: ClaimParam;
  /** In the POLYNOMIAL KINDS whitelist of the mod-p rung (SPEC §10.1). */
  readonly polynomial: boolean;
  readonly test: FloatTest;
  /** One line for documentation and messages. */
  readonly doc: string;
  /** Conditions, NDG and order items over any field; Undefined for an invalid literal. */
  algebra<T>(
    F: Field<T>,
    args: ClaimArgs<T>,
    ctx: ToleranceContext,
  ): Algebra<T> | Undefined | Inexact;
  /** The float residual: dimensionless, 0 when the claim holds exactly. */
  residual(args: ClaimArgs<number>, ctx: ToleranceContext): number;
  /** incidence / tangency: the decisive gap, a signed length (as the kernel measures it). */
  gap?(args: ClaimArgs<number>, ctx: ToleranceContext): number;
  /**
   * Static: a reason the exact rungs cannot represent the claim's own algebra for these
   * literals (they would need trigonometry), or undefined. Such a claim never uses the
   * mod-p rung (L17).
   */
  needsTrig?(lits: readonly Rational[]): string | undefined;
}

export function badClaim(kind: string): Undefined {
  return undef(`${kind}: the arguments do not fit the claim`);
}

export function pointAt<T>(args: ClaimArgs<T>, i: number): Vec<T> | undefined {
  const v = args[i];
  return v?.kind === 'point' ? v : undefined;
}

export function lineAt<T>(args: ClaimArgs<T>, i: number): Line<T> | undefined {
  const v = args[i];
  return v?.kind === 'line' ? v : undefined;
}

export function circleAt<T>(args: ClaimArgs<T>, i: number): Circle<T> | undefined {
  const v = args[i];
  return v?.kind === 'circle' ? v : undefined;
}

/** The exact value of a literal argument. */
export function litAt<T>(args: ClaimArgs<T>, i: number): Rational | undefined {
  const v = args[i];
  return v?.kind === 'number' ? v.exact : undefined;
}

/** Points at indices from..args.length − 1 (all must be points), or undefined. */
export function pointsFrom<T>(args: ClaimArgs<T>, from: number): Vec<T>[] | undefined {
  const out: Vec<T>[] = [];
  for (let i = from; i < args.length; i++) {
    const p = pointAt(args, i);
    if (p === undefined) return undefined;
    out.push(p);
  }
  return out;
}

/** Whether a value fits a parameter (literals must carry their exact value). */
export function fitsParam(v: Value<unknown>, p: ClaimParam): boolean {
  switch (p) {
    case 'point':
    case 'line':
    case 'circle':
      return v.kind === p;
    case 'curve':
      return v.kind === 'line' || v.kind === 'circle';
    case 'integer':
      return v.kind === 'number' && v.exact !== undefined && v.exact.den === 1n;
    case 'number':
      return v.kind === 'number' && v.exact !== undefined;
    default:
      return assertNever(p, 'claim parameter');
  }
}

/** Whether a parameter takes an exact literal (not an object). */
export function isLiteralParam(p: ClaimParam): boolean {
  return p === 'integer' || p === 'number';
}

/** The parameter of argument i, or undefined beyond the signature. */
export function paramAt(spec: ClaimKindSpec, i: number): ClaimParam | undefined {
  return spec.params[i] ?? spec.rest;
}

/** Every pair of distinct indices below n. */
export function pairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

/** "A ≠ B" style NDG items for every pair of points (names from the claim's text). */
export function distinctAll<T>(pts: readonly Vec<T>[], label: (i: number) => string): Ndg<T>[] {
  return pairs(pts.length).flatMap(([i, j]) => {
    const [a, b] = [pts[i], pts[j]];
    return a === undefined || b === undefined
      ? []
      : [{ kind: 'distinct' as const, a, b, what: `${label(i)} and ${label(j)} coincide` }];
  });
}

/**
 * The placeholder of argument i in messages, `{i}`; claim evaluation replaces it with the
 * argument as written (formatClaimMessage), so reasons name objects: "A and B coincide".
 */
export function argLabel(i: number): string {
  return `{${String(i)}}`;
}

/** Replaces every `{i}` placeholder by the text of argument i. */
export function formatClaimMessage(message: string, args: readonly string[]): string {
  return message.replace(/\{(\d+)\}/g, (m, i: string) => args[Number(i)] ?? m);
}
