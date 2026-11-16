# Combined implementation checks

This record tracks checks performed by the integration owner, rather than repeating
subagents' results as new runs. Final acceptance remains pending complete verification,
browser/visual/export validation, CI and prompt 12.

## Initial combined candidate

After integrating 03 core, 05, 06, 08 and 11 infrastructure:

- Nine focused suites: **57 passed / 9 files**, 40.39 seconds. Covered checked sharing,
  canonical files, file lifecycle, property visibility, tool dependencies, sampler inputs,
  Randomize, worker invalid outcomes and release manifest integrity. Log:
  `/tmp/geomira-integrated-focused.log` (local evidence; tests are committed).
- Intermediate CI at `8832146` found a genuine dependency cycle introduced by shared
  draft ownership: store → text-apply → long-press → gestures → store. Extracted generic
  `Schedule`/`timeout` into a host primitive without editor imports, preserving the existing
  long-press module's exports and behavior.
- After that extraction, `pnpm depcruise`: **passed**, 990 modules / 5,781 dependencies.
  Timer/text application suites: **30 passed / 3 files**, 8.46 seconds.
- Independent review found two file-cancellation defects (late read reopening a dialog,
  Save As applying a draft before an accepted cancellation). Both were subsequently
  corrected and independently re-reviewed; the earlier green tests were not treated as
  sufficient acceptance.

## Baseline

The initial check was invalidated by moving a scratch test while formatting enumerated
files; a second in-place attempt was stopped when integration touched its source.
Neither is counted as a baseline pass. A fresh immutable checkout at
`f95e0056c9e2cb73d23c6dac900acaf9e7f1a06a` passed the complete baseline protocol:
4,904 tests / 534 files with every static and coverage gate.

## First complete source and adversarial acceptance

Application source `9622000381c6b253067680593090624fafdff23c`, followed by documentation-only
`86bac50eba8a824f3acf66831eaafe096e8a28f2`, integrated prompts 01–10. This was a candidate
for review, not an accepted release.

- Push CI at `86bac50`: complete verification passed **5,021 tests / 549 files**; export
  validation reported **80 inputs, 74 compiled and checked, 6 precision-guard refusals,
  0 failed**. Public browsers: **517 passed / 35 failed / 1 not run**. Fourteen failures
  were individually inspected visual references after the intentional layout changes;
  the remaining failures were investigated as potential product defects.
- Local normal public Chromium diagnostic: **299 passed / 7 failed**, excluding the
  fourteen visual cases and two in-suite timing cases. This is pre-fix diagnostic evidence,
  not acceptance of the changed tests/source that followed.
- Independent local `pnpm verify` at `9622000` returned failure: **5,020 passed / 1 timed
  out**, 549 files. The scene-law example/300-object case took 5,065 ms against its
  unchanged 5,000 ms limit during concurrent browser work. No timing limit was relaxed;
  isolated diagnosis and a complete final-source run are required.
- The independent reviewer reproduced PWA update loss of unfinished Text and Command
  drafts. Normal browser validation reproduced recovery/warning overlays covering phone
  controls, a first-use guide intercepting construction, moving save-status controls,
  selection controls covering a point, fractional canvas input mapping, and an asynchronous
  startup adoption race with pending source. These findings block acceptance until their
  narrow fixes and affected scenarios are re-reviewed on the revised source.
- Frozen test corrections use visible panel restoration and the compact Settings menu;
  original data, worker, geometry, Undo and timing assertions remain. Approved visual
  reference provenance is in `11-visual-references.json`; unreviewed images are not accepted.

Final counts, fixes, artifact identities and the independent decision will follow after the
complete revised candidate passes. No intermediate success is carried forward as approval.

No main merge, release publication or production deployment was performed.
