/**
 * The static check of a claim (ADR-0008, ADR-0009): its kind exists and its arguments fit
 * the kind's parameters in number and form (literal parameters take exact number literals,
 * the others objects or expressions) and, when the caller knows the arguments' static kinds,
 * in kind (ADR-0028). The tester refuses such a claim as invalid; the
 * language reports the same message as a parse error at the claim's line.
 */
import type { Expr } from '@geomira/kernel/expr';
import type { ValueKind } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import { isLiteralParam, paramAt, type ClaimKindSpec, type ClaimParam } from './kind';
import { claimKind } from './kinds';

/** The kinds an argument's value can have (the kernel's static kinds), undefined if unknown. */
export type ArgKinds = (e: Expr) => readonly ValueKind[] | undefined;

/**
 * Whether a value of kind `k` may fit an object parameter (as fitsParam decides at test
 * time). 'undefined' and 'inexact' say nothing about the kind, so they may fit; nor does a point
 * at infinity where a point is expected (a claim on it is undefined unless the kind takes one).
 */
function mayFit(k: ValueKind, p: ClaimParam): boolean {
  if (k === 'undefined' || k === 'inexact') return true;
  // A point at infinity is a point of the projective plane (ADR-0040): taken, or undefined.
  if (k === 'ideal_point' && p === 'point') return true;
  switch (p) {
    case 'point':
    case 'line':
    case 'circle':
      return k === p;
    case 'curve':
      return k === 'line' || k === 'circle';
    case 'integer':
    case 'number':
      return k === 'number';
    default:
      return assertNever(p, 'claim parameter');
  }
}

/**
 * Why the arguments do not fit the kind, or undefined when they do. With `kindsOf`, an
 * object argument none of whose possible kinds fits its parameter is refused with the
 * message the tester gives at test time ("invalid claim: equal needs point as argument 1,
 * not number"); an argument of unknown kinds is accepted.
 */
export function argProblem(
  kind: ClaimKindSpec,
  args: readonly Expr[],
  kindsOf?: ArgKinds,
): string | undefined {
  const min = kind.params.length;
  if (args.length < min || (kind.rest === undefined && args.length > min)) {
    return `${kind.name} takes ${kind.rest === undefined ? String(min) : `at least ${String(min)}`} arguments, got ${String(args.length)}`;
  }
  for (const [i, a] of args.entries()) {
    const p = paramAt(kind, i);
    if (p === undefined) return `${kind.name}: too many arguments`;
    if (isLiteralParam(p) !== (a.kind === 'lit')) {
      return `${kind.name}: argument ${String(i + 1)} must be ${isLiteralParam(p) ? 'an exact number' : 'an object'}`;
    }
    const ks = isLiteralParam(p) ? undefined : kindsOf?.(a);
    if (ks !== undefined && ks.length > 0 && !ks.some((k) => mayFit(k, p))) {
      return `invalid claim: ${kind.name} needs ${p} as argument ${String(i + 1)}, not ${ks.join(' or ')}`;
    }
  }
  return undefined;
}

/**
 * Why a claim `{ kind, args }` is not acceptable, or undefined. Degenerate cases: an
 * unknown kind; too few or too many arguments; a literal where an object is expected or
 * the reverse; with `kindsOf`, an object that cannot be of its parameter's kind.
 */
export function claimProblem(
  claim: { readonly kind: string; readonly args: readonly Expr[] },
  kindsOf?: ArgKinds,
): string | undefined {
  const kind = claimKind(claim.kind);
  return kind === undefined
    ? `unknown claim "${claim.kind}"`
    : argProblem(kind, claim.args, kindsOf);
}
