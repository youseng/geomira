# ADR-0035: Discovery: the finder ("what is special?"), special positions, lemma tags (Run 17)

Status: accepted (Run 17). Moves "the finder" and "special-position hunting" out of SPEC §1's
Phase 2 list (SPEC §1, §2, §6.1, §10.1 and §16 are updated in the same commit). Adds a package
(`packages/discovery`), one optional ToolSpec field (`Signature.guarantees`, decision 6) and
optional claim-kind data (decisions 3–4). Changes frozen test lines (decision 17). Branch-fix
diagnosis is [ADR-0036](0036-branch-fix-diagnosis.md). Decisions 6, 7, 11 and 12 are amended by
[ADR-0039](0039-no-trivial-facts-in-what-is-special.md) (map facts, the knowledge, groups, ranking).

## Context

Run 17's brief: a finder that answers "what is special about this figure?" as a worker job over
the claim kinds (no separate predicates), reporting only facts that HOLD in the local test, with
the rung used; construction trivialities filtered and counted; a ranking; every cap visible;
special-position hunting that respects `assume` lines and treats degenerate positions as
undefined, each position a complete document; lemma tags with hints. Run 15 (the prover) is
skipped by the maintainer's decision and Run 17 runs before Run 16, so nothing here may refer to
a prover, and there are no conics, ideal points or cross-ratios yet. "The exact rung" means v1's
EXACT OVER Q / EXACT MOD p rungs (SPEC §10.5). A claim kind added later must join the finder
without finder changes. SPEC does not say where the code lives, how candidates are generated,
what "trivial" means, or how positions are searched.

## Decision

### Where it lives

1. **A new pure package `packages/discovery`** → num, kernel, claims. Only apps/web (the worker
   that runs its jobs, the UI that shows their results) and packages/editor (the apply step:
   "Add as claim", applying a branch fix, ADR-0036) import it; SPEC §2 gains
   `discovery → kernel, claims, num` and `editor → … discovery`. Pure-package rules apply (no
   DOM, no module-level mutable state, no Math.random / Date / performance.now; randomness only
   from num's seeded RNG; every result carries its seed). It cannot import lang (lang → claims
   only), so a special position is a Document; the host prints it as text with lang.
   Rejected: inside packages/claims (claims would hold a search engine and lemma data, and
   everything that imports claims could reach them).

### Claim kinds as the finder's vocabulary (packages/claims)

