# ADR-0074: A responsive, discoverable construction workspace

Status: authorized by release prompt 09; final combined verification remains required.
Extends ADR-0016, ADR-0024, ADR-0060, ADR-0062 and ADR-0064. Preserves ADR-0065's
public claim retirement, ADR-0067 recovery and ADR-0068 modal ownership.

## Context

At the integrated task 03/05/06 base, headers still clip controls at 390 and 768 pixels.
The fixed sidebar squeezes intermediate-width canvases. Dozens of palette buttons are
individual tab stops; icon discovery depends on hover. The phone panel covers the figure.
Triangle type is hidden on phones. Properties depends on discovering right-click, and
an empty document has little guidance. Source screenshots confirm these problems.

## Decision

- Let the header wrap at intermediate widths. Keep File, undo/redo, Randomize, View,
  Examples, Export, help and recovery reachable; narrow headers expose triangle type
  and Settings through More actions. Primary phone targets are at least 44 CSS pixels,
  including source Apply/Revert, conversion, diagnostic buttons and Editor help.
- Put tool search, Pan, panel restoration and the first-use guide in a named workspace
  bar. Search uses the existing filtered tool catalog, readable labels/IDs, registry
  operation names and spelling normalization; it selects through the same `chooseTool`
  path as palette buttons. Keyboard selection scrolls the active result into the bounded
  list before the next paint. Recent tools are filtered through that catalog, so stale or
  hostile preferences cannot expose retired public tools.
- Keep the complete grouped palette. Use one roving tab stop; Home/End go to its ends
  and arrows follow its desktop vertical or phone horizontal orientation. Tool selection
  and native text-field arrows retain their separate meanings. Phone group labels are
  horizontal/readable. Short viewports can reveal the complete palette through Tools.
- Desktop panels collapse without unmounting draft state and resize by pointer or keyboard
  within limits reserving at least 300 pixels of canvas. Persist panel width/collapse,
  compact-sheet choice, guide dismissal and recent tools in a separate best-effort
  workspace key. Storage denial never breaks those controls or changes geometry save state.
- Phone panels have compact/expanded heights, bounded below the actual header/workspace
  bar. Observe visualViewport height for keyboard/window resizing, keeping the existing
  canvas world-to-screen mapping through ResizeObserver. Compact panels expose the figure
  during edits. The native editor and its validation/actions remain scrollable. Its real
  editing surface is at least 120 pixels high. Short phone/landscape viewports use an
  in-flow panel and scroll the page instead of compressing source below a fixed header.
  Long editor guidance is collapsed under Editor help (ADR-0075).
- The current-tool status names picked objects as well as the real machine's next input.
  Add explicit Pan: a press pans even over points and a still press does not construct.
  Existing box selection, right/middle pan, touch pan/pinch, wheel zoom and Escape remain.
- A visible Properties action opens the existing selected object's card. Its position and
  maximum height follow the visible viewport. Keep right-click/long-press entry points.
  Keep tool, selection and Zoom controls in a constant reserved strip above the drawable
  canvas. Critical notices remain in a separate normal-flow region, as specified below.
- A small dismissible guide offers points, a starter triangle, tool search, Move, text and
  export. Starting a triangle requires both an empty construction and a clean draft at
  click time. Other guide actions choose or focus existing controls. No existing document
  or unapplied draft is replaced; starting an action dismisses the guide from the canvas.

## Validation and frozen behavior

New workspace tests cover the width matrix, collapse/resize without geometry edits, search
and selection-first behavior, public capability filtering, roving focus, Pan/Properties,
first-use safety, denied preference writes and short phone panels. Existing ordinary
keyboard/touch/modal/file tests stay enabled. Changed full-page/canvas dimensions require
individual composed visual review; do not regenerate references blindly or loosen limits.
The shared Tab type lives in dependency-free panel-types, avoiding a component/hooks cycle.
Hosted Firefox/WebKit run both workspace suites; offline Chromium also runs the composed
newcomer, source and keyboard workflows. Actual locally available engines are reported in the result file.

Deliberate interaction-fixture migrations retain all existing semantic assertions:

- Property dismissal chooses View → Fit when the floating card covers the canvas Fit button.
  Its canvas path chooses a genuinely exposed canvas point rather than hitting a larger phone
  swatch; re-entry after canonical-text inspection uses visible Properties. Another-card
  entry uses the Objects-row right-click when the current card covers the canvas target. Rename persistence,
  exact source and the one-Undo restoration remain unchanged.
- Dependency drags hide the phone Objects sheet through its visible control before targeting
  the canvas. The dependent parent/child coordinate assertions remain unchanged.
- Finger dragging zooms out once before an outward world-coordinate drag whose target would
  otherwise be off-screen in the narrower layout. The expected final point is unchanged.
- Short-sheet acceptance now requires a useful source surface and scroll-reachable controls,
  replacing an upper bound that rewarded clipping the editor. No tolerance, snapshot reference,
  test timeout or test-count floor is weakened.

## Consequences and limits

Workspace preferences are not portable document metadata, cloud backup or geometry history.
Unavailable preference storage affects persistence of those choices only. Browser viewport
simulations and accessibility assertions do not constitute real iOS/Android keyboard or
screen-reader testing. Final device/engine limits and exact commands are recorded in the
result file and integrated STATUS. No runtime dependency or new mathematical tool is added.

## Integration correction: fractional canvas projection

