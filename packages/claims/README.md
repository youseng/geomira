# @geomira/claims

Claims, hypotheses and random-figure testing (SPEC §10, §16). Pure: no DOM, no framework,
no module-level mutable state; it imports only `@geomira/kernel` and `@geomira/num`. The
root entry exports only `VERSION`; import the subpath modules below (ADR-0002). The
semantics of every claim kind (conditions, NDG data, residuals), the samplers, the rungs
and the verdicts are in ADR-0008.

| Module                       | Contents                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `@geomira/claims/kinds`      | `CLAIM_KINDS` (data), `POLYNOMIAL_KINDS` (the mod-p whitelist), `claimKind`                        |
| `@geomira/claims/kind`       | `ClaimKindSpec`, algebra (conditions, NDG, order items), argument helpers                          |
| `@geomira/claims/ndg`        | NDG predicates: exact in exact fields, banded lengths / sines in floats                            |
| `@geomira/claims/hypotheses` | `assume` kinds with a band margin; `assumptionProblem` (equality assumptions → "construct it")     |
| `@geomira/claims/eval-claim` | `evalClaim`: true / false / undefined(reason) in the current figure (live badges, no sampler)      |
| `@geomira/claims/rungs`      | the rung ladder for one figure: exact over Q (bit budget), exact mod p (static whitelist), numeric |
| `@geomira/claims/verdict`    | local and global verdicts (texts with rungs, counts, seeds; example and counterexample documents)  |
| `@geomira/claims/job`        | `runJob` (generator: progress, cancel; regimes local and global), `testClaim`                      |
| `@geomira/claims/constants`  | sampler and tester constants (σ, grid, retry factor, budget); tolerances stay in num               |

Example (a test or a host without workers):

```ts
const result = testClaim(
  { kind: 'testClaim', regime: 'global', doc, claim: claimId, seed: 1, n: 200 },
  { registry, entropy: cryptoSource((b) => crypto.getRandomValues(b)) },
);
// result.verdict.text: "HOLDS ACROSS THE DECLARED CONFIGURATION (exact over Q, 200/200; …) · seed 1"
```
