# ADR-0039: "What is special?" reports no trivial facts (after Run 17)

Status: accepted (maintainer request after Run 17; not a kit run). Amends ADR-0035 decisions 6, 7,
11 and 12 and SPEC §6.1. Changes four lines of a frozen test (decision 10).

## Context

The maintainer asked that "What is special?" stop flooding its list with facts that hold for
trivial reasons. Run 17's finder, on the request's figures (seed 1, default budget; in brackets
every confirmed fact with an unlimited test budget):

| Figure                                                           | Reported                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| inversion in w (O, A on w, B, C free, layer `image(f, main)`)    | 57 (246)                                                        |
| reflection in line AB (C, D free, layer)                         | 50 (709)                                                        |
| incenter–excenter (triangle, circumcircle, I, I_a, M on line AI) | 60 (272)                                                        |
| nine-point circle (midpoints, feet, midpoints of AH, BH, CH)     | 60 (1,958, 132 of them concyclic quadruples of the nine points) |

Three causes:

1. **Images under a map.** ADR-0035 decision 6 declared nothing for maps, so the closure knew
   nothing of images: equal(A, A*) (A on the mirror), collinear(O, B, B*), concyclic(B, B*, C, C*),
   AD = AD*, and the directed angles that follow were findings.
2. **Consequences of what is shown or constructed.** Decision 12(a) hid only facts implied by
   higher-ranked facts _of the same kind_, through the closure, which knew no angles: inscribed
   angles of a constructed circle, base angles of an isosceles triangle MBI once MB = MI is shown,
   midlines, right angles on a diameter.
3. **One fact per subset.** Every 4-subset of nine concyclic points was a fact (126), every pair
   of an equal-length class another.

## Decision

### What is known (the knowledge, `discovery/derive.ts`)

1. **Map facts are registry data** (amends decision 6, SPEC §6.1): `Signature.map` (`MapFacts`:
   the map type, similarity / anti-similarity / inversion / Möbius; involution; ratio; turn;
   fixed points; the curve fixed point by point; invariant curves; an inversion's centre; a
   homothety's signed ratio `factor`; known images `sends`) and `Signature.imageOf` (`{ of, map }`:
   the overload's result is argument `of` under the map `map`: `apply(T, X)`, the image sugar
   `reflect(X, l)`). One table, `kernel/map-facts.ts`, covers reflect (line and point), rotate,
   homothety, translate, spiral and the inversions (inversion by circle and by power,
   orthocenter_inversion, inversion_fixing, inversion_swap, feet_inversion, sqrt_bc, sqrt_bc2).
   docs/tools.md lists them ("As a map"). A kernel test checks each entry names an overload.
2. **The closure** (amends decision 7) adds, to its fixpoint, every rule below; each is a theorem
   about the facts it reads, so the closure stays sound:
   - maps: a fixed point or fixed curve is its own image; `sends`; equal images of equal
     preimages; |X*Y*| = r·|XY| for a similarity with an exact ratio; for an inversion and a
     homothety, the centre (fixed point) on line XX*; a homothety's XX* = |k − 1|·PX; a point a
     line reflection or a circle inversion fixes is on its mirror; an inversion takes a line to a
     curve through its centre; concyclic(X, X*, Y, Y*) for an inversion;
   - equal distances: three or more points at one distance from M are a circle centred at M; two
     are an isosceles triangle (its base angles, below); a point M at one distance from two
     points of a line through M is their midpoint (XY = 2·MX);
   - midpoints: midlines (MN ∥ YZ, YZ = 2·MN); Thales (the points P with PX ⟂ PY on two known
     perpendicular lines are on one circle with diameter XY, centred at the midpoint of XY when
     known); two segments with one ratio to one segment are equal.
     Caps keep a large figure's steps short: at most 150 circles of equal distances, 2,000
     isosceles triangles, 200 midpoints, 500 midlines, 400 circles on a diameter, 5,000 ratios.
     Beyond a cap fewer facts follow: a trivial fact may then be reported, a real one is never
     hidden.
