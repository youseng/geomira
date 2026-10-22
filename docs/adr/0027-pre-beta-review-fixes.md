# ADR-0027: Pre-beta review fixes

Status: accepted (pre-beta bug review, 2026-10-22). Clarifies ADR-0008 (undirected angle
forms), ADR-0017 (what stays absolute in small figures) and ADR-0006 (the double point of two
circles).

## Context

A review of the whole codebase before the beta found defects that break "nothing silently
wrong" (CLAUDE.md). Each decision below fixes one; each is a bug fix with a test that failed
before it.

## Decision

1. **Undirected linear forms at the ends of θ's range.** `α + σβ = θ` was tested as
   "w·e^{−iθ} is a positive real", i.e. mod 360°. Inside θ's range ([0°, 360°] for a sum,
   [−180°, 180°] for a difference) that is exact, but at its two ends the other end is the
   same residue: `angle(A, B, M) − angle(A, M, B) = 180` held when the difference is −180°.
   At an end, one more order item names it: α = 0° at the low end (cos α > 0), α = 180° at
   the high end (cos α < 0); with the condition and the half-turn item this leaves exactly
   the claimed value. The float residual is |α + σβ − θ| in radians, no longer folded mod 2π
   (ADR-0008's table said "folded"; folding is what made the ends agree).
   → `packages/claims/test/angle-wrap.test.ts`.
2. **The numeric rung judges a claim relative to the figure's size.** ADR-0017 kept the
   tolerances absolute below size 1 (SPEC §3.1's clamp of `ctx.scale` to ≥ 1). For claims that
   made the verdict depend on the unit: `on` and `tangent` decide first on the kernel's banded
   gap, so a circle 2·10⁻⁶ of its radius away from tangency "held" in a figure of size 0.01 and
   was false at size 1; and the noise floor's perturbations (FLOOR_DELTA·scale) were
   relatively larger in small figures. Now, when the figure's size (the kernel's
   `figureDiameter`, probes excluded, ADR-0017) is below the evaluation scale, the numeric
   rung scales the claim's arguments (and those of its perturbed figures) by scale/size about
   the origin before deciding, and perturbs the free inputs by FLOOR_DELTA·size. Every claim
   kind is invariant under a direct similarity (numbers in claims are dimensionless literals),
   so this is the same figure judged at size 1. The figure is still evaluated with the
   kernel's context (constructions keep SPEC §3.1), and the float NDG test before the rungs
   keeps the kernel's context too: calling more figures degenerate is the conservative side.
   Figures of size ≥ 1 are unchanged (the factor is 1).
   → `packages/claims/test/small-figure-claims.test.ts`.
3. **Circles that nearly coincide are not tangent.** Circle ∩ circle decided tangency on the
   gaps r₁ + r₂ − d and d − |r₁ − r₂|. When the centres are closer than the band and the radii
   equal within it, the internal gap is in the band too, and the "double point" on the line of
   centres lies on neither circle (for circle(A, B, C) and circle(A, B, D) with D 10⁻⁷ above
   C it was the common centre; near(A) returned it). ADR-0006's jump bound
   √(2r₁r₂g/|r₁ − r₂|) is infinite there. Now, when the internal gap and |r₁ − r₂| are both
   within the band, the half chord decides: h² = D/4s > 0 beyond the band → two candidates;
   otherwise Undefined("ambiguous: the circles nearly coincide"). Genuine tangencies
   (|r₁ − r₂| beyond the band) are unchanged. Only the float run can reach this: over Q the
   gaps are exact. → `packages/kernel/test/circles-nearly-coincide.test.ts`, the new
   degenerate case of `intersect` in `packages/kernel/test/degenerate.test.ts`.
4. **Drag-end rounding checks every object, not only the dragged one.** SPEC §12 rounds the
   dragged coordinates at drag end; the rounding was refused only when the dragged object or
   the object it rewrites moved more than ROUNDING_PX. Rounding Q = (1, 0.00045) to (1, 0)
   crossed l (at y = 0.0003) and flipped `same_side(Q, l)`: X jumped 300 px with no
   degeneracy. Now the rounding is also refused when any other object changes kind (a point
   became undefined, or the reverse) or moves more than DEPENDENT_PX = 1 px on screen (points,
   texts, circle centres and radii, and lines over 100 px). The bound is larger than
   ROUNDING_PX because constructions amplify a tiny move; a refused rounding keeps the exact
   float coordinates, as before. → `packages/editor/test/drag-rounding-dependents.test.ts`.
5. **The GUI choice's other(P) must stay defined, as the kernel decides it.** Tier 1 (SPEC §7)
   checked that P stays on the call's curves when the figure moves (Run 10 audit). For
   `tangent_from` the kernel's other(Q) also needs Q on the polar of the external point, so a
   point at the touch point by coincidence (Q on c by construction, the touch point from
   P = (0, 25/3) only by chance) was written, and the tangent became Undefined after any drag
   of P. Now tier 1 runs the kernel's compute with other(P) in each local response and keeps
   it only when it gives a point every time. → `packages/editor/test/choice-tangent-other.test.ts`.

## Consequences

- A claim that agreed with a kernel decision taken inside the absolute band of a small figure
  (a near-tangency the kernel collapsed to a double point) may now be FALSE or AMBIGUOUS there:
  the claim is judged relative to the figure, the construction is not. Random samples are not
  near such boundaries.
- `num`'s contract (`ctx.scale ≥ 1`) is unchanged.

## Alternatives considered

- **Allowing `ctx.scale < 1` in packages/num**: weakens a guard every package relies on, and a
  frozen test pins it.
- **Changing SPEC §3.1's clamp for constructions**: ADR-0017's reasons stand (EPS·scale must
  not become absurdly small for the kernel's construction decisions).
