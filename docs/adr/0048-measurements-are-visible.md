# ADR-0048: Measurements are visible

Status: accepted (maintainer request "usability", item 4, 2026-10-31). Extends SPEC §5 (the Style
gains `show` and `digits`), §11.1 (two style attributes), §13 (the scene draws measurements),
§14 (exports draw them) and §15 (the Measurements list; the style card of a measurement);
extends ADR-0009's grammar (its EBNF block gains the keys), ADR-0010 (a new shape kind and its
label placement), ADR-0011 (an angle measurement is drawn as an angle mark's arc), ADR-0029
decision 4 (the style card's fields of a number) and ADR-0049 (a measurement's value label is
dragged and, in the Move tool, clicked to select).

## Context

The Distance and Angle tools create numbers (`d = dist(A, B)`, `α = angle(B, A, C)`). Numbers
were never drawn (ADR-0010: `shapeOf` gives `none`), and the style card said "Not drawn". The
maintainer asked that a distance measurement be drawn as its value at the segment's middle,
offset so it does not sit on the segment and readable at any zoom, an angle measurement as an arc
at the vertex with the value in degrees; values live during drags, with a precision setting
(default 2 decimals, degrees with °); selecting, hiding, colour and dragging the value label as for
other objects, in the text; a compact list of measurements with their values (Undefined shown as
Undefined); exports drawing them, the golden snapshots unchanged for documents without shown
measurements.

## Decision

### What is a drawable measurement (scene `measure.ts`, `measureDef`)

1. **Definitions.** A number object is a DRAWABLE MEASUREMENT when its definition is
   - `dist(A, B)` (two points): drawn from A to B;
   - `dist(P, l)` (a point and a line, segment or ray): drawn from P to its foot on the carrier
     line of l (what the kernel measures; the foot is computed by the scene in floats);
   - `angle(A, B, C)`: the convex angle at B (the angle mark's span, ADR-0011 decision 3, read
     from the float cross product);
   - `dangle(A, B, C)`: from the direction of BA counter-clockwise by the value (the directed
     angle from line BA to line BC, mod 180°).

   Their arguments must be NAMED objects (references): the scene has the values of objects, not
   of inline subexpressions (SPEC §5: they have no identity), and it does not evaluate. Every
   other number (ratio, area, power, radius, arithmetic, sqrt/sin/…, a measurement of inline
   expressions) is not drawn, and `measureDef` says why: "only dist, angle and dangle
   measurements are drawn" or "a measurement is drawn only when its arguments are named
   objects". The style card and the Measurements list show that reason. `radius(c)` and the
   others could be drawn later (a label on a radius, a ratio near its segments) and are left out
   because their place on the figure is not obvious.

2. **Degenerate cases.** An Undefined or Inexact value (`angle(A, A, C)`: A = B) is never drawn;
   the scene lists it in `unavailable` with its reason, as it does for every visible object
   (SPEC §13), so exports warn about it (ADR-0026) and the Objects panel and the Measurements list
   show the reason. `dist(A, A)` and P on l are 0 (defined): the value sits at A (the foot),
   offset straight up (direction 90°). An arm of zero length or a non-finite coordinate cannot
   happen for a defined value; if a hand-made document has one, the measurement is not drawn
   (with a reason), never drawn as garbage. A straight `angle` (180°): the arc is the half circle
   on the counter-clockwise side from BA (the float sign of the cross product decides, as for
   angle marks); as the angle passes through 180° the convex angle genuinely changes sides, and
   the arc follows it.

### Shown or not: the language (`show`, `digits`)

3. **`show[=true|false]`** is a new style key (a flag, read and printed like `hidden`: `show`,
   `show=false`). A number is drawn iff its effective style has `show` (and not `hidden`, and a
   layer of its set is visible, as for every object) and it is a drawable measurement. ABSENT
   MEANS NOT DRAWN: numbers were never drawn, so every existing document, every example and every
   golden snapshot is unchanged. The key is accepted on any object (the language does not decide
   value kinds); other objects ignore it (`show` on a point has no effect: points are drawn
   anyway). We considered reusing `hidden` (`hidden=false` on a number shows it): a number's
   default would then be "hidden" while every other object's is "shown", and `hidden=false`
   would read as a no-op; a word that says what it does is clearer.
4. **`digits=N`**, a whole number from 0 to 10 (absent: 2), is how many decimals the value shows;
   angles get a degree sign. The precision lives PER OBJECT in the text (CLAUDE.md: every UI state
   is expressible in the text): a document-level directive (`@digits 3`) would need a new
   Document field, a new edit and its own printing and undo; an app setting would make the same
   file show different figures on different machines ("a saved file reproduces the same
   figure"). A per-object attribute uses the style edit, history and printing that exist. Values
   are written with `toFixed` (round half away from zero as the double is stored); a value that
   rounds to zero has no minus sign; `digits` outside [0, 10] or not whole is a language error
   ("\"digits\" takes a whole number from 0 to 10", hint `write digits=2`) and refused by the
   editor's style edit.
5. **Printing**: after `label_dist`: `… label_dist=12, show, digits=3]`. The P1–P3 generator draws
   both keys (lines added to `gen-doc.ts`); `docs/language.md` is regenerated; ADR-0009's EBNF
   block lists them.

### Drawing (scene)

6. **A distance** is a new shape kind `distance` { p, q } with NO stroke: its value label is
   all it draws, at the middle of pq. Its automatic direction is to the LEFT of p → q as seen
   (`dist(A, B)` with B right of A: above), the normal of the measured segment, so the label
   never sits on the segment; it is continuous while the points move (the direction of A → B is
   directed, so no side flip as the segment turns; only A = B has no direction: then 90°). The
   distance is CURVE_LABEL_DIST = 6 CSS px and the box is aligned away from the anchor (ADR-0010
   decision 11), so the offset is in pixels, the same at every zoom (ADR-0011 decision 14). A
   distance item is kept in the display list while its middle is inside the clipping rectangle;
   its label is placed when the middle is on the surface.
7. **No dimension line.** We decided against the optional thin dimension line: the value at the
   middle of the segment is what olympiad figures and the maintainer's examples show; a line
   parallel to the segment would double every drawn segment, and one on the segment would hide
   it. It can be added later as a style option without changing the text of existing files.
8. **An angle** is drawn as the existing `angle_mark` shape with one arc (radius MARK_RADIUS =
   14 px, mark-paths.ts) and the value as its label, which an angle mark already places on the
   bisector outside the outermost arc; the arc is its stroke (colour, width, dash, opacity of the
   style). Reusing the shape reuses its layout, clipping (L9), hit-testing and every exporter.
9. **The label text**: the value; a style `label` is a PREFIX: `label="AB"` shows `AB = 3.61`
   (the prefix in the label grammar, `b_1` with a subscript; the value literal). An empty label is
   the same as none. `label_angle` / `label_dist` place the value as for any label.
10. **Draw order**: measurements share the angle marks' rank in the kind order (above lines and
    segment marks, below points and texts).
11. **Live during drags.** The value is the evaluated number of the frame (the scene is built
    from the values every frame), so the figure's labels follow a drag. The extra work per frame
    is a lookup of two or three values per shown measurement; drag-frame.spec.ts was run on the
    base and on this branch (both above the 8 ms budget in this container, as known: see the
    report). The PANELS (including the Measurements list) show the settled state during a drag
    and update at its end, as every panel does (note F of Run 9a: a drag frame does not rebuild
    the panels).

### Selecting, styling, dragging (editor, web)

12. **Hit testing.** The angle arc is a stroke: `hitTest` hits it (L8 as for marks). The value
    label is hit by `hitLabel` (ADR-0049: the box the renderer draws, so what is drawn is what is
    hit); a distance has no stroke, so its middle is not a hit target (the segment under it stays
    pickable). **A click in the Move tool on a label that hits no object selects the label's
    object** (the click input carries `label`, `moveClick` uses it when no object is hit): a
    measurement's value is its body. This applies to every label (a point's label too), which is
    the natural reading of "picking an object by its label" left open by ADR-0010 decision 13. Other
    tools still pick by geometry only.
