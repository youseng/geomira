# ADR-0076: Validate and publish one identified public artifact

Status: authorized by release prompt 11. Final candidate acceptance remains pending validation.
Supersedes the independent build/deploy ordering and hand-maintained download of ADR-0030.

## Context

The old deployment workflow could publish while `pnpm verify` was unfinished in a different
workflow. Export compilation was path-filtered and therefore could be missing for a candidate.
The advertised committed HTML was build `5f0ce3be`, including the retired claim interface.
Refreshing that file once would repeat the same synchronization defect on the next change.

## Decision

- `validate.yml` is one read-only reusable graph for the caller's checked-out SHA. PR `ci`
  validates its merge revision; every push uses the deployment wrapper to validate its exact
  pushed revision. Validation has no path filters: verification, built public/internal browser
  checks and export compilation are prerequisites of the artifact-packaging job.
- Export compilation uses the existing Dockerfile built locally. No registry login or package
  write permission is given to PR code. All fixtures and 60 generated documents compile for
  every candidate; no skipped or absent separate workflow is interpreted as success.
- Public builds identify their full source SHA. The public build packages the offline HTML
  byte for byte as `dist/geomira.html`; it never copies internal output. `release.json` records
  source, run/attempt, base, public mode and each delivered file's SHA-256. Browser checks
  exercise the exact offline copy as well as the hosted/PWA output. The validated directory is
  uploaded once, downloaded and integrity-checked, then wrapped as the named Pages artifact.
  Publication does not rebuild it. Integrity checks reject another run, SHA, base or changed,
  missing or additional file. The manifest is provenance, not a claim of external signing.
- Only the default-branch push may enter the deployment job. That job alone receives Pages
  and OIDC write permissions; PR validation never does. There is no `workflow_run` privileged
  promotion. Branch runs cancel superseded validation; production deployment has one canceling
  concurrency group and checks the current default-branch SHA immediately before publication,
  so an obsolete slow candidate is refused. An explicit environment approval may additionally
  be configured by maintainers; this change does not bypass it.
- Advertise the stable public website path `geomira.html`, included with the same deployment
  as the site and manifest. Remove the stale executable from the source repository and explain
  the replacement in `releases/README.md`. A CI artifact with authentication/expiry is useful
  review evidence, not the public download endpoint.
- The PWA navigation fallback explicitly passes only the scope-relative `geomira.html` and
  `release.json` paths through to the network, with their queries. They are assembled after
  the normal precache list and must never receive cached `index.html` in response. Download
  availability initially requires a network; the saved standalone HTML then runs offline.
  Existing app routes still open offline from the app-shell cache. A controlled hosted
  browser test claims/reloads the PWA, navigates to the public file and verifies its exact
  bytes/SHA-256, then verifies the provenance response. The hosted about page offers a
  same-origin `download="geomira.html"` link so users can save the standalone file directly;
  the controlled regression checks its native download bytes/hash as well as navigation.
- Add interactive hosted Firefox/WebKit projects for construction, persistence, command and
  keyboard flows, modal isolation and the public boundary. Keep single-file coverage in all
  three engines. The exact distributed HTML also has a file-mode compatibility/zero-job test.
  Ordinary public browser suites and existing performance gates remain enabled.
- Include the final integration regressions for fractional canvas/native-pointer projection,
  recovery placement, explicit guide dismissal, stable header actions and repeated point
  interaction in hosted Firefox/WebKit and all three offline engines. Hosted Firefox/WebKit
  also run document-file startup draft cases; the existing public offline file, modal, share,
  script, persistence, Randomize and workspace coverage is retained. Internal offline projects
  retain their original engine file tests and add the capability-independent geometry/layout
  regressions without importing public-only capability assertions.
  The delayed-storage first-save/native-pointer and real blocked-storage regressions also
  run in these hosted and offline engine projects.
- Leave the nightly main/schedule mutation policy unchanged. Those hours-long campaigns remain
  explicit separate checks; they are not silently made a per-PR publication prerequisite.
- Run the internal browser suite after an executed public suite succeeds or fails, retaining
  independent public/internal HTML report folders. A public failure still fails the job;
  integrity checks, tested-artifact upload and candidate packaging retain success-only gates.
  Cancellation or an earlier prerequisite that skips public tests does not launch internal
  tests. This collects both sets of failure evidence without promoting a failed candidate.
