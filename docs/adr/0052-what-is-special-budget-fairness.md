# ADR-0052: "What is special?" tests the first candidates of every kind before any long scan

Status: accepted (maintainer request "usability", item 8; not a kit run). Amends ADR-0035
decisions 9 (the order), 10 (the caps) and 11 (when the local tests run), and ADR-0039 decision 6
(the test budget is shared between two rounds). SPEC does not state the order of the screen
(ADR-0035 does), so SPEC is unchanged. Changes no frozen test.

## Context

Run 16c's STATUS (Known bugs) reports a starvation: "What is special?" on the 150-object figure of
`apps/web/e2e/fallback-discovery.spec.ts`, plus D = (6, 6), E = (−2, 4), F = (2, −3),
kk = conic(A, B, C, D, E), mm = conic(A, B, C, D, F) and X = intersect(kk, mm, other(A, B, C)),
ends at its 20 s time budget in the conconic scan with 0 facts; the same figure without the
conics gives 8.

The find job ran in three phases: screen every searched kind to its full budget (20,000
candidates per kind, counting up to 2,000,000 tuples to state the total) in registry order, then
group the true facts, then run the local tests. A `stop` during the screen ended the job with
nothing tested (ADR-0035 decision 15: a stop ends the job without another step). Measured in Node
on the reported figure (seed 7, no time limit), the screen alone took about 17.6 s, most of it in
the preparation of the long kinds' candidates, not in the screen of candidates:

| kind (registry order) | preparing candidates (count, measure, sort) | screening 20,000 |
| --------------------- | ------------------------------------------- | ---------------- |
| dangle                | 2.8 s                                       | 0.5 s            |
| angle_eq              | 2.6 s                                       | 0.4 s            |
| angle_sum             | 2.4 s                                       | 0.4 s            |
| angle_diff            | 1.6 s                                       | 0.4 s            |
| conconic (last)       | 1.1 s (2,000,000 six-point tuples counted)  | 0.9 s            |
| harmonic              | 0.8 s                                       | 0.5 s            |
| concyclic             | 0.7 s                                       | 0.4 s            |

The local tests (60 runs of 200 samples) took another 11–12 s. Conconic is not slow in itself:
it is searched in every figure with six points (it was in the figure without conics too) and is
the last kind, so the time budget ran out there. Four more points made the screen of all kinds
just longer than the page's 20 s, and nothing was tested. It is a scheduling shape, not a wrong
result: no fact was reported falsely, but every fact the cheap kinds had already found was lost.

## Decision

1. **The first look** (`packages/discovery/src/scan-rounds.ts`). Before any long scan, every
   searched kind, in registry order, screens its first `firstLook` candidates:
   - `FindBudget.firstLook` (optional, default 1,000 in `DEFAULT_FIND_BUDGET`, so it is in every
     result's budget);
   - the look screens at most L = min(firstLook, candidatesPerKind) candidates of a kind;
   - its candidate source counts at most FIRST_COUNT = 20,000 tuples (or measured groups and
     matches) instead of countLimit: the count that states the total is itself one of the long
     scans;
   - the candidates are the same as the single scan's, in the same order (ADR-0035 decisions
     8–9). One exception: a measure kind whose first-look count was cut takes its first L
     candidates from the groups of the first FIRST_COUNT tuples of points, in construction order.
2. **Settled kinds.** After its first look a kind is SETTLED when its count was not cut short of
   the full count limit (its total is the single scan's) and either it screened fewer than L
   candidates (all of them) or L is its whole budget. A settled kind's report is the one a single
   scan to the full budget gives.
3. **One round when the first look settles every kind**: the job then groups, tests with the
   whole test budget, ranks and lists exactly as before (small figures: the usual case).
4. **Two rounds otherwise.** The scheduling rule, stated exactly:
   1. The first look of every searched kind (decision 1), in registry order.
   2. Round 1: the true facts so far are grouped (ADR-0039 decision 5) and tested in the test
      order of ADR-0039 decision 6 with ⌈tests / 2⌉ runs (30 of the default 60).
   3. The long scan: every kind not settled, in registry order, from a fresh source with the full
      limits (candidatesPerKind, countLimit), skipping the candidates its first look screened.
      They count as checked, so a kind still screens at most candidatesPerKind candidates in all.
      A skipped candidate counts towards a step's batch like a screened one (at most BATCH = 4
      candidates looked at between two yields).
   4. Round 2: every true fact is grouped again, without the facts round 1 did not confirm, so
      a coincidence the local test rejected does not join a class again. The units not tested in
      round 1 (by key) are tested in the same test order. They use the runs left: tests − the
      runs of round 1. The runs are numbered on from round 1, so seeds never repeat.
   5. The facts of both rounds are ranked together (ADR-0039 decision 7, unchanged) and the
      hidden facts listed (decision 8, unchanged). The untested units are the second grouping's.
      The construction groups listed are those of the last complete grouping; the second covers
      every true fact the first did, so nothing is counted twice.
