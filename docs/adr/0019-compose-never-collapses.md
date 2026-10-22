# ADR-0019: A map is degenerate where it is built; a composition never collapses (Run 10, P1)

Status: accepted (Run 10, maintainer's decision on audit proposal P1). Replaces the test within
EPS of ADR-0007 decision 2. SPEC §6.3 (homothety with k = 0 is Undefined) and every tolerance
are unchanged.

## Context

ADR-0007 decision 2 made every Transform value invertible by testing its scale factor a: both
components within EPS of 0, as dimensionless quantities, gave Undefined ("the map collapses
the plane (scale factor 0)"). Every tool ran this test on every transform it built or
received. A product of two valid maps could then fail it in floats: with h = homothety(O,
10⁻⁵), compose(h, h) had a = 10⁻¹⁰ and was Undefined, although it is a valid similarity, is
defined over Q and mod p, and applying h twice was defined. The audit (docs/audit/2026-10-22.md,
P1) showed that this broke associativity as a tool:

- with h₁ = h₂ = homothety(O, 10⁻⁵) and h₃ = homothety(O, 10⁵), `compose(h₁, compose(h₂, h₃))`
  was the identity;
- `compose(compose(h₁, h₂), h₃)` was Undefined.

ADR-0007 accepted this ("compose of two valid maps can still collapse in floats"). The
maintainer decided otherwise: decide a map's collapse relative to its factors.

## Decision

1. **A map is degenerate where it is built**, by the tool's own test on its own inputs.
   These tests do not change:
   - homothety: k = 0 within EPS (dimensionless; SPEC §6.3);
   - spiral: A = B or C = D (lengths);
   - reflect: a line without direction.

   rotate and translate are never degenerate.

2. **A product or inverse of valid maps is valid**, because |a₁a₂| = |a₁||a₂| > 0 and
   |a⁻¹| = 1/|a|. compose and inverse do not test their result against EPS.
3. **`similarityProblem` keeps two checks** (for hand-built values and for the double range):
   - a = 0 exactly, in any field → Undefined "the map collapses the plane (scale factor 0)";
   - in FloatField, a ≠ 0 but |a|² not a positive finite double (|a| below about 10⁻¹⁶² or
     above about 10¹⁵⁴, reachable only through long chains of tiny or huge maps) → Inexact
     "the scale factor is beyond the double range". Its inverse is not representable, so this
     is a limit of doubles, not a collapse.

   Mod p (p ≡ 3 mod 4), |a|² = 0 only for a = 0. The function no longer takes a tolerance
   context.

4. compose's declared degenerate cases become:
   - "scale factors below EPS (10⁻⁵ · 10⁻⁵) → a valid map: a composition never collapses";
   - "a scale factor beyond the double range (floats) → Inexact".

   inverse and apply keep "a hand-built map with scale factor 0 → Undefined".

## Consequences

- New law `packages/kernel/test/laws/l13-compose-collapse.test.ts`. It covers 300 documents
  per field, with maps from the registry's tools whose scale factors run from 10⁻⁸ to 10⁸
  (products from 10⁻²⁴ to 10²⁴). In every field:
  - both groupings of compose are defined and equal (exactly over Q and mod p; in floats
    within 1e-9 relative to |a|);
  - applying the composition equals applying the maps one by one.

  It includes the audit's case and failed before the change.

- Changed test lines, citing this ADR:
  - `packages/kernel/test/laws/l1-transforms.test.ts` (frozen). "the map collapses the plane"
    is removed from the reasons the fuzz must reach, with the special case for floats. No
    document built from tools can reach it any more: its tiny compositions are valid maps now.
    Two comments are reworded.
  - `packages/kernel/test/helpers/degenerate-transforms.ts`. compose's first case is renamed
    to the new declared case and now requires a transform in all three fields, which is a
    stronger assertion. A case for Inexact beyond the double range is added.
- drag-through uses the same check: a map with a scale factor beyond the double range refuses
  the drag with its reason instead of dividing.
- docs/tools.md is regenerated.

## Alternatives considered

- **Test a against EPS·|a₁||a₂| (relative to the factors).** Equivalent for compose, since
  |a| = |a₁||a₂| up to rounding, so the test could never fail. It would also need the factors'
  sizes carried in every Transform value. Not testing at all states the same thing directly.
- **Carry the exact product.** Exact values are not carried for maps, and the float product is
  correct to a relative 2⁻⁵², so nothing is gained.
- **Keep ADR-0007's rule.** Rejected by the maintainer: it makes the same composition defined or
  Undefined depending on the grouping.
