# Prompt 11 final candidate validation

Status: **blocked by confirmed short-viewport Recovery disclosure A18 on the asset successor**.
Validated application candidate: `4040112d55d0d22792b654339fd96e06ed49b056`. The source correction
passes genuine public/internal full-UI drag gates at 6.13/6.19 ms with exact geometry and
history checks. The original invalid no-drag result and genuine 37.51 ms failure remain
recorded below. Its complete CI matrix and quiet verification now pass. Final inspection
found one unused stale shipped image, corrected separately under ADR-0065/0076; that asset
successor requires its own validated candidate before publication.
The exact 7f8 push then exposed a Firefox focus/disclosure scroll problem despite the
parallel PR run passing. `11-7f8-ci-results.md` preserves its sole failure and both-mode
counts; the earlier green source and different PR metadata do not satisfy that push gate.
No production publication, main merge, deployment or release was performed in this phase.

## Current candidate identity and isolated measurements

The integration owner built all four public/internal hosted/standalone modes with the
full 404 SHA and `/geomira/`, then checked every one of the 15 public manifest hashes.
The independent reviewer checked those hashes and exact standalone equivalence too.
Immutable local candidate: `/workspace/geomira-final-audit/candidate-404/public/geomira.html`,
**1,272,357 bytes**, SHA256
`6a495f5ff81ee17d78dd30ca685d88ec4a9753a5474297b83d805d216d060448`.
This is the local candidate, not the eventual downloaded validated CI artifact.

After every other local browser/build was closed, original performance projects ran
sequentially with worker1 and unchanged limits on these exact built bytes. Public passed
**3/3 in 23.7 seconds**; internal initially passed **5/6 in 70.9 seconds**. The one worker
failure and its sole isolated repeat are preserved separately:

| Original gate                   | Public result | Internal result                                  | Unchanged gate            |
| ------------------------------- | ------------- | ------------------------------------------------ | ------------------------- |
| Scene desktop drag/pan medians  | 4.1/2.2 ms    | 4.7/2.8 ms                                       | Each ≤8 ms                |
| Scene phone drag/pan medians    | 4.6/2.8 ms    | 5.5/2.8 ms                                       | Each ≤8 ms                |
| Genuine full-UI drag app median | 6.13 ms       | 6.19 ms                                          | ≤8 ms;120 measured frames |
| Worker main-thread maximum      | Not public    | First60.5 ms failed;isolated repeat8.7 ms passed | ≤16 ms,no LongTasks       |
| Workerless local/global maximum | Not public    | 13.9 ms,no LongTasks                             | ≤16 ms                    |
| Workerless discovery150objects  | Not public    | 46.1 ms maximum;14/3,979 tasks over16 ms         | ≤150 ms;<1% over16 ms     |

Both genuine drags pass coordinate-only P1 mutation, unchanged other source lines and
complete one-step Undo/Redo/no older history. The first worker attempt recorded 24,485
tasks and LongTasks `[60]`; the single isolated repeat recorded 19,020 tasks and no
LongTasks, passing in6.8 seconds. No scheduling or GC cause is inferred from that difference.
Every original gate has a successful final-source result, while the initial invocation is
explicitly **8/9**, not described as9/9. Raw annotations, errors and stage counts are in
`11-404-performance.json`. All measurement browsers and previews were closed before the
independent reviewer's quiet full verification began.

Required CI verification on 404 passed **5,046 tests/553 files**; exports and all five GUI
comparisons also passed. Quiet independent local `pnpm verify` then exited 0 at the exact
same source: **5,046/5,046 tests, 553/553 files**, 634.91 seconds in Vitest. Coverage was
96.45% statements, 90.44% branches, 99.45% functions and 98.33% lines; static gates passed.

## Complete 404 CI and static-asset successor

Push run `43870309470` passed every required verification, web, export and candidate job.
Public browsers passed **882/882 in 14.6 minutes** and internal browsers **747/747 in
11.7 minutes**, with zero skipped tests. All supported hosted/file engine projects and
all 33 screenshot comparisons (25 unique references) passed. Genuine CI full-UI drag app
medians were **6.57/6.81 ms**; worker maximum **3.1 ms**, workerless maximum **8.4 ms**,
and 150-object discovery maximum **33.1 ms**, with 3/3,434 tasks over 16 ms. None of those
retained-engine measurements reported LongTasks. Every original limit was preserved.

