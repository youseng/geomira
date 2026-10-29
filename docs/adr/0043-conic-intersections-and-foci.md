# ADR-0043: Conic ∩ conic, other(P, Q, R), four-candidate choice, foci (Run 16c)

Status: accepted (Run 16c). Builds the two items ADR-0042 left to Run 16c: conic ∩ conic (and
conic ∩ circle) as one `compute<T>` with up to four candidates, and `foci(k)`. Extends SPEC §7
(0–4 candidates; the selector `other(P, Q, R)`; the GUI choice for four candidates) and ADR-0006
(the selection rules), ADR-0012 decisions 12–14 (the GUI tiers), ADR-0027 item 3 (curves that
nearly coincide). SPEC §1, §6.2 and §7 are updated in the same commit. No frozen test changes.

## Context

Run 16c's brief: conic ∩ conic and conic ∩ circle with up to four candidates (`candidates` for
the GUI), selectors per SPEC §7 extended to four candidates (`other(P, Q, R)` when three common
points are known, so that the fourth is rational and exact over Q; side and arc filters with
points of the construction; `near(P)`; orientation-dependent selectors only when nothing
reflection-equivariant decides, law L16); a GUI choice that works for four candidates with every
written selector verified by the kernel; continuity under drags until two candidates merge, where
the band rules make the call Undefined or a double point, never a jump; a quartic's roots Inexact
over Q and mod p unless known common points reduce it; then `foci(k)` with a selector, a
parabola's focus and a circle's centre, Inexact where a square root is needed.

SPEC §7 speaks of candidate lists of 0–2 values, of `other(P)` with one point, and of low-level
selectors labelling two candidates. Nothing says how four common points are computed in floats,
how their count is decided with the band, or how `other` names three points in the text, where
`other(a, b, P)` is also a tool of three arguments.

## Decision

### The overloads (packages/kernel/src/tools/conic-conic.ts, conic-pencil.ts)

