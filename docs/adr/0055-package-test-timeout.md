# ADR-0055: The package tests' timeout is a hang guard of 15 s

Status: accepted (maintainer request "usability", found while driving its CI to green,
2026-10-31). Changes `vitest.config.ts` only; no test file changes.

## Context

CI's verify job failed on 56ab141 with one test past vitest's default 5 s timeout:
`packages/kernel/test/tools-circles.direct.test.ts`, "FloatField: every tool returns a value,
never throws, never a non-finite number" (run 41186470559). The test is frozen. It calls every
registry tool on every argument list of up to three values from an eleven-value pool, about
1,460 lists per tool, with two assertions per call, in each of three fields.

Measured on this container, idle, under coverage (as `pnpm verify` and CI run it): 3.7–4.5 s
per field on run-16c (9ade9a3) and 3.7–4.2 s on this branch. So the branch does not make it
slower in any measurable way (item 1 adds two tools to the registry, about 2 %). The test was
already within a second of the limit, and a busier CI runner crossed it. Earlier STATUS sections
record the same kind of failure in other frozen tests (a find job in `projective-facts.test.ts`,
`sampler-local-10sigma.test.ts`, choice-four); each was fixed by an explicit timeout or a faster
test, which a frozen test cannot take.

## Decision

1. The `packages` project of `vitest.config.ts` sets `testTimeout: 15_000` (the `scripts` project
   already has 60 s). The timeout is a guard against a hang, not a performance budget: SPEC §17's
   budgets are measured by their own tests (bench and the e2e timing specs), which do not rely on
   vitest's timeout.
2. No test file changes; tests that set their own timeout keep it.

## Consequences

- A test that hangs now fails after 15 s instead of 5 s.
- A test that becomes three times slower is no longer caught by the timeout; the CI job's duration
  (in the log) and the timing specs remain the measures of speed.

## Alternatives considered

- **Rerunning CI until it passes**: hides a known flake.
- **Making the sweep faster**: its time is mostly the per-call assertions under coverage, in a
  frozen file.
- **An explicit timeout in the test**: a modification of a frozen test.
