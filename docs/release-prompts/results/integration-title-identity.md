# Pending title identity boundary (A14)

Base: `1b9b346ec9782646ec189e4706b203b5e54ab48a`.
Independent audit reproduction and trace:
`/workspace/geomira-final-audit/caption-boundary-diagnostic.log` and
`caption-boundary-diagnostic-title-trace.zip`.

The compact caption still allowed a long applied `@title` to increase its intrinsic
width from 103.671875 to 130px. At 1024/1032/1040px this added a header row during native
pointer-down. At 1024×800 the header grew 56.390625→92.390625px, moving the canvas
y=176.390625→212.390625 and reducing its height 541.609375→505.609375. The captured
press had a genuine pending raw draft; a 25×15px drag then moved the point incorrectly.

Only the ellipsized title now receives `contain: inline-size`. Its reserved status
phrase determines the column's width, so title content fills the existing budget.
The complete title stays in document metadata and the native title tooltip. This
avoids permanently widening the clean header to a 130px title slot. No geometry,
serialization, save state, draft status semantics or coordinate rounding changes.

## Failing-first native evidence

With prefixes `PATH=/tmp/geomira-bin:$PATH`,
`PLAYWRIGHT_BROWSERS_PATH=/tmp/geomira-browsers`, `GEOMIRA_BASE=/geomira/` and
`GEOMIRA_PREVIEW_PORT=4299`:

`pnpm --filter @geomira/web exec playwright test draft-pointer-layout --grep 'applied on native' --project desktop --workers 1`
failed the new title case on the exact 36px header/canvas shift; the prior-download
feedback case passed. The fixture records `data-active=true` at the actual native
pointer-down, preventing the 500ms source pause from silently bypassing the intended
race. Expected coordinates come from delivered input, never from reading back the
dragged document. Complete canonical text, title metadata, Undo and Redo are strict.

The independent auditor also scanned download feedback at 673 widths 768–1440 and found
no vertical header/canvas layout change for `Draft not included in download`→
`Changed since download`. That source behavior is unchanged; the additive native
prior-download case protects the real transition.

## Local corrected checks

- `GEOMIRA_BASE=/geomira/ pnpm --filter @geomira/web build`: both public outputs and
  packaging passed.
- `GEOMIRA_BASE=/geomira/ pnpm --filter @geomira/web build:claims`: both internal
  outputs passed.
- The browser command above without its grep, running the entire focused
  `draft-pointer-layout` file: **7 passed**, 12.0 seconds, public Chromium.
- The same focused command with `GEOMIRA_ENGINE_E2E=1`: **7 passed**, 11.7 seconds,
  internal Chromium. The prior native draft-layout/history cases remain unchanged.
- A separate five-width native Chromium geometry probe at height 800 verifies the
  title caption has identical clean/pending/applied width: 90px at 320/390 and
  103.671875px at 768/1024/1280. Public header heights remain 155/107/92.390625/
  56.390625/56.390625px respectively. Pending-to-applied canvas bounds are identical
  at all five widths. Phone Text focus uses the existing 120px drawing minimum; the
  caption adds no default height or additional loss of canvas. Probe data:
  `/tmp/geomira07caption-public.json`.
- The same five-width internal probe also passes; its 1024px header remains the
  existing 92.390625px in clean, pending and applied states. All other widths match
  the public heights above. Internal data: `/tmp/geomira07caption-internal.json`.
- Independent audit rechecked 1024/1032/1040/1280px with no title-induced rectangle
  differences. The native 1024px press still had a pending raw draft, retained the
  full title and produced A=(0.5,2.7059), exactly matching delivered input. Evidence:
  `/workspace/geomira-final-audit/caption-title-fixed-diagnostic.json`.
- `PATH=/tmp/geomira-bin:$PATH pnpm exec tsc -p tsconfig.tests.json --noEmit`: passed.
- Targeted ESLint, Prettier and `git diff --check`: passed.

No snapshots, tolerances, timeouts or existing mathematical/history assertions were
weakened. Final combined-source identity and Firefox/WebKit verification remain
pending CI; local working-tree builds are probes, not immutable release candidates.
No push, merge, publication or deployment was performed.
