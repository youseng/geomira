# Prompt 11 infrastructure phase

Base: `f95e0056c9e2cb73d23c6dac900acaf9e7f1a06a`, isolated branch `codex/release-11`.
Final candidate and independent release acceptance are pending integration of prompts 03–10.
No source snapshot or visual reference was regenerated; no publication was performed.

## Implemented

- Same-run `validate.yml` graph: verification, public/internal browser builds and unconditional
  export compilation all precede candidate packaging. PR CI and pushed-branch validation use
  this graph; default-branch deployment consumes its named Pages artifact without rebuilding.
- No privileged workflow-run promotion or PR package write token. Export Docker images build
  locally from the existing toolchain. Same-branch cancellation, a production concurrency
  group and current-default-branch SHA check reject obsolete deployment candidates.
- Full source SHA build IDs, automatically assembled exact public offline copy and a
  source/run/attempt/base/public-mode/checksum manifest. Packaging verifies every delivered
  byte after artifact download. Failed/skipped/cancelled prerequisites cannot package or deploy.
- The public current download is the website's `geomira.html`, delivered with that exact site.
  Removed the stale committed executable and replaced the advertised link/documentation.
- Added 60 interactive hosted Firefox/WebKit checks across existing build, persistence,
  keyboard, modal and public-release specs; retained file-mode coverage. Added an exact
  distributed-file test for common tangents, preserved claims/assumptions and no claim worker.
- Existing scheduled/main mutation policy and all screenshot/time/count/coverage limits retained.

## Checks performed

Pinned pnpm 10.28.0, Node 24.22.1. Lockfile/dependencies unchanged.

- `pnpm install --offline --frozen-lockfile --store-dir /tmp/geomira-pnpm-store`: passed.
- New integrity suite before implementation: failed because the packaging API did not exist.
- `pnpm exec vitest run scripts/release-candidate.test.ts`: **4 passed / 1 file**.
  Checks exact copy, checksums and rejection of wrong source/run/attempt/base, modified/missing/
  injected files, stale offline builds and internal-mode manifests.
- `pnpm exec tsc -p tsconfig.tests.json --noEmit`: passed.
- Focused ESLint of new scripts, config changes and offline browser spec: passed.
- Actionlint 1.7.11, `-shellcheck= -pyflakes=`, on ci/deploy/validate/tex workflows: passed.
- PyYAML structural dry run: candidate needs exactly verify/web/exports, export and candidate
  have no skip condition, deployment needs validation and a default-branch guard; passed.
- `playwright test --list --project desktop-firefox --project desktop-webkit`: **60 checks
  enumerated across 5 specs**. These are discovery results, not browser passes.
- `git diff --check`: passed. No frozen test modifications; new tests only.

## Integration and remaining acceptance

Use `GEOMIRA_PREVIEW_PORT` for isolated browser servers (default public 4173/internal 4174).
The public build now also runs `scripts/package-release.ts`; after both Vite builds it emits
`apps/web/dist/geomira.html` and `release.json`. CI records its Actions run/attempt; local builds
record `local`/`1`. The explicit CLI in releases/README remains available for inspection.

After all product changes integrate, build the final committed candidate and run the full
required checks, export compilation, complete browser projects, exact offline/PWA update
checks and individual visual-diff review. The newly added exact-download spec has not run
in this infrastructure phase; its file is intentionally not built from intermediate product
source. Firefox/WebKit runtime availability and physical-device/screen-reader limits must be
reported separately. Root owns integrated STATUS and final artifact evidence.