3. **Angle chasing as linear algebra** (`angles.ts`, `angle-rules.ts`, `angle-maps.ts`,
   `angle-lattice.ts`, `lattice.ts`): directed angles mod 180° are linear in line directions.
   Variables: a direction per parallel class (or per segment the closure knows no line for), a
   half-angle per point of each circle (chord PQ: t_P + t_Q + 90°; radius OP: 2·t_P; tangent at
   P: 2·t_P + 90°), a turn per map and an angle per map with a fixed point. Rows: perpendicular
   classes; circles and their centres and tangents; midlines; bisectors (2·d(l) ≡ d(VP) + d(VQ)
   for internal and external alike, including the straight and the zero angle); isosceles
   triangles (d(MX) + d(MY) ≡ 2·d(XY)); maps (a similarity turns every direction by φ, an
   anti-similarity's axis bisects φ and is perpendicular to XX*, the triangles P X X* about a
   fixed point P of a direct similarity are similar, an inversion makes ∡OXY = ∡X*Y*O); and the
   shown facts. A fact's angle content follows iff each of its congruences is in the **integer
   lattice** of the rows (Hermite-style echelon over ℤ with a constant column mod 180; membership
   over ℤ, never ℚ: halving a congruence mod 180° is not valid, so internal and external
   bisectors are never confused). Exact, no tolerance. Undirected angle kinds (angle_eq,
   angle_sum, angle_diff) become directed ones through the orientations of the points in this
   figure (what the screen confirmed), so they are known "in this configuration", as ADR-0035
   keeps them; supplementary arms stay a finding.
4. **Transport**: a fact about images is the same fact about the preimages (a similarity keeps
   every kind; an inversion or Möbius map keeps equal, on, tangent and concyclic, a concyclic
   preimage set possibly collinear; an anti-similarity reverses dangle_lines, so that kind is not
   transported). When the preimages' fact follows, the image fact does. Candidates are checked
   against the rules; no instances are enumerated.

### One fact per configuration (`group.ts`)

