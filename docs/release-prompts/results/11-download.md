# Prompt 11 follow-up: deliver download bytes through the PWA

Base: c3fb932 on the release assembly branch. This isolated follow-up fixes a
concrete integration defect discovered in the prompt 11 source review.

## Finding and correction

The public offline file and release manifest are assembled after Vite writes the
PWA precache. The old generic navigation fallback therefore answered
`/geomira/geomira.html` with cached hosted `index.html` once a service worker
controlled that origin. The same problem affected a navigation to `release.json`.
The original release-download file:// test did not exercise a controlling worker.

The service-worker policy now passes through only these two exact scope-relative
release paths, including their query strings. Their initial retrieval uses the
network; after saving, the standalone HTML remains usable offline. Ordinary app
routes, cached build files, old-version cleanup and explicit update activation
retain their existing policies. No arbitrary-path bypass was added.

The local candidate instructions also set `GEOMIRA_BASE=/geomira/` before building,
so the declared deployment base matches the actual generated asset URLs.
ADR-0076 records the download policy and additive regressions.

## Evidence

- Before the fix, the new policy regression failed: expected passthrough, actual
  `{kind: 'cache', key: 'index.html'}`. Nine existing unit tests passed.
- Before the fix, the real PWA browser test also failed after service-worker claim
  and reload. It received the 686-byte hosted shell instead of the 1,243,072-byte
  standalone file. The test compares booleans/hashes for readable future failures.
- `pnpm exec vitest run apps/web/test/service-worker.test.ts scripts/release-candidate.test.ts --maxWorkers 1`:
  **14 passed / 2 files**, 1.26 seconds after the fix.
- `GEOMIRA_BASE=/geomira/ pnpm build`: both public builds and candidate packaging
  passed; the existing chunk-size advisory remains.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/geomira-browsers GEOMIRA_BASE=/geomira/ GEOMIRA_PREVIEW_PORT=4192 pnpm --filter @geomira/web exec playwright test --project pwa --workers 1`:
  **5 passed**, 23.0 seconds, including every existing PWA offline/update/durable-save
  case and the new controlled hosted download case. That case compares exact bytes
  to both the packaged file and `dist-single/index.html`, checks SHA-256 against the
  manifest, renders the claim-free app, and checks the provenance response itself.
- Changed-file Prettier and ESLint checks passed. `pnpm exec tsc -p tsconfig.tests.json`
  passed.

Both frozen test files receive additions only; no existing assertions, timeouts or
expected images change. The PWA test server gains the JSON MIME type to model the
real public provenance response. No dependencies, push, publication or deployment
are involved. Full final-tree verification, browsers and release provenance remain
owned by the integration validation and independent audit.
