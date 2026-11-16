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
- Phone panels have compact/expanded editing space in ordinary page flow. Observe the
  visualViewport height for keyboard/window resizing, preserving the existing canvas
  world/screen mapping. Drawing and visible source each retain at least 120 pixels in the
  tested layouts. Native source focus reserves the stage's minimum height as scroll padding
  instead of centering the editor at the figure's expense. The native editor, validation and
  actions remain reachable; long Editor help is collapsed under its disclosure (ADR-0075).
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

## Integration correction: draft identity must not resize native input

Applying a focused raw draft on canvas pointer-down removed an inline `Unapplied text draft`
badge. In the internal build at 1280px this collapsed a wrapped header by 36px, moving the
canvas up 36px and growing its logical height by 36px. The unchanged zoom/view then mapped
the same physical drop to B=(5,0.6396), instead of the intended B=(5,1). The old source-blur
and pending-pause audit tests correctly exposed this real layout error; their literal
coordinate and Undo assertions remain unchanged.

Keep the document title and draft feedback in a compact stacked identity group. Reserve
the draft line's layout in both states; show and announce its full text only while raw
source is unapplied. Its hidden state has no status role and is aria-hidden. Phone text
wraps within the existing 140px File group, instead of adding a long inline blank slot.
Ordinary Saving/Saved locally/Not saved feedback stays separate and truthful.

Native regressions cover exact header/canvas bounds across source application at
320/390/768/1280px, the delivered-pointer canonical drag, and separate source/drag Undo
and Redo. A baseline native regression failed on the exact 36px rectangle change. Both
public and internal clean/saved header/canvas rectangles match the prior artifact at all
four widths, so no extra default row or canvas loss is introduced. Whole-GUI references
still require final-source review of the title/status placement; no reference is changed
here. Commands, measurements and CI limitations are in `integration-draft-identity.md`.

## Frozen-test accounting for prompt 09

The original workspace migration changed these existing browser fixtures deliberately:

- `apps/web/e2e/mobile.spec.ts`: zoom out once before an outward drag whose destination
  otherwise lies off-screen; the exact final point assertion remains.
- `apps/web/e2e/property-safety.spec.ts`: reach Fit through View when covered by the card,
  dismiss through an exposed canvas point, and use the visible existing object action for
  card re-entry. Exact rename persistence, numeric partial input and one-Undo restoration
  remain. Later native review exposed real moving-invoker/point-coverage defects; those were
  fixed in source and receive separate native regressions, rather than another fixture bypass.
- `apps/web/e2e/tool-dependencies.spec.ts`: close the phone panel before a canvas drag;
  dynamic dependency and exact parent/child position assertions remain.

`workspace.spec.ts`, `workspace-composed.spec.ts`, `interaction-layout.spec.ts`,
`recovery-layout.spec.ts`, `layout-visibility.ts` and `public-workspace.test.ts` were new
files in this release repair. The native-layout follow-up adds/iterates these new regressions;
it changes no pre-existing mathematical assertions, tolerances or test floor. The separate
fractional/native projection correction and its existing-fixture list are recorded above.
Startup-recovery coverage and the independent native Point oracle belong to their linked
integration records. Screenshot reference changes are reviewed by prompt 11 under ADR-0076.

## Integration correction: retained claim suggestions

The internal claim box successfully submitted a claim, cleared its text, and immediately
reopened its empty-input forms list over the panel tabs. Native clicks could not reach Text.
Successful submission now closes that list. Typing or refocusing opens suggestions again;
Escape closes suggestions while retaining the exact text and consuming that dismissal key.
The public build still excludes the claim box. An additive browser regression first failed
on the reopened forms list, then passed with the existing claim-box, claim-tool, claim-chip
and Geomdraw functional flows. The claim-tool fixture now asserts the full exact current-tool
status, including the deliberately added picked names, instead of expecting its old suffix.
This changes `apps/web/e2e/flows-claimtool.spec.ts`; no claim semantics or numeric laws change.

## Supported-engine panel controls and native focus

Final supported-engine CI and independent audit A13 exposed a panel-header layering defect:
the sticky tab strip intercepted Expand/Compact's center at both 320px and 390px. The header
now owns three separate flex cells: a horizontally scrollable tab list, the panel-size
control and Close. The whole header is sticky. Size/Close controls cannot overlap Help or
be covered by the tab list, and native focus/scroll makes every tab reachable at 320px.

WebKit also left only 62px of source visible after native Text focus at 390×420, despite
the app's scroll padding. On phone Text focus, the panel host now measures source, canvas
and the visual viewport and makes the smallest feasible app scroll that exposes at least
120px of both. It repeats after native focus scrolling settles, rounds inward for native
CSS-pixel scroll quantization, and does not change focus, caret, draft or geometry. If the
viewport cannot contain both minima, it leaves native focus behavior intact; users retain
ordinary page scrolling. This does not claim physical-device keyboard verification.
Alignment also runs in a post-focus microtask, after the focus algorithm's synchronous
default scroll, and uses `window.visualViewport` with the inner-height fallback when absent.
Short-panel bodies retain their intrinsic content height and a 220px minimum rather than
shrinking a 260px editor into a smaller body with overflowing controls.

Additive `panel-controls.spec.ts` checks real center hit targets, native pointer/keyboard
Expand/Compact, every public tab, Close/reopen, exact raw draft preservation and geometry
Undo/Redo. Its focus case injects the traced partly visible native-focus placement and
retains the 120px exposure and caret assertions, including without the optional visual-viewport
API. The existing cross-engine exposure matrix
remains unchanged. No frozen assertion, tolerance or reference is weakened.

## Integration correction: native traversal and page-flow fixtures

The complete Firefox walkthrough reaches the guide's first search correctly and constructs
O. Its later forward-Tab loop then reaches the document's final Hide O button and leaves
page focus instead of wrapping through browser chrome. The keyboard-only fixture now uses
native Shift+Tab for an earlier DOM target. Its 60-key bound, every focus assertion, triangle,
circumcenter, object selection, Properties, Escape and export assertions are retained.
No application focus is forced and no browser timeout increases.

The phone fixtures migrate the former fixed-overlay contract to the page-flow contract
above. An open sheet must leave at least 120 actually exposed drawing pixels, reached through
native page scrolling and verified with elementFromPoint. The retained-engine example has
claim badges on the left, so its native empty-canvas hit uses the exposed right-hand stripe;
that complete stripe must provide 120 consecutive drawable pixels. Native outside-card
clicks use the exposed View action, and replacing a card uses the exposed visibility end of
the other object's row. Color commit and exact Undo assertions remain. No clicks are forced
through another control. The sheet fixture keeps exact camera attributes and canonical
source across layout actions and requires closing to restore the complete pre-open canvas rectangle, including position.
Settings is reached through its visible More actions disclosure on phones.

Changed frozen fixtures: `apps/web/e2e/mobile.spec.ts`, `style-popover.spec.ts`, and
`design-mobile.spec.ts`. The new release test `workspace-composed.spec.ts` changes only its
native traversal helper. These are explicit interaction/layout migrations, not changes to
numeric tolerances, screenshot thresholds, timeouts or mathematical assertions. Shared
file tests also assert the explicit build capability: public Claims count is exactly zero;
internal engine Claims count is exactly one. Public claim testing stays retired by ADR-0065.