13. **Dragging the value label** is ADR-0049's label drag unchanged (it is generic over styled
    objects): one edit of `label_angle` / `label_dist`, whole degrees and px, at most 100 px.
14. **The style card** (apps/web style-measure.ts): a drawable measurement gets the card kind
    `distance` or `angle` (also when its value is Undefined: its static kind is number). Its
    "Visible · shown" checkbox is `show` (ticking writes `show` and clears `hidden`; unticking
    removes `show`). While the draft shows it: colour, opacity, label (the prefix), shown, and
    under More the decimals, z and the label offset; an angle also has the line width and dash
    (its arc). While not shown: only "shown" and the decimals, and the note "Not drawn: tick
    "shown" to draw its value.". A number that is not a drawable measurement keeps "Not drawn:
    nothing to style.", or, when its style asks for `show`, "Not drawn: <reason>." Strings and
    maps are unchanged. The canvas previews the draft as before.
15. **A selected distance** (no stroke for a halo) gets a halo box behind its value label.

### The GUI tools

16. **Distance and Angle create shown measurements**: the tools build with `[show]` (the
    ToolUI's build carries a style). When the same construction exists (ADR-0029: `dist(A, B)`
    is `dist(B, A)`), it is reused, as before, and, if it is not shown, shown by ONE style edit;
    a shown one is only selected (no edit). Other measure tools (ratio, area, power) are
    unchanged.

