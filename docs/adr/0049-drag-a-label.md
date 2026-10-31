# ADR-0049: Drag a label on the canvas

Status: accepted (maintainer request "usability", item 5, 2026-10-31). Amends ADR-0010
decision 13 ("labels are not hit-tested") and SPEC §13 (labels are hit-tested, on the box the
renderer draws them in); extends ADR-0012 decision 9 (the drag protocol) with label drags and
ADR-0013 decision 6 (canvas gestures); keeps ADR-0029 decision 2 (the 500 ms long press).
Uses the style fields `labelAngle` / `labelDist` of ADR-0010 decision 6 (`label_angle`,
`label_dist` in the text): the language does not change.

## Context

The maintainer asked that dragging a point's label (and a line's or a circle's) move it, with
ONE edit at the end writing the existing label angle and distance (the text shows it; undo
restores); a press on a label drags the label, a press on the point drags the point (the
priority stated where they overlap); a distance limit so a label stays near its object; touch
must not conflict with the long press that opens the style card. Item 4 (measurements shown as
value labels, a later agent) will reuse the label drag, so it must not be points-only.

ADR-0010 decision 13 refused label hit-testing because a label's size depends on the renderer's
font. What exists: `label-box.ts` ESTIMATES a label's box from character counts (0.62 em per
character at 15 px) for one decision only, whether two automatic labels overlap; the canvas
renderer measured each run with `measureText` and placed the runs itself (render.ts). A hit
test on the estimate would disagree with the drawn text (a wide "W", a narrow "l").

## Decision

### Hit-testing labels (scene, `@geomira/scene/label-hit`)

