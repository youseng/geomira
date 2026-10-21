# ADR-0011: Display values: marks, text and string literals (Run 8a, step 0)

Status: accepted (Run 8a). Extends ADR-0003 item 3 (the Value union: SPEC §4's kinds were
meant to be all), ADR-0007 decisions 3, 4 and 9 (what apply maps and what derived layers
image), ADR-0009 (the grammar gains string arguments; its EBNF block is updated) and ADR-0010
(shapes, kind order, labels, coincidence and hit-testing of the new kinds). Numbered 0011
(note F of the run).

## Context

SPEC §6.2 lists the display tools `polygon`, `mark_angle`, `mark_right`, `mark_segment` and
`text`. Run 2 built `polygon`; Runs 3b and 7 deferred the others because they need value
kinds the scene defines. Run 8a's brief asks for them first, in their own commit: "new value
kinds in the kernel with ONE compute<T> each, degenerate cases (coincident points, Undefined
inputs), images under derived layers (apply maps them; a reflection reverses a mark's
orientation), lang notation with P1–P3 coverage in the generator, scene shapes with
hit-testing (L8, L9) and the coincident-image rule". mark_angle has "an arc count and a
right-angle style"; mark_segment a "tick count"; text an "anchor + string". SPEC leaves open
which angle a mark marks, how a right-angle style is chosen, what the counts accept, how a
string enters a document whose literals are exact numbers, and how big marks are.

## Decision

### Values (packages/kernel/src/value.ts)

1. **Four new kinds** in the Value union: `AngleMark { b, from, to, arcs, right }`,
   `SegmentMark { p, q, ticks }`, `Text { at, text }` and `Str { s }` (the value of a string
   literal). `numbersOf` lists their coordinates (counts, flags and strings are not field
   elements). They are not SPEC §4 kinds, so `VALUE_KINDS` keeps SPEC §4's list (its frozen
   test enumerates it) and the new `DISPLAY_KINDS` lists these four; `isKnownKind` accepts
   both (scene and evaluator treat them as known).
2. **Two new capabilities**: `annotation` (angle_mark, segment_mark, text: what apply maps
   besides figures) and `string`. Claims and construction tools take neither, so a mark can
   never be a claim argument or an input of a construction ("tool does not accept …").
3. **An angle mark marks the CONVEX angle ∠ABC** (undirected, as olympiad figures mark
   angles) and is STORED COUNTER-CLOCKWISE: `from` and `to` are the arm points (A and C) in
   the order that makes cross(from − b, to − b) > 0. The side is decided with num's banded
   sign of the normalised cross product (as `dangle` decides collinearity, ADR-0003 item 21).
   Zero and straight angles have no inner side: within EPS → Undefined ("0°" or "180°", told
   apart by the sign of the dot product, which is then clearly ±|u||v|), inside the band →
   Undefined ("ambiguous"), so a mark never flips to the other side. Mod p (no order) →
   Inexact.
4. **The right-angle style is mark_right's value**: `mark_right(A, B, C)` gives an AngleMark
   with `right: true` and one arc. It marks ONLY a right angle: the cosine of ∠ABC is decided
   with the band (within EPS → the mark; inside the band → Undefined, ambiguous; beyond →
   Undefined "not a right angle"). SPEC §6.2: right angles are constructed, never assumed;
   a mark that drew a square on a 73° angle would be silently wrong. `mark_angle(A, B, C[, n])`
   gives `right: false` and n arcs.
5. **Counts** (arcs, ticks) are an optional last number argument, which must carry an EXACT
   value 1, 2 or 3 (absent: 1); anything else, including a measured number equal to 2, is
   Undefined with the reason. A count is a decision, never rounded.
6. **text(P, "…")**: the string must be non-empty (an empty one is Undefined, so the object is
   listed with a reason rather than invisible). The string uses the label grammar of the scene
   (`M_a`, `\omega`, primes; ADR-0010 decision 9).
7. **mark_segment(A, B[, n])**: A = B (EPS) → Undefined. No order is needed, so it is exact
   in every field.

### Expressions and the language

8. **String literals**: a new Expr kind `StrExpr { kind: 'str', value }` that evaluates to a
   Str. No runtime name is added to `@geomira/kernel/expr` (its export list is frozen);
   constructors write the object literal. `exprEquals` compares strings; static kinds give
   `string`; `formatExpr` quotes.
