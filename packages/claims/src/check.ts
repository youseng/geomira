/**
 * The static check of a claim (ADR-0008, ADR-0009): its kind exists and its arguments fit
 * the kind's parameters in number and form (literal parameters take exact number literals,
 * the others objects or expressions). The tester refuses such a claim as invalid; the
 * language reports the same message as a parse error at the claim's line.
 */
import type { Expr } from '@geomira/kernel/expr';
import { isLiteralParam, paramAt, type ClaimKindSpec } from './kind';
import { claimKind } from './kinds';

/** Why the arguments do not fit the kind, or undefined when they do. */
export function argProblem(kind: ClaimKindSpec, args: readonly Expr[]): string | undefined {
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
  }
  return undefined;
}

/**
 * Why a claim `{ kind, args }` is not acceptable, or undefined. Degenerate cases: an
 * unknown kind; too few or too many arguments; a literal where an object is expected or
 * the reverse.
 */
export function claimProblem(claim: {
  readonly kind: string;
  readonly args: readonly Expr[];
}): string | undefined {
  const kind = claimKind(claim.kind);
  return kind === undefined ? `unknown claim "${claim.kind}"` : argProblem(kind, claim.args);
}
