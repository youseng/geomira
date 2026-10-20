# STATUS

## Run 3b: ACCEPTED (2026-10-20)

Candidates and selectors (SPEC §7). Base check first: Run 3a was ACCEPTED (tag `run-3a` =
`main` = 8adccc9), `pnpm install && pnpm verify` was green locally on it (718 tests, add-only
compared with `run-3a`), and ci and deploy were green in CI on that commit
(https://github.com/youseng/geomira/actions/runs/39338015540,
https://github.com/youseng/geomira/actions/runs/39338015541), so there was no red base.

Every criterion holds: verify is green locally, in a clean clone (c6ac36c) and in CI (table
under "CI on GitHub"); candidates for intersect(curve, curve), tangent_point and tangent_from;
every selector of SPEC §7 with the band rules and the parse-level errors;
`isOrientationDependent`; each selector checked on 500 random figures, the mirror tests,
the band edges, law L11 for every branchable tool and other(), 13 theorems with selectors;
and the registry audited against SPEC §6.2 item by item (table below). One reading needs
the maintainer's confirmation (see "Uncertain", first item): SPEC §6.2 also lists the
transformation tools, the display marks and `text`, and the `triangle` sugar, which belong
to later runs (transformations, scene, language); they are NOT registered, because the run
prompt and CLAUDE.md forbid starting later runs' work. Every other §6.2 tool is registered,
including three that Runs 2 and 3a had missed (`ninepoint_center`, `power`, `radius`), added
here first. Kernel coverage 99.33% lines; kernel mutation score 99.17% (incremental, c6ac36c;
97.46% in the full run on 7e4c55c, whose survivors pointed at test gaps now closed).

## Done (each item → the test file that proves it)

1. **SPEC §6.2 audit: three tools that earlier runs missed** (8766c5d, before the run's own
   work): `ninepoint_center` (the midpoint of OH), `power(P, c)` = |PO|² − r² (exact),
   `radius(c)` = √r² (exact over Q exactly when r² is a rational square). Each with
   implementation, registry entry, degenerate cases, a property test, `export: 'numeric'`
   and generated docs. → `helpers/degenerate-gaps.ts` (in `degenerate.test.ts`),
   `helpers/gap-properties.ts` (in `tools.property.test.ts`), L3 (`laws/l3-oracle.test.ts`).
2. **Candidates** (SPEC §6.1, ADR-0006 items 1–9): `ToolSpec.candidates?<T>(F, args, ctx)`
   (0–2 values in a fixed order, the double point as one, Inexact entries when the roots are
   not representable); `compute<T>(F, args, ctx, selectors?)`; `Signature.branch`
   (BranchShape). intersect gains line ∩ circle (either order) and circle ∩ circle;
   `tangent_point(P, c, selectors)` and `tangent_from(P, c, selectors)` are new
   (tangent_from: the chiral tangent at the chosen touch point). The count is decided on the
   DISCRIMINANT measured as a length with the band (maintainer's note A): clearly negative →
   Undefined ("no intersection: …", "P lies inside the circle"), within the band → ONE double
   point, clearly positive → two candidates; exact over Q, an exact zero test mod p.
   Positions mid ∓ off carry structural along/orient labels. → `candidates.test.ts`,
   `helpers/degenerate-branch.ts` (in `degenerate.test.ts`: 14 new intersect cases, 6 per
   tangent tool), `helpers/branch-properties.ts` (exact over Q).
3. **Selectors exactly per SPEC §7** (`src/select.ts`): filters `same_side`,
   `opposite_side`, `on_arc(B, C, [not] A)`, `between`, `inside`, `outside`; rankers `near`,
   `far_from`, `other(P)` (P on both objects decided with the banded incidence of
   incidence.ts; the other point by Vieta / reflection without square roots, exact in every
   field and identical to the other() tool bit for bit); `along(±)` (line ∩ circle) and
   `orient(±)` (circle ∩ circle, tangent choices). Band rules: a deciding quantity within
   the band → Undefined("ambiguous: …"); zero survivors → "no … satisfies …"; two →
   "ambiguous: add a selector"; ties → Undefined; mod p any order-based decision → Inexact.
   → `selectors.predicates.test.ts`, `selectors.band.test.ts`,
   `helpers/degenerate-branch.ts`.
4. **Parse-level errors for bare indices and missing selectors** (`@geomira/kernel/selector-check`,
   ADR-0006 item 14): decided statically from the kinds an expression can have, with a hint;
   also selectors on a tool that takes none, misapplied along/orient/other, other twice.
   There is no parser yet: the language run reports these diagnostics as parse errors at
   the call's line and column. Evaluation agrees (a bare index evaluates to Undefined with
   the same message). → `selector-check.test.ts`.
5. **`isOrientationDependent(selector, line)`** per SPEC §7 (`@geomira/kernel/selector`),
   checked on the chirality flags of actual lines and against mirrored figures. →
   `selector.test.ts`, `selectors.mirror.test.ts`.
6. **Each selector returns the candidate satisfying its predicate in 500 random figures**
   (14 forms: same_side, opposite_side, on_arc, on_arc not, between, inside, outside, near,
   far_from, other, along(±), orient(±); candidates from independent formulas; one, two and
   zero survivors all occur for the filters). → `selectors.predicates.test.ts`.
7. **Mirror tests** (300 figures, no selector flipped): gliders mirrored BY POSITION and
   re-projected (asserted: t on line(A, B), −t on perp_bisector(A, B)); 3,795 equivariant
   choices are the mirror image of the original, 3,600 orientation-dependent ones (orient,
   along on perp_bisector / tangent / perp) the mirror of the other candidate; along on
   line(A, B) and line(G, E) is equivariant; Undefined results mirror too. →
   `selectors.mirror.test.ts`.
8. **Ambiguity at the band edges**: every deciding quantity (reference and candidate sides,
   on_arc, between ends, inside/outside, near/far_from ties, other(P)'s incidence, segment
   ends) at ±0.5 EPS, ±0.5, ±0.9, ±1.1, ±2 BAND (scale 100): Undefined inside the band,
   decided outside; and the discriminant's band for line ∩ circle, external and internal
   tangency of circles and tangents from a point (double point / none / two). →
   `selectors.band.test.ts`.
9. **Continuity L11** for intersect (line ∩ circle on achiral and chiral lines, circle ∩
   circle with external and internal tangency), tangent_point, tangent_from and other()
   (the tool and the selector): 476 paths through tangency, exactly tangent (integer data)
   and nearly tangent samples (±1e-12, ±EPS, ±BAND multiples): the value is the selected
   branch (never the other one), the double point within the band, Undefined beyond;
   |ΔV| ≤ 1.5·L·Δs away from tangency (38,522 steps), |ΔV| ≤ |ΔE| + h_band near it (9,350
   steps; ADR-0006 item 16); other() moves through tangency with |ΔX| ≤ 2r·Δφ (3,720
   steps). → `laws/l11-continuity.test.ts`.
10. **13 theorem tests with selectors** (≥ 10 asked), each over FloatField and, where exact,
    over Q (Heronian triangles for the side-length tools): the incenter–excenter lemma with
    other(A); the arc midpoint (other, on_arc not A, opposite_side); the antipode
    (far_from); Thales (other); equal tangents (other(B), orient); tangent–secant (along);
    chord of contact = polar and tangent_from (orient); the common chord (orient);
    intersecting chords (along); the butterfly theorem; Reim's theorem (other); tangent
    lengths s − a and s (orient); and the incircle touch point as the double point of
    intersect(line(B, C), incircle) without a selector. → `theorems-selectors.test.ts`.
    Sanity check: four deliberate bugs in pairs.ts / tangent-from.ts (orientation label,
    Vieta, the radical line, the chord of contact) failed 2, 8, 2 and 6 of them.
11. **L1 for branching tools** (the note on ADR-0002): 2,000 documents per field aimed at
    exactly and nearly tangent lines and circles, concentric and equal circles, P on /
    nearly on / inside c and at the centre, coincident points, segments and rays, degenerate,
    wrong-kind and Undefined selector references, misused selectors, bare indices: 0
    throws, 0 non-finite in Float, Rational and ModP; every listed situation reached in
    FloatField. The frozen L1 fuzzers fuzz the new tools too (registry-driven). →
    `laws/l1-branch.test.ts` (`helpers/fuzz-branch.ts`).
12. **L3 for branching tools**: the frozen L3 compares tangent_point / tangent_from (plan: P
    exactly on c) and every intersect signature; `laws/l3-branch.test.ts` compares calls
    WITH selectors on integer figures whose candidates are rational: 1,512 defined + 2,465
    Undefined agree, 23 excluded (band), 243 mod-p comparisons (other(P)). →
    `laws/l3-oracle.test.ts`, `laws/l3-branch.test.ts`.
13. Selector sanity check: five deliberate bugs in select.ts / tangent-from.ts; four failed
    10, 6, 4 and 8 tests, the fifth was equivalent (`g !== 1` where g can only be ±1).
14. ADR-0006 (branch selection); packages/kernel/README.md; docs/tools.md regenerated
    (examples with selectors, including irrational ones); the exactness table below;
    docs/test-count.txt raised from 718 to 841.
15. **Test gaps found by mutation testing, closed** (c6ac36c): the messages naming the
    object other(P) checks first, the ray in "outside the ray" and the range-end messages;
    a ray that meets a circle once needs no selector; exact tangency of circles with
    irrational radii over Q (the exact sign of D) and mod p; degenerate first arguments.
    Dead or equivalent code removed (other(P)'s data in one optional field that line ∩ line
    omits; a no-op shortcut; an unused default parameter). → `branch-gaps.test.ts`.

### Registry vs SPEC §6.2, item by item

| SPEC §6.2 item                                                                                                                               | Registry                                                                         | Run   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----- |
| `(x,y)` / `point(x,y)`                                                                                                                       | `point` (the `(x, y)` literal is language syntax)                                | 2     |
| `on(obj[, param])`                                                                                                                           | `on` (the parameterless form is desugared by the language, ADR-0004 item 9)      | 3a    |
| `param(min,max,v)`, `midpoint`, `divide(A,B,t)`                                                                                              | `param`, `midpoint`, `divide`                                                    | 2     |
| `intersect(a,b, selectors)`                                                                                                                  | `intersect`: lines (Run 2); line ∩ circle, circle ∩ circle with selectors        | 2, 3b |
| `other(a,b,P)`                                                                                                                               | `other`                                                                          | 3a    |
| `foot(P,l)`, `foot(P,A,B)`                                                                                                                   | `foot` (both signatures)                                                         | 2     |
| `center(c)`                                                                                                                                  | `center`                                                                         | 3a    |
| `circumcenter`, `orthocenter`, `centroid`                                                                                                    | `circumcenter`, `orthocenter`, `centroid`                                        | 2     |
| `ninepoint_center`                                                                                                                           | `ninepoint_center` (missed by Runs 2 and 3a)                                     | 3b    |
| `incenter`, `excenter(A,B,C)`                                                                                                                | `incenter`, `excenter`                                                           | 3a    |
| `tangent_point(P,c,selectors)`                                                                                                               | `tangent_point`                                                                  | 3b    |
| `line`, `segment`, `ray`, `parallel`, `perp`, `perp_bisector`                                                                                | the same six                                                                     | 2     |
| `bisector(A,B,C)`, `ext_bisector`                                                                                                            | `bisector`, `ext_bisector`                                                       | 3a    |
| `tangent(P,c)`                                                                                                                               | `tangent`                                                                        | 3a    |
| `tangent_from(P,c,selectors)`                                                                                                                | `tangent_from`                                                                   | 3b    |
| `polar(P,c)`, `radical_axis(c1,c2)`                                                                                                          | `polar`, `radical_axis`                                                          | 3a    |
| `circle(O,A)`, `circle(O,r)`, `circle(A,B,C)` = `circumcircle`                                                                               | `circle` (three signatures), `circumcircle`                                      | 3a    |
| `cline(A,B,C)`, `diameter_circle`, `incircle`, `excircle`, `ninepoint_circle`                                                                | the same five                                                                    | 3a    |
| `dist`, `dangle(A,B,C)`, `angle(A,B,C)`, `ratio(A,B,C,D)`, `area`                                                                            | the same five                                                                    | 2     |
| `power(P,c)`, `radius(c)`                                                                                                                    | `power`, `radius` (missed by Run 3a)                                             | 3b    |
| arithmetic and sqrt/sin/cos/tan (degrees) on numbers                                                                                         | `add`, `sub`, `mul`, `div`, `neg`; `sqrt`, `sin`, `cos`, `tan`                   | 2, 3a |
| `polygon`                                                                                                                                    | `polygon`                                                                        | 2     |
| `reflect(l)`, `reflect(P)`, `rotate(O,θ)`, `homothety(O,k)`, `translate(A,B)`, `spiral(A,B,C,D)`, `compose`, `inverse`, `apply`, image sugar | **not registered**: SPEC §8 transformations (with layers and views), a later run | later |
| `mark_angle`, `mark_right`, `mark_segment`, `text`                                                                                           | **not registered**: display values the scene (SPEC §13) defines, a later run     | later |
| `triangle A B C [type]` (sugar)                                                                                                              | **not a tool**: a language statement (SPEC §11.1), the language run              | later |
| v1.1: `spiral_center`, `isogonal`, `symmedian`, `pole`, `radical_center`, `arc`                                                              | not v1 (Run 13)                                                                  | v1.1  |

The registry holds 52 tools (`registry.test.ts` lists them); `docs/tools.md` documents
each, generated from the registry.

### Exactness of the Run 3b tools (output of `pnpm docs:exactness`, generated)

The rows of the earlier tools are unchanged (see Run 3a below). intersect gained four
examples with selectors (one with irrational candidates); branchable tools are exact
exactly where their square roots are rational, and `other(P)` is always exact.

| Tool             | Family   | Exact run (RationalField) | Exact examples | Otherwise                            |
| ---------------- | -------- | ------------------------- | -------------- | ------------------------------------ |
| intersect        | points   | can succeed               | 4/5            | inexact: √(2) is not rational        |
| ninepoint_center | points   | can succeed               | 1/1            |                                      |
| power            | measures | can succeed               | 1/1            |                                      |
| radius           | measures | can succeed               | 1/2            | inexact: √(2) is not rational        |
| tangent_point    | points   | can succeed               | 1/2            | inexact: √(275/1296) is not rational |
| tangent_from     | lines    | can succeed               | 1/2            | inexact: √(275/1296) is not rational |

## Not done

Nothing in Run 3b's scope. Not started (later runs): transformations, layers and views
(SPEC §8), claims, language (it will report the selector diagnostics as parse errors),
scene (including the display marks and `text`), editor (including the GUI selector choice of
SPEC §7, which will use `candidates`), export.

## Known bugs

None known. Found and fixed in this run, each with its test in the same commit:

- The other(P) selector computed the Vieta point with a different operation order than the
  other() tool, so the two differed in the last bit (found by L11, which compares them
  exactly). pairs.ts now uses other.ts's operations and range decision. →
  `laws/l11-continuity.test.ts` (4657487, 88543f0).

## Uncertain

- **The scope of "every SPEC §6.2 v1 tool registered".** SPEC §6.2 also lists the
  transformation tools, the display marks and `text`, and the `triangle` sugar. They are
  not registered: they belong to the transformations, scene and language runs, and the run
  prompt says "Do not touch later runs' scope". I read the criterion as every §6.2 tool of
  the runs up to 3b (all registered, the three missed ones added). If the maintainer meant
  every tool of §6.2 literally, this run is NOT ACCEPTED until those are registered.
- Tangency is decided on the discriminant measured as a LENGTH (r − h, r₁ + r₂ − d,
  d − |r₁ − r₂|, |OP| − r), not as the raw r² − h² against BAND·scale²: the raw form would
  call a line at 0.95r from the centre of a circle of radius 10⁻³·scale tangent. This keeps
  note A's point (no square root of a rounding residue decides anything): the length is
  (a² − b²)/(a + b), and over Q the sign is exact.
- At the edge of the band the selected point steps from the double point to a candidate by
  the exact half chord at gap BAND·scale (√(2·BAND·r·scale) ≈ 4.5·10⁻⁴·scale for a line and
  a circle of radius ≤ scale; larger for nearly concentric internally tangent circles,
  ADR-0006 item 16). L11 bounds it explicitly; it is the same as the motion of the exact
  candidates across the band.
- `other(P)` returns "the candidate other than P": P itself only as the double point (a
  literal "farther of the survivors" would return P when the other point was filtered out).
  other(·) twice in one call is refused.
- along(±) / orient(±) name a BRANCH (labels of the pair), not a rank among survivors: on a
  segment whose further intersection is off the segment, along(+) gives "no intersection
  satisfies along(+)", not the other point (no silent change of branch while dragging).
- `on_arc(B, C, [not] A)` is A's side of line BC (the arc BC that contains A for points of
  one circle through B and C); `between(A, B)` is strictly between the perpendiculars to AB
  at A and B (segment AB for points of line AB). Concyclicity is not checked.