### The Measurements list (editor `measurements.ts`, web `MeasurementsList.tsx`)

17. At the top of the Objects panel, under "Measurements" (absent when the figure has no
    number): every number object in construction order, with its name, definition and value as
    the figure shows it (its decimals, ° for angles); an Undefined or Inexact value reads
    "undefined: <reason>" / "not representable: <reason>"; "· shown" when drawn, "· not drawable"
    when `show` is asked of a number that cannot be drawn. A click selects (or gives the number to
    a tool waiting for a pick); a right-click or a long press opens its style card. The rows are
    computed in packages/editor (`measurementRows`), the formatting in packages/scene
    (`formatMeasure`). The name buttons' accessible names are "Measurement d", so they do not
    collide with the Objects rows' names.

### Exports

18. Exports draw the display list (ADR-0014), so they draw shown measurements with no exporter
    change: an angle's arc as a path, every value as a label through `texText` / `texLabel`
    (TikZ, Asymptote: numeric positions; ° as `$^{\circ}$`), a distance as its label only. An
    Undefined shown measurement is an `undefined` warning (ADR-0026). The goldens of the examples
    and fixtures are unchanged (no `show` in them). The new fixture
    `tests/fixtures/export/measurements.geo` (compiled by tex.yml: scripts/export-tex.ts reads
    every fixture) has goldens under `packages/export/test/__snapshots__/fixture-measurements`.

## Consequences

- Existing files and goldens do not change; new measurements made with the tools are drawn.
- `@geomira/scene` gains the subpath `./measure` and the shape kind `distance`; `./style` exports
  `placedLabel`; `@geomira/editor` gains `./measurements`; the editor's click input gains the
  optional `label`. The scene and editor `exports` tests gain lines (added only).
- Tests: `packages/lang/test/measure-attrs.test.ts`, `packages/scene/test/measure.test.ts`,
  `packages/editor/test/measurements.test.ts`, `packages/export/test/measure-export.test.ts`,
  `apps/web/test/measurements-web.test.tsx`, `apps/web/e2e/flows-measurements.spec.ts`; the P1–P3
  generator and the parsed-document laws of apps/web (L8, L9, label hits) now see shown
  measurements.

## Alternatives considered

- **Drawing every number, or every dist/angle**: changes every existing figure and golden.
- **`hidden=false` instead of `show`**: see decision 3.
- **A document directive or an app setting for the precision**: see decision 4.
- **The value label hit-tested as part of `hitTest`**: every tool would pick objects through
  labels, and the hit law would need an exception (ADR-0049's reasoning); a label selects only on
  a Move click where nothing else is hit.
- **A handle dot at a distance's middle** (as a text's handle): it would cover the middle of the
  measured segment, which a click there should pick.
- **Evaluating inline arguments in the scene** (`dist(midpoint(A, B), C)`): the scene does not
  evaluate (SPEC §13: values + doc → scene); naming the point is one line.

## Frozen tests changed

None modified. Added lines only: `packages/lang/test/helpers/gen-doc.ts` (the generator draws `show`
and `digits`), `packages/scene/test/exports.test.ts` (the `./measure` subpath, `placedLabel`),
`packages/editor/test/exports.test.ts` (the `./measurements` subpath), and the frozen baselines
`packages/editor/test/fixtures/run-16a-baseline.json` and `run-16b-baseline.json`, which gain the
new fixture's summary (inserted lines only, as Run 16b did for conics.geo: the baseline tests
require every fixture to have an entry).
