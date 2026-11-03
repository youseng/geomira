# ADR-0058: Cheaper mutation timeouts

Status: accepted (the maintainer's decision on the request "usability", 2026-11-01). Changes the
four Stryker configs (`stryker.num.json`, `stryker.kernel.json`, `stryker.claims.json`,
`stryker.discovery.json`). Follows ADR-0057.

## Context

Four cold nightlies (ADR-0057) showed that a mutation shard's minutes are mostly timed-out mutants.
Stryker ends a mutant's run as a timeout after `timeoutFactor` × the dry-run time of the tests that
cover it, plus `timeoutMS`, and counts it as detected. With the defaults (1.5 and 5,000 ms), a timeout
in the kernel costs up to about 1.5 × 107 s plus 5 s, because the kernel suite runs 107 s under
coverage. How many mutants cross the limit on a given runner then decided whether a shard
fitted in 100 minutes: kernel-f took 48, 62 and more than 100 minutes with the same files.

Two remedies were open (STATUS, Requests): keep the slowest tests out of the mutation test set, or
make timeouts cheaper. The maintainer chose the second: no test leaves the mutation run.

## Decision

1. Every Stryker config sets `timeoutFactor: 1.2` and `timeoutMS: 2500` (defaults 1.5 and
   5,000). A mutant whose tests run more than 20 % slower than unmutated, plus 2.5 s, is a timeout,
   and a timeout still counts as detected, as before.
2. `scripts/stryker-timeouts.test.ts` pins both values (and per-test coverage) in the four configs.
3. One cold nightly (dispatched with `full`) measures the result. If every shard fits, the request
   is accepted on that run. If only kernel-f runs past 100 minutes, it is split once more (in
   the shard table, as ADR-0057) and the request is accepted on that run.

## Consequences

- A timed-out mutant costs about 20 % less on long covering runs (1.2 × instead of 1.5 ×) and
  2.5 s less on short ones.
- A mutant that slows its tests by 20–50 % without making them fail was a survivor or a kill
  before and is a timeout (detected) now. It no longer counts as surviving, so a score can rise a
  little. The 2.5 s floor and 20 % margin keep runner noise and GC pauses from making a correct run
  a timeout.
- The test suites and the mutation test sets are unchanged.

## Alternatives considered

- **The slowest tests out of the mutation test set** (hunt-extreme, the L3 oracle): fewer minutes
  per mutant, but those tests kill mutants no other test kills; the maintainer declined it.
- **A lower factor (1.1) or floor (1 s)**: closer to the noise of a shared runner; a correct run
  could time out.
