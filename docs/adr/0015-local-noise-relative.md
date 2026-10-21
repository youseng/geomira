# ADR-0015: Sampler noise relative to the sampled figure (Run 9a, bug fix)

Status: accepted (Run 9a). Clarifies ADR-0008 decision 13 (samplers) and SPEC §10.4; changes
the samples a given seed draws, so a verdict's seed from an earlier version reproduces other
samples (ADR-0002's pinned RNG outputs are unchanged).

## Context

SPEC §10.4: "LOCAL (default): random similarity + Gaussian noise σ = 0.02·scale on free points
… It cannot cross configuration boundaries." The sampler (Run 5) mapped each free point by the
random similarity z ↦ s·R·(z − c) + c + b (s = 2^u, |u| ≤ 1) and THEN added noise of
σ = LOCAL_SIGMA·scale, scale being the user figure's. When the similarity shrank the figure
(s down to ½), the noise relative to the sampled figure grew to twice LOCAL_SIGMA, and its tails
crossed configuration boundaries: in Run 9a a Run 8b Playwright flow failed in CI with "Mixed
(local test, n = 200, exact over Q: 199 true, 1 false)" for ∠BHC + ∠BAC = 180 in the acute
triangle A(1, 3), B(0, 0), C(4, 0) (largest angle 72°); the false sample was a triangle with a
right angle at B. 14 of the seeds 0–299 gave such a sample (5 of 20,000 single local samples
were obtuse). Each test run of the app draws a fresh seed, so the flow failed in about one run in
twenty. The GLOBAL sampler had the same order (σ = 0.3·scale after the similarity).

## Decision

1. **The noise is drawn in the user's figure and mapped with it**: a free point is moved by the
   Gaussian noise (σ = LOCAL_SIGMA·scale or GLOBAL_SIGMA·scale, as before) and then by the
   similarity, so the noise is σ relative to the SAMPLED figure whatever s is. The random
   numbers are the same draws in the same order (the noise of x, then of y); only where they
   apply changes. Gliders, params and radii were already relative (their noise is in the
   object's own parameter or scaled with s) and are unchanged.
2. A regression test (`packages/claims/test/sampler-relative-noise.test.ts`) fails on the old
   order: 20,000 local samples of that triangle are all acute, and the seeds that failed (91, 98,
   115, 123) give "HOLDS IN THIS CONFIGURATION".

## Consequences

- The local regime keeps its promise for figures whose boundaries are many σ away (the
  triangle's nearest boundary, 18° at B, is now about eleven standard deviations of its angle).
- A seed printed by an earlier version (Runs 5–8b) reproduces different samples now; documents
  and verdicts are not stored with seeds, so nothing saved changes.
- The global regime's noise is likewise relative to the sampled figure (its purpose, leaving the
  configuration, is unchanged; its statistics change slightly).

## Alternatives considered

- Multiplying σ by s after the similarity: the same distribution, but two places would have to
  agree on s; drawing before the map states the intent directly.
- A smaller LOCAL_SIGMA: changes SPEC §10.4's constant and only makes the crossing rarer.
- Rejecting local samples that leave the configuration: the tester does not know a claim's
  configuration (that is the global test's question).
