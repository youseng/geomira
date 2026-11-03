# ADR-0010: The scene: viewport, scene builder, draw order, coincident images, labels, hit-testing, renderer (Run 7)

Status: accepted (Run 7). Extends SPEC §8.2 (layer semantics), §13 (scene and rendering) and
§17 (laws L8, L9); adds three Style fields (decision 6) and their language keys, which extends
ADR-0009's grammar (its EBNF block is updated); reads ADR-0007 decisions 9–10 and ADR-0009
decision 20 (image order) for drawing. Numbered 0010 (note E of the run).

## Context

Run 7 builds packages/scene (SPEC §13: viewport, scene builder, clipping, labels, hit-testing)
and the canvas renderer of apps/web with a development page. SPEC fixes the pipeline (values +
doc → SceneBuilder → Scene of world primitives → canvas | exporters), the y-up world flipped
only in the viewport, "hit-testing uses the SAME primitives that are drawn" (L8), finite scenes
(L9), the coincident-image rule, labels with a text grammar and "offsets as (angle, pixels)",
and layers "visible iff not hidden and ANY layer visible". It leaves open: what an object in
several layers looks like (opacity, z-order), the draw order (note A of the run: never an
image's index in the object list, which text round trips do not preserve, ADR-0009 decision
20), where z and label offsets are stored, what "coincides" means for lines, circles and
polygons, how labels are placed, what a virtual hit is, and how totality is kept for huge and
tiny figures and views (note C).

## Decision

### Pipeline (packages/scene)

1. **Two stages, one list for drawing and picking.** `buildScene(doc, values)` → `Scene`:
   world shapes (point, line with unit direction and range, circle or arc as angles, polygon)
   in draw order, the visible objects whose value is Undefined or Inexact with their reason
   (`unavailable`), the coincident images, and the figure scale. `layout(scene, view)` →
   `DisplayList`: the screen paths (dot, polyline, arc; CSS pixels, y down) and placed labels.
   The canvas renderer draws exactly the display list, and `hitTest(display, cursor)` tests
   exactly it, so L8 holds by construction and is checked by law (decision 15). Exporters
   (a later run) consume the Scene (world coordinates) and clip with clip.ts.
2. **Viewport** (viewport.ts, the only world ↔ screen code): View = the document's Viewport
   { cx, cy, zoom (px per unit) } plus the surface size in CSS px; the device pixel ratio
   belongs to the renderer. `viewProblem` refuses non-finite numbers, zoom ≤ 0, sizes outside
   (0, 2^16], a visible region beyond the double range, and a zoom where one pixel spans fewer
   than PIXEL_ULPS = 256 units in the last place of the coordinates (positions would be wrong
   by more than 1/256 px); a refused view lays out to nothing, with the reason. Pan, zoom
   about an anchor (clamped to [2^−600, 2^600]) and fit (bounds + margin; degenerate bounds
   handled) are pure functions.

### Layers and order (SPEC §8.2, note A)

3. **Layer set semantics.** An object is visible iff its effective style is not hidden and
   ANY layer of its set is visible. It is drawn ONCE, in its DRAWING LAYER: the visible layer
   of its set with the highest `order` (ties: the later layer of `doc.layers`), whose opacity
   it takes. (Reading of SPEC §8.2, which does not say which of several layers an object's
   opacity and depth come from; the topmost visible one is what a layer stack shows.)
4. **Draw order by stable keys**, compared lexicographically: the drawing layer's order (then
   its position in doc.layers), the style's z (decision 6; absent = 0), a fixed kind order
   (polygons, circles, lines, points: points stay pickable on top of their curves), the
   position of the object's ORIGIN (the user object at the root of its chain of sources: X**
   → X* → X), then the positions in doc.layers of the rules along that chain. None of these
   depends on where an image sits in the object list; the `unavailable` and `coincident` lists
   are sorted by the origin key too. Law (note A): permuting the images inside any run of
   adjacent images leaves the scene (primitives and their order) and hit-testing unchanged.

### Styles (SPEC §13 "managed images styled like their sources unless overridden")