- Record Node, pnpm, Playwright and OS versions plus the matched system/UI/monospace/math
  font files and their SHA-256 hashes in the browser job log and report environment file.
  Scene screenshots keep their bundled math face; the platform UI stack is not overridden.
  This identifies the actual Ubuntu font inputs and distinguishes local platform differences
  from product changes without accepting mismatches or raising screenshot tolerances.
- Increase the browser job's overall execution envelope from 40 to 60 minutes for the expanded
  public/internal hosted and offline three-engine matrices. The diagnostic public phase alone
  took 14 minutes 15 seconds in push run `43854336027`, before the internal phase. This changes only the CI job budget:
  individual test timeouts, the 5-second scene law, 8 ms frame gate, retries, skips, screenshot
  ratios and all numeric/coverage assertions remain unchanged. Verification and export job
  budgets remain unchanged. A timeout or failed browser job still blocks the candidate.

## Frozen tests and remaining work

No frozen test assertions, timeouts, screenshots or tolerances are changed by this infrastructure
phase. Additive service-worker and PWA regressions for the download exception preserve
existing assertions. New tests check artifact identity/integrity and the exact offline file. Playwright project
selection adds coverage; existing browser scenarios remain. Final visual inspection, candidate
builds and all release checks follow integration of prompts 01–10. Any reviewed product snapshot
updates require their own recorded evidence; this ADR does not authorize blanket regeneration.

The final integration review also migrates the public-release construction scenario to the
ADR-0074 responsive panel contract: after deliberately hiding the panel to drag the canvas,
reopen it with the visible Show panels control before inspecting its tabs. A closed desktop
panel is now absent rather than merely offscreen. All tab-content, keyboard-navigation,
document-compatibility and retired-job assertions are retained.
The 300-object scene measurement opens the visible More actions disclosure before Settings
on compact headers, retaining the existing measurement, object count and 8 ms limit.
The shared world-pointer fixture scrolls its canvas into view before projecting a native
mouse action. With the phone's panel in page flow, source/footer interaction can leave the
canvas above the viewport; a user first scrolls back to that surface. This preserves the
existing world-coordinate, native-event, text and undo assertions and the CSS inverse mapping.

The full-UI 300-object drag fixture's original centre press selects nearby topmost M234 in
the smaller ADR-0074 fitted viewport. The actual trace reports that this dependent point is
not draggable, produces a 48 px refusal notice and leaves Undo disabled. Its 1.57 ms trace
is therefore invalid as a drag measurement. A native press one CSS pixel left and down,
inside P1's visible dot, selects P1 without changing the camera, canvas, object count or
cyclic path reference. The ADR-0014 frame count, timing computation and 8 ms limit remain
unchanged. Assertions outside the measured window now require a coordinate-only P1 edit,
the exact original document when only that coordinate line is restored, and complete
one-step Undo/Redo with no older history. This retains dense-figure topmost-pick friction
as a visible limitation rather than changing hit ordering to satisfy a fixture.

## Individually reviewed final references

The integration owner reviewed every expected/actual/diff for eight exported example PNGs,
six public and six internal scene canvases, and three internal full-page views. The intended
changes follow ADR-0074/0075: wrapping File/header controls, the workspace bar, a bounded
sidebar/source editor and larger phone controls change the available canvas and its fitted
viewport. Geometry, incidence, colors and labels remain the reference contract; the pixel
ratio and time/coverage limits are unchanged. The public UI has no automated verdict chips.

The first 14 public/export replacements use actual bytes from CI run `43838960729`, artifact
`14213420787`, source `86bac50eba8a824f3acf66831eaafe096e8a28f2` (documentation-only descendant
of frozen application source `9622000381c6b253067680593090624fafdff23c`). The per-file names,
dimensions and before/after hashes are in `docs/release-prompts/results/11-visual-references.json`.
Six CI scene canvases match the independently reviewed local images pixel for pixel. Export
differences between local and CI are confined to label font rendering; CI bytes remain the
reference. Internal CI reference replacement is still pending failure evidence.

Known retained-engine limitation: at phone height 664, internal verdict chips can cover the
reflected A′ label and triangle-base labels. This is recorded visibly rather than masked by
test changes; independent review considers it a nonblocking reactivation limitation because
these chips are absent from the public release. No application change is made here.