The new responsive layout can place the canvas on fractional CSS bounds. The display
has whole logical client dimensions; its backing bitmap has independently rounded
width and height after multiplying by the device ratio. Treating CSS offsets as logical
pixels misaligns pointer hits with the rendered image. Keep the logical display size,
map delivered pointer/wheel coordinates by `logicalSize / actualCSSRect`, and use the
inverse for long-press anchors and selection-box overlays. Rasterization uses separate
`backingWidth / logicalWidth` and `backingHeight / logicalHeight` scales, including tool
previews. Logical sizes are positive, as supplied by `useSurface`; empty CSS rectangles
receive no input. No layout is forced onto an even-pixel grid. The render path reads the
CSS rectangle for an overlay only while an actual selection box exists.

A Chromium regression with fractional width/height failed before this correction:
it expected canonical `A = (-0.016, 0)` from an independent physical-to-logical projection,
but received `A = (-0.02, -0.0022)`. The corrected input contract passes at ordinary and
fractional device ratios. Unit checks assert inverse projection and the exact independent
raster scales used by both figure and preview. Renderer assertions and tolerances remain.

Firefox adds a separate native-driver input limitation: CI trace requested y=371.4000015
at canvas top104.3999939 and height533.583374 (logical height534), while the delivered
integer client y=371 explains the original 0.008-world offset at zoom50. Neither the app
nor a test can recover a fractional request absent from the delivered browser event.
World-coordinate fixtures now independently calculate expectations from the actual native
pointerup's client position and the displayed rectangle/logical metrics. They use the
existing documented 10^-4 construction grid for their scale<10/zoom50 figures. They do
not import the production projection or rounding implementation and do not accept a
coordinate tolerance. Mouse-versus-command canonical text still compares byte for byte;
free-drag undo still restores exactly B=(4,0); the reflected image uses the independent
inverse reflection formula. A separate exact typed-coordinate test retains the original
triangle coordinates and exact canonical undo/redo comparison. Workspace resize and delayed
startup assert the exact point corresponding to delivered native input. No pointer events
are fabricated or replaced with synthetic DOM dispatch, and no snapshot references change.

Frozen fixture changes for this correction: `apps/web/e2e/helpers.ts`,
`flows-build.spec.ts`, `workspace.spec.ts`, and `persistence.spec.ts`. Their meaningful
construction, history, mapping and delayed-startup assertions remain active in all
supported browser projects. Local Firefox still cannot launch due graphics/sandbox
constraints; CI remains authoritative for the actual Firefox event delivery.

## Integration correction: native control targets and exposed drawing space

Final native-browser review found four failures that bounding-box-only checks missed:
Recovery overlapped its header toggle, save-label reflow moved View between pointer down
and click, selection/Zoom controls covered existing points, and an undisposed guide caught
construction clicks. The interaction contract is now:

- Reserve 72px before the drawable canvas for tool/selection/Zoom controls, independent of
  selection state. Zoom occupies the right side; Properties remains visible at the start
  of the horizontally scrollable selection row. Neither a card opening/closing nor a
  selection changes the canvas rectangle. The box-selection outline adds the same canvas
  offset; physical-to-logical projection and raster scaling stay unchanged.
- Keep long notices, PWA update/refusal copy and their native backup/review actions fully
  in normal page flow. They never enter the bounded tool-controls strip. Recovery uses a
  dedicated DOM outlet in that flow region, retaining its native header disclosure, focus,
  version inspection/restore/resolve and backup behavior. This is not a modal or a new
  persistence state machine. Its revision list can scroll within a viewport-bounded region.
- Phone panels use page flow at every height. Compact/expanded choices retain useful source
  space, while the stage reserves at least 120 actually exposed drawable pixels. Source has
  at least 120 visible pixels. A page-scroll hint and panel header controls make the figure,
  tools and command bar reachable. Desktop short windows also preserve the drawing minimum.
- Header and message grid tracks use their full intrinsic height; flex wrapping cannot paint
  a second header row over the workspace bar. Header menus anchor below the measured live
  header/workspace ceiling, update after scrolling and stay bounded by the visible viewport.
  Clicking the same More/View invoker closes it without executing an obscured menu entry.
- Reserve the longest save-label width invisibly so a rename's outside-pointerdown commit
  cannot move a later header click target between Saving and Saved locally.
- Every explicit palette, search, shortcut or Pan choice dismisses the first-use guide.
  Successful command-bar edits also dismiss it, including `tool point` and `tool polygon`,
  without re-parsing commands in the UI or connecting pure editor packages to preferences.
  Fresh initialization still shows the guide; existing geometry/raw-draft safeguards remain.

Additive regressions in `interaction-layout.spec.ts` and `recovery-layout.spec.ts` exercise
native clicks/keys, unchanged pointer-target geometry, delivered-pointer selection outlines,
actual `elementFromPoint` exposure, source visibility and recovery/blocked-storage controls.
The exposure matrix includes 320/390/760×664, 390×420 and 820×390. No existing mathematical
assertion, tolerance, screenshot reference or test-count floor is weakened by this correction.
Final visual references are reviewed separately by the release-artifact owner.

The five Guide-to-Point routes in `interaction-layout.spec.ts` use the same independent
native-event coordinate oracle as the construction fixtures above. A 225px logical canvas
has a half-pixel center: at top 227 and zoom 50, requesting y=339.5 but receiving integer
client y=339 corresponds exactly to world y=0.01. A literal world origin is therefore not
a valid cross-engine mouse expectation. These routes still require exactly one A, compare
the complete canonical document byte for byte with the delivered-event expectation, and
check the canvas rectangle is unchanged before/after input. Guide dismissal is required
both before and after the click. All other reflow, outline and history assertions remain.
This changes only fixture expectations; no application code, synthetic events, coordinate
tolerances, input rounding, screenshot references or typed-coordinate assertions change.
