# ADR-0066: deterministic scene screenshot font

Status: accepted for PR #38's CI repair (2026-11-16).

## Context

PR #38's public mobile nine-point-circle screenshot failed with 390 differing pixels
in CI run 43711518163. The expected, actual and diff artifacts show differences only
in the italic labels; the geometry and canvas dimensions agree. The release font face
selects the first installed serif italic, deliberately preferring Latin Modern to
Liberation Serif. The new public baseline was captured with Latin Modern locally;
the CI machine selected Liberation Serif.

A controlled browser experiment reproduces both images pixel for pixel: explicitly
selecting Latin Modern matches the expected image; selecting Liberation Serif matches
the CI actual. Both remain identical after another 1.5 seconds. Three independent runs
with the fixed Liberation font each reproduce the same 390-pixel failure. This is an
environment-dependent test fixture and an incorrect baseline for that fixture, not a
geometry regression or a render-readiness race.

## Decision

- Bundle an unmodified, SIL-OFL-licensed Liberation Serif Italic font in the E2E fixtures.
  Before navigation, the scene helper replaces the existing `Geomira Math` font source
  in the test response with those bytes. Assert that the replacement occurred, wait
  for the face to load and for two animation frames before inspecting the canvas.
- Keep the production font stack and renderer unchanged. The fixture is test-only and
  uses the existing CI face. Both public and internal scene tests use it.
- Replace only `public-nine-point-circle-mobile-linux.png`, after inspecting the
  expected/actual/diff and establishing that its replacement equals the CI rendering.
  The other eleven public/internal canvas references already pass unchanged.
- Preserve every test, assertion, geometry check, timeout and screenshot tolerance.
  In particular the canvas pixel-ratio limit remains 0.002. Amend the frozen
  `apps/web/e2e/scene.spec.ts` setup under this ADR; record it in STATUS.

## Consequences

Scene visual tests no longer depend on whether the host happens to have Latin Modern
installed. The explicit font load also makes the fixture's readiness observable.
The test fixture adds 375,760 bytes to the repository, with its license and provenance;
it adds no runtime dependency or release asset. Full-page layout references remain a
separate review because they also contain UI changes that predate this PR.

## Alternatives

- Regenerate all snapshots on the current host: would retain the dependency on installed
  fonts and conceal unrelated differences. Rejected.
- Raise the pixel tolerance or retry the assertion: would mask the deterministic
  mismatch. Rejected.
- Change the application's font stack: would change the released appearance to solve
  a test fixture problem. Rejected.
