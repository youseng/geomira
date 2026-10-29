/**
 * "P lies on the conic k" (internal; ADR-0042), as incidence.ts decides it for lines and circles:
 * the gap Q(P)/|∇Q(P)|, the first-order distance to the curve, as a LENGTH with the band (exact
 * fields: Q(P) = 0 exactly; mod p the exact zero test).
 */
import { assertNever } from '@geomira/num/assert';
import type { Field } from '@geomira/num/field';
import { coeffsOf, onConicSign, qValue } from './conic';
import type { EvalContext } from './tool';
import { undef, type Conic, type Undefined, type Vec } from './value';

/**
 * Undefined unless P lies on k; `what` is the reason. Degenerate cases: P off k → Undefined(what);
 * within the band → Undefined("ambiguous: within the band of incidence (what)"); k must be a
 * valid conic (the caller's check).
 */
export function requireOnConic<T>(
  F: Field<T>,
  P: Vec<T>,
  k: Conic<T>,
  ctx: EvalContext,
  what: string,
): Undefined | undefined {
  const s = onConicSign(F, k, P, ctx);
  switch (s) {
    case 0:
      return undefined;
    case 'ambiguous':
      return undef(`ambiguous: within the band of incidence (${what})`);
    case 1:
    case -1:
      return undef(what);
    case 'none':
      return F.isZero(qValue(F, coeffsOf(k), P), 'length', ctx) ? undefined : undef(what);
    default:
      return assertNever(s, 'field sign');
  }
}
