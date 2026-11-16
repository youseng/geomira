# Integration repair: startup drafts and guided keyboard focus

Base: 7d13998, plus the PWA draft/composition API from 806e3f2. This isolated
branch cherry-picks that prerequisite as 4f57c8e; integration should apply the
original PWA commit first, then this repair's own commit.

## Diagnosis

Inspected the actual CI 86bac517 Firefox traces, including DOM snapshots and
screenshots. The file:// Save failure is an explicit stale-draft refusal, not a
blocked browser download. The field contains `A=(123,456)`, but the current figure
is empty and Undo remains disabled. Fill to Save takes less than 300 ms, before
the 500 ms apply pause. A delayed startup restore replaces the base document while
the source still has pending user edits. The startup guard accounted for document,
tool and open-count changes but omitted raw source and active composition.

For keyboard navigation, guided triangle creation removes its focused guide button
without a stable destination. Firefox's subsequent Tab walk never reaches tool
search. A direct focus-destination regression also fails under Chromium, confirming
that the product leaves focus behind rather than depending solely on CI timing.

## Correction

- Startup checks the shared `TextApplier.unappliedText()` contract, including active
  composition. An editing session with pending source wins over delayed startup
  adoption. The loaded personal figure remains durably available in Recovery.
- Successful guided triangle creation moves focus to the stable tool-search input
  before the guide disappears. App tool dispatch and keyboard mappings are unchanged.
- New delayed-IDB regressions seed an existing saved figure, hold startup, type valid
  or invalid source and release storage while the File menu holds the apply pause.
  They require the original saved figure to remain recoverable, the source to remain
  current, valid Save to download the typed geometry, and invalid Save to produce the
  explicitly requested raw draft backup.
- A guide regression asserts the focus destination and subsequent keyboard tool
  selection. The original complete keyboard construction/export walkthrough remains.

## Evidence

Before correction, all **3 new desktop browser regressions failed**: both drafts
became falsely stale, and the search input was inactive after guided creation.

After correction:

- `GEOMIRA_BASE=/geomira/ pnpm build`: both public builds and packaging passed.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/geomira-browsers GEOMIRA_BASE=/geomira/ GEOMIRA_PREVIEW_PORT=4192 pnpm --filter @geomira/web exec playwright test document-files workspace-composed --grep 'startup draft|guided triangle|keyboard navigation alone|valid pending text' --project desktop --project mobile --project file-chromium --workers 1`:
  **15 passed**, 47.1 seconds. Includes the original pending-text Save and complete
  keyboard walkthrough in desktop, touch emulation and file:// Chromium.
- Local Firefox remains unavailable: a fresh headless launch with a 10-second
  deadline still reports graphics/framebuffer failures and UID-map EROFS. These
  process-only diagnostics did not alter system configuration. Firefox confirmation
  must come from the next CI run; it is not claimed as a local pass.

No existing assertions, timeouts, tolerances or screenshot references changed.
Final composed-tree verification, source identity and browser CI remain owned by
integration and the independent audit. No push, merge or deployment was performed.
