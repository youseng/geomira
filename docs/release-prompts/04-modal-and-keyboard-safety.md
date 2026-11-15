# Prompt 04 — Isolate dialogs from document shortcuts

Implement this task in Geomira. The user has authorized fixes from the release review
and removal of public claim testing for now. This task fixes dialog interaction only.

Audit baseline: `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`.
Reproduce against your actual checkout before editing; line numbers can move.

## Read first and coordinate

- Read this directory's `README.md` common execution contract.
- Follow `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the ADR-reading protocol.
- Pay particular attention to ADR-0028, the keymap and existing dialog tests.
- Work on an isolated branch/worktree. Preserve unrelated changes.
- This task can start independently of 01, 02 and 05.
- Integrate with 01's reduced public UI and 03's file/unsaved-work dialogs.
- Provide one reusable dialog policy so future dialogs inherit the correction.
- Do not reintroduce claim controls, badges, discovery or public test dispatch.

## Confirmed failure

1. Create a figure containing several objects.
2. Focus the geometry canvas; use Ctrl+A, or Cmd+A on macOS, to select them.
3. Open Export → SVG.
4. Leave focus on the dialog container or a non-text dialog control.
5. Press Delete.

Actual: the selected figure is deleted behind the still-open Export dialog.
The source becomes only `@version 1`; undo can recover it.
The dialog handles Escape, while the global editor handler still processes other keys.

The user expects keyboard input to act within the active dialog.
Opening an export or share dialog must not expose the figure to hidden destructive edits.

## Source starting points

- `apps/web/src/Dialogs.tsx`: `useDialog`, approximately lines 7–30.
- `apps/web/src/hooks.ts`: `keyTarget`, `shortcutFor`, `useShortcuts`.
- `apps/web/src/ExportDialog.tsx`: dialog root and format/download controls.
- `apps/web/src/App.tsx`: dialog ownership and application background.
- `apps/web/src/dialogs.css`: the apparent modal backdrop.
- `packages/editor/src/keymap.ts`: all document and tool shortcuts.
- Existing `apps/web/e2e/flows-keyboard.spec.ts` and dialog/export flows.
- Also inspect share and debug-report dialogs; the defect is not export-specific.

## Required behavior

Implement actual modal interaction, not just a visual shadow.

- Opening a modal gives focus to an appropriate element inside it.
- Tab and Shift+Tab cycle through its enabled, visible focusable controls.
- A dialog with no focusable children retains focus safely.
- The background cannot be activated by pointer, keyboard or assistive navigation.
- Delete, Backspace, tool letters, select-all, undo/redo and other editor shortcuts
  must not change the figure while the modal owns interaction.
- Native editing, selection, copying and undo within editable dialog fields still work.
- Escape closes the topmost modal once, without also cancelling canvas input.
- Closing restores focus to the invoking control when it still exists.
- If that control disappeared, use a deliberate, usable fallback.
- Background selection, viewport, active tool and pending construction picks remain intact.
- Do not consume browser/system shortcuts unnecessarily.
- Ensure reopening a dialog does not accumulate global event listeners.
- If modal nesting is possible, only the topmost modal handles dismissal and focus.
- Make modal semantics accessible: name, role and modal state must agree with behavior.

Use a shared abstraction or native platform primitive that works in supported browsers.
Keep DOM-specific focus and event work inside `apps/web`.
Do not add a runtime dependency without following the repository's dependency policy.
Do not special-case just the Delete key or just the SVG export dialog.

## Tests to write before the fix

Create a focused browser regression for the reproduction above.
Assert unchanged canonical document content and unchanged history, not merely an open dialog.

Add coverage for:

1. Export, Share and Debug report using the same modal policy.
2. Delete and Backspace from the dialog container and a button.
3. Ctrl/Cmd+Z and tool keys from non-text dialog controls.
4. Typing, deleting, copying and selecting text inside a dialog field.
5. Tab and Shift+Tab containment, including disabled/hidden controls.
6. Pointer clicks on the dimmed background.
7. Escape closing only the dialog and restoring the right focus.
8. Reopen/close cycles and an invoker removed before close.
9. An unchanged pending multi-pick construction after the dialog closes.
10. File-management dialogs added by task 03 once those tasks are integrated.

Keep the test fixture small and deterministic.
A unit test of shortcut classification alone does not exercise focus/event ordering.
Retain useful existing keyboard and export assertions.
For frozen tests requiring changed semantics, follow the ADR procedure; do not weaken them.

## Acceptance criteria

- The original Delete reproduction leaves every selected object present.
- No modal leaks document-changing shortcuts or pointer actions to the background.
- Normal canvas shortcuts resume after closing.
- Screen-reader semantics and keyboard navigation describe the same active surface.
- Export copying and downloading still work.
- All existing non-modal menu and field interactions remain usable.
- The correction survives integration with tasks 01, 03 and 09.
- No public claim-testing capability becomes reachable.

## Validation and handoff

Run focused unit/browser tests, then the required repository checks from the common contract.
Capture at least one keyboard-driven dialog flow and inspect its result.
Check the supported desktop engines when available; state environment failures separately.
Do not update screenshots just to conceal an interaction failure.
Update relevant documentation and decision records if behavior changes.
Report the exact revision, reproduction before/after, tests run and remaining limits.
Do not deploy or publish as part of this task.

## Non-goals

Do not redesign export formats, persistence, the geometry kernel or the whole toolbar.
Do not build new claim features.
Do not change general keyboard mappings unless necessary for the modal boundary.
