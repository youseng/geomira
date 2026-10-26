# ADR-0034: feet_inversion and sqrt_bc2

Status: accepted (maintainer decision on Run 14's open question; same PR as Run 14, own
commit). Completes ADR-0032 decision 4, which left these two presets unbuilt because SPEC does
not define them: the maintainer confirmed the definitions proposed in STATUS (Run 14,
"Uncertain").

## Context

ADR-0032 built the inversion presets as compositions of registry tools and listed
`feet_inversion` and `sqrt_bc2` as not built until their meaning was confirmed. The maintainer
confirmed:

- feet_inversion(A, B, C) = inversion(A, k), k = AB⃗·AC⃗ (signed: k < 0 for an obtuse angle at
  A is the inversion followed by the half turn, as inversion(O, k) already does); a right
  angle at A (k = 0) → Undefined with a reason; symmetry B ↔ C, same value.
- sqrt_bc2(A, B, C) = compose(reflect(bisector(B, A, C)), inversion(A, AB·AC/2)), the √(bc/2)
  inversion, a composition only like sqrt_bc; symmetry B ↔ C, same value (checked).

## Decision

1. **feet_inversion(A, B, C) = inversion(A, power(A, diameter_circle(B, C)))**. The power of A
   with respect to the circle on diameter BC is (A − B)·(A − C) = AB⃗·AC⃗ exactly, so the
   preset is a composition of registry tools (diameter_circle, power, inversion), like
   inversion_swap, and contains no mapping formula. Rational: exact over Q and mod p.
   - It maps B to the foot F of the altitude from C and C to the foot E of the altitude from
     B (AF⃗·AB⃗ = AB⃗·AC⃗: F is the projection of C on line AB), the orthocentre H to the foot D
     of the altitude from A (B, D, H, F lie on the circle on diameter BH, so AH⃗·AD⃗ = AF⃗·AB⃗),
     the circumcircle to line EF and line BC to the circle AEF, whose diameter is AH (the
     angles AEH and AFH are right).
   - Degenerate: k = 0 (a right angle at A, or A = B, or A = C; an exact zero, in FloatField
     within EPS as an area, the inversion's own test) → Undefined "feet_inversion(A, B, C):
     AB⃗·AC⃗ = 0 (a right angle at A, or A = B or A = C)"; B = C → Undefined (the
     diameter circle's coincident points). Three distinct collinear points are not
     degenerate: the feet are then C and B, and the map swaps B and C.
   - Symmetry: B ↔ C, 'value' (the diameter circle's centre and radius and the power do not
     depend on the order; checked exactly by construction-key.test.ts's sample).
2. **sqrt_bc2(A, B, C) = compose(reflect(bisector(B, A, C)), inversion(A, AB·AC/2))**, built
   exactly as sqrt_bc (the same parts: reflect, bisector, dist, mul, div, inversion, compose).
   With A at 0 it is z ↦ bc/(2z). It maps B to the midpoint of AC and C to the midpoint of AB
   (the reflection takes ray AB to ray AC, and (AB·AC/2)/AB = AC/2), the circumcircle to the
   midline through them, and it is an involution (a reflection in a line through A commutes
   with an inversion centred at A).
   - Radical, like sqrt_bc (the bisector and the distances need square roots): exact over Q
     when AB and AC are rational (the Heronian theorem mode), Inexact otherwise.
   - Degenerate: A = B or A = C → Undefined (the bisector's coincident points). Collinear
     A, B, C are still defined, as for sqrt_bc.
   - Symmetry: B ↔ C, 'value' (bisector(B, A, C) and bisector(C, A, B) are the same line,
     AB·AC is symmetric; checked by construction-key.test.ts's sample).
3. **Static kinds and samplers**: both output ['transform', 'mobius'] (ADR-0032 decision 13);
   neither has a number argument, so the claims frame needs nothing new (decision 14).
4. **Export**: 'numeric' (ADR-0032 decision 15).
5. **GUI** (data, ADR-0032 decision 16): "Feet inversion" (vertex A, then B and C) on `o`,
   and "√(bc/2) inversion" (A, then B and C) on `,`, both in the Transform group next to
   √(bc) inversion. Every Shift letter is taken (⇧D by ADR-0033); `o` was the last free
   letter and `,` is a free plain key; the editor test still checks that no key is bound
   twice.
6. **Tests**: degenerate cases (helpers/degenerate-mobius.ts), each preset equal to its
   composition in every field (mobius-kinds.test.ts), theorem tests (theorems-inversion.test.ts:
   feet_inversion over floats and exactly; sqrt_bc2 over floats and Heronian figures), property
   tests (helpers/mobius-properties.ts), L3 (the registry oracle and l3-mobius.test.ts's maps),
   the GUI tools (packages/editor/test/inversion-tools.test.ts).

## Consequences

- All six presets of the Run 14 brief exist; ADR-0032 decision 4's "not built" bullet now
  points here.
- docs/tools.md and docs/language.md list both tools; the help lists the two keys.

## Alternatives considered

- **feet_inversion from a dot-product tool**: there is no such registry tool, and the power of
  A with respect to the circle on diameter BC is the same number from tools that exist.
- **feet_inversion with its own zero test only through inversion's** ("the power k is 0"): a
  correct but less helpful reason; the brief asks for a reason that names the right angle.
- **Leaving the new GUI entries without keys**: every GUI tool has a key in the keymap; making
  keys optional would change editor logic (ADR-0032 forbids that without an ADR of its own).
