# ADR-0032: Inversion through Möbius maps (Run 14)

Status: accepted (Run 14). Moves inversion out of Phase 2 (SPEC §1, §4 `Transform`, §8, §18 E3
and E5 are updated in the same commit). Extends ADR-0007 (decisions 16 and 17: how inversion
plugs in, the `outside` range flag), ADR-0019 (compose never collapses), ADR-0029 (argument
symmetries), ADR-0031 (arcs) and ADR-0008 decision 9 (`radical`). Records the two places where
the v1 extension points were not enough (decisions 13 and 14), as the run's item 5 asks. The
maintainer's request `symmedian_point` (not Run 14 scope) is ADR-0033.

## Context

Run 14's brief: a `TransformData` 'mobius' { anti, a, b, c, d } (z ↦ (az + b)/(cz + d), or of
z̄); the constructors `inversion(c)` and `inversion(O, k)` (k < 0: the inversion followed by a
half turn) and olympiad presets written as compositions only; `apply` on every kind with the
centre's image Undefined, lines and circles exchanging kinds at run time, segments becoming
arcs or rays, a segment through the centre becoming two rays through a range `outside` flag;
exact runs over Q and mod p for an exact power; laws (involution, incidence and tangency kept,
the classical theorems); and everything downstream (derived layers, views, drag-through,
claims in both regimes, exports) "without changes to the kernel core, layers or editor", or an
ADR saying why the v1 extension point was insufficient.

ADR-0007 decision 16 planned the plug-in: `Transform.t` becomes a union and the compiler lists
every place that switches on it. Decision 17 planned the `outside` flag. SPEC does not define
the presets other than √(bc), nor how a range or an arc maps, the chirality of an image line,
or what an inversion does to a polygon or a mark.

## Decision

### The map (packages/kernel/src/value.ts, packages/kernel/src/transform/)