2. **A claim-kind registry value.** `claimKindRegistry(extra = [])` (`@geomira/claims/kinds`)
   returns `{ kinds, get(name) }`, the v1 kinds plus test-only extras, as the tool registry does
   (SPEC §2: a value, never a singleton). `prepare`, `evalClaim`, `runJob` and the screen take
   it as an optional argument (default: the v1 kinds), so a test-only kind runs through the same
   tester (SPEC §18 E2's style of guard).
3. **Claim symmetries are kind data** (`ClaimKindSpec.symmetry`): generators, each a
   permutation of the argument positions that gives the same claim (collinear: adjacent
   transpositions; `AB = CD`: A ↔ B, C ↔ D, and AB ↔ CD only when k = 1, via an optional
   condition on the literals; `∡ABC = ∡DEF`: both angles reversed, and the two swapped when
   n = 1; …). The group they generate is closed by the same breadth-first search as ADR-0029's
   construction keys, and a candidate's key is its lexicographically smallest arrangement: two
   candidates with the same key are one candidate.
4. **Finder hints are kind data** (`ClaimKindSpec.finder`, optional): the arity searched (a
   `rest` kind uses its minimum: three points for collinear), the literal values tried for its
   literal parameters (length: k = 1, 2, 3, 3/2 and the inverses as `AB = k·CD` with k > 1 only
   once; dangle: n = 1; dangle_lines: θ = 30, 45, 60, 120, 135, 150; angle_sum: 90 and 180;
   angle_diff: 90), and for metric and angle kinds a MEASURE: two argument groups, a float
   value of each group (a length, an undirected or directed angle) and the relation between them
   (m₁ = target(m₂, literals)), with a period for directed angles. A kind with literal
   parameters and no literal list is not searched, and is listed so ("not searched: ratio (eight
   points)"). A kind without hints is searched by plain enumeration (decision 8).
5. **The screen** (`@geomira/claims/screen`): the current figure and its FLOOR_SAMPLES
   perturbations are evaluated ONCE (the numeric rung's perturbations of SPEC §3.1, with a
   seed), then each candidate is decided by the numeric rung on those four value maps (NDG first,
   the noise floor, the kernel's banded gap for incidence and tangency, ADR-0027's size factor):
   the same decision as `decideSample`'s numeric rung, without evaluating the figure per
   candidate. The code is shared with rungs.ts (perturb.ts), not copied.

### Construction facts (the triviality filter)

6. **`Signature.guarantees`** (kernel, optional, read by the docs and by discovery): the facts a
   call's result has BY DEFINITION, as claim templates over the call: `{ claim, args }` whose
   arguments are `'result'`, an argument position, a nested call of a registry tool over such
   terms, or an exact literal. Declared (docs/tools.md lists them under "By construction"):
   on(c, …) on c; midpoint collinear with its ends and AM = MB; divide collinear; an
   intersection or `other` on both curves; foot on its line and the foot line perpendicular to
   it; tangent_point on its circle; circumcenter equidistant from the vertices; centroid on each
   median; orthocenter on each altitude; ninepoint_center on OH; incenter and excenter on their
   bisectors; line, segment and ray through their points; parallel and perp through their point
   and parallel / perpendicular to their line; perp_bisector perpendicular to AB through its
   midpoint; bisector and ext_bisector through the vertex, perpendicular to each other; tangent
   and tangent_from through their point and tangent to their circle; polar and radical_axis
   perpendicular to the line of centres; every circle through its defining points, with its
   centre (`center(result)` equal to O or to the circumcenter); diameter_circle through A and B;
   incircle and excircle tangent to the three side lines; ninepoint_circle through the
   midpoints of the sides; symmedian through A; symmedian_point on the three symmedians;
   radical_center on the three radical axes; arc through its three points. Maps, measures,
   marks and inversions declare nothing. A property test (discovery) checks every declared
   guarantee on registry-built figures: each instance holds in the current figure and in the
   local test (a wrong guarantee would hide a real fact).
7. **The closure** (`discovery/closure.ts`) is built from the document alone, before any
   evaluation: every definition and every subterm is keyed by its construction key
   (ADR-0029; a free input by its object and path), an object's id is identified with its
   definition's key, and every instance of a guarantee is recorded, its nested terms registered
   with their own guarantees. Then, to a fixpoint: point classes (equal); line classes (lines and
   collinear triples, merged when they share two distinct point classes); circle classes
   (merged when they share three), each with its centre; parallel classes (lines perpendicular
   to one line are parallel); perpendicular pairs; tangent pairs; equal-length classes of
   segments (k = 1, and each circle's radii through its centre). A fact is a CONSTRUCTION FACT
   when: its kind's canonical key, with arguments replaced by their classes, equals an instance
   of a guarantee of that kind (generic: every kind); or, for the v1 kinds, the closure implies
   it (all points on one line or circle class; three lines through one point class; one
   parallel class; a perpendicular pair; a tangent pair; one length class; for directed angles
   arms in the same parallel classes in order; for undirected angles the same vertex and the
   same arm points, in either order: arms on the same lines are not enough, since with one arm
   reversed the angles are supplementary and equal only at 90°, a finding). Construction facts are counted and listed ("12 construction facts
   hidden", expandable), never reported as findings. The filter is sound by construction (it
   only follows declared definitions), so it can let a trivial fact through but never hides a
   non-trivial one.

### Candidates and screening

8. **Candidates are tuples of the figure's objects** (user objects and managed images whose
   current float value is defined; probes never exist here), per searched kind: each geometric
   parameter takes the objects whose value fits it (point, line, circle, curve), distinct objects
   per tuple, canonical under the kind's symmetry (for transposition generators the tuple is
   increasing on those positions, so the search never generates a non-canonical tuple). MEASURE
   kinds instead compute each group's measure once, sort, and pair only groups whose measures
   satisfy the relation within TRUE_FACTOR·FLOOR_MAX (relative; num's constants, no new
   tolerance), wrapping periodic measures; zero measures (coincident points, flat angles) are
   left out, since those facts are other kinds' (equal, collinear).
