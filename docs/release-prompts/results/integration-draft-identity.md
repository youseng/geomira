# Stable document identity during source-blur input

Base: `6348686b1f7af73cfc92d727bff206b5da0b7373`; failing CI artifact source:
`c540412ec2e4d4a68c93c4e59a26343756adaf69`.

## Diagnosis and source correction

The internal CI `flows-audit` and `flows-typing` cases both produced B=(5,0.6396),
despite requesting B=(5,1). Native event capture reproduced the actual cause: applying
the focused raw draft on pointer-down removed an inline header badge, collapsing the
header from two rows to one. The canvas changed from y=212.390625, height=425.609375,
logical height 426 to y=176.390625, height=461.609375, logical height 462. The viewport
center and zoom 50 were unchanged. The 18px change in drawing center explains the result.
This was a source layout bug; the existing coordinate/history assertions stay intact.

The File identity now stacks its title and a compact reserved draft-status line. The
complete phrase remains visible while source is unapplied; its hidden state has no
status role and is aria-hidden. At phone widths it wraps inside the existing File
group rather than reserving a long separate header slot. Autosave status is unchanged.

## Failing-first and focused validation

Command prefixes below use `PATH=/tmp/geomira-bin:$PATH`,
`PLAYWRIGHT_BROWSERS_PATH=/tmp/geomira-browsers`, `GEOMIRA_BASE=/geomira/` and
`GEOMIRA_PREVIEW_PORT=4299`. Internal commands additionally set `GEOMIRA_ENGINE_E2E=1`.
Every browser invocation uses one worker and the standard Playwright configuration.

- Before the source correction, `pnpm --filter @geomira/web exec playwright test draft-pointer-layout --project desktop --workers 1`:
  **1 failed**, on exact canvas-bounds equality with the 36px change above, against a
  copied immutable internal c540 artifact. This reproduces the two existing CI failures.
- `GEOMIRA_BUILD=c540412ec2e4d4a68c93c4e59a26343756adaf69 pnpm --filter @geomira/web build`:
  both public outputs and packaging passed. This local dirty-tree probe retained the
  baseline build label; its label is not an immutable source-identity assertion.
- `pnpm --filter @geomira/web build:claims`: both internal outputs passed.
- Public `pnpm --filter @geomira/web exec playwright test draft-pointer-layout --project desktop --workers 1`:
  **5 passed**, 9.0 seconds. Covers source-blur native drag/history and all four widths.
- Internal `pnpm --filter @geomira/web exec playwright test draft-pointer-layout flows-audit flows-typing flows-measurements --grep 'a draft applied|draft status preserves|an edit typed in the text|a drag while a pause|an angle' --project desktop --workers 1`:
  **8 passed**, 16.0 seconds. Both original exact B=(5,1), typed C=(2,3), pending-pause
  and one-Undo checks are unchanged. The angle fixture correction is separately recorded
  in `integration-native-coordinate-ci.md`.
- `pnpm exec tsc -p tsconfig.tests.json --noEmit`: passed.
- Targeted ESLint on `DocumentFiles.tsx` and all changed/new TypeScript fixtures: passed.
- Prettier and `git diff --check`: passed.

## Density and visual review

Temporary native Chromium probes compared the immutable old public/internal artifacts
and the local corrected outputs at height 720. The probes were removed before delivery.
The clean/saved rectangles were exactly equal in both modes:

| Width | Header height | Canvas x/y       | Canvas width/height |
| ----- | ------------- | ---------------- | ------------------- |
| 320   | 155           | 0 / 275          | 320 / 233           |
| 390   | 107           | 0 / 227          | 390 / 281           |
| 768   | 92.390625     | 104 / 212.390625 | 344 / 425.609375    |
| 1280  | 56.390625     | 104 / 176.390625 | 856 / 461.609375    |

The old internal draft added 36px at 768/1280; the new draft adds none. Phone Text focus
uses a 120px canvas in both old/new outputs, independent of this caption. Actual images
`/tmp/geomira07-caption-caption-390-draft.png` and
`/tmp/geomira07-caption-caption-1280-draft.png` were inspected: the complete draft phrase
wraps into two lines on the phone and fits one compact status line on desktop. No text
is clipped. The visual owner received the measured equal clean/saved geometry and the
remaining requirement to review final whole-GUI title/status pixels. No snapshots changed.

These local working-tree builds are test probes, not immutable release candidates. Final
combined source identity, all supported engines, full verification and CI remain owned
by integration. Local Firefox/WebKit availability is unchanged. No push, merge,
publication or deployment was performed.