5. **Inheritance.** An image's effective style is its source's effective style (recursively)
   with the image's own fields on top, field by field (colour, width, dash, hidden, z, label
   offsets). The label TEXT is derived, not copied: a source label L gives the image L +
   the rule's suffix (A labelled "X_1" → A* labelled "X_1*"), an empty source label stays
   empty, and an image's own label wins. Hidden is inherited: hiding A hides A* unless A* says
   `hidden=false`. Drawing values are sanitised (a Style is user data): widths not finite or
   negative take the kind's default (points: dot radius 3.5 px; curves 1.5 px) and are capped
   at 64 px; a non-finite z counts as 0; label distances are capped at 1000 px.
6. **Three new Style fields** (SPEC §5 says the document is the entire state, so what the scene
   needs must be in it; note A names "explicit style z"; SPEC §13 says "offsets as (angle,
   pixels)"): `z?: number` (any finite number; higher is drawn later within a layer),
   `labelAngle?: number` (degrees, counter-clockwise, normalised mod 360; absent = automatic)
   and `labelDist?: number` (CSS px, ≥ 0; absent = 9 px for points, 6 px otherwise). The
   language reads and prints them as `z=…`, `label_angle=…`, `label_dist=…` (style keys after
   `label`, so existing texts print unchanged); ADR-0009's EBNF block and docs/language.md
   are updated; the P1–P3 generator draws them (lines added to gen-doc.ts).

### Coincident images (SPEC §13)

7. **The decision** (coincide.ts) uses BAND and the kernel's own measures: points coincide when
   both coordinate differences are within the band as lengths (the kernel's max-norm
   coincidence of ADR-0003 item 21, at BAND); a line coincides with its image when the
   directions are parallel (`signNormalized`, dimensionless), the image's base point is on the
   source's carrier (`signNormalized` of the cross product, as a length: incidence.ts's
   measure) and the ranges are the same point set (segment ends may swap; a ray's open side
   must point the same way); circles when centres coincide, radii agree (`rootGap`, as a
   length) and both are full or the same arc; polygons when the vertices agree up to a cyclic
   shift in either direction. "Within BAND" is the banded sign being 0 or 'ambiguous'.
   Different kinds, Undefined or Inexact values and overflowing quantities never coincide.
8. **"While the source is drawn"**: an image is not drawn iff it coincides with its source and
   the source is SHOWN, i.e. visible and defined (drawn, or itself hidden as a coincident
   image of a shown source, so X** on X* on X is not drawn either). A source hidden by its
   layer (an "image only" view), by its style, or Undefined lets the image be drawn: fixed
   points never disappear. Stateless; the document is not changed.

### Labels (SPEC §13)

