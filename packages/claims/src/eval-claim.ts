/**
 * evalClaim (SPEC §10.2): the three-valued value of a claim in the CURRENT figure, for
 * live badges. It never runs a sampler: the exact rung over Q when it applies (the
 * document's literals are exact), otherwise the numeric rung with the noise floor (whose
 * three perturbations come from a seeded stream, so the badge is deterministic). The
 * mod-p rung needs random values and so does not apply to one given figure. A claim on
 * Undefined objects, or whose NDG data fails, is undefined, never true or false.
 */
import { assertNever } from '@geomira/num/assert';
import { createRng, type Seed } from '@geomira/num/rng';
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import { EXACT_BUDGET_BITS } from './constants';
import type { ClaimKinds } from './kind-registry';
import { CURRENT_FIGURE_SEED } from './current';
import { prepare } from './prepare';
import { decideSample, type RungName, type SampleOutcome } from './rungs';

export type ClaimValue =
  | { readonly value: 'true' | 'false'; readonly rung: RungName }
  | {
      readonly value: 'undefined';
      /** degenerate, undefined objects, ambiguous, ill-conditioned or an invalid claim. */
      readonly status: 'degenerate' | 'undefined' | 'ambiguous' | 'ill-conditioned' | 'invalid';
      readonly reason: string;
    };

export interface EvalOptions {
  /** The seed of the noise-floor perturbations (default CURRENT_FIGURE_SEED). */
  readonly seed?: Seed;
  /** The exact rung's size budget in bits (default EXACT_BUDGET_BITS). */
  readonly budgetBits?: number;
  /** The claim kinds (default: v1's; ADR-0035). */
  readonly kinds?: ClaimKinds;
}

/** A sample outcome as a claim value (hypothesis rejections cannot occur here). */
export function valueOf(o: SampleOutcome): ClaimValue {
  switch (o.kind) {
    case 'true':
    case 'false':
      return { value: o.kind, rung: o.rung };
    case 'rejected':
      return { value: 'undefined', status: 'undefined', reason: o.reason };
    case 'degenerate':
    case 'undefined':
    case 'ambiguous':
    case 'ill-conditioned':
    case 'invalid':
      return { value: 'undefined', status: o.kind, reason: o.reason };
    default:
      return assertNever(o, 'sample outcome');
  }
}

/** The value of claim `claimId` in the current figure of `doc`. */
export function evalClaim(
  doc: Document,
  claimId: number,
  registry: Registry,
  options: EvalOptions = {},
): ClaimValue {
  const p = prepare(doc, claimId, registry, options.kinds);
  if (!p.ok) return { value: 'undefined', status: 'invalid', reason: p.reason };
  const outcome = decideSample(p.prepared, p.prepared.doc, {
    budgetBits: options.budgetBits ?? EXACT_BUDGET_BITS,
    rng: createRng(options.seed ?? CURRENT_FIGURE_SEED),
    hypotheses: false,
  });
  return valueOf(outcome);
}