5. **A stop at any point ends the job with what is confirmed, and every cap stays visible.**
   - Stopped during the first look: as before. The kinds reached are reported, the one being
     screened "stopped at the time budget"; nothing is tested.
   - Stopped during round 1 or during the long scan: the result holds round 1's confirmed facts.
   - Every kind the long scan had not finished is reported with what it checked (its first look's
     count when not reached) and `stop: 'time'`: "checked 1,000 of more than 20,000 conconic
     candidates: time budget". Kinds finished keep their full reports ("…: budget").
   - Stopped while grouping the second time: round 1's facts, every kind's full report.
   - Stopped during round 2's tests: both rounds' facts.
   - The untested units are counted as before ("tested 19 of 1,112 facts: time budget").
6. **Determinism and ranking are unchanged**: no clock, no new randomness; the seed of each
   local test is derived from the job's seed and the run's number, as before. The ranking rules
   of ADR-0039 decision 7 apply to all confirmed facts at once.
7. **Hunt** (special positions) keeps the single scan: its targets are FALSE screened facts with
   their residuals and it runs no local tests, so the starvation does not arise there.
8. Mutation shards: `scan-rounds.ts` joins discovery-b (with scan.ts and candidates.ts). The
   grouping and test order (`unitSteps`, `testOrder`) moved from find.ts to find-units.ts
   (discovery-e), and the listing of hidden facts (`listHidden`) to consequences.ts
   (discovery-b). Find.ts stays under 400 lines and the catch-all shard, which was at 85 of its
   100 minutes, is lighter.

9. **A stop ends the knowledge rebuild in progress** (`rank.ts`). Found while measuring
   ADR-0037's gate with this change: once the first round makes the job reach its ranking within
   the 20 s, the host's stop can arrive while the ranking rebuilds the knowledge with a shown
   fact. After a stop find.ts drives the ranking to its end in one step, and `rankFacts` checked
   the stop only between facts. So the rebuild in progress (a whole knowledge build of the
   figure) ran in that one step: 185 ms in Node on the 150-object figure, a 135 ms task on the
   page. The rebuild now checks the stop between its chunks and is dropped. No snapshot is read
   after a stop (no fact is checked against one), so nothing is lost
   (`discovery/test/rank-stop.test.ts`, failing before the fix). This predates this ADR: any
   stop during the ranking had it. It is fixed here because this change makes it reachable on
   the gate's figure.

## Consequences

- The reported figure, in Node with a 20 s budget: 11 facts. Before, the stop came during the
  long scans with 0 tested. The first look of every kind took about 3 s and round 1 started at
  about 3.1 s. `apps/web/test/find-fairness-150.test.ts` pins it without the wall clock: the
  host's stop after 10,000 job steps. Before this ADR the job was still counting and screening
  there and ended with nothing; now it ends with confirmed facts and the caps above.
- On a figure where the whole job finishes within the time budget, two rounds can report other
  facts than one round would with the same budget:
  - round 1 spends half the tests on the first look's facts, which are those of the earliest
    objects, since candidates are tuples in construction order;
  - a group found whole only by the long scan is tested again as the larger group (a larger
    collinear or concyclic set, a longer class), which costs a test run. The ranking puts the
    group that stands for more facts first among equals (ADR-0039 decision 7 d′) and hides the
    smaller one under it, which follows from it. When an earlier criterion ranks the smaller
    one first (exact before numeric, tagged before untagged), both are shown: the larger is not
    implied by the smaller.

  Figures whose kinds all fit in the first look (the corpus figures, the triangle centres) run
  one round exactly as before; their frozen tests are unchanged.

- The first look adds about 15 × 1,000 screens and a bounded count per kind before the tests.
  The long scan re-enumerates (but does not screen) the first look's candidates. Neither changes
  the size of a job step, so ADR-0037's gate is unaffected. Before and after this change,
  `fallback-discovery.spec.ts` (150 objects, no workers) passes it: the numbers are in STATUS.
- `FindBudget.firstLook` is optional in the type, so a FindBudget written without it still
  type-checks. It means "the default", and the default carries the value.

## Alternatives considered

- **Round-robin over the kinds in slices to the full budget** (each kind screens a slice in
  turn until every kind reaches its budget, then test): every kind's first candidates are
  screened early, but nothing is tested until the whole screen ends. The reported figure still
  ends with 0 facts. The tests are what the time budget must reach.
- **A per-kind share of the time**: the job has no clock (pure package: no Date.now or
  performance.now), and the host's only time signal is `stop`. A step budget per kind is the
  first look in other words.
- **Test while screening** (confirm each true fact as soon as the screen finds it): breaks the
  grouping of ADR-0039 (one fact per configuration needs the whole kind's true facts), so a
  four-point concyclic set would be tested as four separate facts.
- **On `stop`, test what was screened**: `stop` means the time is over (ADR-0035 decision 15).
  Testing after it would run past the host's budget by up to a minute on this figure.
- **Move conconic earlier or give it a smaller budget**: fixes this figure only. The angle kinds'
  preparation (2–3 s each) would starve the next large figure the same way.
- **The whole test budget in round 1**: on a figure that finishes in time, the long scan's facts
  (those of the newest objects, which the ranking puts first) would never be tested.