GitHub reports tested-web archive `14228723764`, **2,425,706 bytes**, SHA256
`d53d7a991eb9bbce2b4b1b20bda2ea127bcdb193e1911ff074e41533cb999f5e`, and Pages
artifact `14229062837`. These are the validated 404 artifacts, not the final publication
candidate: final inspection found an unused stale public screenshot in their contents.
The manifest has no `screenshots` field, so there is no observed active install-dialog bug.

That low-severity image consistency finding is repaired by copying the exact already-reviewed
1280×720 public desktop reference to `apps/web/public/screenshots/main-desktop.png`.
Its 121,162 bytes and SHA256
`6d17ceef7f61a3b2b6cd02c057399de88f39c6c518173d1c635b842a03e76aca` match the committed
reference exactly. ADR-0076 records the previous hash and CI provenance; `releases/README.md`
documents how to refresh this public image with future reviewed GUI changes. No image
editing, manifest feature, application/test logic or threshold changed. The successor's
required gates and exact artifact identity remain prerequisites for publication.

## Historical c540 candidate identity and builds

Source: `c540412ec2e4d4a68c93c4e59a26343756adaf69`; this file is not the final release candidate.

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

## Reviewed visual references

Twenty-five unique references cover eight exported example PNGs, six public
scene canvases, six internal scene canvases, three internal full-GUI views and two new
public full-GUI views. The final phone flow, reserved controls and relocated Zoom controls
change the viewport again, so the first candidate's approved images are intermediate
historical evidence and cannot be blindly reused.

The integration owner approved 20 c540 CI geometry references after individual review, also
independently reviewed by prompt 12. They are copied byte for byte with source/run/artifact,
font environment and per-file hash provenance in `11-visual-references.json`. Five GUI
references subsequently came from the corrected c520 source, as recorded below. All 33
comparison executions pass at 6723. The performance repair must preserve those comparisons.

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

## Final combined-source focused checks

At `c5208237753c033b907bae52c9a949c5ab54c363`, the short local Chromium rerun passed
**11/11 cases in 24.3 seconds** across applicable desktop, phone and standalone-file projects.
It reran every one of the nine failed scenarios from the previous local diagnostic: the
exact angle/Undefined semantics, exposed style-card targets, the phone canvas contract,
Expand/refused-input handling and short source/canvas exposure. This is focused regression
evidence, not another full local matrix. Required final CI covers the complete supported matrix.

The early GUI workflow `43865444969` executed both groups: two public missing-reference
failures and three internal old-reference failures, with no other failed assertion. Artifact
`14225855788` is 8,369,082 bytes, SHA256
`e6688746a83d2a2c64d2a096cc5b81935a83a182b2eb917fc20e1dc061db4b75`.
All five exact CI actual images were inspected individually by implement11 and the integration
owner, then copied under ADR-0076; paths and hashes are recorded in
`11-visual-references.json`. Node 22.23.4, pnpm 10.28.0, Playwright 1.56.1 and every recorded
font hash match the previous CI inputs. This diagnostic has no release artifact or gate dependency;
the complete required suite must compare these references successfully on the final commit.

## Remaining acceptance

The first isolated public performance run on c520 passed the existing scene medians:
desktop drag/pan 4.3/2.2 ms and phone 4.4/2.7 ms. The original full-UI fixture failed
Undo-enabled because its centre press selected dependent M234; its low 1.57 ms number
does **not** measure an edit. Native diagnosis showed a visible P1-dot offset of
(-1,+1) CSS px works at the exact same camera/canvas. The corrected fixture preserves
all timing assertions and now verifies the entire document and one-step Undo/Redo.
Its first actual-drag run passed those document/history assertions but **failed** the
unchanged 8 ms app median at **37.51 ms** (p95 58.05 ms; raster median 10.03 ms).
This was a genuine performance blocker at that source, not a passing benchmark or an
accepted tolerance change. The settled-source repair now meets the original gate both
locally and in complete 404 CI, as recorded above. Original and corrected JSON/logs remain
separate c520 public-performance and public-drag-corrected evidence.

- Build and validate the static-asset successor with the complete required CI matrix;
  keep all 25 reference comparisons and original performance limits.
- Verify the exact downloaded successor artifact's source, run, mode, base and checksums.
- Independent prompt 12 acceptance remains required before publication.
