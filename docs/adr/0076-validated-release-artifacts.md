# ADR-0076: Validate and publish one identified public artifact

Status: authorized by release prompt 11. Final candidate acceptance remains pending integration.
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
  bytes/SHA-256, then verifies the provenance response.
- Add interactive hosted Firefox/WebKit projects for construction, persistence, command and
  keyboard flows, modal isolation and the public boundary. Keep single-file coverage in all
  three engines. The exact distributed HTML also has a file-mode compatibility/zero-job test.
  Ordinary public browser suites and existing performance gates remain enabled.
- Leave the nightly main/schedule mutation policy unchanged. Those hours-long campaigns remain
  explicit separate checks; they are not silently made a per-PR publication prerequisite.

## Frozen tests and remaining work

No frozen test assertions, timeouts, screenshots or tolerances are changed by this infrastructure
phase. Additive service-worker and PWA regressions for the download exception preserve
existing assertions. New tests check artifact identity/integrity and the exact offline file. Playwright project
selection adds coverage; existing browser scenarios remain. Final visual inspection, candidate
builds and all release checks follow integration of prompts 01–10. Any reviewed product snapshot
updates require their own recorded evidence; this ADR does not authorize blanket regeneration.

No production publication, merge or release was performed while implementing this decision.