9. **Text grammar** (label-text.ts): `_x` / `_{…}` subscripts, `^x` / `^{…}` superscripts,
   primes as ′ ″ ‴ ⁗, a managed image's stars raised, `\omega` and the other Greek names as
   letters, `\` + character literal; total (unclosed groups run to the end; a trailing `_` is
   literal). It covers every name of SPEC §11.2 (`M_{ab}`, `A_1''`, `ω*`).
10. **What is labelled**: points by their name; other kinds only when they have a label text;
    an empty label text means no label.
11. **Placement**: the anchor is a point's dot, the middle of the visible part of a line,
    segment or ray, a circle's point at 45° when visible (else the middle of its first
    visible arc), a polygon's vertex centroid; the label sits `dist` px from it in direction
    `angle`, aligned away from the anchor (left/centre/right, bottom/middle/top by octant).
    Automatic direction for points: of the eight compass directions, preferring 45°, 135°,
    315°, 225°, 90°, 0°, 270°, 180°, the first whose gap to every drawn curve through the point
    (within 3 px) is largest, gaps counted in whole degrees and capped at 45°. Labels whose
    anchor is off the surface are not placed. Labels are not hit-tested (decision 13).

### Clipping, hit-testing

12. **Clipping in world coordinates** to the visible rectangle grown by MARGIN_PX = 68 px (the
    widest stroke plus 4) before mapping (clip.ts): lines by slabs, circles by their crossings
    with the edges (computed as r·√((1 − q)(1 + q)), no overflow), arcs by span intersection,
    polygon fills by Sutherland–Hodgman. Arcs with a screen radius above 2^15 px are sampled as
    polylines within 1/4 px of the circle. So every screen coordinate is finite and within the
    margin of the surface, whatever the figure's scale (L9).
13. **Hit-testing** (hit.ts): an item is hit when the cursor is within 6 px of a stroked path
    (plus half its stroke), within a dot, or inside a polygon fill by the nonzero winding rule
    (the canvas's fill rule); hits are listed top first. **Virtual hits** (what the editor's
    tools would create where no point is under the cursor): the nearest intersection of two
    drawn curves under the cursor within the radius, else the nearest point of the topmost
    curve (a point on it), else a free position, each with screen and world coordinates; none
    when a point is hit or the view is refused. Labels are not hit (their size depends on the
    renderer's font); picking an object by its label is an editor decision for a later run.
    **Amended by ADR-0049:** labels are hit-tested (scene `label-hit.ts`) on the box their runs
    are drawn in, from the widths the renderer measures, and can be dragged in the Move tool.

### Renderer (apps/web)

14. `drawDisplay(ctx, display, ui, theme, dpr)` is a pure function of the display list (itself
    a function of scene and view) and of { hover, selection }: it resets the transform to
    dpr (HiDPI: the canvas has css size × dpr pixels), clears, draws fills, strokes, dots and
    labels in order, with hover and selection halos under their items. An invalid CSS colour
    leaves the theme's colour (the canvas ignores invalid assignments, so the default is set
    first). It writes only to the 2D context it is given.

### Laws

15. L8 (hit/render consistency): every sampled point of every drawn path on the surface hits
    its item; at random cursors, every hit item has drawn geometry within the radius (by dense
    sampling, independent of hit-geom.ts) or contains the cursor, and every item drawn within
    the radius is hit; and the renderer draws exactly the display list's paths (a recording
    context). L9: every number in scenes, display lists, labels and hit results is finite, on
    random documents and on extreme figures (coordinates to 1e150, tiny coordinates, views of
    any zoom, refused views) and empty scenes. The laws on PARSED documents (the language's
    document generator and the eight examples, note B) live in apps/web/test, because SPEC §2
    forbids packages/scene, tests included, to import the language; scene-level fuzzing lives
    in packages/scene/test/laws.

## Consequences

- The editor run builds selection and tools on `hitTest` (hits, virtual hits) and stores label
  drags as `labelAngle` / `labelDist`, z changes as `z`; all are in the text.
- The printer now prints runs of adjacent images in their canonical order (lang's
  `sortImageRuns`), so the TEXT does not depend on that order either: a Run 6 bug found by the
  NIGHTLY=1 run of P1's fixed-point test (print∘parse∘print ≠ print when edits had left a run
  out of canonical order and its images had style lines), fixed with a regression test
  (packages/lang/test/print-image-order.test.ts).
- The export run consumes `Scene` (world coordinates) and `clipLine` / `clipCircle`.
- `mark_angle`, `mark_right`, `mark_segment` and `text` (SPEC §6.2 display tools, listed by
  Run 3b as "display values the scene defines, a later run") are not built here: Run 7's
  brief does not list them, and they need new value kinds; the scene's kind order and shapes
  extend by one entry each (asked under Requests in STATUS).

## Alternatives considered

- Drawing an object once per layer of its set: an object in two layers would be drawn twice
  (and twice as opaque); SPEC calls the layers a set.
- Hiding coincident images by a document flag: SPEC §13 says stateless, no document change.
- Coincidence of lines by carrier only: a segment and its image on the same line but
  different ends are different objects and must both show.
- Hit-testing the world shapes directly (unclipped): a second geometry path that could
  disagree with what the canvas shows (clipping, sampled arcs, margins); one display list
  makes L8 structural.
- Label offsets in the editor's state only: not in the text, so not reproducible (CLAUDE.md
  "every UI state is expressible in the text format").
- Even-odd polygon hits: disagree with the canvas's default nonzero fill on self-intersecting
  polygons (found while writing the L8 check).
