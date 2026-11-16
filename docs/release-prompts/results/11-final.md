# Prompt 11 final candidate validation

Candidate application source: `9622000381c6b253067680593090624fafdff23c`, after prompts
01–10 were integrated. This report records this final-source session's checks;
infrastructure-phase results are in `11-infrastructure.md`. No production publication,
main merge, deployment or release was performed.

## Candidate identity

Pinned pnpm 10.28.0; Node 24.22.1; Playwright 1.56.1 / bundled Chromium 141.
Frozen-lockfile offline dependency installation passed. With `GEOMIRA_BASE=/geomira/`
and `GEOMIRA_BUILD` set to the full candidate SHA:

- `pnpm build`: public hosted and standalone builds passed.
- `pnpm --filter @geomira/web build:claims`: internal hosted and standalone builds passed.
- Local public file: `apps/web/dist/geomira.html`, **1,263,779 bytes**, identical to
  `apps/web/dist-single/index.html`.
- SHA-256: `3c56ce1b81df052bcf684caef19c0a88dff5d622ab768ba8897550c3d8d69f38`.
- `release.json`: full source SHA above, public mode, `/geomira/`, run `local`, attempt `1`.
  This local file is separate from the eventual downloaded CI candidate.

## Visual review

Initial screenshot-only runs used `--workers 1`, the pinned browser and existing
thresholds. Public: **14 failures**; internal: **17 failures**. These are 23 unique
reference files because eight PNG export goldens are shared by both modes. Every
expected/actual/diff was inspected individually and reviewed by the integration owner.
No blanket snapshot update or tolerance increase is authorized.

The reviewed changes are:

- Eight PNG export goldens: Euler line, Feuerbach, incenter/excenter, Miquel, nine-point
  circle, radical axes, reflection layer and Simson. The changed workspace geometry
  changes the export viewport from **824×612 to 856×534**. Incidence, colors, labels
  and complete constructions remain intact.
- Six public canvas references and six internal canvas references: Euler line,
  nine-point circle and reflection layer on desktop and phone. Desktop becomes
  **856×534**; phone becomes **390×297**, previously 390×468. The workspace controls,
  bounded panel and larger touch controls intentionally reframe the view. Public
  references contain no automated verdict chips. Internal references retain them.
- Three internal full-page references: desktop main screen, desktop Claims panel
  after a local test and phone main screen. The File controls, wrapping header,
  workspace bar and source editor gutter/help are intended changes.

Explicit retained-engine limitation: on the 390×664 internal phone layout, verdict
chips overlay the reflected A′ label and some triangle-base labels after the new
workspace reduces canvas height. This is visible in reviewed actual images and is
not hidden or repaired by changing screenshot assertions. The public UI has no
verdict chips. Independent prompt 12 review determines its release relevance.

Scene helpers inject the repository's bundled Liberation Serif Italic. The eight
export goldens use the platform math face; CI/local differences were inspected and
confined to label glyphs, with identical geometry and incidence.
Full-page screenshots use the platform's actual system UI face; this container
resolves OpenAI Sans, while the Ubuntu CI image uses its own system face. The three
previously inherited local full-page font differences must therefore be distinguished
from intended product changes. CI-generated actual images are the reference source.

The first 14 reference files now use the approved actual bytes from CI run
43838960729, artifact 14213420787, source `86bac50eba8a824f3acf66831eaafe096e8a28f2`
(a documentation-only descendant of the frozen application source). Six public scene
images match the local actual images pixel for pixel. Per-file paths, dimensions and
before/after hashes are in `11-visual-references.json`. The remaining nine internal
CI references and final comparisons are pending.

Focused recheck after these replacements: **17 passed / 0 failed / 0 skipped** in
44.3 seconds: all 14 public/export comparisons at the original 0.002 limits plus
the repaired public zero-job construction fixture on desktop, phone and file-Chromium.

## Browser checks

The initial frozen-source functional Chromium matrix completed **299 passed / 7
failed / 0 skipped**, 306 tests in 896.6 seconds. It included desktop, mobile, Pages,
PWA and file-Chromium projects using `/geomira/` and the actual `file://` standalone
build. Fourteen screenshot cases and two inline 300-object frame measurements were
excluded from this functional invocation and are counted separately. Dedicated
measurement projects remain deferred until other CPU work is idle. The seven
failures were three mobile recovery-overlay cases, the mobile guide intercepting
an explicit polygon construction, the mobile selection bar intercepting a second
style-card click, and two closed-panel fixtures (desktop/file-Chromium). These
exact failures were reported before repairs; they are not acceptance passes.

Command, with the pinned manager/browser environment and public preview port 4203:

```sh
pnpm --filter @geomira/web exec playwright test \
  --project desktop --project mobile --project pages --project pwa --project file-chromium \
  --grep-invert 'screenshot baseline|PNG golden|frame time at 300 objects' --workers 1
```

Firefox/WebKit runtime and physical-device/screen-reader limits remain separate
from Chromium emulation results.

Initial CI public matrix on the documentation-only `86bac50` revision: **517 passed,
35 failed, 1 dependency-skipped**. Fourteen failures are the reviewed screenshots.
The 21 nonvisual failures include stale closed-panel and compact Settings fixtures,
responsive recovery/guide/selection overlays, Firefox coordinate/focus behaviors and
a Firefox file-download path. They remain reported failures, with separate owners
investigating; none is treated as a final acceptance pass. Internal CI was not reached
in that run. The subsequent diagnostic workflow preserves both report folders even
if public validation fails.

Two deliberately migrated fixtures retain all original assertions: reopen Show panels
after the public construction test hides it, and open More actions before compact
Settings in the 300-object measurement. Focused ESLint and `git diff --check` passed.
The original failures precede these changes; the repaired public fixture passed in
all three supported local Chromium projects. The Settings setup will be exercised
with the isolated measurement after the new source freeze.

Independent prompt 12 found an additional PWA update risk: unapplied invalid source
could be dropped on reload. A separate owner is implementing the guarded update. The
candidate requires a new source freeze and re-audit before final acceptance.

## Failure evidence and release gates

The workflow now retains separate `playwright-report/public` and
`playwright-report/internal` evidence. After an actually executed public suite,
internal tests run on public success or failure; they do not run after cancellation
or skipped prerequisites. A public failure still fails the web job. Integrity checks,
tested artifact upload and the candidate graph retain their normal success-only gates.
No `continue-on-error` is used.

Actionlint 1.7.11 passed for the workflow. A structural dry run checked all eight
public-outcome/cancellation combinations, distinct report paths and unchanged
`candidate.needs = [verify, web, exports]`; failed/skipped/cancelled public outcomes
cannot package a candidate. Scheduled mutation policy remains unchanged.

## Remaining acceptance

- Retrieve and individually compare CI screenshots; replace only approved references
  under ADR-0076, then repeat comparisons.
- Complete public/internal supported local Chromium projects and isolated performance
  checks; record exact counts and any failures.
- Integration owner supplies full verification, required export compilation, complete
  supported remote browser results and exact downloaded CI artifact evidence.
- Independent prompt 12 acceptance and real-device/screen-reader limitations remain
  explicitly separate.