- `tangent_from` is chiral (the tangent at T, direction rot90(T − O)) and its selectors
  judge the touch point T; SPEC lists tangent among the chiral lines.
- along(±) on line ∩ line (one candidate) is refused as "does not apply", so it can never
  mislead the orientation verdict (L16).
- `compute`'s selectors are its last, optional parameter (SPEC §6.1 writes them before
  ctx); ADR-0006 item 1.
- Mod p "misses", "apart" and "inside" are not decidable (no order): a non-zero
  discriminant counts two algebraic candidates, which are Inexact; an exact zero is the
  double point.
- The parse-level checks live in the kernel (`selector-check`) until the language exists;
  a call needs a selector when it can have two candidates for SOME argument kinds (cline).
- Mathematical facts used (I am confident of each): the incenter–excenter lemma; the
  bisector at A meets the circumcircle at the midpoint of arc BC not containing A, which is
  on the perpendicular bisector of BC; the antipode of A is the reflection of H in the
  midpoint of BC; Thales; equal tangent lengths and OT ⟂ PT; the power of a point (secants,
  tangents, intersecting chords); the chord of contact is the polar; the common chord is
  perpendicular to the line of centres and lies on the radical axis; the butterfly theorem
  (for both pairings of the chords' ends, by Desargues' involution theorem); Reim's theorem;
  the tangent lengths from A are s − a (incircle) and s (excircle opposite A); the touch
  points of the incircle and of the excircle opposite A on BC are symmetric about its
  midpoint.

## Changed frozen tests

No line of a file frozen at `run-3a` was modified or removed (`add-only: frozen tests
compared with run-3a, 0 violation(s)`). Lines were ADDED to these frozen files:

- `packages/kernel/test/registry.test.ts`: `'ninepoint_center'`, `'power'`, `'radius'`,
  `'tangent_point'`, `'tangent_from'` appended to the expected registry list.
- `packages/kernel/test/exports.test.ts`: two imports and the `./selector` and
  `./selector-check` surfaces.
- `packages/kernel/test/degenerate.test.ts`: two imports, `...INTERSECT_CURVE_CASES` inside
  the `intersect` entry, `...GAP_CASES` and `...TANGENT_CASES` in the table.
- `packages/kernel/test/tools.property.test.ts`: two imports and `...GAP_PROPERTIES`,
  `...BRANCH_PROPERTIES`.
- `scripts/exactness/table.test.ts`: one test for the Run 3b rows.
- Helpers (not frozen): `helpers/l3-plans.ts` (its incidence plan now also serves
  tangent_point and tangent_from: the condition `tool !== 'tangent' && tool !== 'other'`
  became a list `INCIDENCE`, plus one line that leaves half of their samples random).

## Acceptance command output

### Clean clone of c6ac36c (`pnpm install --frozen-lockfile && pnpm verify`; 7e4c55c, before the mutation gaps were closed, was green too with 837 tests)

```
$ git clone … && git checkout c6ac36c && pnpm install --frozen-lockfile   # Done in 1.1s using pnpm v10.28.0
$ pnpm verify
All matched files use Prettier code style!
✔ no dependency violations found (157 modules, 827 dependencies cruised)
ok   tolerance: 233 files scanned, 0 violation(s)
ok   file-length: 233 files scanned, 0 violation(s)
ok   test-count: 841 tests, floor 837, 0 violation(s)
ok   disabled-tests: 233 files scanned, 0 violation(s)
ok   add-only: frozen tests compared with run-3a, 0 violation(s)
ok   forbidden-words: 233 files scanned, 0 violation(s)
L3 intersect: 444 defined + 1723 Undefined agree, 202 not exact, 31 excluded (band); mod p 257
L1 branch FloatField: 2000 documents, 112976 objects (27943 branchable calls, 1034 defined without selectors: double points and lone intersections), 48767 Undefined, 92 Inexact, 0 throws, 0 non-finite; reached: the line misses the circle 265, the circles are apart 43, one circle lies inside the other 59, concentric circles 1613, P lies inside the circle 568, ambiguous: add a selector 183, satisfies 578, does not apply to 1923, may appear only once 253, bare index 1044, takes no selectors 1491, needs the point on 934, within the band of incidence 121, lies on the line 306, needs two distinct 205, is undefined 36023, coincident points 1154
L1 branch RationalField: 2000 documents, 112976 objects (27943 branchable calls, 625 defined without selectors: double points and lone intersections), 47939 Undefined, 2414 Inexact, 0 throws, 0 non-finite; reached: the line misses the circle 744, the circles are apart 130, one circle lies inside the other 205, concentric circles 1578, P lies inside the circle 683, ambiguous: add a selector 333, satisfies 325, does not apply to 1878, may appear only once 241, bare index 1025, takes no selectors 1491, needs the point on 949, within the band of incidence 0, lies on the line 167, needs two distinct 103, is undefined 35339, coincident points 1130
L1 branch ModPField: 2000 documents, 112976 objects (27943 branchable calls, 587 defined without selectors: double points and lone intersections), 43118 Undefined, 7852 Inexact, 0 throws, 0 non-finite; reached: the line misses the circle 0, the circles are apart 0, one circle lies inside the other 0, concentric circles 1569, P lies inside the circle 456, ambiguous: add a selector 596, satisfies 0, does not apply to 1866, may appear only once 234, bare index 1016, takes no selectors 1491, needs the point on 1164, within the band of incidence 0, lies on the line 0, needs two distinct 76, is undefined 32443, coincident points 1120
L3 ninepoint_center: 2137 defined + 234 Undefined agree, 0 not exact, 29 excluded (band); mod p 2137
L3 power: 2100 defined + 284 Undefined agree, 0 not exact, 16 excluded (band); mod p 2100
L3 radius: 588 defined + 314 Undefined agree, 1487 not exact, 11 excluded (band); mod p 0
L3 tangent_point: 1201 defined + 1191 Undefined agree, 0 not exact, 8 excluded (band); mod p 1202
L3 tangent_from: 1218 defined + 1173 Undefined agree, 0 not exact, 9 excluded (band); mod p 1222
L11 branch: 476 paths through tangency, 38522 steps with |ΔV| ≤ 1.5·L·Δs, 9350 near-tangency steps with |ΔV| ≤ |ΔE| + h_band
L11 other(): 3720 steps through tangency, |ΔX| ≤ 2r·Δφ, no Undefined
theorem (float) the incenter–excenter lemma with other(A): 199 hold, 0 degenerate, 1 ill-conditioned
theorem (heronian) the incenter–excenter lemma with other(A): 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) the arc midpoint: 199 hold, 0 degenerate, 1 ill-conditioned
theorem (heronian) the arc midpoint: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) the antipode intersect(line(A, O), Γ, far_from(A)) = 2O −: 199 hold, 0 degenerate, 1 ill-conditioned
theorem (rational) the antipode intersect(line(A, O), Γ, far_from(A)) = 2O −: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) Thales: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (rational) Thales: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) equal tangents: 199 hold, 0 degenerate, 1 ill-conditioned
theorem (rational) equal tangents: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) tangent–secant: 199 hold, 0 degenerate, 1 ill-conditioned
theorem (float) the chord of contact is the polar; tangent_from(P, c, orient: 199 hold, 0 degenerate, 1 ill-conditioned
theorem (rational) the chord of contact is the polar; tangent_from(P, c, orient: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) the common chord (orient(±)) is perpendicular to the line o: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (rational) the common chord (orient(±)) is perpendicular to the line o: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) intersecting chords: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) the butterfly theorem: 199 hold, 0 degenerate, 1 ill-conditioned
theorem (float) Reim's theorem: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (rational) Reim's theorem: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) tangent lengths from A: 199 hold, 0 degenerate, 1 ill-conditioned
selector same_side: 396 one survivor, 72 two, 32 none; 0 draws not decisive
theorem (heronian) tangent lengths from A: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) intersect(line(B, C), incircle) with no selector is the doub: 200 hold, 0 degenerate, 0 ill-conditioned
selector opposite_side: 370 one survivor, 40 two, 90 none; 0 draws not decisive
theorem (heronian) intersect(line(B, C), incircle) with no selector is the doub: 200 hold, 0 degenerate, 0 ill-conditioned
selector on_arc: 192 one survivor, 226 two, 82 none; 0 draws not decisive
selector on_arc not: 177 one survivor, 82 two, 241 none; 0 draws not decisive
selector between: 359 one survivor, 69 two, 72 none; 0 draws not decisive
selector inside: 316 one survivor, 15 two, 169 none; 0 draws not decisive
selector outside: 329 one survivor, 151 two, 20 none; 0 draws not decisive
selector near: 500 one survivor, 0 two, 0 none; 0 draws not decisive
selector far_from: 500 one survivor, 0 two, 0 none; 0 draws not decisive
selector other: 500 one survivor, 0 two, 0 none; 0 draws not decisive
selector along(+): 500 one survivor, 0 two, 0 none; 0 draws not decisive
selector along(-): 500 one survivor, 0 two, 0 none; 0 draws not decisive
selector orient(+): 500 one survivor, 0 two, 0 none; 0 draws not decisive
selector orient(-): 500 one survivor, 0 two, 0 none; 0 draws not decisive
mirror: 3795 equivariant and 3600 orientation-dependent choices mirrored, 405 Undefined agree, 600 gliders re-projected
L3 branch: 1512 defined + 2465 Undefined agree, 0 not exact, 23 excluded (band); mod p 243; defined per shape/selector: {"near":174,"other":482,"cl":341,"between":145,"orient":312,"tangent_point":249,"inside":79,"cc":332,"far_from":159,"tangent_from":238,"along":215,"same_side":113,"lc":352,"on_arc":171,"outside":71,"opposite_side":55}
 Test Files  74 passed (74)
      Tests  841 passed (841)
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
Statements   : 99.33% ( 2245/2260 )
Branches     : 98.11% ( 1771/1805 )
Lines        : 99.56% ( 1834/1842 )
verify exit=0
```

"selector …" lines: the predicate test (decisive figures with one, two and no survivors).
"L3 branch": "defined per shape/selector" counts the defined exact comparisons in which each
shape or selector took part.

### Mutation testing of kernel geometry (`pnpm mutation:kernel`, local)

Full run on 7e4c55c (no incremental file existed locally), 48 minutes:

```
File                 |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
All files            |  97.46 |   97.70 |     1188 |         0 |         28 |        3 |     1703 |
  intersect.ts       |  97.65 |   97.65 |       83 |         0 |          2 |        0 |      113 |
  pairs.ts           |  79.57 |   79.57 |       74 |         0 |         19 |        0 |      132 |
  range.ts           |  91.67 |   95.65 |       22 |         0 |          1 |        1 |       29 |
  tangent-from.ts    |  98.48 |   98.48 |       65 |         0 |          1 |        0 |       94 |
  circle-measures.ts | 100.00 |  100.00 |       43 |         0 |          0 |        0 |       46 |
```

The survivors of the new code were test gaps (Done, item 15) and dead code, closed in
c6ac36c. Incremental run on c6ac36c (2,579 of 2,909 results reused, 2 minutes 33 seconds):

```
File                 |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
All files            |  99.17 |   99.34 |     1197 |         0 |          8 |        2 |     1702 |
 tools               |  99.25 |   99.42 |     1190 |         0 |          7 |        2 |     1668 |
  args.ts            |  95.45 |   95.45 |       21 |         0 |          1 |        0 |       50 |
  arithmetic.ts      | 100.00 |  100.00 |       43 |         0 |          0 |        0 |       62 |
  circle-measures.ts | 100.00 |  100.00 |       43 |         0 |          0 |        0 |       46 |
  circles.ts         |  99.28 |   99.28 |      138 |         0 |          1 |        0 |      179 |
  display.ts         | 100.00 |  100.00 |       32 |         0 |          0 |        0 |       25 |
  functions.ts       |  98.21 |  100.00 |       55 |         0 |          0 |        1 |       80 |
  incircle.ts        | 100.00 |  100.00 |       86 |         0 |          0 |        0 |      129 |
  index.ts           | 100.00 |  100.00 |        1 |         0 |          0 |        0 |        0 |
  intersect.ts       | 100.00 |  100.00 |       85 |         0 |          0 |        0 |      113 |
  lines.ts           | 100.00 |  100.00 |       78 |         0 |          0 |        0 |      109 |
  measures.ts        |  99.01 |  100.00 |      100 |         0 |          0 |        1 |      160 |
  on.ts              | 100.00 |  100.00 |       47 |         0 |          0 |        0 |       65 |
  other.ts           | 100.00 |  100.00 |       49 |         0 |          0 |        0 |       74 |
  pairs.ts           |  98.80 |   98.80 |       82 |         0 |          1 |        0 |      130 |
  points.ts          |  98.37 |   98.37 |      121 |         0 |          2 |        0 |      159 |
  range.ts           |  95.65 |   95.65 |       22 |         0 |          1 |        0 |       29 |
  tangent-from.ts    |  98.46 |   98.46 |       64 |         0 |          1 |        0 |       95 |
  tangents.ts        | 100.00 |  100.00 |       70 |         0 |          0 |        0 |       81 |
  triangle.ts        | 100.00 |  100.00 |       53 |         0 |          0 |        0 |       82 |
 geom.ts             |  87.50 |   87.50 |        7 |         0 |          1 |        0 |       34 |
```

99.17% on c6ac36c (informational until v1.1, SPEC §17 L15). The 8 survivors are
equivalent: Run 2's and 3a's five (geom.ts `abs`'s `case -1`, `pointsOf`'s length check,
`param`'s range mod p, the flag of `foot`'s internal line, circles.ts `centreRadius`'s
`s === 'none'`), and three new ones: one operand of `ranged: l.lo !== null || l.hi !==
null` and of rangeName's `l.lo !== null && l.hi !== null` (a v1 line-like value has
`lo === null` only when `hi === null` too), and the chirality flag of the polar line that
tangent-from.ts builds only to test incidence (no result carries it). The 2 NoCoverage
mutants are the messages of unreachable `assertNever` calls (measures.ts, functions.ts).
Stryker ran in a clean clone, so this working tree was never touched during a run.

