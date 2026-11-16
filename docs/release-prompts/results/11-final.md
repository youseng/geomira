# Prompt 11 final candidate validation

Status: **pending final CI references, browser matrix and independent acceptance**.
Revised application candidate: `c540412ec2e4d4a68c93c4e59a26343756adaf69`.
Its formatting-only successor passed verification, but later independent findings require
further source corrections. Checks below identify their actual source rather than treating
this diagnostic candidate as a release pass.
No production publication, main merge, deployment or release was performed in this phase.

## Revised candidate identity and builds

Pinned pnpm 10.28.0; Node 24.22.1; Playwright 1.56.1 / bundled Chromium 141.
Frozen-lockfile offline dependency installation passed. With `GEOMIRA_BASE=/geomira/`
and `GEOMIRA_BUILD` set to the full candidate SHA:

- `pnpm build`: public hosted and standalone builds passed.
- `pnpm --filter @geomira/web build:claims`: internal hosted and standalone builds passed.
- `release-candidate.ts check`: passed against source, mode, base, run/attempt and checksums.
- Local public file: `apps/web/dist/geomira.html`, **1,270,674 bytes**, identical to
  `apps/web/dist-single/index.html`.
- SHA-256: `bb48e5a9f5b72499f5d90ae080d7daaa41e0bd5353a8d28b7a2247427b99b212`.
- `release.json`: full source SHA above, public mode, `/geomira/`, run `local`, attempt `1`.
  This local file is separate from the eventual downloaded CI candidate.

Logs: `/tmp/geomira-final11-c540-public-build.log` and
`/tmp/geomira-final11-c540-internal-build.log`. The supported local public Chromium diagnostic
matrix completed **401 passed / 9 failed / 0 skipped**, 410 tests in 1,055.7 seconds. All nine
failures match the documented CI categories. A complete 125-failure disposition ledger is in
`11-c540-ci-dispositions.md`; these are historical results, not revised-source acceptance.

## Visual acceptance still required

Twenty-five unique references need final review: eight exported example PNGs, six public
scene canvases, six internal scene canvases, three internal full-GUI views and two new
public full-GUI views. The final phone flow, reserved controls and relocated Zoom controls
change the viewport again, so the first candidate's approved images are intermediate
historical evidence and cannot be blindly reused.

The integration owner approved 20 c540 CI geometry references after individual review, also
independently reviewed by prompt 12. They are copied byte for byte with source/run/artifact,
font environment and per-file hash provenance in `11-visual-references.json`. All five GUI
references remain untouched pending final panel/header source. Final-source comparisons are
still required even where clean geometry dimensions are unchanged.

The two new public references capture untouched native desktop/phone viewports with a
saved nine-point example and editable source. They explicitly reject claim tabs/chips.
Native wheel scrolling must expose offscreen palette/command controls while preserving
the geometry camera; the wheel target must already be inside the native viewport.
A separate, labelled full-scroll attachment temporarily removes only overflow clipping,
requires exactly unchanged layout boxes and restores clipping before the native comparison.
That attachment is not a reference or evidence that all phone content fits simultaneously.
Initial prototype runs reached only the intentionally missing references: **0 passed,
2 failed**. Missing references remain failures pending individual CI-image review.

Scene screenshots use the repository's bundled Liberation Serif Italic. Export PNGs use
the platform math face; full-GUI views use the actual system UI face. This container uses
OpenAI Sans for system UI. The final CI job records Node/pnpm/Playwright/OS versions,
fontconfig matches and font-file SHA-256 hashes. Local platform differences must remain
reported; replacing a reference with CI bytes does not make a locally failing comparison pass.
No blanket snapshot updates or tolerance increases are authorized. Existing scene/export
ratios remain 0.002 and full-GUI ratios remain 0.01.

## Initial diagnostic results, not revised-source acceptance

At application source `9622000381c6b253067680593090624fafdff23c`:

- Initial screenshot-only runs: public **14 failed**, internal **17 failed**, representing
  23 unique references because eight export goldens are shared. Every expected/actual/diff
  was reviewed individually. The integration owner approved the intended workspace/header/
  source-editor reframes; no threshold changed.