5. **Groups** of the screen-true facts, construction facts included so that each group is
   maximal: collinear, concyclic and concurrent facts sharing a determining subset that is proper
   in the figure (two points apart, three points apart and not on a line, two lines not parallel)
   are one n-ary fact (`concyclic(M_a, M_b, M_c, D, E, F, K_a, K_b, K_c)`); objects that coincide
   in the figure are not named twice (a member naming the second stays a fact of its own: a
   claim naming one line twice is degenerate). Equal lengths (k = 1), directed angles (n = 1) and
   equal undirected angles are classes: one fact "AB = CD = EF", stated as its links (first member
   = each other member). A group whose every member holds by construction is one construction
   fact (`collinear(A, I, I_a, M)`, the maintainer's choice for the incenter figure).
6. **Confirmation** (amends decision 11): an n-ary group is one claim (the claim kinds take n
   points or lines) and one local test. A class is tested by its **checks**: the non-construction
   members that join it once its construction members are joined (a spanning forest); with the
   construction members they give every link by transitivity. When a check fails (a numeric
   coincidence the screen let through), the failing member is unconfirmed on its own and the class
   is rebuilt from the checks that held; when an n-ary group fails, its parts are tested on their
   own after the other units. The test budget counts runs (each check is one); a unit that does not
   fit in the runs left is skipped and counted untested. Test order: tagged first, then fewer
   objects (a group counted as one fact of its kind: an n-ary group the kind's arity, a class its
   link), a group standing for more facts first, the kind's registry order, the newest objects
   first, the key.

### Ranking and what is hidden

7. **Ranking** (amends decision 12): the preliminary order is (b) exact before numeric, (c) tagged
   before untagged, (d) fewer objects (a group counted as one fact of its kind), (d′) a group
   standing for more facts first, (e) newest objects first, (f) the kind's order, then the key.
   Then (a), for every kind: a fact is shown unless it follows from the construction and the
   facts shown before it (the knowledge rebuilt with those facts given), in which case it is
   hidden. A coincidence (P_8 = P_121) thus comes before the class it explains. The "follows from
   a fact above" mark goes (`FoundFact.follows` is removed): such facts are hidden and listed.
8. **Nothing hidden is lost** (`consequences.ts`): a fact that follows from the construction
   alone is a construction fact ("N construction facts hidden"); one that follows once the i-th
   shown fact is known is listed under that fact ("12 consequences of A, B, C, M concyclic",
   expandable), with the rule it follows by (incidences and lengths, angle chasing, through a
   map, part of this fact) and its parents (the facts shown up to it); the members a group stands
   for are listed under it. Untested units that follow from the shown facts are listed the same
   way (a sound derivation needs no test); the rest are counted untested. A fact is hidden only
   with such a derivation.
9. **Add as claim**: a class adds the claims of its links as one batch (one history entry, one
   undo), its text "MB = MC = MI = MI_a"; an n-ary group is one claim. The text format already
   expresses both.

### Frozen tests

10. `packages/discovery/test/find.test.ts`, four lines. On the triangle-centres figure Run 17
    reported 31 facts with 40 tests (midlines, Thales circles through O, the angles that follow);
    exactly 8 are left with any budget (the Euler line, the centroid's 2:1 ratios, OH = 2·OG and
    the three AH = 2·OM_a), so `toBeGreaterThan(10)` became `toBeGreaterThanOrEqual(8)`. The
    small-budget check (3 tests, 20 candidates per kind) confirmed three facts before and two now
    (one test goes to a screened coincidence the local test rejects), so `results: 2` and its two
    expectations (two facts shown, "showing 2 of …") became `results: 1` and "showing 1 of …":
    the cap line and the cut are checked as before.

### Mutation shards

11. **Six discovery shards** (amends ADR-0038 decision 1). The nightly on c47299a (run 40537385274) ran discovery-a in 44 minutes, discovery-b in 52 and discovery-c in 28, but the
    last shard, which held every file this ADR adds (3,642 mutants with find, rank and the
    branch-fix files), had tested 2,592 when Stryker's 100 minutes ran out (278 timeouts). The
    new files go to two new shards and the light ones: discovery-d (closure-merge, closure-maps,
    closure-mid: the closure's rules), discovery-e (derive, group, confirm, find-units),
    discovery-b (+ lattice, consequences), discovery-c (+ the angle modules); the last shard
    keeps find, rank, the branch-fix files and types. The gate still sums the package at 75 %.
    Frozen test changed, three lines of `scripts/mutation-discovery.test.ts` "four shards …":
    the id list and the parents list gain discovery-d and discovery-e, and the catch-all is
    checked as the last shard (`shards[shards.length - 1]`) instead of `shards[3]`. The check
    is as strict as before; the test's title still says four.

## Consequences

- On the request's figures (default budget): inversion and reflection report nothing; the
  incenter–excenter figure reports only MB = MC = MI = MI_a, with collinear(A, I, I_a, M) a
  construction fact and the inscribed and base angles hidden; the nine-point figure reports the
  nine-point circle and the class of its three diameters M_aK_a = M_bK_b = M_cK_c. Rotation,
  homothety, spiral and the inversion of a line and a circle report nothing; the incenter figure
  under the inversion in circle(M, B) reports I = I* and I_a = I_a*.
- Hidden facts are sound by construction and checked by property tests (derivations.test.ts):
  every hidden fact holds (evaluated, and the local test on a sample); every consequence's
  parents are the shown facts up to it; no candidate the screen calls false, no false mutant of
  a hidden fact and no claim of the false corpus is ever derived.
- On the 150-object figure of ADR-0037 the job is faster than Run 17's (fewer facts to rank) and
  its longest step stays well under the gate's 150 ms; the e2e gate is unchanged.
- The rules are incomplete: a trivial fact the rules do not reach is still reported. Each new
  rule must be a theorem about the facts it reads, with a property test.

## Alternatives

- **Enumerate every instance of the map rules** (all pairs and triples of images) and add them
  as facts: quadratic and cubic in the figure's points, over the budgets on 150 objects. Rules
  are checked against candidates instead.
- **Angle chasing over ℚ** (Gaussian elimination with rational coefficients): would derive the
  half of a congruence mod 180°, false for bisectors (internal and external); the integer lattice
  is exact for congruences.
- **Group after confirming** (test every member, then merge): one run per member; grouping
  before testing with a fallback (decision 6) spends one run per group or per check.
- **Report a group as all its claims at once without links**: the claim language has no n-ary
  equality; links from the first member are the claims the class is tested and added as.