### CI on GitHub

| Workflow | Run                                                         | Result                                                                                        |
| -------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| ci       | https://github.com/youseng/geomira/actions/runs/39350515735 | success on c6ac36c (push, the last code commit: the mutation gaps): verify, build, Playwright |
| ci       | https://github.com/youseng/geomira/actions/runs/39350519800 | success on c6ac36c (pull_request, PR #6)                                                      |
| deploy   | https://github.com/youseng/geomira/actions/runs/39350515739 | success on c6ac36c (build job; deploy job skipped off the default branch)                     |
| ci       | https://github.com/youseng/geomira/actions/runs/39345792268 | success on bcf0592 (push, the interim STATUS commit)                                          |
| ci       | https://github.com/youseng/geomira/actions/runs/39345799018 | success on bcf0592 (pull_request, PR #6)                                                      |
| ci       | https://github.com/youseng/geomira/actions/runs/39345650020 | cancelled on 7e4c55c (pull_request; superseded by the push of bcf0592)                        |
| ci       | https://github.com/youseng/geomira/actions/runs/39345215160 | success on 7e4c55c (push, before the mutation gaps): verify, build, Playwright                |
| deploy   | https://github.com/youseng/geomira/actions/runs/39345215246 | success on 7e4c55c (build job; deploy job skipped off the default branch)                     |
| ci       | https://github.com/youseng/geomira/actions/runs/39344486107 | success on 482aea7 (push: the theorems)                                                       |
| ci       | https://github.com/youseng/geomira/actions/runs/39344064779 | success on 0a2b26a (push: laws L1 and L3 for branch selection)                                |
| ci       | https://github.com/youseng/geomira/actions/runs/39343627159 | success on 4657487 (push: predicates, mirror, band edges, L11)                                |
| ci       | https://github.com/youseng/geomira/actions/runs/39342405306 | success on 4fb7c83 (push: candidates and selectors)                                           |
| ci       | https://github.com/youseng/geomira/actions/runs/39345173909 | cancelled on 88543f0 (push; superseded by the push of 7e4c55c)                                |

## Requests

- None. No dependency was added.
- The `run-3b` tag is for the maintainer to place on the merge of this run's PR.
- Please confirm the reading of "every SPEC §6.2 v1 tool registered" ("Uncertain", first
  item).

## Notes for later runs

- The language run: report `callDiagnostics` / `selectorDiagnostics` as parse errors;
  `on(obj)` without a parameter is still to be desugared (ADR-0004 item 9).
- The editor's GUI choice (SPEC §7) uses `ToolSpec.candidates` and tries the selectors in
  the order SPEC §7 lists, preferring other(P).
- The claims run: `isOrientationDependent` (L16) and the selector kinds of a closure (L17:
  any filter, ranker other than other(P), along or orient is sign-based).
- A new branchable tool adds a Pair (tools/pairs.ts) and a BranchShape on its overloads.

---

## Run 3a: ACCEPTED (2026-10-19; completed the same day, see "Completion")

### Completion: sqrt, sin, cos, tan (ADR-0005)