- Fourteen approved public/export replacements came from CI run `43838960729`, artifact
  `14213420787`, documentation-only source `86bac50eba8a824f3acf66831eaafe096e8a28f2`.
  Six public scenes matched local images pixel for pixel; export differences were confined
  to label glyphs. Their mapping/hashes are historical evidence in git history.
- Focused recheck: **17 passed / 0 failed / 0 skipped**, 44.3 seconds: fourteen public/export
  comparisons plus the repaired public zero-job fixture on desktop/phone/file-Chromium.
- Normal local Chromium matrix: **299 passed / 7 failed / 0 skipped**, 306 tests, 896.6 seconds;
  desktop, mobile, Pages, PWA and file-Chromium at `/geomira/` / actual standalone file.
  Screenshot cases and inline performance cases were counted separately. Failures were
  three recovery overlays, the guide intercepting Polygon, selection controls intercepting
  a second style-card click and two closed-panel fixtures.
- Initial CI public matrix: **517 passed / 35 failed / 1 dependency-skipped**, 553 total.
  Fourteen failures were screenshots; remaining failures identified responsive overlays,
  compact-menu fixtures, Firefox native-pointer/focus behavior and startup draft adoption.
  Internal CI was not reached in that run. These failures were reported before repair.

Subsequent integration fixes address those findings, PWA transient-draft protection and
physical phone occlusion. Prototype checks are preliminary evidence, not substitutes for
the revised-source full matrix. Two fixture migrations retain all original assertions:
reopen Show panels before inspecting tabs, and open More actions before compact Settings.
The pointer helper now scrolls an offscreen canvas into view before applying the unchanged
CSS inverse projection. A real wheel repro previously projected to negative coordinates;
after correction, native input reaches canvas and the exact invalid source remains intact.

## Gate and provenance evidence

The workflow retains separate public/internal HTML reports and environment evidence.
Internal tests run after an actually executed public suite succeeds or fails, never after
cancellation/skipped prerequisites. Public failure still fails the web job; integrity checks,
tested-artifact upload and packaging retain success-only gates. No `continue-on-error` is used.
Actionlint and the eight-outcome structural dry run passed; candidate dependencies remain
`[verify, web, exports]`. Scheduled mutation policy is unchanged.

The expanded three-engine public/internal coverage receives a **60-minute web-job envelope**,
previously 40 minutes. Push run `43854336027` spent 14 minutes 15 seconds on public browsers
before starting the internal matrix. Individual test timeouts, the 5-second scene law,
8 ms frame limit, retries, skips and screenshot/coverage assertions remain unchanged.
Verification/export job budgets are unchanged. The running diagnostic still has its original
40-minute budget; this change applies only after the evidence/reference commit.

Actual CI run `43838960729`: verification and export compilation succeeded, browser validation
failed, and candidate/deployment/smoke jobs were skipped. Only export and failure-report
artifacts existed; no tested web or Pages candidate was uploaded. This is executed failure-gate
evidence, not a production deployment experiment.

## Explicit nonblocking limits

- On a phone with Text open, the intentionally retained 120 px canvas fits the nine-point
  figure into roughly 40 px of drawing height, crowding labels. Closing the panel and using
  Fit/Zoom provides the larger construction view. Adaptive fit margins or a larger portrait
  split remain future usability improvements; this interface is not described as perfect.
- Internal-only verdict chips can overlay reflected A-prime or triangle-base labels in the
  compact phone view. The public build has no such chips; retained-engine reactivation requires
  separate UI acceptance. Final images must keep any overlap visible rather than mask it.
- Local Firefox/WebKit availability, emulated versus physical devices, real screen-reader
  checks and final CI/downloaded-artifact results must be reported separately.

## Remaining acceptance

- Retrieve final CI images, compare every expected/actual/diff, replace only individually
  approved references under ADR-0076, format the manifest and repeat comparisons.
- Complete supported public/internal local Chromium projects and isolated performance
  checks after quiet verification; record exact counts and actual measurements.
- Integration owner supplies revised-source full verification, required export compilation,
  complete supported remote browser results and the exact downloaded CI artifact.
- Independent prompt 12 acceptance remains required before publication.