9. **Grammar**: a string is a call argument when it stands alone between `(`/`,` and `,`/`)`:
   `t = text(C, "Let \omega be the circle")`. Anywhere else it is a syntax error ("expected an
   expression, found "…"", hint "a string is only an argument of a call, as in text(P, "…")"):
   Run 6's frozen test requires `x = "a"` to be an error, and a string object, or a string in
   arithmetic, has no meaning. The printer quotes with the lexer's escapes (`quote`), so P1
   holds for any string. ADR-0009's EBNF block shows `arg = expr | string`.
10. **The generator of laws P1–P3** draws the display tools (`annotation` joins the wanted
    capabilities) with random strings (quotes, backslashes, controls, Unicode); a test checks
    it draws every display tool and a string literal.

### Images (similarity.ts, transforms.ts, derived.ts)

11. **apply maps marks and text**: vertex, arm points and ends mapped; an anti-similarity
    SWAPS an angle mark's arms (a reflection reverses its orientation), so the image is again
    counter-clockwise and equals mark_angle of the images (property-tested exactly over Q and
    in floats). Text keeps its string. Strings, numbers and transforms are not mapped.
    `apply` gains the overload (transform, annotation) and the degenerate case "an
    anti-similarity reverses an angle mark (its arms swap)". The image SUGAR (reflect(X, l),
    rotate(X, O, θ), …) stays for figures: Run 4's frozen radical test counts exactly four
    rotate overloads, and derived layers use apply.
12. **Derived layers image marks and text** (ADR-0007 decision 9's imaged kinds gain
    angle_mark, segment_mark and text): a mark drawn in the source layer appears in the image
    layer. Strings are not imaged (they never are objects in parsed documents).

### Scene (packages/scene)

13. **Shapes**: `angle_mark` (vertex, the convex span as world angles from < to ≤ from + π,
    recomputed from the cross product so a hand-made value in either order marks its convex
    angle; counts outside 1–3 → unavailable), `segment_mark` (ends, ticks), `text` (anchor,
    string). Str → not drawn.
14. **Sizes are pixels** (mark-paths.ts): arcs of radii 14, 18, 22 px, a right-angle square of
    side 11 px, ticks 10 px long and 4 px apart, whatever the zoom: a mark is a sign on the
    figure, not a length of it. A mark is laid out only when its anchor (vertex, segment
    middle) is inside the clipping rectangle shrunk by the mark's reach, so every coordinate
    stays within the layout margin (L9).
15. **A text** is drawn as its item's LABEL (the string, centred on the anchor at distance 0
    unless the style gives `label_angle` / `label_dist`); the style's `label` is ignored for a
    text (its string is the value). Its only path is a dot of radius 0 at the anchor: its
    handle, hit within the pick radius (part `point`), so L8 holds for texts exactly as for
    points. Picking a text far from its anchor is not possible in v1 (labels are not
    hit-tested, ADR-0010 decision 13).
16. **Order and labels**: the kind order becomes polygons, circles, lines, segment marks,
    angle marks, points, texts (marks under points, texts on top). An angle mark's label sits
    at its outermost arc, along the bisector; a segment mark's at its middle tick.
17. **Coincident images**: angle marks coincide when vertices coincide and both arms point the
    same ways (normalised cross product within the band, same sense) with equal arcs and
    style; segment marks when the ends coincide in either order with equal ticks; texts when
    anchors coincide and strings are equal. The rule "while the source is drawn" is unchanged.
18. **Virtual hits** ignore marks: their strokes are signs, not curves to construct on (an
    "on curve" or intersection target on a mark arc would be meaningless).

## Consequences

- The export run maps marks and text (TikZ, Asymptote) from the Scene's shapes; their pixel
  sizes become lengths in the output's units there.
- The editor's "marks" tools create these calls; the text tool asks for a string.
- Frozen tests gain lines only (STATUS lists them): capability and tool lists, the radical
  test's argument draws, the degenerate and property tables' spreads, the sameValues /
  plain switches, the L3 plan for text, the generator's capability list and string literal,
  and one guard in the branch fuzzer (below).
- The branch fuzzer (Run 3b) could pick the `point` tool with a 1e200 literal (a free point
  beyond MAX_SCALE that its test refuses); a larger registry reshuffled its random calls into
  that case. A guard line skips `point` in `misuse()`, where it adds nothing (selectors on a
  tool that takes none are reached through every other tool).

## Alternatives considered

- **The text's string in the style's label** (`t = text(P) [label="…"]`): no new Expr or
  Value kind, but the content of a text would be a style, a `label` edit would change it, and
  "anchor + string" would not be a value the exporters receive. Rejected.
- **String objects** (`s = "abc"`): forbidden by Run 6's frozen error test, and nothing uses
  them.
- **mark_angle marking the directed angle** (counter-clockwise from BA to BC): half of all
  marks would be reflex angles, and a reflection would turn a marked 40° into a marked 320°.
- **Choosing the right-angle style automatically at 90°**: a decision that flips between arcs
  and a square at the band, and a square on an angle that is only nearly right.
- **Marks sized in world units**: they would vanish when zooming out and fill the screen when
  zooming in; olympiad figures draw them at a fixed size.
- **New capabilities for each mark kind**: nothing takes one kind but not the others.
- **Modifying VALUE_KINDS and its frozen test under this ADR**: possible, but DISPLAY_KINDS
  keeps SPEC §4's list intact and needs no modification.
