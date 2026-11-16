# Retained engine: reactivation gates

The public release does not expose claim testing, discovery or live verdicts
(ADR-0065). ADR-0073 corrects shared sampling and strict circular distinctness;
it does not declare the retained engine ready for public reactivation.

## Discovery result identity — unresolved

`apps/web/src/discovery-runs.ts:sameFigure` compares object definitions and
returns early for a shared object array, ignoring changed claims/assumptions.
Its existing `discovery-runs.test.ts` explicitly documents claims as immaterial.
Reproduce by keeping construction objects unchanged and changing an `assume`
statement: prior results can still be considered fresh. Public builds cannot run
these searches. Before reactivation, bind find/hunt/branch-fix results, proposed
edits, viewed figures and late callbacks to relevant construction, assumptions,
claim identity and test regime. Test assumption-only and claim-only edits through
DiscoveryRuns and its presentation/actions; retain harmless style-only behavior.
Do not solve this by re-enabling a public experimental setting.

## Large live concyclicity cost — unresolved

`packages/claims/src/kinds-incidence.ts:concyclicAlgebra` eagerly constructs all
point triples for existential non-collinearity, in addition to pairwise distinctness.
This is cubic allocation before NDG evaluation can short-circuit. Public builds
unmount live verdict components, so this is not part of public dragging.

Before reactivation, benchmark representative isolated 50/150/300-point claims,
including collinear and late-noncollinear inputs, in the intended main-thread path.
Replace eager triples with a mathematically equivalent bounded/short-circuit
approach, retaining pairwise distinctness and exact-field behavior. Establish and
record a main-thread budget against the repository's existing interaction gates;
measure it on an otherwise idle supported runtime. No busy-machine timing is
claimed here as an accepted baseline. Add regression/performance evidence and
retest worker cancellation, live drag and retained local/global verdict equivalence.

These gates are intentionally independent of the repaired public Randomize sampler.
Reactivation requires a separate product decision and completed evidence for both.