9. **Order**: kinds in registry order, tuples in construction order of their objects (earlier
   first). Each candidate passes the screen (decision 5); only TRUE ones go on.
10. **Caps, all visible** (FindBudget, every value in the result): candidates screened per kind
    (default 20,000), tuples counted per kind to state the total (2,000,000; above it the total
    reads "more than 2,000,000"), local tests (default 60), facts reported (default 50), and a
    host time budget (the host sends `stop`; the job ends with what it has and says "stopped at
    the time budget"). The result lists, per kind, "checked a of b candidates" and why it
    stopped (budget, time) and the kinds not searched with the reason.

### Confirmation, verdicts, ranking

11. **Only the LOCAL test confirms.** Each surviving non-construction fact is appended to the
    document as a claim and tested by claims' `runJob` (regime local, n = 200 as the Test
    button, seed derived from the job's). Reported iff HOLDS IN THIS CONFIGURATION, with the
    rungs used ("holds in this configuration, exact over Q, 200/200"). Facts the local test
    does not confirm (MIXED, FALSE, INCONCLUSIVE) are counted ("3 facts true in this figure only
    were not reported"), never shown as findings. Degenerate candidates never pass the screen
    (NDG first). Undirected angles stay numeric-only (SPEC §10.1): their verdicts show
    "numeric".
12. **Ranking** (stable): (a) facts not implied by higher-ranked reported facts of the same kind
    (the closure re-run with those facts added) before implied ones, which are kept and marked
    "follows from …"; (b) exact rungs (all samples exact over Q or mod p) before numeric; (c)
    tagged facts (decision 14) before untagged; (d) fewer distinct objects; (e) the latest object
    involved later in the construction first (facts about the newest objects lead); (f) the kind's
    registry order, then the candidate key. Tests run in screening order and stop at the test
    budget, so the cap removes the facts the search reached last.

### Special positions (`hunt` job)

13. **Search**: the screened candidates that are FALSE now and not construction facts, the
    simplest first (fewest objects: right angles, isosceles triangles, collinearities), the
    nearest (smallest residual) among equals (at most 24 targets, a cap shown; the nearest by
    residual alone are near misses of the measure pairing among six unrelated points), each solved for one free input of
    its closure at a time (free points: two degrees of freedom, gliders and params: one), by
    Gauss–Newton on the kind's float conditions (`algebra` over FloatField) with finite
    differences of step √EPS·size, at most 16 iterations and a move of at most half the figure's
    size. The position is rounded to the coarsest decimal grid (10^(e−2) down to 10^(e−12),
    e = ⌊log₁₀ size⌋) at which the target still holds in the current figure (evalClaim; exact
    over Q when the rounded position makes it exact). A position is SKIPPED, and counted, when a
    hypothesis (`assume`) fails or is within its band there ("contradicts the hypotheses"), when
    an object defined now becomes undefined or the target is degenerate there ("degenerate:
    treated as undefined"), or when it repeats one found. Each kept position is a complete
    Document (the user's document with that input's literals replaced; nothing else changes),
    with the input moved, the target fact, and every other target true there but not now ("new
    facts"). The current document is never changed by the job; the UI opens a position as a new
    figure, or views it as a draft scene (ADR-0024's preview mechanism), only when the user
    chooses.

### Lemma tags

14. **Tags are data** (`discovery/lemmas.ts`): a name, a one-line hint, and a structural match
    over the closure (construction keys of the tools involved; a test checks that every tool a
    tag names is a registry tool, as ADR-0025's aliases). Only well-known named results: Euler
    line (O, G, H, N collinear), nine-point circle (midpoints of the sides, feet of the altitudes,
    midpoints of AH, BH, CH concyclic), Simson line (feet from one point to the three side lines
    collinear), radical axis / radical center (radical axes or common chords of three circles
    concurrent), Miquel point (circles AEF, BFD, CDE through one point for D, E, F on the side
    lines). No contest problem and no attribution. A tag never changes whether a fact is
    reported; it only adds the hint and ranks (decision 12c).

### Jobs

15. **`find` and `hunt` jobs** (`@geomira/discovery/job`): pure generators with SPEC §16's
    protocol, yielding progress after every bounded step (a batch of at most 256 screened
    candidates, one sample of a local test, one Gauss–Newton solve), answering `cancel`
    (cancelled, nothing reported) and `stop` (the time budget: finish with what is confirmed).
    apps/web's worker runs them, and the page's time-sliced fallback (ADR-0030) runs them with
    the same slice loop; on a 150-object figure in that fallback an end-to-end measurement gates
    regressions (no task over 150 ms, under 1 % over 16 ms: ADR-0037, which waives ADR-0030's
    16 ms for this job in Run 17). `env` is the tool registry, the claim
    kinds, and the host's entropy for the mod-p rung.

### UI

16. "What is special?" in the Claims panel runs `find`: progress, then the facts (verdict text,
    lemma tag with its hint, "Add as claim": one claim edit, undoable, shown in the text; hover
    highlights the fact's objects on the canvas), the hidden construction facts (count,
    expandable), and the caps line. "Special positions" runs `hunt`: each position with its moved
    input and new facts, "View" (the canvas draws the position's document as a draft until the
    view is closed) and "Open as new figure" (the position's text, through the usual open path,
    so the current figure stays in "Restore previous figure").

## Frozen tests changed

17. Under this ADR (commit messages cite it): `scripts/depcruise.test.ts` (the package list and
    the restated SPEC §2 table gain discovery; editor's line lists discovery: 3 lines),
    `scripts/mutation-gate.test.ts` (two lines that count the gated packages: `3 + SHARDS.length`
    and the three-entry `[false, false, false]` become four; one line added for the new shard's
    file), `scripts/mutation-shards.test.ts` (one line added: the discovery shard runs its whole
    config; ADR-0038 makes it list the four discovery shards and changes one frozen line). Lines are only added to the exports tests of kernel and claims.

## Consequences

- A claim kind added later (Run 16's conics, cross-ratios) is searched by plain enumeration as
  soon as it is in the registry; giving it symmetry, literal and measure hints makes the search
  smaller, without finder changes (tested with a test-only kind).
- A tool added later without guarantees makes its definitional facts show as findings (noise,
  never a hidden fact); declaring them is part of the tool checklist from now on.
- The nightly mutation gate covers discovery at ≥ 75 % (its own shards, four since ADR-0038, and threshold).

## Alternatives considered

- **Hand-written predicates per fact type** ("is this triangle isosceles?"): a second claim
  vocabulary beside SPEC §10.1's, against the brief.
- **Triviality by names** (an object called M_a is a midpoint): names are user data.
- **Reporting facts on the screen alone** (float evidence in the current figure): the brief
  requires the local test, and a screen cannot tell a coincidence of this figure from a fact.
- **Searching every tuple of every kind**: 6-point angle kinds have ~10¹⁰ tuples in a figure of
  60 points; the measure hashing keeps them searchable, and the caps say what was not.
- **Snapping special positions to the exact solution**: needs square roots in general (Inexact
  over Q); the coarsest grid that keeps the fact true is honest about the rung it reaches.
