# Prompt 05 — Make properties, undo and visibility agree

Implement this task in Geomira. The user has authorized fixes from the release review
and removal of public claim testing for now. Fix these three connected property defects.

Audit baseline: `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`.
Reproduce on the current checkout; inspect source rather than relying on old line numbers.

## Read first and coordinate

- Read this directory's `README.md` common execution contract.
- Follow `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the ADR-reading protocol.
- Read ADR-0020, ADR-0029, ADR-0046, ADR-0060 and ADR-0063 closely.
- Preserve the approved immediate-apply model and one undo per control.
- Work independently from 04 where possible; coordinate focus/close behavior at integration.
- Task 09 may add a visible Properties entry point; expose a reusable safe card behavior.
- Keep 01's public claim-testing removal intact.
- Do not edit other tasks' files without coordinating ownership.

## Reproduction A: outside click loses a rename

Create:

```text
A=(0,0)
B=(4,0)
C=(1,3)
```

Right-click C, replace Name with P, then click the canvas or Fit.
Actual: the card closes and the source still defines C.
The captured outside `pointerdown` unmounts the card before Name's blur handler commits.

Expected: leaving a valid name field commits once, including outside-close paths.
The canvas, object list and source must all display P.
For an invalid or locked-object rename, preserve the document and show a useful reason.
Do not silently discard a draft during a close race.
Define invalid-name dismissal behavior explicitly and document any ADR change.

## Reproduction B: undo leaves stale property fields

Open C's style card; set Label text to `foo`.
Focus the card header, then press Ctrl/Cmd+Z.
Actual: the source/canvas revert, but Label text still reads `foo`.
Toggle Show the label off and on: the undone `foo` is written back.

Expected: the card follows the current document after undo, redo, reset and external edits.
A later control must not resurrect stale values from a previous document state.
Audit numeric text fields and digits as well as labels: they share local-state patterns.
Preserve legitimate in-progress input such as a partial number without adding bogus edits.
Do not solve synchronization by remounting the entire card on every keystroke.

## Reproduction C: an inherited-hidden image cannot be shown normally

```text
A=(0,0)
B=(4,0)
C=(1,3) [hidden]
t=reflect(line(A,B))
@layer inv=image(t,main)
```

C* inherits hidden styling and is absent from the scene.
Its Objects row nevertheless offers Hide; the selection's Show action says nothing is hidden.
Toggling its eye twice still leaves it hidden, because removing its override reveals
the inherited hidden value again.

Expected: the eye, selection summary, property card and scene agree about effective visibility.
Showing C* must create the minimal necessary explicit override without showing C.
The operation is one undoable edit and survives text/save/share round trips.

## Source starting points

- `apps/web/src/StyleCard.tsx`: `useCloseOutside`, `NameRow`, card synchronization.
- `apps/web/src/StyleRows.tsx`: `LabelRow`, `NumberField`, `DigitsField`.
- `apps/web/src/style-draft.ts`, `style-name.ts`, `style-values.ts`.
- `packages/editor/src/live-style.ts`: session and history coalescing.
- `packages/editor/src/panels.ts`: `rowOf` currently reads only own `hidden`.
- `packages/editor/src/selection-actions.ts`: visibility summaries and style edits.
- `apps/web/src/panels/ObjectsPanel.tsx`, `SelectionBar.tsx`.
- The kernel's existing style-inheritance resolution and the scene visibility logic.
- Existing style-card, live-style, selection and derived-layer tests.

## Required design constraints

Use one authoritative meaning for inherited style and visibility.
Avoid copying inheritance logic into several React components.
Distinguish own hidden styling, inherited hidden styling, hidden layers and undefined geometry.
An object hidden because all its layers are hidden should explain that cause;
an object eye must not secretly turn on an entire layer.
The same distinction must remain clear for opacity and coincident managed-image suppression.

ADR-0060 currently says Show removes `hidden` and never writes `hidden=false`.
That is insufficient for overriding inherited hiding.
Record the narrow amendment needed for an inherited override; do not bypass the contract.
Preserve terse normal-object styles when no override is needed.

All mutations still pass through the editor's checked edit/history path.
Locked layers must refuse the complete action without partial UI updates.
Managed objects retain their identity and source relationship.
Renaming must not break references, claims retained as data, derived names or selections.
Undo/redo should neither duplicate name commits nor split a single slider gesture into many edits.

## Tests to write before the fix

- Browser reproduction of valid rename via Enter, button, Tab, canvas click and Fit.
- Closing one object's card by opening another commits the right object's valid rename.
- Invalid/duplicate names, locked layers, Escape and removed objects have explicit outcomes.
- Label `foo` → undo → visibility toggle never restores the undone text.
- Redo, Reset, a source-text edit and object switching update all corresponding controls.
- Numeric field values follow external changes without losing caret on ordinary typing.
- Hidden source → inherited-hidden image → Show image → undo → redo.
- Mixed normal/inherited-hidden multi-selection changes once and undoes as one batch.
- Hidden-layer and undefined-object cases do not claim that an eye can make them drawable.
- Parsing/printing and a save/reopen preserve the intentional hidden override.
- Property editing does not create history entries for no-op changes.

Use actual browser tests for blur/pointer event ordering and field synchronization.
Model tests should compare the effective scene and UI data, not just style keys.
Do not delete or weaken frozen assertions; use the documented ADR process when needed.

## Acceptance and handoff

All three reproductions must be fixed and independently demonstrable.
Keep immediate styling and the existing history coalescing contract.
Run focused tests, then the common repository verification commands.
Inspect the card with keyboard and touch/long-press entry where supported.
Report tests, exact revision, source locations, inheritance decisions and remaining limits.
Coordinate final integration with 04's dialog policy and 09's Properties entry point.
Do not deploy or publish.

## Non-goals

No general style-system rewrite, new geometry, new claim UI or speculative property controls.
Do not implement a full document manager here; task 03 owns that work.
