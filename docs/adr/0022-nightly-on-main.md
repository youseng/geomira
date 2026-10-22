# ADR-0022: The nightly workflow also runs on every push to main (Run 10, P5)

Status: accepted (Run 10, the maintainer's decision on audit proposal P5). Changes when
`.github/workflows/nightly.yml` runs; SPEC §17 L15 (incremental mutation testing of num,
kernel geometry and claims) is unchanged.

## Context

The nightly workflow (the NIGHTLY=1 test suite and incremental mutation testing) ran on its
schedule and on dispatch. A push to a branch ran its test job only, and only when the push
changed the workflow or a test or mutation configuration (a `paths` filter). Runs 9a and 9b
were merged without a nightly running on their code, so Run 10's brief quoted a claims score
two runs old (docs/audit/2026-10-22.md §1). The maintainer's decision:

- run the nightly (tests and incremental mutation) also on push to main;
- keep the concurrency rule and the schedule;
- branches still run only the fast test job.

## Decision

1. **Every push triggers the workflow.** A workflow has a single `push` filter, and `paths`
   applies to every branch it lists. So the push trigger no longer filters paths, and a first
   job, `scope`, decides what runs (`scripts/nightly-scope.sh`; checkout only, no install):
   - schedule, `workflow_dispatch`, or a push to `refs/heads/main`: `test=true`,
     `mutation=true`;
   - a push to another branch: `mutation=false`, and `test=true` only when the push changes
     one of the paths the old filter listed. Those are `.github/workflows/nightly.yml`,
     `stryker.*.json`, `vitest.*.config.ts`, `scripts/mutation-shards.ts` and
     `scripts/mutation-summary.ts`, plus the new `scripts/nightly-scope.sh`. The comparison is
     with `github.event.before`, or with `origin/main` for a branch's first push. With no base
     at all, the test job runs.
2. The `test` job runs if `needs.scope.outputs.test == 'true'`. The `plan` job, and through it
   the mutation shards, runs if `needs.scope.outputs.mutation == 'true'`. Mutation stays
   incremental: on a push, `inputs.full` is unset, so each shard restores its cache.
3. The schedule (`17 3 * * *`), the dispatch input and the concurrency rule
   (`nightly-${{ github.ref }}`, cancel in progress) are unchanged. A push to main therefore
   cancels a nightly still running on main. Every shard saves its incremental file even when
   cancelled (`if: always()`), so the next run continues from it.

## Consequences

- Each merge to main gets its own nightly. STATUS can quote mutation scores of the merged code.
- Every branch push now starts the `scope` job, about 10 s on a runner, which ends without
  further jobs unless the configuration changed. Branches still never run mutation testing.
- Tests: `scripts/nightly-scope.test.ts` runs the script against temporary git repositories:
  - schedule, dispatch and push to main;
  - a branch push with source changes only;
  - every configuration path;
  - a new branch compared with origin/main.

  It also checks that the workflow calls the script, gates both jobs on its outputs, keeps the
  schedule and the concurrency group, and no longer filters paths. It failed before the change.

## Alternatives considered

- **`workflow_run` after ci on main.** Indirect, and it runs after ci rather than on the push.
  Its ref and commit are those of the default branch at the time, not necessarily of the
  push.
- **A second workflow file for main.** It duplicates the mutation matrix and its caches, and
  two concurrency groups could run mutation twice on the same commit.
- **A third-party paths-filter action.** It adds a dependency for a decision a few lines of
  shell make.
