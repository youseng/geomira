# ADR-0054: Kernel mutation survivors: behaviour tests, three no-op branches removed, the rest listed

Status: accepted (maintainer request "usability", item 10). Changes no rule of SPEC (§17 L15
keeps its gates); it records the source lines removed as no-ops, one bug fixed on the way, and
the surviving mutants that are equivalent or guards. No frozen test changes.

## Context

The nightly on main after Run 16c (run 40897490665 on 9ade9a3, the same code this item starts
from; the Run 16c STATUS quotes the run before it, 40878931952 on 758b5c4) scored the kernel at
89.49 % (3771 detected, 443 undetected; Run 16c's STATUS: 88.56 %), kernel-j at 75.92 % (105
undetected, all in `conic-pencil.ts`), kernel-b at 78.63 % (97). The maintainer asks for the
kernel at 93 % or more: survivors killed by behaviour tests; fallback branches that a test shows
are no-ops removed; the rest listed.

The survivors were read from the shards' JSON reports (the run's `mutation-report-kernel-*`
artifacts), each mutant counted only in its own shard (`scripts/mutation-shards.ts`,
`inScope`). The largest clusters: `conic-pencil.ts` 105, `tools/conic-conic.ts` 74,
`tools/conic-pairs.ts` 32, `transform/proj-lines.ts` 31, `conic.ts` 26, `transform/proj-apply.ts`
25, `transform/proj-side.ts` 15, `conic-glider.ts` 14, `tools/foci.ts` 14, `tools/pairs.ts` 12.

## Decision

1. **Behaviour tests, in new files** (packages/kernel/test, each well under a second):
   `conic-pencil-edges-behaviour`, `conic-conic-behaviour`, `conic-pairs-edges-behaviour`,
   `proj-edges-behaviour`, `conic-core-behaviour`, `arcs-rays-behaviour`, `map-edges-behaviour`,
   `tool-edges-behaviour`. They assert observable results on constructed inputs: band edges
   (a root in the last sampling step of the pencil, the fourth point of a near four-point
   contact within ∛EPS·scale, a direction within the band of the sent line, a point within the
   band of another), degenerate inputs (hand-built invalid curves, an affine map with m₃₃ < 0 or
   scaled by 10⁻¹², polygons on the sent line), exact reasons (each refusal by its words), the
   Newton polish (quadratic convergence, a step that does not lower the gap, parallel
   gradients), and orders and flags (points by x then y, chirality parity of the harmonic line,
   the toggled flag of a pole at infinity).

2. **Three no-op branches removed**, each shown by a test to change no output:
   - `tools/conic-conic.ts`, the pair's `ranged` flag. select.ts reads `Pair.ranged` only in
     `bySquareRoots`, after it has returned for a four-candidate shape (a selector is needed
     whatever the count, ADR-0043), and `candidateValues` never reads it. Test: conic ∩ arc
     without a selector asks for one, in either order, floats and Q
     (`conic-conic-behaviour.test.ts`, "an arc does not change the selector rule").
   - `tools/conic-conic.ts`, `vertexNear`'s check that the centre is finite. When it is not (a
     parabola: w = ac − b² = 0), Q(C) is not finite either (d·Cx with Cx infinite or NaN), so t is
     not finite and the loop skips both eigen-directions: the function returns undefined, as the
     check did. Test: an anchorless parabola and circle far from the origin, both orders
     ("a parabola (no centre, no vertex there) and a circle").
   - `transform/proj-side.ts`, `directionSide`'s affine shortcut. An affine map has m₃₁ = m₃₂ = 0
     exactly, so W(d) = 0 exactly, the norm is 0, `signNormalized` falls back to the sign of 0,
     and the general path answers 'parallel' in every field (mod p: the exact zero test).
     Test: "every direction is parallel to the line an affine map sends to infinity (none)",
     floats, Q and mod p, two affine maps, three directions (`proj-edges-behaviour.test.ts`).

   Nothing is removed from `conic-pencil.ts` (other work reuses it: its edits stay minimal).

3. **A bug found and fixed** (`tools/conic-conic.ts`, failing test first, same commit): two
   conics without a known point far from the world origin, the first one a circle as a conic
   value (A a multiple of the identity: the image of an unanchored circle by a similarity).
   `vertexNear` found no eigen-direction (both candidate vectors are 0 when h = 0), so the frame
   fell back to the world origin, or halfway to it, and the pencil answered "no intersection:
   the conics do not meet" for an ellipse and a circle about (10⁵, 10⁵) at scale 4 that meet four
   times. Every direction is principal for a circle: u = (1, 0). Test: "a frame at the curves for
   conics without a known point" (both orders, at 10⁵ and 2²³).