The first acceptance of Run 3a missed one item of its prompt: SPEC §6.2 lists sqrt/sin/cos/tan
(degrees) on numbers, and only `+ − × ÷` and negation existed. "Not done" below wrongly said
"Nothing in Run 3a's scope". This completion adds the four tools (Done, items 12–13). Base
check first: `pnpm install && pnpm verify` was green on `main` = f57d247 (681 tests), so there
was no red base. Verify was green locally, in a clean clone and in CI on f873e55 (ci
https://github.com/youseng/geomira/actions/runs/39270898956, deploy
https://github.com/youseng/geomira/actions/runs/39270898955). On review the maintainer chose
the continuous sqrt (ADR-0005, "Revision"; 382985f): verify is green locally and in a clean
clone on 382985f, and CI is green on 382985f (pull_request run) and c5ddc46 (table below). Kernel coverage 99.72% lines; kernel mutation score 99.47%
(full run on f873e55), and 0 survivors in functions.ts after the revision (focused run). The
test-count floor is raised from 681 to 718.

### First acceptance

Circles and gliders (SPEC §4, §6.2, §6.3), no selectors. Base check first: Run 2 was
ACCEPTED (tag `run-2` = `main` = 6e10d9b), `pnpm install && pnpm verify` was green locally
on it, and ci, deploy and nightly were green in CI on that commit
(https://github.com/youseng/geomira/actions/runs/39244164101), so there was no red base to
repair.

Every criterion holds: verify green locally, in a clean clone and in CI (ci run
https://github.com/youseng/geomira/actions/runs/39258413806 on 43aa3f9, the interim
STATUS commit); every SPEC §6.3 case for the new tools is a named test; L1 (incl. 2,000
circle-degenerate documents), L3 with the band exclusion, glider round trips, cline
switching and 16 theorems pass; the exactness table below is generated. Kernel coverage
99.78% lines (gate 90%); kernel mutation score 99.21% locally and in CI (reported, gated
from v1.1).

## Done (each item → the test file that proves it)

1. **Circle values** (SPEC §4): `Circle { c, r2, arc: null, anchor? }`, every circle tool
   sets its anchor as SPEC §4 lists (circle(O, A): A; circle(A, B, C), circumcircle, cline:
   A; diameter_circle: A; ninepoint_circle: the midpoint of BC; incircle / excircle: the
   touch point on BC; circle(O, r): none). → `helpers/circle-properties*.ts` (anchors
   checked per tool), `theorems-circles-2.test.ts` (touch points on BC).
2. **Tools**, each with one `compute<T>`, registry entry, degenerate cases, a property test,
   `export: 'numeric'`, generated docs (docs/tools.md): circle (3 signatures),
   circumcircle, cline, diameter_circle, ninepoint_circle, center, on, other, tangent,
   polar, radical_axis, incenter, excenter, incircle, excircle, bisector, ext_bisector.
   → `degenerate.test.ts` (now 100 cases; the Run 3a part is in
   `helpers/degenerate-circles.ts` and `helpers/degenerate-gliders.ts`; the meta-test
   checks the table equals the registry), `tools.property.test.ts` (meta-test: every tool
   covered; Run 3a properties in `helpers/circle-properties.ts`, `-2.ts`),
   `tools-circles.direct.test.ts` (compute total on malformed circles and lines),
   `docs.test.ts`. Every SPEC §6.3 case for these tools is a named case: coincident
   defining points, collinear circumcircle (use cline), concentric circles (radical_axis,
   other), tangency → the double point (other), glider on a degenerate object, bisector /
   ext_bisector of a straight and of a zero angle.
3. **Gliders** (SPEC §6.2): `on(l, t)` clamped to the range (Inexact mod p for segments and
   rays); `on(c, u, v)` stereographic from the anchor, rational, the anchor at v = 0;
   `on(c, θ)` by angle (the form for circle(O, r)); the drag map cursor → parameter and the
   exact inverse in `@geomira/kernel/glider`. → `glider.test.ts` (round trips parameter →
   point → parameter exact over Q and mod p incl. the anchor, within rounding over floats;
   the drag map; a cursor going round the circle never makes the glider jump).
4. **cline switching circle ↔ line without NaN** → `cline.test.ts`.
5. **L3 oracle with the exclusion band** for every new tool → `laws/l3-oracle.test.ts`
   (frozen file, lines added: a circle argument and argument plans from
   `helpers/l3-plans.ts`, see "Changed frozen tests"). Counts below; every tool has ≥ 50
   exact comparisons (tangent 2400, other 2100, incircle 1053, …).
6. **L1 totality** (the Run 1 note on ADR-0002): the frozen L1 now fuzzes the new tools too,
   and `laws/l1-circles.test.ts` adds 2,000 documents built to hit circle degeneracies
   exactly and nearly (coincident points, parallel lines, concentric and tangent circles,
   P nearly on c, (0 : 0), straight angles, residuals of ±1e-17) over Float, Rational and
   ModP: 0 throws, 0 non-finite, every listed degeneracy reached. Every division and
   square root in the new computes is guarded (`degenerateCircle`, the (0 : 0) test, the
   excenter's sign check, …).
7. **16 theorems** (≥ 12 asked), each over FloatField and exactly over RationalField (the
   side-length tools on Heronian triangles) → `theorems-circles.test.ts`,
   `theorems-circles-2.test.ts`: nine-point circle through nine points; reflections of H in
   BC and in the midpoint of BC on the circumcircle; Simson line; Miquel; radical axes
   concurrent; power of a point; polar reciprocity; other() consistency (line–circle and
   circle–circle, both involutions); tangency as the double point; the radical axis through
   both common points; incenter–excenter lemma; Feuerbach (|NI| = R/2 − r and
   |NI_A| = R/2 + r_A); Euler OI² = R² − 2Rr; incircle and excircle touch the side lines;
   the excenter on one internal and two external bisectors; the angle bisector theorem.
   Sanity check: with two deliberate bugs (one coordinate of other()'s reflection, the
   excenter's weight) 19 tests failed.
8. **Chirality** of the new line tools against mirrored figures (tangent, polar,
   radical_axis, ext_bisector chiral; bisector and cline's line achiral; the straight-angle
   cases swapped) → `chirality-circles.test.ts`.
9. **Explicit radii in the scale** (SPEC §3.1) → `context-radii.test.ts`.
10. **Generated exactness table** (`pnpm docs:exactness`, below) → `scripts/exactness/table.test.ts`.
11. ADR-0004 (circles, gliders, incidence); packages/kernel/README.md; docs/test-count.txt
    raised from 517 to 681.

12. **sqrt, sin, cos, tan** (SPEC §6.2, ADR-0005), each with one `compute<T>`
    (packages/kernel/src/tools/functions.ts), a registry entry, `export: 'numeric'` and
    generated docs (docs/tools.md). The argument is classified before num is called: an
    exact argument (`Num.exact`) is decided exactly in every field, and a rational result
    keeps its exact value; otherwise the field's banded sign decides: sqrt is continuous
    (x ≥ 0 → √x as computed, −BAND < x < 0 → 0, x ≤ −BAND → Undefined("sqrt of a
    negative number")), and tan at a cosine within the band of 0 → Undefined, as at
    90° (mod 180°) →
    Undefined("tan is undefined at 90° (mod 180°)"). Over Q: sqrt is exact on squares of
    rationals and Inexact otherwise; sin/cos are exact at the angles num's tables cover;
    tan is exact at the multiples of 45° (sin 2θ / (1 + cos 2θ) from the same tables,
    where sin θ or cos θ is not rational). →
    - degenerate cases: `degenerate.test.ts` (table in `helpers/degenerate-functions.ts`:
      negatives, exact and measured; in-band arguments of both signs, on both sides of
      EPS (negatives → 0, positives → their root); just outside the band; exact arguments decided exactly; 90° exactly and within the
      band; Inexact over Q and mod p);
    - properties: `tools.property.test.ts` (`helpers/function-properties.ts`: √(area²) =
      area exactly; sin/cos/tan of a constructed right angle and 45° angle, exact over Q;
      exact values carried; sin² + cos² = 1, tan = sin / cos, sin(180° − θ) = sin θ);
    - theorems: `theorems-functions.test.ts` (Heron, exact on Heronian triangles;
      Pythagoras through the foot of an altitude; the laws of sines and cosines;
      tan A + tan B + tan C = tan A·tan B·tan C);
    - L3: `laws/l3-oracle.test.ts` (frozen; plans in `helpers/l3-plans-functions.ts`:
      exact squares and multiples of 15°, plus measured arguments without an exact value:
      area², −area², dist² on Pythagorean offsets, angles between axis and diagonal
      directions);
    - L1: the frozen `laws/l1-total.test.ts` fuzzes them (registry-driven), and
      `laws/l1-functions.test.ts` adds 2,000 documents aimed at their degeneracies over
      Float, Rational and ModP, checking the FloatField band rules call by call;
    - `functions.test.ts`: exact tables (sin/cos/tan at every multiple of 15° in
      [−720°, 720°], sqrt of n/d), and through `withSqrtLog` / `withDivisorLog` num is
      never asked for √ of a negative or a division by zero;
    - `scripts/exactness/table.test.ts`: the regenerated exactness table;
    - `sqrt-continuity.test.ts` (the revision): on seeded arguments, a grid and the
      doubles next to −BAND, 0, EPS and BAND in [−2·BAND, 10·BAND], at scales 1 and 1000,
      sqrt of a measured number is defined exactly on (−BAND, ∞), non-decreasing and
      ½-Hölder (|√⁺y − √⁺x| ≤ √|y − x|) on adjacent and 2,000 random pairs, so it never
      jumps. It fails (3/3) on the first rule, which stepped by √BAND at x = BAND.
      Sanity check: three deliberate bugs (in-band negatives Undefined, tan = cos/sin, a
      wrong double angle) failed 1–3, 25 and 6 tests; the first was caught only by L1, so
      the degenerate case gained an argument between EPS and BAND, which now catches it too.
13. **L1 fuzzer reaches parallel lines and out-of-range intersections deliberately**
    (`helpers/fuzz.ts`, lines added only). The registry-driven L1 reached "parallel lines"
    and "outside the <range>" only by chance (10 and 8 of 2,000 documents); registering
    four tools reshuffled its random calls to 2 and 2, and to 0 at the reduced law scale of
    the mutation run, whose dry run then failed. It now builds exactly parallel lines and
    segment/ray intersections outside the range (301 and 366). → `laws/l1-total.test.ts`.

### Exactness of each tool (output of `pnpm docs:exactness`, generated from the registry)

"Exact run" is discovered by running each tool's examples over RationalField. The
side-length tools (incenter, excenter, incircle, excircle, bisector, ext_bisector) are
exact exactly when the side lengths are rational (their Heronian example) and Inexact
otherwise (their generic example); that is expected (SPEC §3.4). The angle form of `on`
is Inexact except at rational special angles. sqrt, sin, cos, tan are exact exactly where
their value is rational (an exact square; sin/cos at the multiples of 30° in num's tables;
tan at the multiples of 45°). Mod p, everything needing √ or trig is Inexact, except a
rational result of an exact argument (ADR-0005 item 2).

| Tool             | Family     | Exact run (RationalField) | Exact examples | Otherwise                                                  |
| ---------------- | ---------- | ------------------------- | -------------- | ---------------------------------------------------------- |
| point            | points     | can succeed               | 1/1            |                                                            |
| param            | points     | can succeed               | 1/1            |                                                            |
| midpoint         | points     | can succeed               | 1/1            |                                                            |
| divide           | points     | can succeed               | 1/1            |                                                            |
| foot             | points     | can succeed               | 2/2            |                                                            |
| intersect        | points     | can succeed               | 1/1            |                                                            |
| circumcenter     | points     | can succeed               | 1/1            |                                                            |
| centroid         | points     | can succeed               | 1/1            |                                                            |
| orthocenter      | points     | can succeed               | 1/1            |                                                            |
| line             | lines      | can succeed               | 1/1            |                                                            |
| segment          | lines      | can succeed               | 1/1            |                                                            |
| ray              | lines      | can succeed               | 1/1            |                                                            |
| parallel         | lines      | can succeed               | 1/1            |                                                            |
| perp             | lines      | can succeed               | 1/1            |                                                            |
| perp_bisector    | lines      | can succeed               | 1/1            |                                                            |
| dist             | measures   | can succeed               | 2/2            |                                                            |
| ratio            | measures   | can succeed               | 1/1            |                                                            |
| angle            | measures   | can succeed               | 1/2            | inexact: atan2(12, 9) is not a rational number of degrees  |
| dangle           | measures   | can succeed               | 1/2            | inexact: atan2(-12, 9) is not a rational number of degrees |
| area             | measures   | can succeed               | 2/2            |                                                            |
| polygon          | display    | can succeed               | 1/1            |                                                            |
| add              | arithmetic | can succeed               | 1/1            |                                                            |
| sub              | arithmetic | can succeed               | 1/1            |                                                            |
| mul              | arithmetic | can succeed               | 1/1            |                                                            |
| div              | arithmetic | can succeed               | 1/1            |                                                            |
| neg              | arithmetic | can succeed               | 1/1            |                                                            |
| circle           | circles    | can succeed               | 3/3            |                                                            |
| circumcircle     | circles    | can succeed               | 1/1            |                                                            |
| cline            | circles    | can succeed               | 2/2            |                                                            |
| diameter_circle  | circles    | can succeed               | 1/1            |                                                            |
| ninepoint_circle | circles    | can succeed               | 1/1            |                                                            |
| center           | points     | can succeed               | 1/1            |                                                            |
| on               | points     | can succeed               | 3/4            | inexact: cos(30°) is not rational                          |
| other            | points     | can succeed               | 2/2            |                                                            |
| tangent          | lines      | can succeed               | 1/1            |                                                            |
| polar            | lines      | can succeed               | 1/1            |                                                            |
| radical_axis     | lines      | can succeed               | 1/1            |                                                            |
| incenter         | points     | can succeed               | 1/2            | inexact: √(18) is not rational                             |
| excenter         | points     | can succeed               | 1/2            | inexact: √(18) is not rational                             |
| incircle         | circles    | can succeed               | 1/2            | inexact: √(18) is not rational                             |
| excircle         | circles    | can succeed               | 1/2            | inexact: √(18) is not rational                             |
| bisector         | lines      | can succeed               | 1/2            | inexact: √(18) is not rational                             |
| ext_bisector     | lines      | can succeed               | 1/2            | inexact: √(18) is not rational                             |
| sqrt             | arithmetic | can succeed               | 1/2            | inexact: √(2) is not rational                              |
| sin              | arithmetic | can succeed               | 1/2            | inexact: sin(45°) is not rational                          |
| cos              | arithmetic | can succeed               | 1/2            | inexact: cos(45°) is not rational                          |
| tan              | arithmetic | can succeed               | 1/2            | inexact: cos(30°) is not rational                          |

## Not done

Nothing in Run 3a's scope now (the first acceptance said so while sqrt/sin/cos/tan were
missing; see "Completion"). Not started (later runs): branch selectors and branchable tools
(intersect with circles, tangent_from, tangent_point), transformations, claims, language,
scene, editor, export. `on(obj)` without a parameter is left to the language run, which
desugars it to an explicit parameter (ADR-0004 item 9).

## Known bugs

None known.

## Uncertain

- SPEC §7 says "P must lie on both objects within BAND". ADR-0004 item 1 reads it as a
  banded decision: on within EPS·scale, ambiguous (Undefined) inside the band, not on
  beyond. A gap between EPS and BAND is therefore Undefined("ambiguous"), never "on".
- `on(c, θ)` is accepted on every circle (not only circle(O, r)); `on(c, u, v)` needs an
  anchor. The angle is measured from the +x axis (SPEC fixes no reference direction).
- `circle(O, r)` with r < 0 is Undefined over ordered fields; mod p the sign is not checked
  (as `param`).
- Explicit radii count as a diameter 2·|r| combined with the free points by max; SPEC says
  only "bounding box of free points and explicit radii".
- The bisector of a straight angle is chiral and its external bisector achiral: the flags
  follow SPEC §4's rule "every 90° turn toggles the flag" applied to the actual directions.
- Float theorem tests skip and count ill-conditioned figures (at most 2 of 200 per
  theorem, all nearly flat triangles), mirroring SPEC §3.1's ILL-CONDITIONED class
  (ADR-0004 item 20); some float checks compare magnitudes relative to their size
  (far-away centres of flat triangles). Exact runs skip only degenerate draws.
- Mathematical facts used (I am confident of each): the nine-point circle passes through
  the midpoints of the sides, the feet of the altitudes and the midpoints of AH, BH, CH and
  is centred at the midpoint of OH; the reflections of H in a side and in the midpoint of
  a side lie on the circumcircle (the latter is the antipode of the opposite vertex); the
  Simson line; Miquel's theorem; the radical axes of three circles (centres not collinear)
  concur; the power of a point; polar reciprocity (La Hire); the incenter–excenter lemma;
  Feuerbach's theorem; Euler's OI² = R² − 2Rr; the angle bisector theorem; Thales; a
  triangle inscribed in a circle at points w² (|w| = 1, w rational) has rational chords
  2·|sin(φ₁ − φ₂)|·R.
- Completion (ADR-0005, revised on review): for arguments WITHOUT an exact value, sqrt is
  √max(x, 0) on (−BAND, ∞) and Undefined from −BAND down; the only discontinuity is that
  domain edge. A discriminant that is 0 up to a positive rounding residue r therefore
  gives √r (≤ √BAND ≈ 3.2·10⁻⁴), not exactly 0: branch selection (a later run) must decide
  tangency on the discriminant, not on its root. Inside the band the side of 0 is read
  from `F.toNumber`, which is x itself in FloatField (the exact fields reach that branch
  only for an exact 0).
- Completion: an argument WITH an exact value (a literal, `param`, exact arithmetic) is
  decided exactly, also in FloatField, so `sqrt(1/100000000)` is 1/10000 there, not 0. For
  tan the float run also refuses a θ whose float cosine is in the band even when the exact θ
  is not 90° (mod 180°), as `div` does with a divisor that is zero only in FloatField. A
  rational result of an exact argument is a value mod p too (`sin(30)` is 2⁻¹ mod p); the
  mod-p rung never uses closures with sqrt or trigonometry anyway (SPEC §10.5, L17).
- Completion: FloatField arguments beyond 2^200 are Inexact before any tool runs (ADR-0003
  item 19), so `sqrt(-1e200)` is Inexact in FloatField but Undefined over Q.
- Mathematical facts used in the completion (I am confident of each): Niven's theorem (for
  a rational number of degrees, sin and cos are rational only at the values 0, ±1/2, ±1,
  and tan only at 0, ±1, i.e. at the multiples of 45°); tan θ = sin 2θ / (1 + cos 2θ);
  Heron's formula; the laws of sines (a = 2R·sin A) and cosines; in a triangle without a
  right angle, tan A + tan B + tan C = tan A·tan B·tan C.

## Changed frozen tests

No line of a file frozen at `run-2` was modified or removed (`add-only: frozen tests
compared with run-2, 0 violation(s)`). Lines were ADDED to these frozen files (allowed by
the guard; recorded in ADR-0004 item 19):

- `packages/kernel/test/registry.test.ts`: the 17 new tool names appended to the expected
  registry list.
- `packages/kernel/test/exports.test.ts`: the `./glider` subpath and its import.
- `packages/kernel/test/degenerate.test.ts`: two imports and `...CIRCLE_CASES,
...GLIDER_CASES` in the table.
- `packages/kernel/test/tools.property.test.ts`: two imports and `...CIRCLE_PROPERTIES,
...CIRCLE_PROPERTIES_2` in the list.
- `packages/kernel/test/laws/l3-oracle.test.ts`: one import, a `planned` field and its use
  at the top of `arg()`, a circle argument for the `round` capability, and the call to
  `planArgs` in `sampleTool`. Without the plans L3 could not compare tangent, other or the
  incircle family (random inputs never lie on a circle; random triangles never have
  rational sides). Existing tools' samples are unchanged (the plans draw nothing for them).

Completion: again no line of a file frozen at `run-2` was modified or removed (`add-only:
frozen tests compared with run-2, 0 violation(s)`), and no line of any other existing test
file either (`git diff --numstat` shows additions only). Lines ADDED:

- `packages/kernel/test/registry.test.ts` (frozen): `'sqrt'`, `'sin'`, `'cos'`, `'tan'`
  appended to the expected registry list.
- `packages/kernel/test/degenerate.test.ts` (frozen): one import and `...FUNCTION_CASES`.
- `packages/kernel/test/tools.property.test.ts` (frozen): one import and
  `...FUNCTION_PROPERTIES`.
- `scripts/exactness/table.test.ts` (Run 3a): one test for the four tools' rows.
- The revision changed only files added by this PR (`helpers/degenerate-functions.ts`,
  `laws/l1-functions.test.ts`, `functions.test.ts`) and added `sqrt-continuity.test.ts`.
- Helpers (not frozen; additions only): `helpers/l3-plans.ts` (an import and the line
  that hands the four tools to `helpers/l3-plans-functions.ts`), `helpers/fuzz.ts`
  (`parallelPair`, `outsidePair` and the two lines calling them; Done, item 13).

## Acceptance command output

### Completion: clean clone of 382985f (`pnpm install --frozen-lockfile && pnpm verify`)

```
All matched files use Prettier code style!
✔ no dependency violations found (133 modules, 642 dependencies cruised)
ok   tolerance: 208 files scanned, 0 violation(s)
ok   file-length: 208 files scanned, 0 violation(s)
ok   test-count: 718 tests, floor 715, 0 violation(s)
ok   disabled-tests: 208 files scanned, 0 violation(s)
ok   add-only: frozen tests compared with run-2, 0 violation(s)
ok   forbidden-words: 208 files scanned, 0 violation(s)
L1 functions FloatField: 2000 documents, 86399 objects, 23142 sqrt/sin/cos/tan calls, 4194 Undefined, 746 Inexact, 0 throws, 0 non-finite; reached: negative 769, 90° 661, in-band negatives → 0 335, in-band positives → √x 286, near 90° defined 314
L2 FloatField: 1200 incremental evaluations equal to full ones
L1 functions RationalField: 2000 documents, 86399 objects, 23142 sqrt/sin/cos/tan calls, 2356 Undefined, 27460 Inexact, 0 throws, 0 non-finite; reached: negative 675, 90° 217, in-band negatives → 0 0, in-band positives → √x 0, near 90° defined 0
L2 RationalField: 1200 incremental evaluations equal to full ones
L2 ModPField: 1200 incremental evaluations equal to full ones
L1 functions ModPField: 2000 documents, 86399 objects, 23142 sqrt/sin/cos/tan calls, 1520 Undefined, 35126 Inexact, 0 throws, 0 non-finite; reached: negative 489, 90° 132, in-band negatives → 0 0, in-band positives → √x 0, near 90° defined 0
theorem (float) Heron: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (heronian) Heron: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) Pythagoras through the foot of an altitude: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) the law of sines: 199 hold, 0 degenerate, 1 ill-conditioned
invariants: 3161 edits applied, 1639 refused, all valid
theorem (float) the law of cosines: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) tan A + tan B + tan C = tan A·tan B·tan C (no right angle): 200 hold, 0 degenerate, 0 ill-conditioned
L3 sqrt: 756 defined + 991 Undefined agree, 653 not exact, 0 excluded (band); mod p 208
L3 sin: 633 defined + 0 Undefined agree, 1767 not exact, 0 excluded (band); mod p 138
L3 cos: 634 defined + 0 Undefined agree, 1766 not exact, 0 excluded (band); mod p 136
L3 tan: 636 defined + 222 Undefined agree, 1542 not exact, 0 excluded (band); mod p 118
L1 FloatField: 2000 documents, 57692 objects, 26570 Undefined, 491 Inexact, 0 throws, 0 non-finite; reached: parallel lines 301, coincident lines 342, coincident points 5834, collinear points 125, ambiguous 77, division by zero 113, outside the 366
L1 circles FloatField: 2000 documents, 65393 objects, 32850 Undefined, 1576 Inexact, 0 throws, 0 non-finite; reached: coincident points 3718, collinear points 17, parallel lines 456, concentric circles 381, needs P on 284, ambiguous 100, no anchor 21, (0 : 0) 181, radius 670, polar is the line at infinity 221, no other intersection 27, is undefined 21743
L1 RationalField: 2000 documents, 57692 objects, 21025 Undefined, 10829 Inexact, 0 throws, 0 non-finite; reached: parallel lines 364, coincident lines 271, coincident points 4141, collinear points 110, ambiguous 0, division by zero 43, outside the 417
L1 ModPField: 2000 documents, 57692 objects, 18775 Undefined, 14523 Inexact, 0 throws, 0 non-finite; reached: parallel lines 354, coincident lines 264, coincident points 4008, collinear points 100, ambiguous 0, division by zero 24, outside the 0
L1 circles RationalField: 2000 documents, 65393 objects, 29245 Undefined, 5365 Inexact, 0 throws, 0 non-finite; reached: coincident points 2625, collinear points 58, parallel lines 628, concentric circles 546, needs P on 437, ambiguous 0, no anchor 69, (0 : 0) 5, radius 194, polar is the line at infinity 305, no other intersection 33, is undefined 19231
L1 circles ModPField: 2000 documents, 65393 objects, 28528 Undefined, 6374 Inexact, 0 throws, 0 non-finite; reached: coincident points 2608, collinear points 57, parallel lines 615, concentric circles 571, needs P on 463, ambiguous 0, no anchor 133, (0 : 0) 5, radius 23, polar is the line at infinity 315, no other intersection 0, is undefined 18865
 Test Files  63 passed (63)
      Tests  718 passed (718)
 kernel/src        |   99.63 |    98.33 |     100 |   99.68 |
 kernel/src/tools  |   99.27 |    98.46 |     100 |   99.56 |
  functions.ts     |   98.41 |    96.29 |     100 |      98 | 80
Statements   : 99.6% ( 1750/1757 )
Branches     : 98.68% ( 1354/1372 )
Lines        : 99.72% ( 1436/1440 )
verify exit=0
```

L3 for the new tools compares exact literals and measured arguments (plans above); "not
exact" counts the samples whose exact run is Inexact (√ of a non-square, trig off the
special angles). The 0 band exclusions mean no planned measured argument fell inside the
band; the band rules themselves are checked call by call by L1 functions.

### Completion: mutation testing of kernel geometry (`pnpm mutation:kernel`, local, full run on f873e55)

```
File            |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
All files       |  99.47 |   99.68 |      935 |         2 |          3 |        2 |     1327 |
 tools          |  99.46 |   99.68 |      928 |         1 |          3 |        2 |     1293 |
  args.ts       | 100.00 |  100.00 |       22 |         0 |          0 |        0 |       50 |
  arithmetic.ts | 100.00 |  100.00 |       43 |         0 |          0 |        0 |       62 |
  circles.ts    |  99.17 |   99.17 |      120 |         0 |          1 |        0 |      161 |
  display.ts    | 100.00 |  100.00 |       32 |         0 |          0 |        0 |       25 |
  functions.ts  |  98.11 |  100.00 |       52 |         0 |          0 |        1 |       79 |
  incircle.ts   | 100.00 |  100.00 |       86 |         0 |          0 |        0 |      129 |
  index.ts      | 100.00 |  100.00 |        1 |         0 |          0 |        0 |        0 |
  intersect.ts  | 100.00 |  100.00 |       54 |         1 |          0 |        0 |       57 |
  lines.ts      | 100.00 |  100.00 |       78 |         0 |          0 |        0 |      109 |
  measures.ts   |  99.01 |  100.00 |      100 |         0 |          0 |        1 |      160 |
  on.ts         | 100.00 |  100.00 |       47 |         0 |          0 |        0 |       65 |
  other.ts      | 100.00 |  100.00 |       49 |         0 |          0 |        0 |       74 |
  points.ts     |  98.37 |   98.37 |      121 |         0 |          2 |        0 |      159 |
  tangents.ts   | 100.00 |  100.00 |       70 |         0 |          0 |        0 |       81 |
  triangle.ts   | 100.00 |  100.00 |       53 |         0 |          0 |        0 |       82 |
 geom.ts        | 100.00 |  100.00 |        7 |         1 |          0 |        0 |       34 |
```

99.47% (was 99.21%). functions.ts: 52 killed, 0 survived; its one NoCoverage mutant is the
message of the unreachable `assertNever` in sqrt's exhaustive switch (measures.ts has the
same one). The 3 survivors are Run 3a's and Run 2's documented equivalent mutants
(circles.ts `centreRadius` `s === 'none'`, points.ts `param`'s range mod p, the flag of
`foot`'s internal line). The first attempt's dry run failed (L1 at the reduced law scale
no longer reached "parallel lines"), which led to Done, item 13.

### Completion, revision: mutation testing of functions.ts (`stryker run stryker.kernel.json --mutate packages/kernel/src/tools/functions.ts`, local)

```
File          |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
All files     |  98.21 |  100.00 |       55 |         0 |          0 |        1 |       80 |
 functions.ts |  98.21 |  100.00 |       55 |         0 |          0 |        1 |       80 |
```

The first focused run had 1 survivor: removing sqrt's `case 'none'` let mod p fall
through to the in-band branch, which a positive representative could not tell apart; a
case with a negative symmetric representative (functions.test.ts) kills it. The
NoCoverage mutant is the unreachable `assertNever` message.

### First acceptance: clean clone (commit 629034c; the STATUS commit adds only docs)

```
$ git clone … && pnpm install --frozen-lockfile        # Done in 1.6s using pnpm v10.28.0
$ pnpm verify
All matched files use Prettier code style!
✔ no dependency violations found (124 modules, 576 dependencies cruised)
ok   tolerance: 198 files scanned, 0 violation(s)
ok   file-length: 198 files scanned, 0 violation(s)
ok   test-count: 681 tests, floor 681, 0 violation(s)
ok   disabled-tests: 198 files scanned, 0 violation(s)
ok   add-only: frozen tests compared with run-2, 0 violation(s)
ok   forbidden-words: 198 files scanned, 0 violation(s)
L3 point: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 param: 402 defined + 1998 Undefined agree, 0 not exact, 0 excluded (band); mod p 402
L3 midpoint: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
theorem (float) other() consistency: 198 hold, 0 degenerate, 2 ill-conditioned
L3 divide: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
theorem (rational) other() consistency: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) tangency: 198 hold, 0 degenerate, 2 ill-conditioned
theorem (rational) tangency: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) the radical axis of two intersecting circles passes through both common points: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (rational) the radical axis of two intersecting circles passes through both common points: 200 hold, 0 degenerate, 0 ill-conditioned
L3 foot: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
theorem (float) incenter–excenter lemma: 199 hold, 0 degenerate, 1 ill-conditioned
theorem (heronian) incenter–excenter lemma: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) Feuerbach: 198 hold, 0 degenerate, 2 ill-conditioned
theorem (heronian) Feuerbach: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) Euler: 198 hold, 0 degenerate, 2 ill-conditioned
theorem (heronian) Euler: 200 hold, 0 degenerate, 0 ill-conditioned
L3 intersect: 1577 defined + 792 Undefined agree, 0 not exact, 31 excluded (band); mod p 968
theorem (float) the incircle and the excircle opposite A touch the three side lines, at their anchors on BC: 199 hold, 0 degenerate, 1 ill-conditioned
theorem (heronian) the incircle and the excircle opposite A touch the three side lines, at their anchors on BC: 200 hold, 0 degenerate, 0 ill-conditioned
L3 circumcenter: 2155 defined + 221 Undefined agree, 0 not exact, 24 excluded (band); mod p 2155
theorem (float) the excenter opposite A lies on the internal bisector at A and the external bisectors at B and C: 199 hold, 0 degenerate, 1 ill-conditioned
theorem (heronian) the excenter opposite A lies on the internal bisector at A and the external bisectors at B and C: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) the angle bisector theorem: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (heronian) the angle bisector theorem: 200 hold, 0 degenerate, 0 ill-conditioned
L3 centroid: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 orthocenter: 2140 defined + 225 Undefined agree, 0 not exact, 35 excluded (band); mod p 2140
L3 line: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 segment: 2397 defined + 3 Undefined agree, 0 not exact, 0 excluded (band); mod p 2397
L3 ray: 2398 defined + 2 Undefined agree, 0 not exact, 0 excluded (band); mod p 2398
L3 parallel: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L2 FloatField: 1200 incremental evaluations equal to full ones
L3 perp: 2399 defined + 1 Undefined agree, 0 not exact, 0 excluded (band); mod p 2399
L3 perp_bisector: 2399 defined + 1 Undefined agree, 0 not exact, 0 excluded (band); mod p 2399
L3 dist: 922 defined + 1 Undefined agree, 1477 not exact, 0 excluded (band); mod p 0
L3 ratio: 665 defined + 3 Undefined agree, 1732 not exact, 0 excluded (band); mod p 0
L2 RationalField: 1200 incremental evaluations equal to full ones
L3 angle: 403 defined + 7 Undefined agree, 1953 not exact, 37 excluded (band); mod p 0
L2 ModPField: 1200 incremental evaluations equal to full ones
L3 dangle: 397 defined + 3 Undefined agree, 1963 not exact, 37 excluded (band); mod p 0
L3 area: 2387 defined + 4 Undefined agree, 0 not exact, 9 excluded (band); mod p 0
theorem (float) the nine-point circle passes through the midpoints, the feet of the altitudes and the midpoints of AH, BH, CH: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (rational) the nine-point circle passes through the midpoints, the feet of the altitudes and the midpoints of AH, BH, CH: 200 hold, 0 degenerate, 0 ill-conditioned
L3 polygon: 2387 defined + 13 Undefined agree, 0 not exact, 0 excluded (band); mod p 2387
L3 add: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
theorem (float) the reflections of H in BC and in the midpoint of BC lie on the circumcircle (the latter opposite A): 200 hold, 0 degenerate, 0 ill-conditioned
theorem (rational) the reflections of H in BC and in the midpoint of BC lie on the circumcircle (the latter opposite A): 200 hold, 0 degenerate, 0 ill-conditioned
L3 sub: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
theorem (float) Simson: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (rational) Simson: 200 hold, 0 degenerate, 0 ill-conditioned
L3 mul: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
theorem (float) Miquel: 200 hold, 0 degenerate, 0 ill-conditioned
L3 div: 2335 defined + 65 Undefined agree, 0 not exact, 0 excluded (band); mod p 2335
theorem (rational) Miquel: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) the three radical axes of three circles are concurrent: 200 hold, 0 degenerate, 0 ill-conditioned
L3 neg: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
theorem (rational) the three radical axes of three circles are concurrent: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (float) the power of a point: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (rational) the power of a point: 200 hold, 0 degenerate, 0 ill-conditioned
L3 circle: 1909 defined + 480 Undefined agree, 0 not exact, 11 excluded (band); mod p 1909
theorem (float) polar reciprocity: 200 hold, 0 degenerate, 0 ill-conditioned
theorem (rational) polar reciprocity: 200 hold, 0 degenerate, 0 ill-conditioned
L3 circumcircle: 2164 defined + 211 Undefined agree, 0 not exact, 25 excluded (band); mod p 2164
L3 cline: 2360 defined + 12 Undefined agree, 0 not exact, 28 excluded (band); mod p 2388
invariants: 3171 edits applied, 1629 refused, all valid
L3 diameter_circle: 2397 defined + 3 Undefined agree, 0 not exact, 0 excluded (band); mod p 2397
L3 ninepoint_circle: 2130 defined + 248 Undefined agree, 0 not exact, 22 excluded (band); mod p 2130
L3 center: 2063 defined + 317 Undefined agree, 0 not exact, 20 excluded (band); mod p 2063
L3 on: 1434 defined + 255 Undefined agree, 694 not exact, 17 excluded (band); mod p 1149
L3 other: 2100 defined + 300 Undefined agree, 0 not exact, 0 excluded (band); mod p 1673
L3 tangent: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L1 FloatField: 2000 documents, 52801 objects, 24142 Undefined, 340 Inexact, 0 throws, 0 non-finite; reached: parallel lines 10, coincident lines 154, coincident points 6243, collinear points 161, ambiguous 64, division by zero 117, outside the 8
L3 polar: 2104 defined + 287 Undefined agree, 0 not exact, 9 excluded (band); mod p 2104
L1 circles FloatField: 2000 documents, 65371 objects, 33394 Undefined, 1560 Inexact, 0 throws, 0 non-finite; reached: coincident points 3744, collinear points 22, parallel lines 436, concentric circles 406, needs P on 319, ambiguous 117, no anchor 30, (0 : 0) 201, radius 728, polar is the line at infinity 238, no other intersection 25, is undefined 22236
L3 radical_axis: 1865 defined + 510 Undefined agree, 0 not exact, 25 excluded (band); mod p 1865
L3 incenter: 1048 defined + 242 Undefined agree, 1098 not exact, 12 excluded (band); mod p 0
L3 excenter: 1065 defined + 243 Undefined agree, 1082 not exact, 10 excluded (band); mod p 0
L3 incircle: 1053 defined + 253 Undefined agree, 1079 not exact, 15 excluded (band); mod p 0
L3 excircle: 1066 defined + 257 Undefined agree, 1067 not exact, 10 excluded (band); mod p 0
L3 bisector: 1276 defined + 81 Undefined agree, 1035 not exact, 8 excluded (band); mod p 0
L3 ext_bisector: 1308 defined + 70 Undefined agree, 1011 not exact, 11 excluded (band); mod p 0
L1 RationalField: 2000 documents, 52801 objects, 18768 Undefined, 7712 Inexact, 0 throws, 0 non-finite; reached: parallel lines 9, coincident lines 128, coincident points 4442, collinear points 127, ambiguous 0, division by zero 63, outside the 8
L1 ModPField: 2000 documents, 52801 objects, 17542 Undefined, 9755 Inexact, 0 throws, 0 non-finite; reached: parallel lines 9, coincident lines 125, coincident points 4428, collinear points 127, ambiguous 0, division by zero 28, outside the 0
L1 circles RationalField: 2000 documents, 65371 objects, 29671 Undefined, 4655 Inexact, 0 throws, 0 non-finite; reached: coincident points 2695, collinear points 65, parallel lines 605, concentric circles 571, needs P on 490, ambiguous 0, no anchor 68, (0 : 0) 9, radius 199, polar is the line at infinity 338, no other intersection 32, is undefined 19658
L1 circles ModPField: 2000 documents, 65371 objects, 28824 Undefined, 5769 Inexact, 0 throws, 0 non-finite; reached: coincident points 2673, collinear points 62, parallel lines 593, concentric circles 587, needs P on 522, ambiguous 0, no anchor 133, (0 : 0) 9, radius 35, polar is the line at infinity 351, no other intersection 0, is undefined 19222
 Test Files  59 passed (59)
      Tests  681 passed (681)
 kernel/src        |   99.63 |    98.33 |     100 |   99.68 |
 kernel/src/tools  |   99.38 |    98.71 |     100 |   99.75 |
Statements   : 99.64% ( 1688/1694 )
Branches     : 98.78% ( 1302/1318 )
Lines        : 99.78% ( 1387/1390 )
verify exit=0
$ pnpm build
✓ built in 1.08s
build exit=0
```

"defined" = both fields defined and equal within 1e-9 relative; "Undefined agree" = both
Undefined with the same reason; "not exact" = the exact run is Inexact; "excluded (band)" =
a float decision saw a non-zero quantity within BAND of zero; "mod p" = mod-p results equal
to the reduction of the exact ones. "theorem … hold / degenerate / ill-conditioned" counts
the figures of each theorem test.

### First acceptance: mutation testing of kernel geometry (`pnpm mutation:kernel`, local)

```
File            |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
All files       |  99.21 |   99.32 |      882 |         0 |          6 |        1 |     1248 |
 tools          |  99.32 |   99.43 |      875 |         0 |          5 |        1 |     1214 |
  args.ts       |  95.45 |   95.45 |       21 |         0 |          1 |        0 |       50 |
  arithmetic.ts | 100.00 |  100.00 |       43 |         0 |          0 |        0 |       62 |
  circles.ts    |  99.17 |   99.17 |      120 |         0 |          1 |        0 |      161 |
  display.ts    | 100.00 |  100.00 |       32 |         0 |          0 |        0 |       25 |
  incircle.ts   | 100.00 |  100.00 |       86 |         0 |          0 |        0 |      129 |
  index.ts      | 100.00 |  100.00 |        1 |         0 |          0 |        0 |        0 |
  intersect.ts  |  98.18 |   98.18 |       54 |         0 |          1 |        0 |       57 |
  lines.ts      | 100.00 |  100.00 |       78 |         0 |          0 |        0 |      109 |
  measures.ts   |  99.01 |  100.00 |      100 |         0 |          0 |        1 |      160 |
  on.ts         | 100.00 |  100.00 |       47 |         0 |          0 |        0 |       65 |
  other.ts      | 100.00 |  100.00 |       49 |         0 |          0 |        0 |       74 |
  points.ts     |  98.37 |   98.37 |      121 |         0 |          2 |        0 |      159 |
  tangents.ts   | 100.00 |  100.00 |       70 |         0 |          0 |        0 |       81 |
  triangle.ts   | 100.00 |  100.00 |       53 |         0 |          0 |        0 |       82 |
```

(local: a full run, then an incremental run on 629034c.) The first full run scored
98.88%; its new survivors were arity checks of the new tools (reachable only by calling
compute with an extra argument), circle(O, r)'s zero radius without an exact value (mod
p), the excenter's flat-triangle guard and the bisector band in one component; the tests
for them are in 629034c (99.21%). The 6 remaining survivors are equivalent: Run 2's five
(geom.ts `abs`'s `case -1`, `pointsOf`'s length check, the segment/ray label of
`rangeName`, `param`'s range mod p, the flag of `foot`'s internal line) and one in
circles.ts (`s === 'none'` → true in `centreRadius`: a zero radius has sign 0 in every
ordered field, so only mod p reaches that test). The NoCoverage mutant is Run 2's (an
error-message string in measures.ts). A first attempt was discarded: I had stashed
untracked files while it ran, so its type checker saw a missing module.
Mutation scores are reported, gated from v1.1 (SPEC §17 L15).

### CI on GitHub

| Workflow | Run                                                         | Result                                                                                                                                                         |
| -------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ci       | https://github.com/youseng/geomira/actions/runs/39270898956 | completion: success on f873e55 (push): verify, build, Playwright                                                                                               |
| ci       | https://github.com/youseng/geomira/actions/runs/39278468170 | revision: success on 382985f (pull_request, PR #5): verify, build, Playwright                                                                                  |
| deploy   | https://github.com/youseng/geomira/actions/runs/39278464233 | revision: success on 382985f (build job)                                                                                                                       |
| ci       | https://github.com/youseng/geomira/actions/runs/39278464186 | revision: cancelled on 382985f (push; superseded by the push of c5ddc46)                                                                                       |
| ci       | https://github.com/youseng/geomira/actions/runs/39278939447 | revision: success on c5ddc46 (push, the STATUS commit)                                                                                                         |
| deploy   | https://github.com/youseng/geomira/actions/runs/39278939611 | revision: success on c5ddc46 (build job)                                                                                                                       |
| ci       | https://github.com/youseng/geomira/actions/runs/39276556007 | completion: success on b7b3c01 (push)                                                                                                                          |
| ci       | https://github.com/youseng/geomira/actions/runs/39276607688 | completion: success on b7b3c01 (pull_request, PR #5)                                                                                                           |
| deploy   | https://github.com/youseng/geomira/actions/runs/39276555958 | completion: success on b7b3c01 (build job)                                                                                                                     |
| deploy   | https://github.com/youseng/geomira/actions/runs/39270898955 | completion: success on f873e55 (build job; deploy job skipped off the default branch)                                                                          |
| ci       | https://github.com/youseng/geomira/actions/runs/39258413806 | success on 43aa3f9 (push): verify, build, Playwright                                                                                                           |
| ci       | https://github.com/youseng/geomira/actions/runs/39258448213 | success on 43aa3f9 (pull_request, PR #4)                                                                                                                       |
| deploy   | https://github.com/youseng/geomira/actions/runs/39258413747 | success on 43aa3f9 (build job; deploy job skipped off the default branch)                                                                                      |
| nightly  | https://github.com/youseng/geomira/actions/runs/39258455195 | success on 43aa3f9 (dispatched): test; mutation-num; mutation-kernel "kernel mutation score: 99.21% (882 detected, 7 undetected; target 75%, gated from v1.1)" |
| ci       | https://github.com/youseng/geomira/actions/runs/39251375178 | success on 39393da (push, the code commits before the test-gap commit)                                                                                         |

## Requests

- None. No dependency was added.
- The `run-3a` tag is for the maintainer to place on the commit that records acceptance
  (the add-only guard then freezes this run's test files). With the completion, that is
  the merge of its PR, not f57d247.
- Resolved: the maintainer chose the continuous sqrt (ADR-0005, "Revision").

## Notes for later runs

- Points on circles without selectors: `on(c, u, v)` (exact) and `other(a, b, P)` (exact).
  Branch selection adds intersect for curves; incidence.ts already implements the "P on
  both objects" decision the `other(P)` selector needs.
- The editor uses `dragParameter` / `gliderParameter` from `@geomira/kernel/glider`.
- A new incidence-based tool needs an L3 plan (helpers/l3-plans.ts) with float-exact
  incidences, or L3 excludes all its samples.

---

## Run 2: ACCEPTED (2026-10-19)

Kernel core (SPEC §4, §5, §6.1, §9; the line-based tools). Base check first: Run 1 was
ACCEPTED, `pnpm install && pnpm verify` was green locally on dc215a6 (= `run-1`, `main`),
and ci, deploy and nightly were green in CI on that commit
(https://github.com/youseng/geomira/actions/runs/39233995711), so there was no red base
to repair.

Every criterion holds: verify green locally, in a clean clone and in CI (ci run
https://github.com/youseng/geomira/actions/runs/39241926737 on 1cf0ead); L1–L3 counts
below; kernel coverage 99.9% lines (gate 90%); mutation testing of kernel geometry wired
into nightly.yml, 98.82% in CI (target 75%; reported, gated from v1.1). All workflows in
the table under "CI on GitHub".

## Done (each item → the test file that proves it)

1. **value.ts** (SPEC §4): `Value<T>` generic over the field: Point, Line (`p`, `d`, `lo`,
   `hi`, `chiral`; unbounded ends are `null`, ADR-0003), Circle (arc, anchor), Num (with
   `exact`), Polygon, Transform (similarity), Undefined, Inexact; capabilities point,
   curve, linear, round, number, transform, polygon; reserved kinds IdealPoint, Conic,
   Locus documented only. → `packages/kernel/test/value.test.ts`; unknown kinds are
   rejected by every tool, also through `evaluate` (E2) → `registry.test.ts`.
2. **document.ts, invariants.ts, edit.ts, layers.ts** (SPEC §5): the document type,
   `checkInvariants`/`assertInvariants` for I1–I8, immutable helpers `addObject`,
   `removeCascade` (+ `dependents`: objects, claims, assumptions, cleared rules),
   `renameObject` (images follow), `redefineObject` (cycle check, stable topological
   reorder), `setStyle` (`[noimage]` removes images), `setObjectLayers`, `addLayer`,
   `updateLayer`, `removeLayer`. → `invariants.test.ts` (each invariant violated on a
   crafted document), `edit.test.ts`, `layers.test.ts`, `names.test.ts`, `expr.test.ts`;
   property: `document.property.test.ts` (400 random sequences of 12 helper calls, valid
   and invalid, from fuzzed documents and from a document with a derived layer: 3,158 edits
   applied, 1,642 refused, invariants hold after every edit, inputs never mutated).
3. **registry.ts** (SPEC §6.1): `createRegistry(extra)` returns a frozen value (no
   singleton); overloads resolved by capability; a rejected call reads
   "foot does not accept (point, number); signatures: foot(point, linear) ·
   foot(point, point, point)". → `registry.test.ts`.
4. **evaluate.ts, context.ts** (SPEC §9, §3.1): `evaluate(doc, registry, F, ctx)` over
   Float, Rational and ModP, total; `evaluateFrom` re-evaluates changed objects and their
   dependents only (falls back to a full evaluate for another field, registry or scale);
   `evalContextFor(doc)`: scale = diameter of the free points (≥ 1). →
   `evaluate.test.ts`, `context.test.ts`, laws below.
5. **Tools**, each with one `compute<T>`, registry entry, degenerate cases, a property or
   theorem test, `export: 'numeric'` and generated docs: point, param, midpoint, divide,
   foot (both signatures), intersect (line-like × line-like), parallel, perp,
   perp_bisector, circumcenter, centroid, orthocenter, line, segment, ray, polygon, area,
   dist, dangle, angle, ratio, add, sub, mul, div, neg. → `degenerate.test.ts` (45 tests,
   one per declared case, the table must equal the registry's lists),
   `tools.property.test.ts` (35 tests, every tool covered, checked by a meta-test),
   `tools.direct.test.ts` (compute is total on any argument list), `docs.test.ts`.
   The chirality flag (line, segment, ray achiral; perp toggles; parallel keeps;
   perp_bisector chiral) is checked against actually mirrored figures, over Q and floats.
   → `chirality.test.ts`.
6. **Laws.** L1 → `laws/l1-total.test.ts`; L2 → `laws/l2-determinism.test.ts`; L3 (with
   the band exclusion and a mod-p differential check) → `laws/l3-oracle.test.ts`. Counts
   under "Acceptance command output".
7. **Theorems** on 200 random triangles each, over FloatField and over RationalField
   (exact): O, G, H collinear; OG : GH = 1 : 2; the altitudes concurrent (at the
   orthocenter); each median divided 2 : 1 by the centroid. O, G, H come from three
   independent formulas (H is not A + B + C − 2O). → `theorems.test.ts`. Sanity check:
   with the orthocenter's sign flipped, 6 of the 8 tests fail.
8. **Generated docs**: docs/tools.md from the registry (`pnpm docs:tools`); the "exact
   run" column is discovered by running each tool's examples over RationalField. →
   `docs.test.ts` (fails when the file is stale).
9. **Coverage gate** for packages/kernel (90% lines, 85% branches) in `pnpm verify`;
   **mutation testing** of kernel geometry (`geom.ts`, `tools/`): `stryker.kernel.json`,
   `vitest.kernel.config.ts`, `pnpm mutation:kernel`, nightly.yml job `mutation-kernel`
   (a matrix with `mutation-num`). The first run (CI, c26fb17) scored 90.93%; its
   survivors pointed at real gaps (exact Undefined reasons, arity checks reached only
   with line or polygon arguments, polygon vertex numbering, intersect with only the
   first line degenerate, param at v = min, dangle's mod-p reason), closed by tests in
   f520cce/14e4095: 98.82% in CI on 1cf0ead.
10. ADR-0003 (kernel representation choices); packages/kernel/README.md;
    docs/test-count.txt raised from 309 to 517.

## Not done

Nothing in Run 2's scope. Not started (later runs): circles, transforms, selectors and
branchable tools, claims, language, scene, editor, export. The `run-2` tag is for the
maintainer to place on the commit that records acceptance.

## Known bugs

None known. Fixed in this run, each with its regression test in the same commit:

- Found by L1 on its first run: a construction with coordinates near 1e200 (for example
  `divide(A, B, 1e200)` then `dist`) overflowed |d|² to ∞ and `FloatField.sqrt(∞)` threw,
  so `evaluate` was not total. FloatField arguments beyond 2^200 now give Inexact
  (ADR-0003 item 19). → `evaluate.test.ts` "regression (found by L1)".
- `div(1, (1e17 + 1) − 1e17 − 1)`: the exact value of the divisor is 0 while the float
  value is −1, so `Rational.div` would have thrown. `div` now also checks the exact
  value. → `degenerate.test.ts` (div).
- A value of an unknown kind reached `numbersOf`'s `assertNever` in the evaluator's range
  check. → `registry.test.ts` (E2).

## Uncertain

- "arithmetic" in the Run 2 tool list is read as `+ − × ÷` and unary minus (add, sub,
  mul, div, neg). SPEC §6.2 also lists sqrt/sin/cos/tan on numbers; they are not built
  here and belong to the run that lists them.
- SPEC §11.2 allows a trailing `*` only after a point name, but derived layers (§8.2)
  also image lines and circles (`l*`). The kernel accepts `source name + suffix` for any
  kind (I4); the language run has to decide how `l*` is lexed.
- L3's "inputs within BAND of a degeneracy" is implemented as: some zero test or sign
  decision of the float run saw a non-zero quantity with |x| < BAND·scale^k. Exact zeros
  are compared rather than excluded (stricter). At most 1.5% of a tool's samples are
  excluded.
- L3 compares numbers with a relative tolerance of 1e-9·max(1, |exact|, scale). All
  comparisons pass with this tolerance; SPEC does not fix one.
- Angle-type degeneracies (parallel lines, collinear vertices, the `dangle` decision) are
  decided on sin θ (ADR-0003 item 21) instead of the raw cross product against EPS·scale².
  This is my reading of SPEC §3.1's "dimensionless otherwise".
- Mod p, ordered decisions (segment and ray ranges, unsigned area, undirected and
  directed angles) are Inexact; `param`'s range is not checked mod p (ADR-0003 item 16).
  The claims run may refine this when it builds the mod-p rung.
- The FloatField argument bound 2^200 relies on every v1 formula being of degree ≤ 4 with
  divisors ≥ (EPS·scale)². Tools added later with higher-degree formulas must re-check it.
- Mathematical facts used (I am confident of each): the Euler line with OG : GH = 1 : 2;
  the altitudes meet at the orthocenter; the centroid divides each median 2 : 1; for a
  triangle, ∡BAC + ∡CBA + ∡ACB ≡ 0 (mod 180°) for directed angles.

## Changed frozen tests

None. Every test file frozen at `run-1` is unchanged (`add-only: frozen tests compared
with run-1, 0 violation(s)`); packages/kernel/test/index.test.ts still passes because the
kernel API lives in subpath modules (ADR-0002).

## Acceptance command output

### Clean clone (commit 14e4095; 1cf0ead adds only docs/STATUS.md)

```
$ git clone … && pnpm install --frozen-lockfile        # Done in 1.9s using pnpm v10.28.0
$ pnpm verify
> pnpm typecheck && pnpm lint && pnpm depcruise && pnpm rules && pnpm test:coverage
All matched files use Prettier code style!
✔ no dependency violations found (101 modules, 404 dependencies cruised)
ok   tolerance: 171 files scanned, 0 violation(s)
ok   file-length: 171 files scanned, 0 violation(s)
ok   test-count: 517 tests, floor 517, 0 violation(s)
ok   disabled-tests: 171 files scanned, 0 violation(s)
ok   add-only: frozen tests compared with run-1, 0 violation(s)
ok   forbidden-words: 171 files scanned, 0 violation(s)
L1 FloatField: 2000 documents, 53437 objects, 20145 Undefined, 476 Inexact, 0 throws, 0 non-finite; reached: parallel lines 22, coincident lines 359, coincident points 4337, collinear points 60, ambiguous 40, division by zero 176, outside the 30
L1 RationalField: 2000 documents, 53437 objects, 16548 Undefined, 5456 Inexact, 0 throws, 0 non-finite; reached: parallel lines 29, coincident lines 409, coincident points 3116, collinear points 55, ambiguous 0, division by zero 69, outside the 40
L1 ModPField: 2000 documents, 53437 objects, 14680 Undefined, 8891 Inexact, 0 throws, 0 non-finite; reached: parallel lines 29, coincident lines 405, coincident points 3092, collinear points 55, ambiguous 0, division by zero 35, outside the 0
L2 FloatField: 1200 incremental evaluations equal to full ones
L2 RationalField: 1200 incremental evaluations equal to full ones
L2 ModPField: 1200 incremental evaluations equal to full ones
L3 point: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 param: 402 defined + 1998 Undefined agree, 0 not exact, 0 excluded (band); mod p 402
L3 midpoint: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 divide: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 foot: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 intersect: 1577 defined + 792 Undefined agree, 0 not exact, 31 excluded (band); mod p 968
L3 circumcenter: 2155 defined + 221 Undefined agree, 0 not exact, 24 excluded (band); mod p 2155
L3 centroid: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 orthocenter: 2140 defined + 225 Undefined agree, 0 not exact, 35 excluded (band); mod p 2140
L3 line: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 segment: 2397 defined + 3 Undefined agree, 0 not exact, 0 excluded (band); mod p 2397
L3 ray: 2398 defined + 2 Undefined agree, 0 not exact, 0 excluded (band); mod p 2398
L3 parallel: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 perp: 2399 defined + 1 Undefined agree, 0 not exact, 0 excluded (band); mod p 2399
L3 perp_bisector: 2399 defined + 1 Undefined agree, 0 not exact, 0 excluded (band); mod p 2399
L3 dist: 922 defined + 1 Undefined agree, 1477 not exact, 0 excluded (band); mod p 0
L3 ratio: 665 defined + 3 Undefined agree, 1732 not exact, 0 excluded (band); mod p 0
L3 angle: 403 defined + 7 Undefined agree, 1953 not exact, 37 excluded (band); mod p 0
L3 dangle: 397 defined + 3 Undefined agree, 1963 not exact, 37 excluded (band); mod p 0
L3 area: 2387 defined + 4 Undefined agree, 0 not exact, 9 excluded (band); mod p 0
L3 polygon: 2387 defined + 13 Undefined agree, 0 not exact, 0 excluded (band); mod p 2387
L3 add: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 sub: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 mul: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
L3 div: 2335 defined + 65 Undefined agree, 0 not exact, 0 excluded (band); mod p 2335
L3 neg: 2400 defined + 0 Undefined agree, 0 not exact, 0 excluded (band); mod p 2400
invariants: 3158 edits applied, 1642 refused, all valid
 Test Files  50 passed (50)
      Tests  517 passed (517)
 kernel/src        |     100 |    98.76 |     100 |     100 |
 kernel/src/tools  |   99.62 |    98.41 |     100 |   99.55 |
Statements   : 99.92% ( 1344/1345 )
Branches     : 98.98% ( 977/987 )
Lines        : 99.9% ( 1106/1107 )
verify exit=0
$ pnpm build
✓ built in 1.22s
build exit=0
```

"defined" = both fields defined and equal within 1e-9 relative; "Undefined agree" = both
Undefined with the same reason; "not exact" = the exact run is Inexact (no comparison);
"excluded (band)" = a float decision saw a non-zero quantity within BAND of zero; "mod
p" = mod-p results equal to the reduction of the exact ones. Every tool has ≥ 50 defined
comparisons (asserted).

### Mutation testing of kernel geometry (`pnpm mutation:kernel`)

```
                | % Mutation score |          |           |            |          |          |
File            |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
All files       |  98.62 |   99.01 |      497 |         3 |          5 |        2 |      720 |
 tools          |  98.80 |   99.20 |      490 |         3 |          4 |        2 |      686 |
 geom.ts        |  87.50 |   87.50 |        7 |         0 |          1 |        0 |       34 |
```

(local, 14e4095 tests; CI on 1cf0ead: "kernel mutation score: 98.82% (501 detected, 6
undetected; target 75%, gated from v1.1)".) The remaining survivors, analysed one by one,
are equivalent: in `abs`, dropping `case -1` falls through to √(x²) = |x|; `pts.length ===
n` → `true` in `pointsOf` still ends in badArgs through the destructuring; no v1 line
has `lo = null` with `hi` set (segment/ray label); mod p every `param` check is skipped
either way; the `chiral` flag of the line `foot` builds internally is never observed;
the `assertNever` message of an impossible sign. "errors" are mutants rejected by the
TypeScript checker.

### CI on GitHub

| Workflow | Run                                                         | Result                                                                          |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ci       | https://github.com/youseng/geomira/actions/runs/39241926737 | success on 1cf0ead (push): verify, build, Playwright 2/2                        |
| ci       | https://github.com/youseng/geomira/actions/runs/39241931201 | success on 1cf0ead (pull_request, PR #3)                                        |
| deploy   | https://github.com/youseng/geomira/actions/runs/39241926639 | success on 1cf0ead (build job; deploy job skipped off the default branch)       |
| nightly  | https://github.com/youseng/geomira/actions/runs/39242037616 | success on 1cf0ead (dispatched): test; mutation-num; mutation-kernel 98.82%     |
| nightly  | https://github.com/youseng/geomira/actions/runs/39240829013 | success on c26fb17 (first kernel run, full: 90.93%, before the test-gap commit) |

The CI run on f520cce failed (`max-lines`: degenerate.test.ts had 417 lines); b5782f1
split the file. Runs on other intermediate commits were cancelled by the next push
(ci.yml `cancel-in-progress`).

## Requests

- None. No dependency was added (`@geomira/num` is a workspace dependency of the kernel).

## Notes for later runs

- Import the kernel through its subpaths (`@geomira/kernel/value`, `/evaluate`, …); see
  packages/kernel/README.md and ADR-0003.
- A new tool needs: a ToolSpec in packages/kernel/src/tools/ (added to tools/index.ts),
  its degenerate cases in degenerate.test.ts (the table must equal the registry), a
  property test (meta-checked), examples, and `pnpm docs:tools`. L1 and L3 fuzz it
  automatically through the registry's signatures.
- Branch selection must add `candidates` and evaluated selectors to ToolSpec by ADR
  (ADR-0003 item 10); until then a call with selectors is Undefined.

---

## Run 1: ACCEPTED (2026-10-19)

packages/num (SPEC §3). Base check first: Run 0 was ACCEPTED, `pnpm install && pnpm verify`
was green locally on e413a0f, and ci, tex, deploy and nightly were green in CI on that commit
(`main` and the `run-0` tag), so there was no red base to repair.

Every criterion holds: coverage of num is 100% lines and 100% branches (gate: 95%,
enforced by `pnpm verify`); mutation score 89.56% (target 80%; reported, gated from
v1.1), the same locally and in CI; verify green locally, in a clean clone and in CI
(ci run https://github.com/youseng/geomira/actions/runs/39224402956; all workflows
in the table under "CI on GitHub").

## Done (each item → the test file that proves it)

1. **tolerance.ts** (SPEC §3.1): EPS, BAND, FLOOR_MIN, FLOOR_MAX, FLOOR_DELTA,
   FLOOR_SAMPLES, TRUE_FACTOR, FALSE_FACTOR, FALSE_ABS, MAX_SCALE; `toleranceContext`
   (scale = max(1, diameter)); `isZeroLen`/`isZeroArea`/`isZeroDimless`/`isZero`
   (inclusive at EPS·scale^k); `sign3` (0 up to EPS·scale^k, `'ambiguous'` below
   BAND·scale^k, ±1 from there); `noiseFloor`; `residualThresholds`;
   `classifyResidual` → `'true' | 'false' | 'ambiguous' | 'ill-conditioned'`.
   → `packages/num/test/tolerance.test.ts`: every threshold tested at, one ulp below and
   one ulp above, at figure diameters 1e-3, 1 and 1e3 and for length, area and
   dimensionless quantities; floor = 0 (clamped by FLOOR_MIN, residual 0 → true);
   FALSE_ABS vs 1e4·floor; FLOOR_MAX boundary; the laws "a residual of 1e-10 is never
   FALSE whatever the floor" (5,000 floors) and "the class is monotone in the residual";
   "no decision flips from −1 to 1 without passing through 0 or ambiguous"; decisions
   invariant under rescaling; NaN/±Infinity → RangeError (zero tests) or ill-conditioned
   (classification).
2. **rng.ts** (SPEC §3.2): xoshiro128\*\* with explicit state (`createRng`, `state`,
   `restoreRng`), `deriveSeed` for per-sample streams, `nextFloat` (53 bits), unbiased
   `nextInt`, `uniform`, `gaussian` (Box–Muller), `uniformBigInt`, and `cryptoSource`
   wrapping a host-supplied `getRandomValues` (pure packages read no globals).
   → `packages/num/test/rng.test.ts`: reproducible streams, hand-checked xoshiro128\*\*
   outputs from state [1, 2, 3, 4], pinned outputs for several seeds (a verdict's seed
   must reproduce across versions), resume from a snapshot, independence of generators,
   chi-square and moment checks (uniform, nextInt, bits, gaussian mean/variance/68–95),
   rejection-sampling bias check, crypto wrapper with a fake and with Node's webcrypto.
3. **rational.ts** (SPEC §3.3, §3.4): BigInt fractions in normal form, `parseRational`
   ("0.1", "2/3", "-3/4", "+5"; rejects "1/0", "1e3", ".5", whitespace…), arithmetic,
   `compare`, `toNumber` (correctly rounded: ties to even, gradual underflow, RangeError
   beyond the double range) and `tryToNumber`, exact `fromNumber`, `bitSize`,
   `sqrtExact`. → `packages/num/test/rational.test.ts`: `toNumber` equals IEEE division
   for operands below 2^53 (5,000 cases: IEEE division is correctly rounded, so this is an
   independent oracle); nearest-double check done exactly in rational arithmetic on
   [1e-12, 1e12] with numerators and denominators of 80 to 190 bits (so within half an ulp,
   better than the one ulp asked); ties, carries into the next binade, subnormals,
   MAX_VALUE and overflow;
   `fromNumber` round trip of 3,000 random bit patterns.
4. **field.ts and the three fields** (SPEC §3.3): `Field<T>` with partial `sqrt`,
   `sin`/`cos`/`atan2` (degrees) returning `Inexact`; `FloatField` (tolerance-aware
   `isZero`/`sign`), `RationalField` (exact; sqrt of squares of rationals; exact trig at
   multiples of 30° where rational, atan2 on axes and diagonals), `ModPField`
   (p = 2^61 − 1, `sign` → `'none'`, sqrt/trig `Inexact`); `Complex<T>` (complex.ts);
   `withDivisorLog`, `withSqrtLog`; `mapExact`/`allExact` for propagation. QuadExt,
   PolyFractionField, DegreeBoundField are documented as reserved in
   packages/num/README.md (no code).
   → `packages/num/test/field-conformance.test.ts` (one generic suite run against all
   three fields: addition and multiplication axioms, distributivity, inverses, division
   by zero, zero/one/sign, `fromRational` homomorphism, sqrt of squares, trig at 0,
   `Inexact` propagation with its first reason, both logs and their composition,
   Complex<T> ring laws, conjugation, multiplicative norm, division, powers);
   `float-field.test.ts`, `rational-field.test.ts`, `modp.test.ts`, `field.test.ts`.
5. **Stryker** for packages/num: `stryker.num.json` (vitest runner, TypeScript checker,
   per-test coverage analysis, incremental) on `vitest.num.config.ts`; `pnpm
mutation:num`; nightly.yml job `mutation-num` restores and saves the incremental
   result through the Actions cache, writes the score to the job summary and uploads the
   HTML/JSON report. First CI run: "num mutation score: 89.56% (609 detected, 71
   undetected; target 80%, gated from v1.1)", incremental result saved to the cache,
   report uploaded as artifact `mutation-report-num`.
6. **Coverage gate**: `pnpm verify` now runs `pnpm test:coverage`; vitest.config.ts
   fails the run if packages/num drops below 95% lines or branches. Checked by adding a
   60-branch uncovered function to an internal num module: the run failed with "Coverage
   for lines (84.5%) does not meet … threshold (95%)" (exit 1); the probe was removed.
7. **Public surface** (ADR-0002): one subpath export per module (`@geomira/num/field`,
   …); the root entry still exports only `VERSION`, so the frozen
   `packages/num/test/index.test.ts` is untouched. → `packages/num/test/exports.test.ts`
   (exact names per module, export targets exist, exported constants and fields frozen).
8. `assertNever` shared from `@geomira/num/assert` → `packages/num/test/assert.test.ts`;
   internal BigInt helpers → `packages/num/test/bigint.test.ts`.
9. docs/test-count.txt raised from 73 to 309.

## Not done

Nothing in Run 1's scope. Not started (later runs): any kernel, claims or other package
code. The `run-1` tag is for the maintainer to place on the commit that records
acceptance, as with `run-0`.

## Known bugs

None known.

## Uncertain

- "Tests … at scales 1e-3, 1, 1e3": SPEC §3.1 says `ctx.scale` is the bounding-box
  diameter and "≥ 1", so a figure of diameter 1e-3 gets scale 1 and absolute thresholds
  (EPS = 1e-9 for lengths). The tests read "scale 1e-3" as "figure diameter 1e-3"
  under that clamp. If very small figures should get relative thresholds, SPEC needs to
  drop the clamp.
- MAX_SCALE = 1e100 is new (ADR-0002); SPEC sets no upper bound. Above it EPS·scale²
  heads towards the double range, so the context constructor rejects it.
- The exact special values rely on Niven's theorem (at a rational number of degrees, sin
  is rational only for 0, ±1/2, ±1; tan only for 0, ±1). I am confident of both
  statements; the tests check every integer angle in [−720°, 720°] against FloatField.
- FloatField's sign is the banded `sign3` (0 ≤ EPS·scale^k < ambiguous < BAND·scale^k ≤
  ±1). SPEC fixes EPS for zero tests and BAND for decisions but not this exact layering;
  ADR-0002 records it.
- Mutation score: of the 71 undetected mutants, 43 are error-message strings or `''`
  defaults of regex groups that always participate (a `noUncheckedIndexedAccess`
  artefact); the other 28 were analysed one by one and are equivalent (examples:
  `×(±1)` vs `÷(±1)`; `<` vs `≤` where equality cannot occur; removing a zero-divisor
  check that `rational(…, 0)` repeats; `t ≥ 0` → `false` in `tryToNumber`, since a
  negative BigInt shift is a right shift and ⌊n/2^t⌋ < d ⟺ n < d·2^t). Two mutants are
  equivalent only on V8 (Math.atan2 is exact on diagonals there) or only with
  probability 1 − 2^−32 per draw (`w < limit` vs `w ≤ limit` in `nextInt`).

## Changed frozen tests

None. (`packages/num/test/index.test.ts`, frozen at run-0, is unchanged; ADR-0002
explains why the API lives in subpath modules.)

## Acceptance command output

### Local (commit cc502d8)

```
$ pnpm verify
> pnpm typecheck && pnpm lint && pnpm depcruise && pnpm rules && pnpm test:coverage
(8 workspace projects + tests: typecheck Done)
All matched files use Prettier code style!
✔ no dependency violations found (51 modules, 85 dependencies cruised)
ok   tolerance: 115 files scanned, 0 violation(s)
ok   file-length: 115 files scanned, 0 violation(s)
ok   test-count: 309 tests, floor 309, 0 violation(s)
ok   disabled-tests: 115 files scanned, 0 violation(s)
ok   add-only: frozen tests compared with run-0, 0 violation(s)
ok   forbidden-words: 115 files scanned, 0 violation(s)
 Test Files  29 passed (29)
      Tests  309 passed (309)
=============================== Coverage summary ===============================
Statements   : 100% ( 391/391 )
Branches     : 100% ( 248/248 )
Functions    : 100% ( 120/120 )
Lines        : 100% ( 339/339 )
```

The same in a clean clone (`git clone` → `pnpm install --frozen-lockfile` → `pnpm
verify` → `pnpm build`, all exit 0; build: "✓ built in 1.23s").

### Mutation testing (`pnpm mutation:num`, local, commit cc502d8)

```
-------------------|------------------|----------|-----------|------------|----------|----------|
                   | % Mutation score |          |           |            |          |          |
File               |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
-------------------|--------|---------|----------|-----------|------------|----------|----------|
All files          |  89.56 |   90.22 |      580 |        29 |         66 |        5 |      242 |
 assert.ts         | 100.00 |  100.00 |        2 |         0 |          0 |        0 |        1 |
 bigint.ts         |  92.16 |   92.16 |       38 |         9 |          4 |        0 |       13 |
 complex.ts        |  95.24 |   95.24 |       17 |         3 |          1 |        0 |       20 |
 field.ts          | 100.00 |  100.00 |        8 |         0 |          0 |        0 |       31 |
 float-field.ts    |  86.76 |   86.76 |       59 |         0 |          9 |        0 |       30 |
 modp.ts           |  91.30 |   91.30 |       21 |         0 |          2 |        0 |       16 |
 rational-field.ts |  86.36 |   86.36 |       19 |         0 |          3 |        0 |       22 |
 rational.ts       |  87.56 |   89.55 |      196 |         1 |         23 |        5 |       53 |
 rng.ts            |  92.50 |   92.50 |       95 |        16 |          9 |        0 |       23 |
 tolerance.ts      |  89.52 |   89.52 |       94 |         0 |         11 |        0 |       30 |
 trig.ts           |  88.57 |   88.57 |       31 |         0 |          4 |        0 |        3 |
-------------------|--------|---------|----------|-----------|------------|----------|----------|
```

"errors" are mutants rejected by the TypeScript checker (not counted in the score). The
first full run scored 86.72%; reviewing its survivors found real gaps (rounding carry
at a non-maximal exponent, `sin(30/7°)` taken for `sin(30°)` if the integer check were
dropped, the −180° fold in atan2 asserted only with ≤, `sqrt(Infinity)`, MAX_SCALE in a
hand-made context, zero words in a restored RNG state, a rejection-sampling bias
invisible at n = 2^31 + 1, a 4th bucket hiding in a chi-square, `isInexact` on other
tagged values), each closed by a test in this run. An incremental re-run takes ~15 s.

### CI on GitHub

Commit cc502d8 (branch claude/gallant-brahmagupta-nce2a2):

| Workflow | Run                                                         | Result                                                                        |
| -------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ci       | https://github.com/youseng/geomira/actions/runs/39224402956 | success (verify incl. coverage 100% on every num file, build, Playwright 2/2) |
| deploy   | https://github.com/youseng/geomira/actions/runs/39224402795 | success (build job; deploy job skipped off the default branch)                |
| nightly  | https://github.com/youseng/geomira/actions/runs/39224402905 | success (`test`; `mutation-num`: 89.56%, cache saved, report uploaded)        |

From the ci log (verify step):

```
> pnpm typecheck && pnpm lint && pnpm depcruise && pnpm rules && pnpm test:coverage
All matched files use Prettier code style!
✔ no dependency violations found (51 modules, 85 dependencies cruised)
ok   tolerance: 115 files scanned, 0 violation(s)
ok   file-length: 115 files scanned, 0 violation(s)
ok   test-count: 309 tests, floor 309, 0 violation(s)
ok   disabled-tests: 115 files scanned, 0 violation(s)
ok   add-only: frozen tests compared with run-0, 0 violation(s)
ok   forbidden-words: 115 files scanned, 0 violation(s)
 Test Files  29 passed (29)
      Tests  309 passed (309)
 % Coverage report from v8
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |     100 |      100 |     100 |     100 |
 (every file of packages/num/src: 100 | 100 | 100 | 100)
✓ built in 1.02s
  2 passed (2.7s)
```

## Requests

- None. Dev-only dependencies added (allowed runtime dependencies unchanged):
  @vitest/coverage-v8 4.1.12, @stryker-mutator/core, @stryker-mutator/vitest-runner and
  @stryker-mutator/typescript-checker 10.0.0.

## Notes for later runs

- Import num through its subpaths (`@geomira/num/field`, `@geomira/num/tolerance`, …);
  see packages/num/README.md and ADR-0002. Field preconditions throw RangeError: test
  divisors and radicands with `F.isZero` / `F.sign` first and return Undefined.
- Add each new package to `coverage.include` / `coverage.thresholds` in vitest.config.ts
  and, for L15, a `stryker.<pkg>.json` + `vitest.<pkg>.config.ts` pair and a nightly job.
- Stryker needs its plugins listed explicitly (`plugins` in the config): pnpm's isolated
  node_modules hides them from auto-discovery.

---

## Run 0: ACCEPTED (2026-10-19)

Scaffold and guardrails. Everything is in place and green locally, in a clean clone and in
CI (ci, tex, deploy and nightly all succeeded on commit 76fb8bd). The last open criterion,
the GitHub Pages deployment, is now met: after PR #1 was merged, deploy.yml ran on `main`
(commit 50ee23d) and both its `build` and `deploy` jobs succeeded:
https://github.com/youseng/geomira/actions/runs/39219324273
Live site: https://youseng.github.io/geomira/ (serves the "Geomira" shell).

Starting point: no previous run, no `run-*` tag, no docs/adr/, no package.json, so there
was no `pnpm verify` to run and no red base to repair. This run creates both.

## Done (each item → the test file that proves it)

1. pnpm workspace per SPEC §2: packages num, kernel, claims, lang, scene, editor, export
   (each exports only `VERSION`) and apps/web (Vite + React + TypeScript). Shared
   tsconfig.base.json: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes (plus
   noImplicitReturns, noUnusedLocals/Parameters, verbatimModuleSyntax). Package `src/` is
   compiled with `lib: ES2022` and `types: []` (no DOM, no Node globals).
   → `packages/*/test/index.test.ts` (exports exactly `VERSION`, equal to package.json).
2. ESLint 10 (typescript-eslint strictTypeChecked, `@vitest/eslint-plugin`
   no-disabled-tests / no-focused-tests, ban on `.skip/.only/.todo/.fails/.skipIf/.runIf`
   in tests, purity bans in `packages/*/src`: Math.random, Date, performance, window,
   document, process, timers, module-level `let`/`var`, module-level Map/Set caches,
   react/react-dom/zustand and `node:*` imports; no `any`; no `as` casts outside tests;
   eslint-disable comments need a description), Prettier, dependency-cruiser generated
   from the SPEC §2 table, Vitest `test.projects`, Playwright in apps/web.
   → `scripts/lint-guards.test.ts`, `scripts/depcruise.test.ts` (all 42 ordered package
   pairs: exactly the SPEC-forbidden ones are flagged; Node built-ins and npm imports in
   pure packages flagged, lz-string allowed in editor; packages → apps flagged).
3. `pnpm rules` (scripts/check-rules.ts, rules in scripts/check-rules/), each rule with
   bad/good fixtures under scripts/check-rules/fixtures/:
   - (a) tolerance-like literals → `scripts/check-rules/tolerance.test.ts`
   - (b) files > 400 lines → `scripts/check-rules/file-length.test.ts`
   - (c) test count below docs/test-count.txt → `scripts/check-rules/test-count.test.ts`
   - (d) disabled/focused/todo/expected-failure tests → `scripts/check-rules/disabled-tests.test.ts`
   - (e) add-only guard → `scripts/check-rules/add-only.test.ts` (throwaway git repos:
     modified line, deleted line, deleted file, uncommitted change, missing ADR, one of
     several commits without ADR, version-ordered tags, shallow clone all fail; added
     lines and ADR-cited commits pass)
   - (f) proved/proof/proven → `scripts/check-rules/forbidden-words.test.ts`
   - CLI exit code and report → `scripts/check-rules/cli.test.ts`
4. `pnpm verify` = typecheck + lint (ESLint + Prettier) + depcruise + rules + test.
5. Workflows: `ci.yml` (install, verify, build, Playwright), `tex.yml` (GHCR-cached Debian
   image with texlive-latex-base, texlive-pictures, texlive-latex-extra, asymptote;
   compiles tests/fixtures/hello-tikz.tex and hello.asy and checks Asymptote's `write()`
   output), `deploy.yml` (build with base `/<repo>/`, base-path check, Playwright under
   that base, Pages artifact, deploy job on the default branch), `nightly.yml` (test
   suite with NIGHTLY=1, daily and on changes to the workflow).
6. apps/web renders "Geomira" and an empty canvas → `apps/web/test/App.test.tsx`,
   `apps/web/e2e/shell.spec.ts` (desktop and 390×664, no page errors, canvas > 100 px).
7. docs/STATUS.md (this file), docs/adr/0001-baseline.md, docs/test-count.txt (73).
8. Clean clone in a temp directory: `git clone` → `pnpm install --frozen-lockfile` →
   `pnpm verify` → `pnpm build` → `pnpm e2e`, all exit 0 (output below).
9. GitHub Pages deployment from the default branch (deploy.yml run 39219324273 on
   `main`, commit 50ee23d: `build` and `deploy` jobs both succeeded).

## Not done

Nothing for Run 0. The `run-0` tag is placed on the `main` commit that records this
acceptance; from then on the add-only guard freezes every test file present at that tag.

## Known bugs

None known.

## Uncertain

- No mathematical content in this run.
- Rule (a) is a textual check, as CLAUDE.md describes it ("greps for float literals"):
  it scans comments and strings too, and it does not catch tolerances written as
  expressions (for example a power of two with a negative exponent). Rule (f) uses a
  word match with camelCase boundaries; `improved`, `waterproof`, `provenance` are not
  hits, `unproven` and `isProven` are.
- Rule (d) bans the six test modifiers anywhere in code, as CLAUDE.md says
  ("anywhere"). A future method named `skip` (for example in a lexer) would have to be
  named differently.

## Changed frozen tests

None (no `run-*` tag existed).

## Acceptance command output

### Clean clone (temp directory, commit 76fb8bd)

```
$ git clone -q /home/user/geomira clean && cd clean
$ pnpm install --frozen-lockfile        # Done in 1.4s using pnpm v10.28.0
$ pnpm verify
> pnpm typecheck && pnpm lint && pnpm depcruise && pnpm rules && pnpm test
> pnpm -r run typecheck && tsc -p tsconfig.tests.json      (8 projects + tests: Done)
> eslint . --max-warnings 0 && prettier --check .
All matched files use Prettier code style!
> depcruise packages apps/web/src --config .dependency-cruiser.cjs
✔ no dependency violations found (24 modules, 17 dependencies cruised)
> tsx scripts/check-rules.ts
ok   tolerance: 87 files scanned, 0 violation(s)
ok   file-length: 87 files scanned, 0 violation(s)
ok   test-count: 73 tests, floor 73, 0 violation(s)
ok   disabled-tests: 87 files scanned, 0 violation(s)
ok   add-only: no run-* tag yet: nothing frozen, 0 violation(s)
ok   forbidden-words: 87 files scanned, 0 violation(s)
> vitest run
 Test Files  17 passed (17)
      Tests  73 passed (73)
$ pnpm build
dist/index.html                   0.55 kB │ gzip:  0.33 kB
dist/assets/index-C6lbls-J.css    0.76 kB │ gzip:  0.45 kB
dist/assets/index-Df2v0Kg9.js   193.95 kB │ gzip: 60.98 kB │ map: 912.63 kB
✓ built in 1.28s
$ pnpm e2e
  ✓  2 [desktop] › e2e/shell.spec.ts:3:1 › shows the title and an empty canvas (333ms)
  ✓  1 [mobile] › e2e/shell.spec.ts:3:1 › shows the title and an empty canvas (328ms)
  2 passed (2.5s)
```

### Every check-rules fixture fails as intended

The fixture tests above assert the exact `file:line` list of each bad tree and an empty
list for each good tree. The same trees through the real CLI
(`tsx scripts/check-rules.ts scripts/check-rules/fixtures/<rule>/bad`; every run exits 1;
test-count also fails there because a fixture tree has no floor file):

```
FAIL tolerance: 3 files scanned, 7 violation(s)
     apps/web/src/zoom.ts:1  tolerance-like literal 1e-3
     packages/kernel/src/eps.ts:1  tolerance-like literal 1e-9
     packages/kernel/src/eps.ts:2  tolerance-like literal 0.0000001
     packages/kernel/src/eps.ts:3  tolerance-like literal 2.5E-7
     packages/kernel/src/eps.ts:4  tolerance-like literal 1e-12
     packages/kernel/src/eps.ts:5  tolerance-like literal .0001
     scripts/tool.ts:1  tolerance-like literal 3E-5
FAIL file-length: 3 files scanned, 3 violation(s)
     apps/web/src/long.css  401 lines (max 400)
     packages/kernel/src/long.ts  401 lines (max 400)
     packages/kernel/test/long.test.ts  401 lines (max 400)
FAIL disabled-tests: 8 files scanned, 14 violation(s)
     apps/web/e2e/fixme.spec.ts:2  `test.fixme(`
     apps/web/e2e/fixme.spec.ts:3  `test.describe.fail(`
     packages/kernel/test/conditional.test.ts:2  `.skipIf(`
     packages/kernel/test/conditional.test.ts:3  `.runIf(`
     packages/kernel/test/conditional.test.ts:4  `.skip(`
     packages/kernel/test/fails.test.ts:2  `.fails(`
     packages/kernel/test/jasmine.test.ts:1  `xit(`
     packages/kernel/test/jasmine.test.ts:2  `fdescribe(`
     packages/kernel/test/only.test.ts:2  `.only(`
     packages/kernel/test/only.test.ts:3  `.only(`
     packages/kernel/test/skip.test.ts:2  `.skip(`
     packages/kernel/test/skip.test.ts:3  `.skip(`
     packages/kernel/test/todo.test.ts:2  `.todo(`
     packages/lang/src/lexer.ts:1  `.skip(`
FAIL forbidden-words: 3 files scanned, 8 violation(s)
     apps/web/index.html:2  "Proofs" in apps/
     apps/web/src/Verdict.tsx:1  "Proved" in apps/
     apps/web/src/Verdict.tsx:2  "proven" in apps/
     apps/web/src/Verdict.tsx:3  "proof" in apps/
     packages/claims/src/verdict.ts:1  "proved" in a user-facing string
     packages/claims/src/verdict.ts:2  "unproven" in a user-facing string
     packages/claims/src/verdict.ts:3  "PROOF" in a user-facing string
     packages/claims/src/verdict.ts:4  "Proven" in a user-facing string
```

Rules (c) and (e) need injected counts and git history; they are covered by
test-count.test.ts and add-only.test.ts (all cases listed under Done).

### TeX fixtures (local, Ubuntu 24.04 TeX Live + Asymptote 2.87)

`sh tests/fixtures/compile-tex.sh` → hello-tikz.pdf written, Asymptote prints `(2,0)`,
"TeX and Asymptote fixtures compiled.", exit 0. With the expected coordinate changed to
`(9,9)` the script exits 1.

### CI on GitHub

On the branch (commit 76fb8bd, claude/run-0-scaffold-guardrails-crjyx4), tex.yml's
compile job ran inside `ghcr.io/youseng/geomira-tex`, wrote hello-tikz.pdf, and
Asymptote printed `(2,0)` ("TeX and Asymptote fixtures compiled."). tex and nightly have
path filters (TeX inputs, their own workflow file) and run again only when those change
or on their schedule / manual dispatch.

| Workflow      | Run                                                         | Result                                                          |
| ------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| ci            | https://github.com/youseng/geomira/actions/runs/39218199380 | success (verify, build, Playwright)                             |
| tex           | https://github.com/youseng/geomira/actions/runs/39218199382 | success (image built and pushed to GHCR; fixtures compiled)     |
| deploy        | https://github.com/youseng/geomira/actions/runs/39218199443 | success (build job; deploy job skipped off the default branch)  |
| nightly       | https://github.com/youseng/geomira/actions/runs/39218199640 | success                                                         |
| deploy (main) | https://github.com/youseng/geomira/actions/runs/39219324273 | success (merge of PR #1, commit 50ee23d; build and deploy jobs) |

## Requests

- None open. (Done: GitHub Pages enabled, branch merged as PR #1, deploy green on
  `main`.)

## Notes for later runs

- Dependencies: none beyond the allowed runtime set (react, react-dom). Dev tooling only:
  TypeScript, ESLint + plugins, Prettier, dependency-cruiser, Vitest, Vite,
  @vitejs/plugin-react, Playwright, tsx, @types/\*, globals.
- Deviations from the run text (not from SPEC), recorded in ADR-0001: Vitest
  `test.projects` instead of a workspace file (removed in Vitest 4);
  `@vitest/eslint-plugin` instead of `eslint-plugin-vitest` (renamed package, same
  rules).
- The tex image is based on `public.ecr.aws/docker/library/debian:trixie-slim` (the
  official Debian image via ECR Public) to avoid Docker Hub rate limits; GHCR package
  `geomira-tex` was created by the first tex.yml run.
- CI checks out full history (`fetch-depth: 0`) so the add-only guard can compare
  against the `run-*` tags.
