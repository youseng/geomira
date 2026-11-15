# Prompt 11 — Gate releases and ship the artifact that was tested

Implement this task in the Geomira repository. Read the common execution contract in
`docs/release-prompts/README.md`, then follow `CLAUDE.md` and the repository's SPEC,
STATUS and ADR protocol. The maintainer authorized removing public claim testing;
this task must ship that release scope consistently, without reactivating it.

Audit reference: `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`. Verify the current tree.

## Outcome

The website and advertised offline download must come from a known, tested revision.
Publication must wait for that revision's required checks. Visual baselines must
describe the intended interface and use reproducible browser/font inputs.

This task prepares and validates release infrastructure and artifacts. It does not
authorize a push, merge, production deployment or release publication.

## Evidence to reproduce

1. At the audited revision, README links to `releases/geomira.html`, whose embedded
   build ID and `releases/README.md` identify `5f0ce3be`, made on October 25. It was
   229 commits behind main and lacked common tangents and newer UI/language behavior.
   The fresh `apps/web/dist-single/index.html` was current; the advertised file was not.
2. `.github/workflows/deploy.yml` gates deployment only on its own build/E2E job.
   The separate full-verification workflow was still running after deployment
   completed. A failed or unfinished required check must prevent publication.
3. Nine local screenshot comparisons failed. Some rendering differences were
   environmental, but the expected phone image visibly retained the removed Style
   tab. Do not classify every mismatch as a container issue or accept every actual
   screenshot as correct.

Starting points:

- `.github/workflows/ci.yml`, `deploy.yml`, `tex.yml`, `nightly.yml`
- `apps/web/playwright.config.ts`, `apps/web/e2e/` and snapshot directories
- `apps/web/vite.config.ts`, `apps/web/src/build-info.ts`, `apps/web/build/`
- `apps/web/src/sw/service-worker.ts`, PWA update/version handling
- `README.md`, `releases/README.md`, `releases/geomira.html`
- `docs/audit-checklist.md`, `tests/fixtures/`, `scripts/export-tex.ts`

## Required implementation

1. Make verification dependencies explicit for the same source revision. Prefer
   a clear job graph or reusable workflows over polling an ambiguous green status.
   Include typecheck/lint/rules/tests, builds, supported browser checks and export
   compilation required for this release. Keep nightly mutation policy explicit;
   do not silently remove it or accidentally turn an hours-long scheduled campaign
   into an undocumented gate for every UI edit.
2. Handle path-filtered or skipped workflows explicitly. A release must not wait
   forever for a check that cannot run, accept an unrelated older run, or interpret
   a missing result as success. Ensure export validation actually runs for the
   candidate when it is a required gate.
3. Bind uploaded artifacts to the validated commit, build mode/base path and run.
   Deploy/download those artifacts, not a fresh unvalidated rebuild. Preserve
   provenance with a full source SHA and artifact checksum/identity where practical.
   Ensure an older slow workflow cannot overwrite a newer authorized deployment.
4. Preserve least-privilege credentials. Untrusted pull-request content must not gain
   publication rights by way of a privileged follow-up workflow or arbitrary artifact.
   Do not solve ordering by disabling checks or granting broad repository access.
5. Replace the stale download process with a reliable current-artifact path. Update
   every advertised link and explanation. If the committed HTML is retained, define
   an exact synchronization/check procedure; merely refreshing it once leaves the
   same process bug. A login-required, expiring CI artifact is not an adequate public
   download replacement. Produce the current candidate without publishing it.
6. Inspect visual failures individually. Pin or otherwise control browser/font inputs,
   distinguish expected product changes from regressions, and update only reviewed
   baselines for the final claim-free public UI. Keep meaningful tolerances. Record
   changes and ADR justification where required; no mass snapshot acceptance.
7. Test hosted base paths, the exact downloadable file, PWA offline behavior and the
   version update path. After installing an update, the new public UI must not keep
   stale claim controls through old cached assets. Preserve the user's document,
   including inactive claim data and pending persistence/recovery state.
8. Include a useful subset of interactive desktop flows in supported Firefox/WebKit
   coverage as well as file-opening scenarios. Report engine/device limitations
   explicitly. Do not silently narrow supported browsers to make CI pass.

## Acceptance evidence

- A failed, cancelled, missing or unfinished required validation prevents publication
  of that candidate. A different SHA's success does not satisfy the gate.
- A successful authorized candidate resolves to exactly the validated artifact.
  Demonstrate this with workflow/job structure and controlled dry-run checks; do not
  trigger production publication merely to demonstrate the gate.
- The advertised offline candidate has matching source/build identity and supports
  common tangents, current construction workflows and the claim-free release scope.
- An old document with claim/assumption statements survives offline open/save/share
  and a PWA update without launching automated tests or losing its statements.
- All reviewed screenshot baselines match the intended UI under the pinned test
  environment; every remaining mismatch is reported as unresolved, not hidden.
- `pnpm verify`, both builds, the appropriate complete browser projects and required
  export checks pass on the candidate. Record any unavailable real-device checks
  for prompt 12; emulation does not establish real-device success.

## Boundaries and delivery

Infrastructure may be developed early on an isolated branch. Generate/review final
artifacts only after prompts 01–10 are integrated. Coordinate build-capability switches
with 01 and hosted-link behavior with 03. Do not change application geometry or add
new features here. Do not hardcode the audit's SHA as the identity of future releases.

Deliver the workflow dependency explanation, artifact provenance, inspected visual
diffs, exact check outcomes, remaining release prerequisites and the candidate file
location. State explicitly that production publication was not performed.