4. **Equivalent mutants and guards kept** (each survivor not killed, by reason; the line numbers
   are those of the code after this item):
   - Unreachable `assertNever(…, 'field sign' | 'value' | 'transform' | 'arc side')` messages
     (17 in the kernel): the switch is exhaustive.
   - Equality boundaries of float thresholds (`<=` ↔ `<` at EPS, BAND, ∛EPS·scale, det > 0 vs ≥ 0,
     a cross product never 0 there): the boundary value is not reachable in floats by
     construction.
   - `conic-pencil.ts`:
     - the member's sign (`cos θ·B₁ − sin θ·B₂` is the member at −θ; the roots, the split and
       the triple test map onto each other);
     - the bisection: the BISECTIONS cap and the float-adjacency exit each end the loop with the
       same result (once the midpoint equals an end, an iteration changes nothing); an exact
       zero of φ at a midpoint or a sample is not reachable for valid curves (φ(0) = det of a
       non-degenerate conic);
     - the choice of the most isolated root (`apart`, `iso`): every real degenerate member of the
       pencil passes through all common points; a search over 3,000 random circle/ellipse pairs
       and tangency, crossing and osculation families found no case where another root changes
       the points beyond 10⁻⁹;
     - the triple-contact thresholds and the split's pivot choices (ties and band edges only);
     - `polish`: the Jacobian guard (J = 0 makes the step non-finite and the gap test stops),
       NEWTON_STEPS + 1 steps (one more step only refines), `gn ≤ g`;
     - the conjugate branch's `max` ↔ `min` of the two gaps: the vertex V of a member s·Q₁ + t·Q₂
       lies on it, so Q₁(V) = 0 ⇔ Q₂(V) = 0 (t ≠ 0 for valid curves);
     - `merged` (a merge outside a triple contact needs two candidates of different lines within
       the band; in the contacts tested the triple path replaces it), `openness` (which curve a
       line meets changes the points only by rounding), and the near-infinity checks of `onLine`
       and `finish` and the double-range check: a candidate beyond scale/BAND is caught first
       by line ∩ conic's band on the asymptotic direction; they stay as guards (no NaN or
       infinity in a value, CLAUDE.md).
   - `tools/conic-conic.ts`: `proportional`'s loop bounds (the extra index reads the `?? 0`
     fallback, a repeated pair repeats a minor); `vertexNear`'s eigen-vector arithmetic (a wrong
     vertex still lies near the curves, which is all the frame needs; the bug above is the case
     where none was found); `count()`'s value (never read for a four-candidate shape: only
     whether it is a number).
   - `tools/conic-pairs.ts`: `flip` (normalForm fixes the sign of Q at the points that have
     tangents, so in ordered fields flip is always true: shown by the orient(+) test around an
     ellipse and a hyperbola); `sign: sa === 'none' ? 'none' : sa` (both branches equal);
     `lineConicMeet`'s `double` on an empty list and its unused reason; the second
     "P lies on an asymptote" (a polar is never the asymptote itself for a point off the centre).
   - `transform/proj-lines.ts`: `atScale`'s guards (|N| is a positive finite double there),
     `containsT0`'s redundant conjuncts (`start === end` with `start ≠ 0` implies `end ≠ 0`), the
     double-range guards.
   - `transform/proj-apply.ts`: the polygon's `find`/`typeof` pair (written for type narrowing),
     the mark vertex on ℓ (the same words through `finitePosition`), the double-range guards.
   - `transform/proj-side.ts`: `positionSide`'s affine branch mod p (its callers return
     Inexact before), `directionSide`'s last line (floats never give 'none').
   - `tools/foci.ts`: `csqrt`'s choice of sign (either square root gives the same pair
     centre ± off), the unreachable "no finite focus" of a valid parabola, the exact-field
     shortcut of `isFocus` (the general path gives the same refusal).
   - `conic-glider.ts`: the drag's step bound (it converges in a few steps; 64 is a guard) and
     `conic.ts`'s mod p shortcut of `clearSign` (its callers stop at 'none' first).
   - Argument-count checks behind the registry's signatures, and `chiral` flags of internal lines
     used only for an on-line test.

## Consequences

Measured locally (a 4-core machine shared with other agents; Stryker 10 with `--testFiles`
limited to the new behaviour tests, so each mutant ran against them; a mutant the nightly's
full run on the same code already killed counts as killed; removed lines take their mutants
with them). The nightly measures the real shard scores. Before → after:

| shard             | nightly 40897490665 (before) | local (after)            |
| ----------------- | ---------------------------- | ------------------------ |
| kernel-a          | 84.89 % (427 / 76)           | 93.81 % (470 / 31)       |
| kernel-b          | 78.63 % (357 / 97)           | 85.46 % (388 / 66)       |
| kernel-c          | 95.11 % (350 / 18)           | 98.64 % (363 / 5)        |
| kernel-d          | 94.46 % (307 / 18)           | 96.62 % (314 / 11)       |
| kernel-h          | 87.42 % (667 / 96)           | 94.85 % (719 / 39)       |
| kernel-j          | 75.92 % (331 / 105)          | 81.42 % (355 / 81)       |
| kernel-k          | 91.18 % (217 / 21)           | 96.22 % (229 / 9)        |
| kernel-e, f, g, i | unchanged                    | unchanged                |
| **kernel**        | **89.49 % (3771 / 443)**     | **93.96 % (3953 / 254)** |

(detected / undetected; the kernel gate's sum over its eleven shards.) Per file, before → after:
`conic-pencil.ts` 67.08 % → 74.61 % (105 → 81 undetected); `tools/conic-conic.ts` 54.60 % →
86.08 % (74 → 22); `tools/conic-pairs.ts` 67.01 % → 78.35 % (32 → 21); `transform/proj-lines.ts`
71.03 % → 74.77 % (31 → 27); `conic.ts` 69.77 % → 93.02 % (26 → 6); `transform/proj-apply.ts`
64.79 % → 83.10 % (25 → 12); `transform/proj-side.ts` 71.15 % → 88.24 % (15 → 6);
`conic-glider.ts` 51.72 % → 86.21 % (14 → 4, then one more by the last drag test); `tools/foci.ts`
90.34 % → 93.79 % (14 → 9); `tools/pairs.ts` 90.00 % → 99.17 % (12 → 1);
`transform/apply-map.ts` 63.33 % → 83.33 % (11 → 5); `transform/mobius.ts` 74.36 % → 89.74 %
(10 → 4); `tools/harmonic.ts` 93.48 % → 97.83 %; `tools/poles.ts` 93.75 % → 98.73 %;
`tools/conic-lines.ts` 88.00 % → 100 %; `transform/projective.ts` 84.62 % → 100 %;
`tools/other.ts` 92.06 % → 96.83 %.

Checked with the whole kernel suite (Stryker 10 without `--testFiles`, the same configuration
as the nightly's, `--force`, concurrency 3, on the final code): `conic-pencil.ts` 67.08 %
(214 / 105, the same local run before the item) → 74.61 % (238 / 81), and `tools/conic-conic.ts`
→ 85.99 % (135 / 22). kernel-j holds `conic-pencil.ts` and `transforms.ts:133-265` (unchanged):
81.42 %. Its remaining 81 are the equivalents and guards of decision 4; the shard stays above the
75 % target. The kernel's 254 left: 81 in the pencil, the rest the guards and equivalents listed
above, spread over the shards.

The numbers are of this branch alone (item 1's new tools are merged elsewhere: their own tests
and mutants come with them).

Found while writing the tests and left for the maintainer (not item 10's scope; each with a
reproduction in the final report of this item):

- An angle mark under a projective map whose matrix is scaled small (for example the identity
  times 10⁻¹²) keeps its vertex but its arms collapse onto it: the arms are the derivative's
  image without the 1/W(b)² factor, so they scale with the square of the matrix's factor. Never
  normalised (ADR-0040), a composed or inverted matrix can be that small.
- Far from the world origin the pencil evaluates the curves in world coordinates: about
  (2²³, 2²³) at scale 1 the common points hold to about 10⁻²·scale only (the test states it).
- A four-point contact reports multiplicity 4 or 2 depending on the order of the curves; the
  multiplicity only decides the Newton polish and no tool shows it.

The new tests add 8 files and well under a second to the kernel suite: the shards' runtimes
are unchanged in practice (a mutant now also runs these fast tests).

## Alternatives considered

- Deleting the pencil's bisection exit or polish guard (each a pure deletion with an argument):
  rejected, the first costs up to 145 extra determinants per root on every drag frame, the second
  rests on NaN propagation through a function other tools reuse; listed instead.
- Exporting `vertexNear` or the pencil's internals to test them directly: rejected; the tests
  go through `pencilPoints`, `polish`, `conicConicPair` and `fourthPoint`, which are exported
  already.
- Lowering a threshold or weakening a frozen test: not allowed (CLAUDE.md).
