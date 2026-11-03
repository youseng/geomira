# ADR-0059: A mutation shard's cold run fits within 150 minutes

Status: accepted (the maintainer's decision on the request "usability", 2026-11-02). Amends
ADR-0038 (the shard-size rule) and ADR-0057/ADR-0058 (the layout and the timeouts). Changes
`.github/workflows/nightly.yml` and the shard table.

## Context

ADR-0038 sized the mutation shards so that a cold run (no incremental cache) of each fits within
Stryker's 100-minute limit in the nightly. Five cold runs on this branch (ADR-0057, ADR-0058)
showed that a shard's cold minutes depend on how many mutants cross Stryker's timeout on the runner
of the day: the same files took 48, 62 and more than 100 minutes. After cheaper timeouts
(ADR-0058), the fifth cold run (9784b4e, run 41296971836) had 29 of 30 shards within 4–93 minutes.
kernel-h, the catch-all of the kernel's tool files, ran out of time at 94 % of 1,514 mutants with
147 timeouts; ADR-0045's common-tangents.ts and similitude.ts were in it.

Cold runs happen only when a shard has no cache of its own: on main after a merge that changes or
moves its files, and on a dispatch with `full`. Every other night is incremental and takes minutes
(the incremental nightly on eacbf5a: 1–64 minutes per shard).

## Decision

1. **The shard-size rule becomes "a cold run fits within 150 minutes with margin."** Stryker's
   own limit in the nightly is `timeout 150m`; the mutation job's `timeout-minutes` is 170, which
   leaves time to save the incremental cache and the report after a full run.
   `scripts/stryker-timeouts.test.ts` pins both.
2. **kernel-h's two new tool files move** to kernel shards with room on the fifth cold run:
   common-tangents.ts to kernel-f (59 minutes) and similitude.ts to kernel-d (27). Eleven kernel
   shards stay.
3. Incremental runs are unaffected: they retest what changed, as before.
4. Acceptance (the maintainer's rule): one cold run after this change. If every shard finishes and
   the gate passes, the request is accepted on that run. If not, the request is not accepted on a
   missing shard report, because main's first nightly after the merge is a cold run and would go red.

## Consequences

- A cold nightly can take up to about three hours of wall time for its longest shard (30 jobs, 20
  at a time).
- A shard can grow by half before it needs splitting, and the variance between runners no longer
  decides whether main's first nightly after a merge goes red.

## Alternatives considered

- **Splitting until every shard fits 100 minutes on every runner**: five cold runs show the
  variance outruns the splits; each split also costs a cold run of the moved files.
- **Excluding slow tests from the mutation set**: declined by the maintainer (ADR-0058).