1. **One geometry for drawing and picking.** `labelGlyphs(label, widths, px)` places a label's
   runs from their measured advance widths (alignment, baseline, sub- and superscript shift and
   size: the renderer's rules, moved here unchanged) and returns the box they occupy (the runs'
   advance widths horizontally, their em boxes vertically: 0.8 em above and 0.2 em below each
   baseline). The canvas renderer now draws the glyphs `labelGlyphs` gives, from the widths it
   measures (render.ts `measuredWidth`), and `hitLabel(display, q, width, px)` tests the same
   box with the same measure. So what is drawn is what is hit, by construction, as for paths
   (L8); the drawing is unchanged pixel for pixel (the arithmetic is the same; the screenshot
   baselines on desktop pass). Without a canvas (Node tests, exports) the measure is the scene's
   estimate (`estimatedWidth`, label-box.ts's rule per run).
2. **What is hit.** A press inside a label's box grown by LABEL_PICK_PX = 2 px; overlapping
   labels: the one drawn last (on top). Every placed label with text is pickable except a text
   object's string (ADR-0011: the string IS the object, dragged by its handle, ADR-0028). The
   label is not part of `hitTest`'s hits: tools still pick objects by their drawn geometry, and
   the L8 law on hits is unchanged; `hitLabel` is a separate query.
3. **Law** (apps/web/test/laws/label-hit-laws.test.ts): on the examples and on generated parsed
   documents, the rectangles of the runs the renderer draws are read back from its calls on a
   recording context (fillText positions, font sizes, measured widths) independently of the
   scene; a press at the centre of each drawn label hits it (or a label drawn after it), with a
   box equal to its drawn runs' union; every label hit on a grid of cursors has drawn runs
   within LABEL_PICK_PX of the cursor.
4. **The offset of a position.** `labelOffset(label, at)` is the inverse of the placement
   (labels.ts puts the label's reference point `dist` px from its anchor in direction `angle`):
   angle in degrees counter-clockwise as seen, in [0, 360), and distance; on the anchor, the
   current angle and 0 (property-tested).

### The gesture (editor, the drag protocol)

5. **Edits.** `dragStart(id, part 'label')` → `dragLabel(angle, dist)`… → `dragEnd` |
   `dragCancel` (packages/editor label-drag.ts, dispatched by drag-edit.ts). As for point drags:
   the first move records the history entry ("move the label of A"), later moves amend it, so
   the gesture is ONE entry; `dragCancel` restores the document and history exactly; document
   edits, undo and redo are refused while it runs; a `dragMove` on a label drag and a `dragLabel`
   on a point drag are refused. A drag that ends with the offset it started with is no edit (as
   if cancelled); a press without a move adds nothing. A missing object and an object in a
   locked layer (ADR-0020) are refused at the start.
6. **Generic.** Any object with a style can have its label dragged: the edit writes its style's
   `labelAngle` / `labelDist` (a managed image's own fields, ADR-0010 decision 5); the scene
   decides what is drawn. A labelled display value (item 4) needs only to be placed as a label.
7. **Rounding and the limit, at every move** (so the drag shows what will be written): the
   angle in whole degrees, normalised to [0, 360); the distance in whole CSS px, clamped to
   [0, MAX_LABEL_DRAG_PX = 100]. 100 px keeps a label visibly attached to its object at any
   zoom (the scene still accepts up to 1000 px typed in the text or the card); whole degrees
   move a label at most 0.9 px at 100 px. The text shows `[label_angle=101, label_dist=15]`.

### Canvas (apps/web)

8. **Priority** (gestures.ts, Move tool only, as point drags): a press that starts a point drag
   drags the point: the dot wins within its radius plus the pick radius (HIT_RADIUS = 6 px),
   whatever label overlaps it; otherwise a press inside a label's box drags the label (also over
   a line or circle, which the Move tool does not drag: a press there used to pan); otherwise it
   pans. A point the editor refuses to drag (a constructed point) does not hide its label: the
   label is dragged. In other tools labels are not dragged (a press is the tool's click).
9. **Following the pointer.** The label's reference point keeps the offset from the pointer it
   had when grabbed: each move sends `labelOffset(label as grabbed, pointer − grab offset)`.
10. **Touch and the long press (ADR-0029).** The same click slop and timer as point drags: a
    press that moves CLICK_SLOP = 4 px before LONG_PRESS_MS = 500 ms is a drag (the timer is
    cancelled); a still press is a click, or held 500 ms the style card opens, and the label drag
    it started is cancelled (no edit). The card opens on the LABEL'S OBJECT: `pressedObject`
    (the topmost hit object, else the object of the label under the press) serves the long
    press and the right-click alike. Escape (a `dragCancel`) ends the gesture quietly (ADR-0028).

## Consequences

- Labels can be placed by hand; every placement is the text's `label_angle` / `label_dist`.
- A right-click or a long press on a label opens its object's style card.
- The renderer and the hit test share `labelGlyphs`; a change of the renderer's label metrics
  is a change of the scene module, and the law above checks them against the drawn calls.
- `@geomira/scene` gains the subpath `./label-hit`; the editor's `Edit` gains `dragLabel` and
  `dragStart`'s optional `part`; `DragState` an optional `part`.

## Alternatives considered

- **Hit-testing the estimated box (label-box.ts)**: simple, but not what is drawn (L8 in spirit
  broken): a press on a wide label's end would miss it, a press beside a narrow one would hit.
- **Measured boxes inside the display list (layout with the host's measure)**: the display list
  would depend on the canvas; the PNG export, which lays out without a canvas and draws on one,
  would then place runs by the estimate. Measuring where the renderer measures keeps one rule.
- **Labels in `hitTest`'s hits**: every tool would pick objects through labels, and the hit law
  (every hit has drawn geometry within the radius) would need an exception.
- **The label wins over the dot everywhere in its box**: a label at distance 0 (or a large font)
  would make its point impossible to drag; the dot's own pick area is small and visible.
- **Rounding only at drag end** (as point drags): the label would jump at the release; with
  whole degrees and px the steps are below a pixel or two, so the drag shows the final place.
- **No limit, or the scene's 1000 px**: a label dragged across the figure no longer reads as its
  object's; 100 px is a few label heights, far more than the 6–9 px defaults.

## Frozen tests changed

None. Added lines only: `packages/scene/test/exports.test.ts` (the `./label-hit` subpath) and
`packages/editor/test/helpers/fuzz-commands.ts` (label gestures in the model-based fuzz, L5/L6).
New tests: `packages/scene/test/label-hit.test.ts`, `packages/editor/test/label-drag.test.ts`,
`apps/web/test/gestures-label.test.ts`, `apps/web/test/laws/label-hit-laws.test.ts`,
`apps/web/e2e/label-drag.spec.ts`.
