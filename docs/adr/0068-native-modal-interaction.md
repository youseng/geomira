# ADR-0068: One native modal boundary for dialogs

Status: authorized by release prompt 04; acceptance requires the recorded checks and review.
Extends ADR-0028 decision 25 and SPEC §15.

## Context

Base `8535d51097af931a9bdd6fd924d3a5acbba12a20` includes merged PR #39.
A built-app regression selects A and B, opens Export → SVG, focuses its container and
presses Delete. The canonical text becomes only `@version 1`; the dialog stays open.
The old hook intercepts Escape alone and its CSS shadow does not isolate the background.

## Decision

- Share, Debug report and Export use a shared native `<dialog>` opened with `showModal()`.
  The browser's top layer provides pointer, keyboard and accessibility inertness for the
  background, including the recovery panel and controls outside the application root.
  A real `::backdrop` replaces the decorative shadow. No dependency is added.
- Initial focus is the dialog container, so its title and purpose precede its contents.
  Tab and Shift+Tab explicitly cycle through visible, enabled controls, or keep focus on
  the container if none exist. Focused controls scroll into view within long dialogs.
  Radio groups retain one sequential tab stop. Native editing,
  selection, copying and field undo remain browser actions.
- Editor shortcut dispatch returns while a native modal is open. It does not cancel key
  defaults. Only unmodified Tab and Escape are handled by the shared modal policy.
  Escape dismisses the topmost modal once, before canvas cancellation. A stack tracks modal
  opening order, supports nested dialogs and is cleaned up on unmount, including StrictMode.
- Closing restores an existing usable invoker, otherwise an underlying modal, otherwise
  the geometry canvas. Menus focus their persistent disclosure button before invoking an
  action: a disappearing menu item must not become the restoration target.
- Keep document/history, tool picks, selection, viewport, persistence and disabled public
  claim capability unchanged. The inline recovery panel is not a modal. Task 03's future
  file dialogs must use this boundary; task 09 must preserve it through layout changes.

## Frozen-test migration

`flows-keyboard.spec.ts` retains all ordinary key, focus, completion and dialog assertions.
Its tab activation also runs publicly against Objects; the original Claims activation
assertion remains in the internal build. `mobile.spec.ts` retains the exact pan, pinch,
drag and panel assertions, and its Claims assertions remain in the internal build. Public
builds instead assert the absent Claims tab and preserved claim text. Both specs return to
the public configuration. No screenshots, tolerances, test-count or coverage floors change.

## Consequences

DOM interaction stays in apps/web. Browser regressions compare canonical documents and
traverse complete undo/redo history, exercise keyboard defaults and pending construction,
and check native inertness. Real assistive-technology and physical-device checks remain
distinct from browser accessibility assertions and touch emulation.

## Alternatives

A special Delete guard misses other editor shortcuts and pointer actions. A custom focus
trap plus manually maintained inert siblings duplicates native platform behavior and must
track newly inserted DOM. Blocking every key's default would break field editing and browser
shortcuts. Native modal dialogs with a small shared policy cover these requirements.