The c540 diagnostic CI run `43854336027`, artifact `14221259440`, supplies 20 subsequently
reviewed geometry references: eight exports and six scene views in each build mode. All eight
shared exports are byte-identical across modes. The integration owner and independent audit
reviewed every expected/actual/diff and approved the 72 px control-strip reframe without
incidence, color or shape loss. These exact CI bytes replace only those 20 references, with
paths, dimensions and before/after hashes in `11-visual-references.json`. Final-source
comparisons remain required. All five whole-GUI references are deliberately pending the
corrected panel/header source; the known covered Expand control is not accepted into a baseline.

Two additional `public-layout.spec.ts` references cover the untouched public desktop and
phone viewports with a saved nine-point figure, source editor and document controls. They
retain the existing full-GUI 0.01 ratio and explicitly reject claim tabs/chips. Before any
capture override, a real native wheel must expose offscreen palette/command controls. An
additional attachment unclamps overflow only to show the whole existing phone scroll surface;
exact header/workspace/canvas/panel/palette/command bounds must remain unchanged, and the
override is removed before the native reference comparison. The attachment is not a reference
or evidence that the native viewport fits all content at once. The first CI run must collect
the two missing references for individual review; their absence is a failed check, not a pass.

A separate push-triggered `gui-review.yml` collects the two public and three internal GUI
comparisons early. It uses the same source SHA, base path, pinned dependencies, Ubuntu runner,
browser installation and shared browser/font recorder as required validation. Both comparison
groups execute even when the public assertions fail, and the separate reports upload on failure;
missing references remain failed assertions. This workflow has read-only repository permissions,
no release artifact, no publication step and no dependency in the required release graph. The
complete required browser matrix still executes all five comparisons and decides acceptance.
An exact-font local reproduction remained 2.61–3.70% different from same-source CI GUI images,
so these references must be reviewed from CI output rather than generated locally as equivalent.

The required web job also uploads a diagnostic-only public report immediately after an
actually executed public failure, before collecting the internal suite. This responds to
the observed roughly 12-minute wait for the combined report while official active-job logs
returned BlobNotFound. The early archive contains only the public HTML report and shared
environment record, identified by full source SHA, run and attempt, retained 14 days.
Cancellation and skipped prerequisites do not upload it. The public failure remains fatal;
the existing internal diagnostic condition, complete final report upload, least-privilege
permissions and candidate dependency graph are unchanged. No `continue-on-error`, new gate,
privileged follow-up or publication path is introduced.

The five final GUI references use exact actual images from diagnostic run `43865444969`,
artifact `14225855788`, source `c5208237753c033b907bae52c9a949c5ab54c363`. The integration
owner and implement11 inspected both new public images and all three internal
expected/actual/diff comparisons individually. The phone's Expand and Close controls are
visibly separate, and the editable source remains available. The small Text-open figure and
internal-only chip overlap remain explicit limits. Browser, Node and font hashes match the
recorded CI inputs; per-file paths and hashes are in `11-visual-references.json`. Only those
five reviewed images are copied. Their required full-matrix comparisons are still pending.

No production publication, merge or release was performed while implementing this decision.

## Delivered static image consistency

Final artifact inspection found that the unused shipped
`apps/web/public/screenshots/main-desktop.png` still depicted retired claim entry, verdict
chips and the old Style tab. This is a low-severity delivered-asset consistency finding,
not an observed active install dialog: the current web manifest has no `screenshots` field.
Under ADR-0065/0076, replace only its exact bytes with the already-reviewed public desktop
GUI reference, preserving its public path and 1280×720 dimensions. No manifest feature,
application code or implementation-mirroring test is added.

The old 125,614-byte image SHA256 was
`d9b1b5d2e1e9b51a7c9ad25cfd977d9bda541e7797a75a4a1f9a41ad99a7ba1c`.
The replacement is the 121,162-byte actual from source
`c5208237753c033b907bae52c9a949c5ab54c363`, diagnostic run `43865444969`, artifact
`14225855788`, already committed as
`public-layout.spec.ts-snapshots/public-workspace-desktop-linux.png`:
SHA256 `6d17ceef7f61a3b2b6cd02c057399de88f39c6c518173d1c635b842a03e76aca`.
It was individually reviewed by the integration owner, independent audit and implement11;
the reference also passes the complete 404 candidate matrix. A byte comparison and PNG
header check confirm the copy and dimensions. `releases/README.md` records the maintenance
source and refresh procedure. The successor must build and validate this corrected asset;
the earlier 404 archive containing the old image is not the publication candidate.
