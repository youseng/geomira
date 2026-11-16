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
  and Settings through More actions. Primary phone targets are at least 44 CSS pixels.
- Put tool search, Pan, panel restoration and the first-use guide in a named workspace
  bar. Search uses the existing filtered tool catalog, readable labels/IDs, registry
  operation names and spelling normalization; it selects through the same `chooseTool`
  path as palette buttons. Recent tools are filtered through that catalog, so stale or
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
  Stack selection actions with notices and tool controls; reserve their measured height
  above expanded sheets so a refusal and Properties cannot overlap one another.
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
newcomer, source and keyboard workflows. Actual locally available engines are reported below.

Deliberate interaction-fixture migrations retain all existing semantic assertions:

- Property dismissal chooses View → Fit when the floating card covers the canvas Fit button.
  Its canvas path chooses a genuinely exposed canvas point rather than hitting a larger phone
  swatch; re-entry after canonical-text inspection uses visible Properties. Rename persistence,
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
