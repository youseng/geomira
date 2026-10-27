# ADR-0038: Every nightly mutation shard within Stryker's time limit (Run 17)

Status: accepted (Run 17). Amends ADR-0035's "its own shard" for discovery (now four shards) and
ADR-0032 decision 18's placement of `transform/inversion-tools.ts` (kernel-j). Changes one line
of a frozen test (below).

## Context

Each nightly mutation shard gives Stryker 100 minutes (`timeout 100m` in nightly.yml, inside the
job's 120). Stryker writes its incremental file only when a run completes, so a shard that runs
out of time saves nothing and starts over the next night: it never passes the gate.

- **kernel-j** (`tools/transforms.ts:133-265`, `tools/map-ops.ts`, `transform/inversion-tools.ts`;
  814 mutants). On Run 14's branch its first run took about 80 minutes. On main, which cannot
  read a branch's cache, the nightly after Run 14's merge
  (https://github.com/youseng/geomira/actions/runs/40413679232) stopped it at 100 minutes with
  659 of 814 tested (185 timed out). The gate on main has failed since, and the shard is on
  course to fail on every branch.
- **discovery** (the whole package, 3,589 mutants). The first dispatch on Run 17's branch
  (https://github.com/youseng/geomira/actions/runs/40465577525) had tested 2,223 after 70
  minutes, when a push cancelled it. At that rate (it was slowing as timeouts grew) a full run
  takes about two hours.

## Decision

1. **discovery in four shards** (`DISCOVERY_GROUPS` in scripts/mutation-shards.ts): discovery-a
   (closure, closure-view, terms, uf), discovery-b (candidates, scan, ticking, solve, job),
   discovery-c (lemmas, hunt, position, text, rules), and `discovery`, the rest by negated globs
   (find, branch-fix, branch-sites, rank, types and any new file), as kernel-h is for tools/.
   The first grouping, by source lines (about 850 each, rules and rank in discovery-a), took 80,
   55, 18 and 17 minutes on e33cf50 (run 40479162163). 391 of discovery-a's 542 mutants were
   timeouts (closure.ts 180, rules.ts 94, rank.ts 78), so rules.ts and rank.ts moved to the two
   short shards. The gate still sums the package over its shards at 75 %.
   `scripts/mutation-discovery.test.ts` checks that the shards partition stryker.discovery.json's
   files and that a new file falls to the last shard.
2. **kernel-j's Run 14 files spread over light shards**, each cut between top-level statements
   (as the frozen test of cuts requires): `transform/inversion-tools.ts` lines 1–177 (its
   functions) join kernel-i (lines.ts) and lines 178 on (its tool specs) kernel-k (mobius.ts,
   apply-map.ts); `tools/map-ops.ts` lines 1–86 (compose, inverse, apply) join kernel-e
   (points.ts, triangle.ts) and lines 87 on (its tool specs) kernel-g (measures.ts,
   functions.ts, display.ts). kernel-j keeps transforms.ts:133-265, the range the frozen
   summary test fixes for it. There are still eleven kernel shards, with the same parents.
   Moving inversion-tools.ts alone was not enough: on a933455's tree kernel-j still held 399
   mutants (190 in transforms.ts:133-265, 209 in map-ops.ts) and ran for more than 50 minutes,
   while kernel-i took one minute for its 88 and kernel-k 16 minutes for its 251 new ones.
   kernel-j's mutants are covered by most of the kernel suite (about 85 s per run), so each of
   its timeouts costs minutes.
3. **Frozen test changed** (one line, this ADR): in `scripts/mutation-shards.test.ts`, "every
   file a shard names exists" looked files up in packages/kernel/src only, so a discovery shard
   that names a file failed it. The lookup now also covers packages/discovery/src. That check is
   just as strict, and it now covers more shards. The line in the same file that Run 17 added
   for discovery (`['discovery', [], '']`, not frozen) now lists the discovery shards from
   `SHARDS`; their contents are checked in mutation-discovery.test.ts.

## Consequences

- With the first steps of this split (inversion-tools.ts moved, discovery by source lines), every
  shard finished on e33cf50 and the gate passed (num 93.47 %, kernel 97.95 %, claims 85.70 %,
  discovery 85.30 %), but kernel-j took 91 minutes and discovery-a 81: too close to the limit
  for main, whose first nightly after the merge cannot read the branch's caches and runs them
  in full. Decisions 1 and 2 as written spread those two further, so each shard's full run is
  well inside the limit even on a slower runner. The first night after a change to
  these files still runs them in full; later nights reuse each shard's own incremental file.
- Moving a file to another shard makes it run in full once (the new shard's cache does not have
  it). After that, a shard re-tests only what changed.
- main's gate is red because of kernel-j until a branch with this change is merged.

## Alternatives considered

- **A twelfth kernel shard for inversion-tools.ts**: needs the frozen eleven-shard test changed.
  Spreading the file over two light shards does the same without that change.
- **Higher Stryker concurrency or a shorter mutant timeout**: GitHub's runners have four vCPUs,
  so more workers cannot give the halving needed. A shorter timeout counts slow mutants as
  Timeout, which the gate treats as detected, so the score would rise for no reason.
- **A longer job limit**: one shard taking two or more hours, on the edge of the job's limit, for
  every change to the package.
- **Discovery in subdirectories, one glob per shard**: would avoid the frozen line, but moves
  every source file of the package and its imports for a CI concern.
