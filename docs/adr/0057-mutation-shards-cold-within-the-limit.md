# ADR-0057: Claims in three mutation shards, discovery in ten; two kernel files move

Status: accepted (maintainer request "usability", constraint "shards within 100 minutes on a
COLD run", 2026-10-31). Amends ADR-0038 (the shard layout). Changes `scripts/mutation-shards.ts`
(the group tables move to `scripts/mutation-groups.ts`) and four frozen lines of the shard tests.

## Context

Two cold nightlies were dispatched with `full` on this branch:

- **5fef14e**, run 41218368581: thirteen of twenty shards ran into the 100-minute limit.
- **a0d505b**, run 41230221798, after ADR-0056's gcd: every kernel shard finished (kernel-a 95
  minutes, kernel-i 86, the others 18–73). Five shards still ran out of time: claims (73 % of
  6,805 mutants in 98 minutes), discovery-b (78 %), discovery-c (80 %), discovery-d (82 %) and
  discovery-e (77 %). Each is on course for 115–134 minutes.

These five overruns are older than this branch. A cold run of discovery-d's mutants, side by side on
this container with two cores each, tested 465 of 1,034 mutants in 22 minutes on run-16c (9ade9a3)
and 458 on this branch; its source files are unchanged. claims had 6,456 mutants on run-16c and
6,805 here; its last measured full run took 47 minutes, with 2,342 (Run 8a). Since then, only the
incremental runs were measured, and those retest only what changed. A shard that runs out of time saves no cache, so its next nightly is cold again: the nightly cannot turn green on
its own.

## Decision

1. **claims in three shards** (`CLAIMS_GROUPS`): claims-a, the kinds (kinds-_.ts, kind.ts,
   kind-hints.ts, kind-registry.ts, ndg.ts, symmetry.ts, collinear-infinity.ts); claims-b, the
   tester (verdict_.ts, job.ts, prepare.ts, rungs.ts, decide.ts, screen.ts, analysis.ts); and
   `claims`, every other file, by negated globs, as kernel-h and `discovery`. It keeps the old id
   and cache key, so a new file is always mutated. The new shards name `claims` as their parent
   (its cache seeds their first run). The gate sums the package over its shards at 75 %, as
   for the kernel and discovery.
2. **discovery's four slow shards halved** by source lines (`DISCOVERY_GROUPS`):
   - b: candidates, scan, ticking, job; f: scan-rounds, solve, lattice, consequences.
   - c: lemmas, hunt, position, text; g: rules and the four angle files.
   - d: closure-merge, closure-conics; h: closure-maps, closure-mid.
   - e: derive, group; i: confirm, find-units.
3. **Two kernel moves between existing shards** (eleven kernel shards stay):
   - the conic core (CONIC_A: conic.ts, conic-glider.ts, conic-maps.ts) from kernel-a (95 minutes)
     to kernel-e (20);
   - the projective constructors (PROJECTIVE_I) from kernel-i (86) to kernel-j (27).
4. **The tables move to `scripts/mutation-groups.ts`** (mutation-shards.ts would pass 400 lines);
   mutation-shards.ts re-exports them.

## Frozen tests changed (each in the commit citing this ADR)

- `scripts/mutation-shards.test.ts`:
  - "every file a shard names exists" also searches packages/claims/src: a claims shard now names
    files.
  - "num and claims run their whole config" is now "num runs its whole config; claims and
    discovery by file groups": the claims entries come from `SHARDS`, as the discovery ones did.
- `scripts/mutation-discovery.test.ts`: the id list gains discovery-f, -g, -h and -i, the parents'
  list four more '' entries, and the title says ten shards.
- `scripts/mutation-gate.test.ts` ("fails when any one package is below its threshold"): the low
  report is written for every shard of the package, not only for the shard named like the package.
  With claims split, a low `claims` shard beside two passing ones no longer makes the package's sum
  low. The assertion (the package fails, the others pass) is unchanged.

`scripts/mutation-claims.test.ts` (new) checks the claims partition, the catch-all and the parents.

## Consequences

- 25 mutation jobs instead of 20. A free account runs 20 jobs at once, so a cold nightly's wall time
  grows, while each shard's own time limit is unchanged.
- The first nightly after the merge runs the moved and new shards cold (no cache of their own).
  `claims-a` and `claims-b` restore `claims`'s cache.
- The shard times are estimates from the per-mutant rates of the two cold runs (each new shard about
  45–65 minutes). The next cold run measures them, and STATUS records the times.

## Alternatives considered

- **A shorter Stryker timeout** (`timeoutMS`, `timeoutFactor`): fewer minutes per timed-out mutant,
  but more slow mutants would count as detected. That weakens the measurement.
- **Splitting only what this branch slowed** (the kernel): leaves the nightly red on the five older
  overruns.

## Amendment: the third cold run (d08200e, run 41242777649)

Twenty-two of twenty-five shards finished; the times of one shard vary widely between runs (kernel-h
73 minutes on a0d505b, past 100 on d08200e with the same files). Three shards still ran out of time:
kernel-h (90 % of 2,386 mutants), discovery-d (98 %; 225 of its 587 mutants timed out, mutants that
stop the closure's fixpoint loops from ending) and discovery-b. claims-a took 87 minutes, discovery-a
70, discovery-e 71. Every shard therefore gets a wide margin (the slowest about 60 minutes on that
run's rates):

- kernel-h's heavy tool files join light kernel shards (eleven kernel shards stay): common-tangents.ts
  and similitude.ts kernel-c (19 minutes), conic-conic.ts kernel-i (20), dual-tangents.ts kernel-k
  (23), foci.ts kernel-b (22). conics.ts and the small tool files stay in kernel-h.
- discovery-a keeps closure.ts, discovery-j takes closure-view, terms and uf; discovery-b keeps
  candidates.ts, discovery-k takes scan, ticking and job; discovery-d keeps closure-merge.ts,
  discovery-l takes closure-conics.ts; discovery-e keeps derive.ts, discovery-m takes group.ts.
- claims-a keeps the angle, incidence, curve and projective kinds with kind.ts, kind-hints.ts and
  kind-registry.ts; claims-c takes the triangle, conic, metric and length kinds, ndg.ts, symmetry.ts
  and collinear-infinity.ts.

Thirty mutation jobs in all. The same frozen line of `scripts/mutation-discovery.test.ts` (the id
list and its parents) changes again, under this ADR.
