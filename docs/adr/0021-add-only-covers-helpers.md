# ADR-0021: The add-only guard freezes every file under test/ and e2e/ from run-10 (Run 10, P4)

Status: accepted (Run 10, the maintainer's decision on audit proposal P4). Extends ADR-0001's
add-only guard (rule (e) of `pnpm rules`).

## Context

CLAUDE.md freezes the "test files that existed at the previous run's tag". The guard
(`scripts/check-rules/add-only.ts`) implemented this as `*.test.ts(x)` and `*.spec.ts(x)`
only. The helpers under `test/` were free to change without an ADR:

- corpora of true and false claims;
- tables of degenerate cases;
- the L3 oracle's plans;
- fuzzers;
- Playwright helpers;
- fixtures.

The laws' strength depends on these files as much as on the test files. A helper edit could
weaken a law silently, and Run 3b's STATUS did change two lines of `l3-plans.ts` without an
ADR (docs/audit/2026-10-22.md §1, §6).

## Decision

1. From the tag `run-10` on, the guard freezes every file under a `test/` or `e2e/`
   directory: helpers, corpora, fixtures and data. It also keeps freezing `*.test.ts(x)` and
   `*.spec.ts(x)` anywhere.
2. These are not frozen: snapshot baselines, which are regenerated when the output
   deliberately changes and are reviewed as diffs, and generated test output. That means:
   - `__snapshots__/` directories and `*.snap` files (Vitest);
   - `*-snapshots/` directories (Playwright);
   - `test-results/`, `playwright-report/` and `coverage/`.
3. The rule depends on the tag the guard compares with (`helpersFrozenAt`: the run number of
   `run-N` or `run-Nx` is at least 10). At `run-9b` and earlier tags the old scope applies,
   so the helpers that existed at run-9b are frozen from the next tag on, as decided. This
   run's own helper changes stay under the old rule. They are listed in STATUS, and the
   frozen ones cite their ADRs.
4. As before, a deleted file or a deleted or modified line fails unless every commit that
   removed lines cites an existing ADR (`ADR-NNNN`).
5. The root `tests/` directory (export fixtures compiled by the tex job) is not under `test/`
   or `e2e/` and is not covered. The decision named `test/` and `e2e/`.

## Consequences

- Tests: `scripts/check-rules/add-only-helpers.test.ts`, run against temporary git
  repositories. It covers:
  - the scope at run-9b and at run-10;
  - snapshots and output left free;
  - a deleted helper failing;
  - an ADR-citing change passing;
  - the path classification and the tag reading.

  It failed before the change.

- After the maintainer tags `run-10`, any edit of an existing helper, corpus or fixture needs
  a commit citing an ADR, and STATUS lists it.
- Moving a helper or splitting a file counts as deleting it, so it needs an ADR, like a frozen
  test.

## Alternatives considered

- **Freeze the helpers at run-9b immediately.** The maintainer decided "from the next tag on".
  It would also have flagged this run's ADR-cited helper changes retroactively for no gain.
- **Freeze snapshots too.** Baselines change whenever the rendering changes on purpose
  (ADR-0016's palette). Freezing them would make every deliberate change of output an ADR.
  Their diffs are reviewed instead.
