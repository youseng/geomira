# ADR-0037: "What is special?" on 150 objects on the page: a regression gate, not 16 ms (Run 17)

Status: accepted (Run 17, by the maintainer's decision of 2026-10-27). Amends ADR-0035
decision 15's last sentence ("a 150-object figure keeps every main-thread task within
ADR-0030's budget in that fallback"). ADR-0030 itself is unchanged: claim tests on the page keep
its ≤ 16 ms slices, measured by `fallback-long-task.spec.ts`.

## Context

Run 17's brief: "A 150-object figure stays responsive (main-thread budget of ADR-0030)". ADR-0030
gives the page's slice loop a budget of MAIN_SLICE_MS = 8 ms and states its limit: the loop keeps
slices under the budget "for any figure whose single step fits it". `fallback-discovery.spec.ts`
measures the find job on a 150-object figure (a triangle and 147 midpoints, feet, lines and
circles of earlier points), opened from file:// with Web Workers removed, by a Chromium trace of
every main-thread task from the click to the result.

Measured on the development container (Chromium, single file, no workers), in order:

| change                                                    | longest tasks (ms)             | long tasks (≥ 50 ms) |
| --------------------------------------------------------- | ------------------------------ | -------------------- |
| first version                                             | 132, 78, 64, 55                | 4                    |
| sliced closure, screen and survivor selection             | 97 (a 64 ms major GC), 39, 37  | 1                    |
| measured groups in flat arrays, sliced index sort         | 28, 26, 23                     | 0                    |
| one lemma view per closure, the canvas's own snapshot     | 31, 28, 26 / 27, 26, 24        | 0                    |
| the construction facts rendered only when opened (6 runs) | longest 27, 30, 39, 57, 66, 72 | in 3 of 6 runs       |

In every run about 13 to 27 of 5,100 to 5,800 tasks (under 0.5 %) are longer than 16 ms. The
render of the result was one of them (about 45 ms, now removed). The rest are single steps at
random points of the job: a screening batch of 16 candidates, the ranking, a sample of a local
test. They change with the job's seed and are absent for some seeds (in Node, three seeds of
five show none above 25 ms). The work per step does not explain them, so they look like garbage
collector pauses from the allocation churn of the screen and the candidate keys, not like steps
that are too long. That is an inference from the traces, not a proof.

## Decision

1. For the find job on 150 objects on the page, `fallback-discovery.spec.ts` is a **regression
   gate** with its numbers logged and annotated on every run. It asserts that the job completes
   on the page (a result, no error), that **no main-thread task is longer than 150 ms**
   (`MAX_TASK_MS`), and that **fewer than 1 % of the tasks are longer than 16 ms**
   (`OVER_SHARE`).
2. ADR-0030's ≤ 16 ms for every task is **waived for Run 17** on this figure; STATUS.md lists it
   under Known bugs (known limits) with the follow-up of decision 4.
3. The finder's own steps stay bounded as they are now (ADR-0035 decision 15): the screen yields
   after each evaluation; the closure yields by batches of terms and after each merging pass;
   the survivors to test are kept as a bounded sorted list while screening; the measured groups
   are flat arrays, sorted by a sliced index merge sort; batches are 16 screened candidates and
   128 counted matches; the canvas reads its own snapshot, so a job's progress does not
   re-render the page; the hidden construction facts are rendered only when opened.
4. **Follow-up** (not Run 17): every task within 16 ms. First, find the pauses' cause in a
   heap-allocation profile and cut the allocation of the screen (packages/claims `screenSteps`'
   decide), of the candidate keys and of the tuple copies. Then split the claim tester's steps
   (a local test's preparation and an exact sample) and improve the slice loop's step prediction
   (ADR-0030's `slicer.ts`), each under its own ADR. The measurement then asserts 16 ms.

## Consequences

- With workers (the normal case) nothing changes: the job runs off the main thread.
- Without workers, a 150-object figure stays usable during a 20 s search, but a few pauses of up
  to about 70 ms can occur; ADR-0030's slice budget is not met there.
- The gate catches regressions of the kind this run fixed (a step or a render of 100+ ms, or
  slices that overrun as a rule); it does not catch an occasional pause of 50–150 ms.

## Alternatives considered

- **Keep optimizing in Run 17**: the right end state, but open-ended and it touches
  packages/claims and ADR-0030's loop, both covered by earlier runs' frozen tests; it is decision
  4's follow-up.
- **A bound near the typical maximum (32 ms)**: failed in three of six runs; a gate that fails
  without a regression teaches the reader to re-run it.
- **A lighter 150-object figure** (shallow constructions, cheap samples): would pass while hiding
  the case that does not; rejected.
- **No measurement in Run 17**: no regression would ever fail CI.