1. **`TransformData<T> = Similarity<T> | Mobius<T>`**, `Mobius = { type: 'mobius', anti, a, b,
c, d }` (complex entries): z ↦ (a·ẑ + b)/(c·ẑ + d), ẑ = z̄ when `anti`. The matrix is
   defined up to a non-zero factor and is never normalised, so the float and exact runs agree
   entry by entry (L3). It is valid iff ad − bc ≠ 0: exactly 0 → Undefined ("the map is not
   invertible (ad − bc = 0)"); in FloatField an entry or ad − bc that is not finite, or a
   determinant that rounds to 0, → Inexact ("beyond the double range"), as ADR-0019 decision 3.
   With c = 0 exactly the map is the similarity (a/d)·ẑ + b/d and is applied as one; otherwise
   its POLE (the centre) is the point sent to infinity, −d/c (conjugated when anti).
2. **compose and inverse.** Two similarities compose as before (similarity.ts unchanged). Any
   other pair is multiplied as matrices: S∘T = M_S·M_T when S is direct, M_S·conj(M_T) when S
   is anti; anti = anti_S xor anti_T; a similarity a·ẑ + b is the matrix (a, b, 0, 1). No
   collapse test (ADR-0019 decision 2: determinants multiply). The inverse is the adjugate
   (d, −b, −c, a), conjugated when anti.
3. **`inversion(O, k)`**: w = O + k / conj(z − O), the anti matrix (O, k − |O|², 1, −Ō), with
   ad − bc = −k. k = 0 (exact zero, or within EPS as an area in FloatField) → Undefined
   ("inversion: the power k is 0"). k < 0: the inversion with power |k| followed by the half
   turn about O, by the same formula. **`inversion(c)`** = inversion(center(c), r²) (an arc
   uses its carrier circle, ADR-0031 decision 7). Both are rational: exact over Q and mod p
   for an exact power. There is no image sugar (`inversion(X, c)`): images are
   `apply(inversion(c), X)` and derived layers. Symmetry: none.
4. **The presets are compositions only.** Each preset's `compute` calls the registry tools'
   own `compute` functions (reflect, bisector, inversion, compose, power, circumcircle, …) on
   its arguments and contains no mapping formula; a test checks each one against the
   composition built from those tools, entry by entry, in all three fields.
   - **sqrt_bc(A, B, C)** = compose(reflect(bisector(B, A, C)), inversion(A, AB·AC)) (the
     brief's definition; with A at 0 it is z ↦ bc/z). It swaps B and C and maps the
     circumcircle to line BC. Radical (the bisector and the distances need square roots), so
     Inexact over Q unless AB·AC and the bisector are rational. Symmetry: B ↔ C, 'value'.
     Degenerate: A = B or A = C → Undefined (the bisector's coincident points). Collinear
     points are not degenerate: the straight angle's bisector is the perpendicular at A, the
     zero angle's is the line itself (ADR-0004 item 14), and the map still swaps B and C.
   - **orthocenter_inversion(A, B, C)** = inversion(H, power(H, circumcircle(A, B, C)) / 2),
     H = orthocenter(A, B, C). Since the reflection of H in BC lies on the circumcircle, the
     power is HA⃗·HD⃗ (D the foot from A), negative in an acute triangle: the map swaps each
     vertex with the foot of its altitude and the circumcircle with the nine-point circle.
     Rational. Symmetry: any order of A, B, C, 'value'. Degenerate: collinear vertices →
     Undefined (orthocenter, circumcircle); a right angle (H is that vertex, on the
     circumcircle) → the power is 0 → Undefined.
   - **inversion_fixing(O, c)** = inversion(O, power(O, c)): the inversion centred at O that
     maps c to itself (for O inside c the power is negative and the half turn makes it so).
     Rational. Symmetry: none. Degenerate: O on c → the power is 0 → Undefined.
   - **inversion_swap(O, A, B)** = inversion(O, power(O, diameter_circle(A, B))), whose power
     is OA⃗·OB⃗. An inversion centred at O swaps A and B exactly when O lies on line AB (A's
     image is on ray OA); for O off that line no inversion centred at O swaps them, and the
     result is Undefined ("inversion_swap(O, A, B): no inversion centered at O swaps A and B
     unless O lies on line AB"), decided as an incidence with the band (ADR-0004 item 1).
     Checked symmetric in A ↔ B ('value'): the diameter circle's centre and radius and the
     incidence of O with line AB do not depend on the order (its anchor does, and is not
     used). Degenerate: A = B → Undefined; O = A or O = B → the power is 0 → Undefined.
   - **sqrt_bc2** and **feet_inversion** are NOT built: SPEC does not define them and their
     standard meaning is not certain. STATUS (Uncertain) proposes definitions for the
     maintainer to confirm.

### apply on every kind (transform/apply-map.ts, mobius-apply.ts, unit-inversion.ts)

5. **One decomposition.** For c ≠ 0, M = S₂ ∘ J ∘ S₁ with J(w) = 1/w̄ (the inversion in the
   unit circle about the origin), S₁(z) = ẑ + d/c and S₂(w) = a/c + e·w̄, e = (bc − ad)/c²
   (both similarities, applied by similarity.ts). S₁ is an isometry that moves the pole to
   the origin, so every decision taken in J's frame is a decision on world lengths with the
   figure's tolerance context (SPEC §3.1). `apply` is one `compute<T>` for every field.
6. **J per kind** (the pole is the origin):
   - **point**: at the pole (both components within EPS as lengths) → Undefined ("apply: the
     point is the center of inversion: its image is at infinity"); within the band →
     Undefined (ambiguous); otherwise z/|z|².
   - **line, segment, ray**: the carrier's distance to the pole, as a length with the band
     (ADR-0004 item 1). Zero → a line through the pole with the same direction and chirality
     flag; the range maps by decision 7. Ambiguous → Undefined. Otherwise a circle through the
     pole: centre F/(2|F|²), r² = 1/(4|F|²) (F the foot of the pole on the line), anchor the
     image of p; a full line gives the full circle, a range an arc (decision 7).
   - **circle, arc**: the pole's gap to the circle (circleGap, a length, with the band). Zero
     → the line w·c = ½ (p = c/(2|c|²), d = rot90(c), `chiral` true, decision 9); a full
     circle gives the full line, an arc a range (decision 7). Ambiguous → Undefined.
     Otherwise the circle with centre c/s and r² = r²/s², s = |c|² − r², and the anchor's
     image; an arc keeps its order when the pole is inside (s < 0) and swaps its ends when
     the pole is outside (s > 0) (J reverses orientation; inside, it also exchanges the disc
     and its outside).
   - **polygon**: Undefined ("apply: an inversion maps the sides of a polygon to arcs, so the
     polygon has no image"): drawing the images of the vertices joined by segments would be
     silently wrong. (A Möbius map with c = 0 is a similarity and maps polygons as before.)
   - **angle mark**: the vertex's image, and as arm points the image vertex plus the images
     of the arm DIRECTIONS under the derivative (v ↦ −v̄/z̄² for J): the mark sits on the
     tangents of the image arms, whose angle is the original one (an inversion keeps angles,
     reversing their orientation, so the arms swap under J like under an anti-similarity);
     `right` and the arc count are kept. Vertex at the pole → Undefined.
   - **segment mark**: Undefined ("apply: an inversion does not keep lengths, so a segment
     mark has no image").
   - **text**: the anchor's image (the pole → Undefined).
   - numbers, maps, strings: Undefined, as for similarities; Undefined and Inexact pass.
     Mod p there is no order: a decision that needs a side (an arc or a range of a curve whose
     kind changes or that passes the pole) is Inexact; full lines and full circles map exactly.
7. **Ranges and arcs as arcs of the projective parameter line.** A range is read as the arc
   from `start` to `end` of ℝ ∪ {∞} in increasing t: [lo, hi] is (lo, hi); a ray [lo, ∞) is
   (lo, ∞); (−∞, hi] is (∞, hi); the two rays t ≤ lo or t ≥ hi are (hi, lo) through ∞.
   - **Line through the pole** (t₀ the pole's parameter): the image line is p' = pole,
     d' = d, with s(t) = 1/((t − t₀)|d|²), a decreasing bijection of the projective line with
     s(t₀) = ∞ and s(∞) = 0, so (start, end) maps to (s(end), s(start)). Whether t₀ is an end
     is decided as a coincidence of that end with the pole (lengths, EPS; the band →
     ambiguous), otherwise its side by the sign of the end's position along d (a length; it
     is clearly non-zero then). The result is read back: an end at ∞ gives a ray (a segment
     with an end at the centre → a ray), an arc through ∞ gives the two rays `outside`
     (a segment containing the centre), anything else a segment (a ray along the pole's line
     pointing away from it → a segment ending at the pole).
   - **Line not through the pole**: the image circle is traversed counter-clockwise iff the
     pole is on the left of the directed line (σ = sign cross(d, pole − p), already decided),
     so the range (start, end) becomes the arc from J(start) to J(end) when σ > 0 and from
     J(end) to J(start) otherwise, with J(∞) = the pole. A full line gives the full circle.
   - **Circle through the pole**: the image line's parameter τ increases along the
     counter-clockwise traversal from the pole. An arc whose end is the pole (coincidence,
     EPS; band → ambiguous) gives a ray; an arc containing the pole (ADR-0031's side test,
     with its band) gives the two rays `outside`; any other arc the segment [τ(from), τ(to)].
     Every formula is rational, so arcs and ranges are exact over Q.
8. **The `outside` flag** (SPEC §4, E5): `Line.outside?: true` means t ≤ lo or t ≥ hi, with
   lo < hi both bounded. It is OPTIONAL (absent = an ordinary range) because frozen tests
   build Line literals, which a required field would break; for the same reason the compiler
   cannot list its consumers, so every reader of `lo` / `hi` was found by search and handles
   it, each with a test: kernel `tools/range.ts` (rangeStatus: on the two rays, the band at
   each end), `glider.ts` (a glider in the gap is clamped to the nearer end; the middle of the
   gap is Undefined within the band, as an arc glider's far point), `tools/pairs.ts`,
   `docs.ts`, `similarity.ts` (images keep the flag); claims `kinds-curves.ts` (`on`: one
   order item (t − lo)(t − hi) ≥ 0) and `sampler.ts` (glider samples on the two rays);
   scene `shapes.ts`, `display.ts` (two clipped rays: drawn and hit, L8), `placement.ts`,
   `bounds.ts`, `coincide.ts`; export `asy-plan.ts` (no Asymptote variable: drawn from the
   display list like an arc) and `check.ts`; apps/web `style-draft.ts`.
9. **Chirality** (SPEC §4). An image line through the pole keeps its source's flag (S₁, J and
   S₂ keep its direction). An image line from a circle through the pole has direction
   rot90(c) in J's frame, a quarter turn of the achiral direction from the pole to the
   centre: CHIRAL. Under mirroring the whole figure the map is conjugated by the mirror
   (S₁, S₂ conjugated, J unchanged), so the computed direction is reversed relative to the
   mirrored one exactly by that quarter turn. Tested against actual mirrored figures, as
   SPEC §4 asks.

### Everything downstream

10. **Derived layers, views, drag-through** read the rule's transform object and `apply`;
    nothing in them depends on the map being a similarity (ADR-0007 decision 16). The
    inversion circle's image coincides with it and the scene hides it; the centre's image is
    Undefined with its reason. Drag-through inverts each map of the chain with the union
    functions; the image is not draggable when a map depends on the dragged point (the centre
    defined from it: SPEC §8.4's rule, unchanged), and a cursor at the inverse's pole is
    refused with its reason.
11. **Compiler-listed changes (ADR-0007 decision 16's plan)**: the switch on `Transform.t`
    reaches `similarity.ts` callers outside the transform code: kernel `drag.ts` (inverse and
    point image through the union), `docs.ts` (formatting), `value.ts` (`numbersOf`); editor
    `drag.ts` (`chainScale`: the local scale |f′(x)| = |ad − bc|/|cx̂ + d|² at the source's
    position for a Möbius map, |a| for a similarity, for the drag-end rounding of an image);
    export `asy-plan.ts` (decision 15). Each is a type switch, not new behaviour of those
    modules.
12. **Claims** need nothing new for images (they are plain `apply` objects): the exact rungs
    run the rational maps; ranges and arcs mod p are Inexact (the rung falls through).

### Where the v1 extension points were not enough

13. **Static kinds of images (kernel `value.ts`, `kinds.ts`).** ADR-0028 decision 12 gave
    `apply` and the image sugar `preserves`: the image of a line is statically a line. Under
    an inversion it can be a circle, and the static kinds decide the selector checks: with
    `l*` statically a line, `intersect(l*, k)` would need no selector but evaluate to
    "ambiguous: add a selector", and the parser would refuse `along(±)` or `other(P)` on it,
    so the image circle could never be intersected with a line. Capability dispatch handles
    the values at run time, but static kinds are decided before evaluation (ADR-0007
    decision 8) from kinds alone, and a transform's kinds did not say what kind of map it is.
    Decision: a STATIC kind `'mobius'` ("a transformation that may be a Möbius map"), never
    the kind of a value. The inversion tools' overloads output ['transform', 'mobius'];
    an overload that outputs a transform from a transform argument (compose, inverse) adds
    'mobius' when an argument may be one; and an image under a map that may be Möbius has
    the kinds of its figure with line and circle exchanged (a line or circle → line or
    circle; points, marks and text keep theirs). Similarity maps keep ADR-0028's narrowing
    exactly (image-kinds.test.ts unchanged). Every consumer that already folds static kinds
    over objects (lang, editor, claims) carries the marker without a change; a transform's
    kinds still include 'transform', so rule checks and tool steps are unchanged.
14. **The samplers' frame (claims `frame.ts`).** ADR-0028 decision 7 treats a number argument
    of any tool other than point, circle and on as dimensionless; `inversion(O, 4)`'s power is
    a squared length, so a random similarity would change the figure's shape. Decision: a
    Signature may declare `absolute` (positions of number arguments that carry a size, here
    the power), and the frame treats them like a fixed radius: no random similarity unless
    the samplers map them (they never do: a power is not a free input), mirroring allowed.
    The rule stays registry data (nothing outside the registry enumerates tools).

### Export, docs, GUI, tests

15. **Export.** Every new tool's mapping is `'numeric'` (ADR-0014's frozen test pins the
    constructive ones). A Möbius map is not an Asymptote `transform`: it gets no variable, so
    a constructive `compose` or `apply` on it falls back to numeric coordinates. Image arcs
    use the Circle `arc` field and every exporter draws only the arc (ADR-0031 decision 8);
    two rays are drawn from the display list in every format.
16. **GUI** (packages/editor data, ADR-0031's pattern): Inversion (a circle) ⇧W →
    `f = inversion(c)`; √(bc) inversion ⇧U (A, then B and C); Inversion fixing a circle ⇧F
    (center point and circle, either order). Group Transform. The shortcuts were the free
    Shift letters (D, F, U, W); a test keeps keys unique. The other presets are typed. A map
    built here is used with Apply transformation (⇧G) and Layer from transform (⇧J).
17. **Tests**: laws (involution apply∘apply = id; apply∘inverse = id; compose and apply;
    incidence and tangency preserved on fuzzed figures, exactly over Q and mod p where exact,
    and in floats; L1 totality in three fields; L3 with argument plans), degenerate cases of
    every new tool, theorem tests (√(bc) swaps B and C and maps the circumcircle to line BC;
    the orthocenter inversion maps the circumcircle to the nine-point circle and each vertex
    to the foot of its altitude; Ptolemy's equality AB·CD + AD·BC = AC·BD for concyclic
    A, B, C, D, checked through the inversion at A, which puts B*, C*, D* on a line, where
    B*D* = B*C* + C*D*), ranges and arcs, chirality against mirrored figures, the static
    kinds, the frame rule, scene and export of two rays, and the Playwright flow "derive an
    inverted layer, build in it, drag an image".
18. **Mutation testing**: the new kernel files under `transform/` join stryker.kernel.json's
    scope. The frozen shard test keeps eleven kernel shards, so they join existing ones by
    weight (scripts/mutation-shards.ts, as ADR-0031 decision 20 did): `j-core.ts` and
    `proj-range.ts` kernel-a; `j-lines.ts` and `j-circles.ts` kernel-b; the tool specs
    (`tools/map-ops.ts`, `transform/inversion-tools.ts`) kernel-j; `mobius.ts` and
    `apply-map.ts` kernel-k. compose, inverse and apply moved from `tools/transforms.ts` (at
    its 400-line limit) to `tools/map-ops.ts`, unchanged for similarities; transforms.ts's line
    ranges are re-cut between top-level statements (1–132, 133–265, 266–end).
19. **The layer line names the map.** The brief writes `@layer inv = image(inversion(w),
main)`; ADR-0009's grammar takes a name there (a rule refers to a transform object), so the
    text is `f = inversion(w)` and `@layer inv = image(f, main)`, as for every derived layer.
    The language is unchanged.

## Frozen tests changed under this ADR

`Transform.t` became a union, so two frozen tests that pass a transform value to a
similarity-only function no longer typecheck. Each change is type-level and equivalent for
similarities (commit citing this ADR):

- `packages/kernel/test/inverse-range.test.ts`: `similarityProblem(FloatField, inv.t, 'x')`
  becomes `inv.t.type === 'similarity' ? similarityProblem(…) : 'a Möbius map'` (still
  expected undefined, so a Möbius result would now fail the test: stronger).
- `packages/kernel/test/laws/l13-model.test.ts`: `applySimilarity(F, t.t, x)` becomes
  `t.t.type === 'similarity' ? applySimilarity(F, t.t, x) : applyMap(F, t.t, x, …)` (one
  import line added); the model's maps are similarities, so the law checks the same images.

Lines only added: `registry.test.ts` (five names), `radical.test.ts` (sqrt_bc),
`construction-key.test.ts` (three samples), `degenerate.test.ts` and
`tools.property.test.ts` (one import and one spread each), the kernel's `exports.test.ts`
(two subpaths).

## Consequences

- A figure can be inverted: `@layer inv = image(inversion(w), main)` gives A*, B*, …; images
  of lines and circles change kind with the figure, never silently: through the band of the
  centre they are Undefined.
- The image of a polygon or a segment mark under an inversion is Undefined with its reason.
- Kernel core files changed (decisions 8, 11, 13): value.ts, kinds.ts, tool.ts (`absolute`),
  similarity.ts, drag.ts, docs.ts, glider.ts, tools/range.ts, tools/pairs.ts. Outside the
  kernel: claims frame.ts, kinds-curves.ts, sampler.ts; scene shapes, display, placement,
  bounds, coincide; export asy-plan.ts, check.ts; editor drag.ts; apps/web style-draft.ts and
  the icons of the new tools. STATUS lists them.

## Alternatives considered

- **A required `outside` field or a range union**: the compiler would list every consumer,
  but every frozen test that builds a Line literal would need changing.
- **Normalising Möbius matrices** (e.g. d = 1): divides by an entry that may be zero, and
  float and exact runs would no longer agree entry by entry.
- **Mapping a polygon to the polygon of the vertices' images**: silently wrong sides.
- **Widening every image of a curve to line or circle**: breaks ADR-0028 decision 12 for
  similarities (`intersect(l*, k)` would need a selector again).
- **A parallel "may be Möbius" table beside the kind tables**: every consumer of static kinds
  (lang, editor, claims) would have to build and pass it; a static kind travels with the
  existing tables.
- **Hard-coding `inversion` in the samplers' frame**: a second enumeration of tools.
- **Image sugar `inversion(X, c)`**: not asked for, and it would add overloads whose static
  kinds differ from the other sugar.
