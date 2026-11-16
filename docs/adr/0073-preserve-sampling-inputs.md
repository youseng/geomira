# ADR-0073: Preserve fixed radii and refuse invalid sampling domains

Status: authorized by release prompt 08; integration verification remains required.
Amends ADR-0008 decision 13, ADR-0015 and ADR-0017.

## Context

Base f95e005 includes the public-claims-off boundary and local recovery/modal fixes.
The shared sampler rounded literal circle radii on the free-coordinate grid. With
O=(0,0), F=(1000,0), c=circle(O,0.01) and d=circle(O,0.02), it rounded both radii
to zero and then manufactured a grid-unit radius. A false radius-equality claim
received 200/200 true outcomes. Zero and negative fixed radii could also become
valid circles. Randomize uses the same sampler and rounded radii independently
again. A reversed parameter range reached RNG.uniform before validation and threw.

## Decision

- Quantize the similarity's positive scale once to an exact hundredth, using the
  existing exact-decimal utility. Its numeric projection maps points and its exact
  rational multiplies every fixed literal radius. Coordinate/glider rounding stays
  unchanged. This preserves every ratio between literal radii exactly, irrespective
  of unrelated points or the coordinate grid. The scale remains in [0.5,2].
- Randomize does not round fixed radii a second time. A radius may require a longer
  exact decimal/fraction than a coordinate; correctness takes precedence over a
  fixed number of displayed digits. Every original dependency is retained, while
  actual free point/glider/parameter values continue to change.
- Validate every sampled literal input before Randomize or a retained test job,
  including unrelated free inputs. Nonrepresentable inputs, nonpositive radii,
  radii whose square cannot be represented, invalid parameter ranges or values,
  and zero homogeneous glider pairs produce an actionable refusal/structured
  invalid job result. Do not swap bounds, drop invalid objects or repair constants.
  Existing current-figure claim evaluation remains separate from sampling.
- Low-level sampler calls preserve zero/negative radii and invalid parameter bounds
  instead of turning them into another construction or invoking an invalid uniform
  range. Sampling entry points own validation; rendering degeneracy still follows
  the kernel's existing EPS/BAND rules.
- Strict circular order requires pairwise distinct points within the existing BAND
  margin, including two-point groups. Exact coincidence fails; insufficient separation
  is ambiguous. This changes ordering only: it does not add an incidence hypothesis.
- Public claim/discovery controls, live evaluation and job dispatch remain disabled.
  Retained-only discovery freshness and large live-claim performance remain explicit
  reactivation gates in `docs/claims-reactivation.md`.

## Consequences

Identical seeds still reproduce identical samples under this version; a corrected
sampler version may differ from older versions. No sample counts, attempt budgets,
mathematical tolerances, exactness budgets or performance gates are reduced. Invalid
unrelated free inputs now refuse the complete sample consistently in both regimes.
Valid Randomize is still one undoable edit and leaves metadata/claim syntax intact.
No existing tests are modified or deleted; new regressions cover the new contract.

## Alternatives

A smaller radius grid still changes ratios and can turn zero positive. Freezing all
inputs would preserve ratios by ceasing to sample. Swapping invalid bounds would
silently change the document. Hiding verdicts alone leaves public Randomize affected.
