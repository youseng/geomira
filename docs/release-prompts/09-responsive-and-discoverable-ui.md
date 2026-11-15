# Prompt 09 — Make the workspace fit and teach its tools

Implement this task in Geomira after the public claim-testing removal and core interaction fixes.
The user wants a usable construction, exploration, scripting and export application.
Retain the recognizable palette and existing mathematical visual style.

Audit baseline: `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`.

## Read first and coordinate

- Read this directory's `README.md` common execution contract.
- Follow `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the ADR-reading protocol.
- Read ADR-0016, ADR-0024, ADR-0060, ADR-0062 and ADR-0064.
- Task 01 removes public claim/testing/discovery surfaces; do not restore them through search.
- Integrate after 04's keyboard/dialog boundaries and 05's property behavior.
- Task 03 owns document actions; place those actions coherently without duplicating logic.
- Task 06 owns tool compatibility; consume its existing input model for contextual hints.
- Task 10 owns text editing internals; coordinate panel layout, not editor semantics.
- Use an isolated branch and retain another task's unrelated changes.

## Confirmed responsive defect

At a 768 × 768 CSS-pixel viewport, the desktop layout is active.
The header's controls occupy about 826 pixels: Settings is clipped and header Help is off-screen.
The fixed 96-pixel palette plus 360-pixel sidebar leave a 312-pixel canvas.
Body overflow is hidden, so users cannot simply scroll to the missing controls.

The audit measured widths 320, 390, 768, 1024 and 1440.
Phone widths fit; the intermediate desktop breakpoint does not.
Reproduce with screenshots and bounding boxes, using the latest reduced header from task 01.
A smaller header after claim removal does not eliminate the need for robust intermediate sizing.

## Confirmed usability observations

- The original palette contains 65 separately tabbable icon buttons.
- Similar icons require hovering; a phone has no dependable hover discovery.
- A long horizontal phone strip uses small vertical category labels.
- An empty first visit shows little guidance beyond a canvas and `@version 1`.
- The Move prompt omits box selection and right-button panning.
- The sidebar cannot be collapsed/resized on a narrow desktop.
- The phone drawer covers the figure during edits.
- Styling is mainly discovered through right-click or long-press.

These observations are usability findings, not assertions that every existing interaction fails.
Preserve existing efficient keyboard and mouse workflows while adding clearer entry points.

## Source starting points

- `apps/web/src/styles.css`: application grid and header.
- `apps/web/src/phone.css`: 760-pixel breakpoint and phone toolbar/drawer.
- `apps/web/src/Header.tsx`, `ToolBar.tsx`, `SidePanel.tsx`.
- `apps/web/src/Stage.tsx`, `SelectionBar.tsx`, `panels/HelpPanel.tsx`.
- `packages/editor/src/tool-groups.ts`, `tools.ts`, `prompt.ts`, `keymap.ts`.
- Existing phone, drawer, keyboard, selection and screenshot E2E tests.
- Tool metadata and steps must remain registry/editor data, not a second hard-coded catalog.

## Required release scope

1. Make every header action reachable at all tested widths, using a coherent overflow menu
   where needed. Do not squeeze labels and hit areas until they become unusable.
2. Add a keyboard-operable desktop sidebar collapse control and constrained resize behavior.
   Keep a useful canvas width and a way to restore the panel after resize or reload.
3. Make the phone panel behave sensibly at small heights and when the software keyboard appears.
   Provide a compact/resizable sheet or equivalent view that can expose the figure during edits.
4. Add tool search by readable label/id and sensible existing aliases.
   Search selects the same tool through the same selection-first path as the palette.
5. Keep the full palette available. Add a compact common/recent-tools presentation or
   collapsible labeled groups; do not replace the approved palette with an unrelated design.
6. Show current tool name, named picked inputs and expected next input in a concise region.
   Explain a refused input specifically and preserve its reason where users can see it.
7. Teach box selection, right/middle-button pan, touch pan/pinch, cancel and fit.
   Add an explicit accessible Pan action or Space+drag option without changing existing gestures.
8. Expose Properties for a selected object as a visible action, using task 05's card.
9. Add a small dismissible first-use guide with direct actions: create points/triangle,
   choose a tool, move a point, open text and export. Do not replace an existing figure.
10. Give toolbar navigation roving focus and appropriate arrow/Home/End behavior.
    Respect orientation and let Tab leave the toolbar without visiting every tool.
11. Use comfortable phone hit targets, aiming for at least 44 CSS pixels for primary controls.
    Preserve clear accessible names, active state, visible focus and adequate contrast.

Record any interaction-contract changes in an ADR.
Do not silently change the maintainer's existing two-finger-scroll/zoom preference.
Persist workspace preferences separately from geometry history and file format.
Unavailable storage must not break workspace controls or contradict task 02's save status.

## Acceptance matrix

Test widths 320, 390, 760, 768, 820, 1024 and 1440 CSS pixels.
Include a short phone height, landscape, and browser zoom/text enlargement.
For each relevant mode verify:

- No required action is off-screen, overlapped or unreachable.
- Menus and property cards fit and can be dismissed without losing work.
- The active input and validation message remain reachable with the keyboard visible.
- Canvas resize keeps world/screen mapping and pointer hit-testing correct.
- Sidebar collapse/resize does not add a geometry undo entry or lose text drafts.
- Opening an example or using first-use help never silently replaces unsaved work.
- Search supports keyboard selection, Escape and no-match feedback.
- Search/recent tools cannot expose hidden claim/testing/discovery capabilities.
- Choosing a searched tool uses selected inputs exactly like a palette button.
- Toolbar arrow navigation and normal text-field arrows do not interfere.
- Named picked inputs, cancel and completion behavior match the actual tool state.
- Right-click styling, right-drag panning, box selection and touch gestures still work.
- A keyboard-only user can construct a simple figure, inspect properties and export it.

Capture a small, meaningful set of before/after screenshots.
Inspect every changed baseline; do not bulk-accept screenshot failures.
Use deterministic fonts/browser configuration where the project supports them.
A viewport simulation is not evidence of a real iOS/Android keyboard test.
State explicitly which real devices and engines were or were not exercised.

## Validation and handoff

Run focused responsive/interaction E2E and affected unit tests, then common verification.
Document the new navigation affordances and an updated concise gesture help.
Report supported sizes, keyboard behavior, screenshots and any outstanding platform limits.
Confirm task 01's public release surface remains reduced.
Do not publish or deploy.

## Non-goals

No new geometry tools, account system, collaboration service, macros or animation.
No wholesale visual rebranding or unapproved runtime UI-library dependency.
Do not solve layout by hiding important actions with no alternative path.