1. **`intersect(k1, k2, selectors)`** gains three overloads: (conic, conic), (conic, round) and
   (round, conic). Circle ∩ circle keeps its overload and every decision of ADR-0006: a circle
   stays a circle and is read as the coefficients |X − O|² − r² only inside this computation.
   Their BranchShape is `CONIC_CONIC = { candidates: 4, low: 'none', other: true, describe:
'conic ∩ conic' }` (SPEC §6.1's BranchShape gains the count 4). Symmetry: the two curves in
   either order, `'value'` (the candidates are a set; no selector reads the order). Guarantees:
   on both curves (as every intersection). Export: the tool's constructive mapping applies to
   lines and circles only, so these overloads are drawn from numeric coordinates.
2. **No selector → Undefined** ("ambiguous: add a selector: conic ∩ conic has up to four
   intersections (for example other(P, Q, R), near(P), same_side(Q, l))") in every field, before
   anything is computed, whatever the count in this figure (ADR-0006 item 11's rule, so every
   field gives the same answer). The static check (selector-check.ts) makes it a parse error.

### The candidates in floats (the pencil of the two conics)

3. **Frame.** Coordinates x′ = (x − o)/L with L = ctx.scale and o the midpoint of the two curves'
   reference points (a circle's centre; a conic's known point; for an anchorless conic its vertex
   nearest to the other curve's point, else that point, else the world origin), so every decision
   below is invariant under similarities of the figure and lengths are compared with EPS and BAND
   directly. (Run 16c's audit: the first version used an anchorless conic's centre, which for a
   hyperbola close to a parabola lies hundreds of figure sizes away; the triple test then fired on
   a simple root and two real common points were dropped —
   `packages/kernel/test/conic-conic-far-centre.test.ts`.)
4. **Coincidence.** With M₁, M₂ the curves' matrices in the frame, each scaled to unit Frobenius
   norm, ε = |M₂ − ⟨M₂, M₁⟩M₁| is the sine of the angle between the coefficient vectors
   (dimensionless): within EPS → Undefined("the conics coincide"); inside the band →
   Undefined("ambiguous: the conics nearly coincide"), the analogue of ADR-0027 item 3. Beyond
   the band the pencil is spanned by M₁ and the unit difference B₂ = (M₂ − ⟨M₂, M₁⟩M₁)/ε, so a
   small difference costs at most a factor 1/BAND in accuracy, never a root of a cancelled cubic.
5. **The degenerate member.** φ(θ) = det(cos θ·M₁ + sin θ·B₂) is a binary cubic: its real roots
   are the pairs of lines through the four common points (one real root when two common points
   are complex, three when all four are real or all four complex). The roots are bracketed by
   the sign changes of φ at 96 equal steps of [0, π) and bisected to the last bit; the member
   used is the MOST ISOLATED real root (largest distance to the other real roots found). Near a
   tangency two roots merge (the two pairings that split the merging points) and the third, the
   pair {the line through the merging points, the line through the other two}, stays isolated:
   so the line through two merging points is always one of the two lines used, and its own
   count decides their merge (decision 7). A double root never changes sign, so it is never
   used; the isolated root always does. A switch between equally isolated roots changes only the
   rounding of the same four points.
6. **A triple root** (three common points that merge: an osculating circle or conic, two
   hyperbolas sharing an asymptote, two parabolas with parallel axes, whose triple point is at
   infinity): in the chart at the found root, φ ∝ c₀ + c₁τ + c₂τ² + c₃τ³ (τ = tan(θ − θ₀),
   c₀ ≈ 0). When the other two roots lie within ∛EPS of it (|c₁| ≤ ∛EPS²·|c| and
   |c₂| ≤ 2∛EPS·|c|), the member is taken at the cluster's centroid τ = −c₂/(3c₃), and the
   cluster is ONE triple point: the vertex of the member (the meet of its two lines: the common
   tangent and the line to the fourth point; none when the vertex is at infinity), plus the
   candidate farthest from it when it is farther than ∛EPS·scale (the fourth point). Why ∛EPS:
   coefficients known to EPS (the construction zero test) place a triple root only to within
   ∛EPS, and the found root itself is accurate only to u^{1/3} ≈ 6·10⁻⁶; with √EPS, the
   coefficients a conic(…) of five points carries in floats (errors near 10⁻¹⁴) split the triple
   point at infinity of two hyperbolas sharing an asymptote into two spurious points 3·10⁴·scale
   away (a test keeps that figure). ∛EPS is derived from EPS (no new constant). Moving out of the
   cluster, the result can step by at most the cluster's size, about ∛EPS·scale (10⁻³·scale; the
   continuity law bounds it in an osculation sweep).
7. **The lines.** The member is split into its two lines through its adjugate (Richter-Gebert's
   splitting of a degenerate conic): a real line pair gives two lines; a conjugate pair (only
   possible with no real common point near it) gives only its real vertex, a candidate when it
   lies on both curves within the band (a double point: four-point contact at a vertex). A line
   whose distance from the frame's origin exceeds scale/EPS is the line at infinity and carries
   no finite point (two parabolas with parallel axes, hyperbolas sharing an asymptote). Each line
   meets the curve on which it is less nearly asymptotic (the larger |dᵀM₂d|/(|d|²·|M₂|), so the
   choice is symmetric in the two curves) by ADR-0042 decision 7, unchanged: the count on the
   chord gap as a length with the band (within the band: ONE double point), an asymptotic
   direction (one point), an asymptote (none), inside the band of either → Undefined (ambiguous).
   The two curves have the same common points on such a line, so the count is the same on both
   (the choice only picks the better conditioned).
8. **Merging, infinity, polishing.** Candidates of the two lines within BAND·scale of each other
   are one point (a common point on both lines: the member's vertex). A candidate farther than
   scale/EPS from the frame's origin is at infinity and is not a candidate; one farther than
   scale/BAND, or on a line inside the band of an asymptotic direction, is near infinity →
   Undefined ("ambiguous: a common point is near infinity"), as ADR-0042 decides an asymptotic
   direction. Simple candidates are polished by at most three Newton steps on Q₁ = Q₂ = 0, each
   kept only if it lowers the larger of the two incidence lengths Q/|∇Q| (the steps converge to
   the exact common point of the two given curves; double and triple points are not polished).
   other(P, Q, R)'s point is polished the same way in floats (L3 found a figure where the formula
   alone was 3·10⁻⁹ of the scale off).
   Candidates off an arc are dropped (ADR-0031 decision 7). They are listed by x, then y; the
   order carries no meaning (no candidate has a label).
9. **No candidates → Undefined**("no intersection: the conics do not meet"). Over Q and mod p the
   candidates are roots of a quartic: Inexact ("… not representable in Q: other(P, Q, R) gives
   the fourth point exactly"), never an approximation; `candidates` returns [] there.

### Selectors on four candidates (select.ts)

10. **`other(P, Q, R)`**: P, Q, R on both curves (the banded incidence of each curve), pairwise
    apart (lengths with the band: coincident → Undefined, within the band → ambiguous) and not
    collinear (three common points of two distinct conics never are). The fourth common point,
    without square roots, exact in every field: with M the midpoint of PQ, the member
    D = Q₂(M)·Q₁ − Q₁(M)·Q₂ vanishes on line PQ, so D = PQ · m with m the line through R and the
    fourth point S; m is perpendicular to ∇D(R), and S is the other point of m ∩ k₁ by Vieta
    (ADR-0042 decision 7). m in an asymptotic direction (α within EPS) → Undefined("the fourth
    common point is at infinity"); inside the band → ambiguous. S may coincide with P, Q or R (a
    tangency there): it is then that point. S off an arc → Undefined. The other selectors then
    judge S alone. other(P) with one point on conic ∩ conic, and other(P, Q, R) on a pair with
    two candidates, → Undefined with the form that applies.
11. **Filters** (same_side, opposite_side, on_arc, between, inside, outside) judge each candidate
    as before. **Rankers** near(P) / far_from(P) keep the nearest (farthest) of any number of
    candidates; the decision is the gap to the runner-up as a length with the band (a tie →
    ambiguous); with two candidates this is ADR-0006's rule unchanged. **Low-level** along(±) /
    orient(±) do not apply to conic ∩ conic (no structural label exists for four points): the
    pair has no orientation-dependent selector, so L16 holds for it by construction. Rules
    unchanged: zero survivors → "no intersection satisfies …", two or more → "ambiguous: add a
    selector".

### The text (packages/kernel expr.ts, packages/lang)

12. The `other` selector gains an optional `rest: [Q, R]` (`Selector` keeps its shape for every
    existing document and frozen test). It prints `other(P, Q, R)`. Reading: `other(` is a
    selector when it holds one argument (as before), or, in a branchable call, when it holds
    three arguments of which the first is statically a point (the `other` TOOL takes a curve
    first), or when it follows a selector. The parse-level checks (selector-check.ts) report a
    conic ∩ conic call without a selector, other(P) on conic ∩ conic and other(P, Q, R) on a
    two-candidate pair, with the form that applies.

### Claims, discovery

13. A closure with a conic ∩ conic call is off the mod-p rung unless the call selects with
    other(P, Q, R) (the fourth point is rational), as for two candidates and other(P) (analysis.ts
    reads `candidates > 1`). Branch-fix diagnosis (ADR-0036) keeps two-candidate sites only: a
    conic ∩ conic call is not a site in this run (its choices are not binary; STATUS, Not done).

### The GUI choice for four candidates (packages/editor choice.ts, options.ts, robust.ts)

14. The clicked candidate is the nearest of any number. Tier 1: `other(P, Q, R)` with existing
    points at the three other candidates, each staying where the kernel needs it under the local
    responses (ADR-0027 item 5). Tier 2: filters with points and lines of the construction —
    same_side / opposite_side with a line and a point, and on_arc(B, C, [not] A) with points on
    either intersected curve (for a conic it is the side of line BC that holds A) — and near(P)
    with points of the construction (its deciding distances are the gaps |X_k − P| − |X_c − P| to
    every other candidate): one option that keeps only the clicked candidate, else a pair of
    filters whose kept sets meet in it; the score of a pair is its weaker filter's, each option
    scored as ADR-0012 decision 13 (all its deciding distances). The candidates in each local
    response are computed once and matched to the original ones (the assignment of least total
    distance). The best score wins (one selector before two at equal score) and must reach
    ROBUST_SIGMAS; there is no tier 3 to fall back on (no continuous low-level label), and a
    conic through five points moves a lot under the LOCAL noise (2 % of the figure per point:
    the symmetric test figure's filters reach about 2.4 to 4 deviations), so an option of at least
    FALLBACK_SIGMAS = 2 deviations is still written, with a note saying how firm it is and that a
    point near the intersection makes it firmer. Tier 4: near(P) for an incident named point.
    Every choice is verified by the kernel's compute with all its selectors. The intersection
    tool builds every common point it can single out and names the others in its notice; with
    none it refuses with the reason. near(P) with a point that is not incident is new in tier 2
    for four candidates only (SPEC §7's tier list keeps it out for two, where along/orient
    follows the candidate continuously).

### foci (packages/kernel/src/tools/foci.ts)

15. **`foci(k, selectors)`**: the foci of a conic, the centre of a circle. With the dual conic
            C* = adj(M) = [[A, B, D], [B, C, E], [D, E, G]], the isotropic lines through a point z = x + iy
            are tangent to k exactly when G·z² − 2(D + iE)·z + (A − C + 2iB) = 0, so the foci are the
            roots of this complex quadratic (the classical characterisation of foci by the circular
            points). Ellipse and hyperbola (G = ac − b² ≠ 0): the centre (D + iE)/G ± √w/G with
            w = (D + iE)² − G(A − C + 2iB): two candidates, the half focal distance |√w/G| a length with
            the band (within it: one double point, the centre: a conic that is nearly a circle, so the
            foci move continuously into the centre); the complex square root needs two real ones →
            Inexact over Q unless they are squares, mod p always. Parabola (G = 0 exactly, or the type
            decision within EPS): the one focus (A − C + 2iB)/(2(D + iE)), rational, exact over Q and
            mod p. Type inside the band of a parabola → Undefined (ambiguous). A circle: its centre
            (overload (round), no selector).
16. BranchShape `{ candidates: 2, low: 'none', other: true, describe: 'foci(k)' }` on (conic) (a
    Pair may name its plural, "foci", and replace other's curves by a check: F a focus):
    a selector is required (even for a parabola, as for a line ∩ conic that may meet once).
    other(F): F a focus (the quadratic's residual |q(z)|/|q′(z)| as a length with the band; exact
    fields: q(z) = 0), the other focus 2·centre − F, exact; a parabola's other focus is at
    infinity → Undefined. near / far_from and the filters as usual. No guarantees (no claim kind
    states a focus), symmetry none, `radical` on (conic), export 'numeric', docs from the
    registry. No GUI tool in this run (no free key; the text builds it).

### Tests

17. Degenerate cases by name for every overload; L1 in three fields; L3 with argument plans
    (other(P, Q, R) on conics through four rational points, circles through rational points of a
    conic; foci of parabolas and of conics with rational foci); the continuity law L11 for conic
    ∩ conic against closed forms through tangencies, a four-point contact and an osculation
    (steps bounded by the exact step plus the band, Undefined only within the band of the
    merge); law L16 on random scripts with conic ∩ conic; the GUI choice on random figures (every
    written selector picks its candidate in the figure and under the local regime). Theorem
    tests, classical results only: the fourth common point equals other(P, Q, R); the diagonal
    triangle of the four common points is self-polar for both conics; four points where a circle
    meets a conic: the chords PQ and RS make opposite angles with the conic's axes; the
    reflective property of the foci; the focal sums and differences; the focus–directrix
    relation (the polar of a focus is its directrix, |PF| = e·dist(P, directrix)).
18. **Mutation shards**: the new kernel files join light shards (scripts/mutation-shards.ts, as
    ADR-0040 decision 19 did), so no shard exceeds its time on a cold run.

## Consequences

- Conics meet conics and circles in the figure, with exact fourth points; the four-candidate
  choice writes only reflection-equivariant selectors.
- Over Q and mod p, a figure built on a conic ∩ conic point is exact only through other(P, Q, R).
- A near-osculation within ∛EPS of the triple root is one point: a step of at most the cluster's
  size when the figure leaves that region (STATUS: Uncertain, since ∛EPS is a judgement).
- The GUI may write a four-candidate selector that is firm to only two to five deviations of the
  local noise; it says so in its notice.

## Alternatives considered

- **The resultant quartic in x** (Ferrari or eigenvalues): the y of a root is ambiguous when two
  points share an x; the count would need a decision on complex roots near the real axis with no
  length to measure; the pencil reduces every decision to ADR-0042's line ∩ conic.
- **Parametrising one conic from its known point** (a binary quartic): needs a known point (a
  circle(O, r) has none) and a root clustering rule for every tangency.
- **A low-level label for four candidates** (a pair of signs on the lines of a member): the member
  used switches with the figure, so the label would jump; with no label the pair has no
  orientation dependence at all.
- **other(P) and other(P, Q) on conic ∩ conic**: one known point leaves three candidates (a cubic),
  two leave a quadratic with no exactness; three is the case the brief names and the only exact
  one. Filters still choose among the rest.
- **A new selector name (`others`)**: the brief writes other(P, Q, R); the reading rule of
  decision 12 is unambiguous because the tool takes a curve first.
- **Deciding the count on the half chord**: the square root of a rounding residue (ADR-0006).
