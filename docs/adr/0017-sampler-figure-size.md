# ADR-0017: Samplers and the GUI choice measure the figure's size, not the clamped scale (Run 10, bug fix)

Status: accepted (Run 10, audit). Clarifies SPEC §10.4 ("σ = 0.02·scale", "σ = 0.3·scale",
"a coarse rational grid") and ADR-0008 decision 13, extends ADR-0015 (noise relative to the
sampled figure) and ADR-0012 decision 13 (the GUI choice's tier-2 margins in deviations of the
LOCAL noise), and adds the kernel subpath `./figure-size`. SPEC §3.1's `ctx.scale` and every
tolerance are unchanged.

## Context

SPEC §3.1 defines `ctx.scale` as the diameter of the bounding box of the free points and
explicit radii, clamped to at least 1, so that EPS and BAND have an absolute floor. The
samplers (Run 5) and Randomize (Run 9b) took their lengths from that same clamped scale: the
LOCAL noise σ = LOCAL_SIGMA·scale, the GLOBAL noise, the random translation, the length grid
2^(⌊log₂ scale⌋ − 10), the line-glider spread and Randomize's decimals 10^(⌊log₁₀ scale⌋ − 2).
For a figure smaller than one unit these are not relative to the figure: for the acute triangle
A(0.01, 0.03), B(0, 0), C(0.04, 0) (ADR-0015's triangle at 1/100 of its size) the LOCAL noise was
0.02, about half the figure, and the grid 2^−10 about 2% of it. The audit found:

- 13,866 of 20,000 local samples of that triangle were obtuse or right (at 1/1000: 15,047);
- the local test of ∠BHC + ∠BAC = 180 (true in every acute triangle) said "MIXED (exact over Q,
  101 true and 99 false)": a true statement reported as failing in its own configuration;
- Randomize redrew the triangle on a grid of 0.01 (two decimals for a figure of size 0.05);
- the editor's GUI choice (robust.ts) moved each free input by LOCAL_SIGMA·scale = 0.02 to
  measure how firmly a same_side / on_arc selector decides, so on a figure of size 0.1 no such
  selector was ever firm: the same construction got `along(-)` at 1/100 of its size where the
  full-size one got `same_side(A, l3)` (orientation-dependent instead of reflection-equivariant).

SPEC §10.4 says the LOCAL regime "cannot cross configuration boundaries"; note B of Run 10 asks
for noise "relative to the figure". The literal formula with the clamped scale contradicts both
for small figures; figures with diameter ≥ 1 are unaffected.

## Decision

1. **`figureDiameter(doc)`** (kernel, new subpath `@geomira/kernel/figure-size`): the diameter
   of the free points and explicit radii as SPEC §3.1 defines it, NOT clamped (0 for no point
   or a single point; undefined for a coordinate beyond the double range; a radius beyond the
   float argument limit ignored). `evalContextFor` uses it and clamps as before, so there is
   one definition of the figure's extent.
2. **The samplers' size** (`figureSize` in sampler.ts) is figureDiameter of the user's objects
   (probes excluded), or the evaluation scale when that is 0 (a single free point) or not
   finite. Every length the samplers draw is measured in it: σ = LOCAL_SIGMA·size and
   GLOBAL_SIGMA·size, the translation b ∈ [−size/2, size/2]², the grid 2^(⌊log₂ size⌋ − 10),
   the line-glider spread size/|d|. A figure and the same figure scaled by any factor get the
   same samples, scaled (up to the grid), from the same seed.
3. **Randomize** rounds points and radii to 10^(⌊log₁₀ size⌋ − 2).
4. **The GUI choice** (editor robust.ts) moves each free input by LOCAL_SIGMA × figureDiameter
   (the scale when it is 0), so a tier-2 selector is judged against the noise the tester
   applies and the choice does not depend on the figure's size.

## Consequences

- Seeds of figures smaller than one unit reproduce different samples than before (as after
  ADR-0015); figures with diameter ≥ 1 draw exactly the samples they drew before.
- The tolerances (EPS, BAND, the noise floor's δ = 1e-10·scale) keep SPEC §3.1's absolute floor
  for tiny figures; only what the samplers and the GUI choice MOVE is relative.
- Tests: `packages/claims/test/sampler-figure-size.test.ts` (20,000 local samples at 1/100 and
  1/1000 all acute; the grid; the local test of the theorem; scaled figures give scaled
  samples; a single point; a radius alone; Randomize's decimals),
  `packages/editor/test/choice-scale.test.ts` (ten random figures choose the same selectors at
  full size and at 1/100), `packages/kernel/test/figure-size.test.ts` (each degenerate case).

## Alternatives considered

- **Changing SPEC §3.1's clamp**: the clamp keeps EPS·scale from becoming absurdly small for
  tiny figures; the tolerances are not the problem.
- **Asking users to draw figures of size ≥ 1**: the text format accepts any coordinates, and
  "nothing silently wrong" forbids a verdict that depends on the unit.
- **Computing the size from the free inputs in packages/claims**: a second definition of the
  figure's extent that could drift from the kernel's (and the editor would need a third).
