# ADR-0042: Conics (Run 16b)

Status: accepted (Run 16b). Builds SPEC §18 E8's reserved kind Conic and moves conics out of SPEC
§1's Phase 2 list (SPEC §1, §3, §4, §10.1 and §18 are updated in the same commit). Replaces
ADR-0040's "a projective map sends a circle to Undefined (a conic: Run 16b)" and decides the two
questions ADR-0040 decision 23 deferred to this run. Changes frozen tests (decision 30).
Conic ∩ conic, foci and the scoped audit of Run 16 are Run 16c's.

## Context

The maintainer split Run 16 into 16a (ADR-0040), 16b and 16c. Run 16b's brief: (1) a Conic value
(six coefficients, a documented normal form, the type derived, degenerate conics Undefined,
circles never re-typed); (2) the tools conic(A, B, C, D, E), conic_center, tangent at a point,
the tangents from a point, pole and polar, line ∩ conic with selectors, gliders; (3) maps on
conics; (4) conic_to_circle and circle_to_centre as maps for derived layers; (5) the claims
on, tangent and conconic, discovery; (6) drawing and exports; (7) theorem tests; (8) the GUI
intersection of parallel lines and pole(l, c) at infinity. SPEC said nothing about the
representation, the scale, how incidence and tangency are decided on a conic, how a glider runs
through a hyperbola's points at infinity, or which projective maps send a conic to a circle.

## Decision

### The value (packages/kernel/src/value.ts, conic.ts)

1. **The Conic value** has the fields `kind: 'conic'`, `a`, `b`, `c`, `d`, `e`, `f` and an
   optional `anchor`: the points where a·x² + 2b·xy + c·y² + 2d·x + 2e·y + f = 0, that is
   (x, y, 1)·M·(x, y, 1)ᵀ = 0 with the symmetric matrix M of rows (a, b, d), (b, c, e),
   (d, e, f). `anchor` is a known point of the conic, as a circle's (gliders, conic_to_circle).
   `CONIC_KINDS` lists the kind beside SPEC §4's frozen list; `numbersOf` lists a…f, then the
   anchor.
2. **Normal form (the scale): det M = a² + 2b² + c².** A conic scaled by λ has det λ³·det M and
   a² + 2b² + c² scaled by λ², so exactly one representative satisfies it: every construction
   ends by multiplying by (a² + 2b² + c²)/det M. Consequences: one point set has one value (the
   five points of conic(A, B, C, D, E) in any order give equal coefficients, exactly over Q), the
   float and exact runs agree entry by entry (L3), and Q is dimensionless (scaling the figure by s
   gives Q(X/s)), so Q(P)/|∇Q(P)| is a length. For a circle of radius r centred at O the normal form
   is Q = 2 − 2|X − O|²/r². Mod p the factor is not representable when a² + 2b² + c² ≡ 0 (one in p):
   Inexact.
3. **Valid conics only** (`coeffsProblem`): a value is non-degenerate and real. Degenerate: no
   quadratic part (a line) → Undefined; det M = 0 exactly (exact fields), or the degeneracy length
   ℓ = √(|det M|/(a² + 2b² + c²)^{3/2}) within EPS·scale (floats) → Undefined ("a pair of lines, a
   double line or a point"), inside the band → Undefined (ambiguous). ℓ is the semi-latus rectum
   b²/a (a circle's radius, a parabola's parameter): the radius of curvature at a vertex. An
   imaginary ellipse (ac − b² > 0 and a·det M > 0) → Undefined; mod p (no order) not checked.
4. **The type is derived, never stored**: ac − b² over a² + 2b² + c² (dimensionless) with the band:
   positive an ellipse, zero (EPS) a parabola, negative a hyperbola, inside the band ambiguous.
5. **A circle is never a conic.** Every existing tool, fixture and verdict is unchanged
   (editor/test/figure-baseline-16b.test.ts compares every example and fixture with its summary
   on the base). Capability dispatch (E2): a new capability `conic` (`CONIC_CAPABILITIES`, beside
   the frozen list) only the overloads below declare; elsewhere a conic gives Undefined "k is a
   conic: <tool> does not take one".

### Decisions on a conic (conic.ts, conic-incidence.ts, tools/conic-pairs.ts)

6. **Incidence**: P on k is decided on Q(P)/|∇Q(P)| as a LENGTH with the band (exact fields: Q(P)
   = 0), as ADR-0004 decides it for circles.
7. **Line ∩ conic**: on p + t·d, Q = αt² + βt + γ. α (over |d|²·√(a² + 2b² + c²), dimensionless)
   within EPS: d is an asymptotic direction (or a parabola's axis): one finite common point
   −γ/β (both along signs), and β zero too: an asymptote, no finite common point; inside the band:
   Undefined (the far point is near infinity and the near point's along label would flip there).
   Otherwise the count is decided on −sign(α)·Q(mid)/|∇Q(mid)| (mid the chord's midpoint) as a
   length with the band: no square root of a rounding residue, the double point within the band
   (ADR-0006 decision 6's rule). Candidates mid ∓ √(Δ/4α²)·d, so along(+) is structural. other(P):
   Vieta, t₁ = −β/α − t₀, exact; with α within EPS the other point is at infinity → Undefined.
8. **Tangents from P**: the touch points are the polar of P ∩ k (decision 7 on the polar); P the
   centre → Undefined, no tangent (the polar misses k) → Undefined, P on k → the double point P,
   P on an asymptote → Undefined (one touch point at infinity). orient(+): cross(mid − P, T − P)
   > 0, mid the midpoint of the chord of contact; for a circle mid − P points to O, so the labels
   > are the circle tools' (SPEC §7). other(T): Vieta on the polar.
9. **Tangent, polar, pole**: the tangent at P has direction rot90(−∇Q(P)/2) and the polar of P is
   g(P)·X + h = 0 through the foot of P on it, both CHIRAL (a quarter turn of a gradient, which is
   an achiral direction: the normal form commutes with mirroring); for a conic that is a circle
   they are the circle tools' lines. P the centre (g(P) = 0, as a length) → Undefined. The pole of
   l is adj(M)·u: at infinity exactly when l passes through the centre (a parabola: l parallel to
   its axis), decided by the type: a central conic tests the length from the centre to l, a
   parabola the sine between l and its axis, near a parabola (the band) → Undefined (ambiguous).
   conic_center(k) is the pole of the line at infinity, (be − cd, bd − ae, ac − b²): a parabola's
   is the point at infinity of its axis.

### Tools

10. **conic(A, B, C, D, E)**: the member λ·AB·CD + μ·AC·BD of the pencil of two line pairs through
    A, B, C, D that passes through E, computed relative to A (scaled by the points' spread when its
    square root is representable), then put in normal form. Coincident points, three collinear
    points (the conic is a line pair) and four collinear points (no unique conic) → Undefined, the
    collinearity decided as the triangle tools decide it (ADR-0003 item 21). Anchor A. Symmetry:
    B, C, D, E in any order `'value'` (the normal form is unique); all five in any order `'figure'`
    (the anchor is the first point). The brief's "any order, same value" holds for the
    coefficients; the anchor cannot be order-free without a decision that would make a glider
    jump.
11. **conic_center(k)**, **tangent(P, k)**, **polar(P, k)**, **pole(l, k)**, **tangent_point /
    tangent_from(P, k, selectors)**, **intersect(l, k, selectors)**, **other(l, k, P)**,
    **on(k, u, v)**, **apply(T, k)**: overloads of the existing tools where one exists (one
    compute each). All rational (exact over Q and mod p) except the candidates of the two-candidate
    calls (square roots, as for circles; other(P) exact).
12. **Gliders on(k, u, v)** (conic-glider.ts): the pencil of lines through the anchor A, as the
    circle gliders' (u : v): with e = −∇Q(A)/2 (for a circle a positive multiple of A − O) and
    f = rot90(e), X(u : v) is the second point of the line through A with direction u·f − v·e,
    A − (2v|e|²/α)·w; for a conic that is a circle it is the circle glider's point exactly. The
    parameter runs over the whole conic once and passes the points at infinity (a parabola's one,
    a hyperbola's two) where α = 0: there the glider is Undefined ("at a point at infinity"),
    inside the band ambiguous; so a glider leaves one branch of a hyperbola through infinity,
    Undefined there, and comes back on the other. Inverse: (w·f : −w·e), (1 : 0) at A. Drag:
    Newton steps along the gradient from the cursor to the curve (floats), then the inverse.
    Randomize and the samplers use the circle gliders' (u : v) = (cos φ/2, sin φ/2) (packages/claims).
13. **conic_to_circle(k)**: in the conformal frame X = A + x·rot90(e) + y·e at the anchor A with
    e = c·g, g = ∇Q(A)/2, c = −|g|²/(2·Q₂(rot90 g)), k divided by g·e is αx² + 2βxy + γy² + 2y = 0
    (α = −1/2), and (x : y : z) ↦ (x + (β/α)y : y : (y − (2/α)(z + (δ′/2)y))/4), δ′ = γ − β²/α,
    sends it to x² + y² − 4y = 0. So the map fixes A and the tangent at A, and the image is the
    OSCULATING circle of k at A: centre A + 2e, radius 2|e| = |g|³/|Q₂(rot90 g)|, the radius of
    curvature (Q₂ of a tangent direction is never 0 at a finite point of a valid conic); for a
    conic that is a circle it is the identity. Rational. No anchor → Undefined. The first frame,
    e = g/|g|², made the image of an eccentric conic about 10⁻³ across in a figure 40 wide: the
    float matrix was nearly rank one and apply(g, k) lost every digit (a float theorem test;
    test/conic-to-circle-conditioning.test.ts keeps that figure).
14. **circle_to_centre(c, P)**: the hyperbolic translation of the Klein model along OP (a Lorentz
    boost, scaled to one square root): with w = P − O, R = r², σ = √(R(R − |w|²)), in coordinates
    X − O, X ↦ (σX + R·w(w·X)/(R + σ) − R·w : −w·X + R). Every projective map keeping c is a
    hyperbolic isometry, and those sending P to O need √(1 − |w|²/R), so the map is radical: exact
    over Q exactly when R(R − |w|²) is a square. P on c → Undefined (inside the band ambiguous), P
    outside → Undefined, P = O → the identity.
15. Every new tool: export 'numeric', docs from the registry, degenerate cases tested by name, a
    property test, L3 by the registry oracle with argument plans (l3-plans-conics.ts).

### Maps on conics (packages/kernel/src/similarity.ts, transform/)

16. **A similarity** sends a conic to a conic (its matrix), anchor mapped. **A projective map**
    sends a circle or a conic to a conic: the image is NEVER a circle, whatever the matrix (the
    rule is decided by the map's type, never by a numeric test, so every field gives the same
    kind); its known point mapped, dropped when it goes to infinity. An arc → Undefined (an arc of
    a conic is not an object). The image's det is det(m)⁴·det M, computed from the inputs (far
    better conditioned than from the image's rounded coefficients). **A Möbius map with a pole**
    sends a conic (that is not a circle) to a curve of degree 3 or 4 → Undefined. Static kinds: a
    circle's image under a map that may be projective may be a conic.
17. Derived layers image conics (`k*`); views and drag-through need no change.

### Claims (packages/claims)

18. **on(P, k)** is Q(P) = 0 over the normal-form coefficients; its float gap is Q(P)/|∇Q(P)|,
    the kernel's incidence length (a claim and a construction never disagree). **tangent(l, k)**
    (either order) is the dual conic uᵀ·adj(M)·u = 0 with u = (n, −n·p), n = rot90(d); NDG: d is
    not an asymptotic direction (a new NDG item `nonzero`: dᵀM₂d over |d|²·√(a² + 2b² + c²),
    dimensionless), since such a line meets k at infinity (an asymptote touches it there); its
    float gap is the kernel's chord gap (the count of intersect(l, k)). A conic with a circle or
    with a conic: Undefined "the tangency of a conic and a circle or of two conics is not
    decided" (conic ∩ conic is Run 16c's). Both stay POLYNOMIAL KINDS.
19. **conconic(A, B, C, D, E, F, …)**, a rest kind, POLYNOMIAL: per point X after the fifth,
    Q(X) = 0 for the pencil conic through A…E, which is
    [ACE][BDE][ABX][CDX] − [ABE][CDE][ACX][BDX] ([PQR] the orientation determinant): the 6×6
    determinant of the rows (x², xy, y², x, y, 1) up to one constant factor
    (kinds-conics.test.ts checks the ratio on random rational points), so its zero set is
    symmetric in the six points (symmetry: any order of six). NDG: the points distinct and no
    three collinear (three collinear points lie on a conic only as a line pair, which
    conic(…) refuses); a circle's points qualify (a circle is a conic). Residual: the distance
    from each later point to the conic through A…E over the points' diameter.
20. **Corpora**: the conic corpus (corpus-conics.ts: conconic, Pascal, Brianchon, La Hire, the
    pole of a chord, the centre of the conic through A, B, C, H on the nine-point circle, a
    reflection of a conic; their mutations; a repeated point, three collinear points) runs in
    test/laws/l12-conics.test.ts with a minute per test: the normal form multiplies the
    coefficients by (a² + 2b² + c²)/det M, so a hexagon on a conic takes about a second per seed
    on the exact rung (the frozen L12 files keep their five seconds). L17: l17-conics.test.ts
    (rational conic closures eligible, sign-based selectors and circle_to_centre excluded, the
    rung used agrees).
21. **Samplers and Randomize**: on(k, u, v) is a stereographic glider like a circle's: (u : v)
    = (cos φ/2, sin φ/2) globally, perturbed by angle locally; a sample at an asymptotic
    direction is Undefined there and resampled (Randomize accepts only samples where every
    defined object stays defined).

### Discovery (packages/discovery)

22. conconic is searched through the claim-kind registry (six points; the candidates are
    budget-bounded per kind as every kind's). claimKey takes a fast path when a kind's
    generators are every adjacent transposition: the smallest arrangement is the arguments in
    the smallest-concatenation order (x before y when x|y| < y|x|), equal to the orbit's
    minimum (claim-key-symmetric.test.ts) without listing 720 arrangements per candidate.
    Groups: five points, pairwise apart and no three collinear, determine a conic, so
    conconic facts sharing five such points are one n-ary fact.
23. **The closure** (closure-conics.ts): conic sets (the points recorded on a conic object by
    the guarantees: the five points of conic(…), gliders, intersections, touch points; and the
    points of a given conconic fact); on(P, k) follows when P is in k's set, conconic when the
    points are distinct and in one conic set or one circle class. A projective map keeps
    conconic facts (transport). Non-object terms on(k, u, v) on one conic class with equal
    literals are one point.
24. **Maps** (`MapFacts`): conic_to_circle(k) has `circleImage` k (the images of k's points are
    put on one circle) and fixes on(k, 1, 0), which conic(A, …) declares equal to A;
    circle_to_centre(c, P) keeps c and line OP, sends P to the centre and the centre to the
    reflection of P in it (the translation along OP of the Klein model sends O to −P). A new
    rule: the images of the points of an invariant line or circle are on it. So a layer under
    either map reports nothing that holds by the map alone (conic-facts.test.ts, ADR-0039's
    style).

### Drawing, exports, editor

25. **Scene**: the shape (type, centre or vertex, axis, semi-axes or parameter) from the
    eigenvectors of the quadratic part; the visible part from each branch's crossings with the
    clip rectangle (closed forms), sampled until every chord is within 1/4 px; one polyline per
    branch and interval, a closed one for a whole ellipse. Placement (ADR-0023) lists a conic
    whose points round by more than 1/2 px at the zoom, and also one that the rounding might
    hide from the crossings (the curve within the rounding error of the view), which was
    otherwise silently left out. Labels at the middle of the first visible branch; hit testing
    and snapping on the polylines.
26. **Exports**: numeric polylines per branch (SVG polyline or polygon, TikZ \draw, Asymptote
    draw) clipped to the view; points on a conic are numeric variables in Asymptote.
    tests/fixtures/export/conics.geo with golden snapshots; tex.yml compiles it with every
    fixture.
27. **Style card**: a conic is a curve, named "conic".
28. **Editor**: the glider and point tools put on(k, u, v) on a clicked conic; a drag moves it
    through the kernel's nearest point (conicDragParameter); its rounding length is 2/|∇Q(A)/2|
    (a circle's radius when the conic is a circle). A conic without a known point has no
    glider. Not done here: a toolbar button for conic(A, …, E) and the Tangent button on a conic
    (both typed in the text).

### Run 16a's queue

29. The GUI intersection of two parallel lines builds their point at infinity, selects it (the
    Objects panel shows it) and says "point at infinity, direction of l"; pole(l, c) with l
    through the centre is the point at infinity perpendicular to l (its flag l's toggled), for
    a conic the direction conjugate to l.

### Frozen tests

30. Changed lines in test files of the tag run-16a (every other change adds lines):
    - kernel/test/value.test.ts (3 lines) and scene/test/shapes.test.ts (2 lines): they used
      `conic` as the unknown future kind; now `locus`, the reserved kind left.
    - kernel/test/cline.test.ts (1 line): the list of on's signatures gains on(conic, number,
      number).
    - kernel/test/helpers/degenerate-projective.ts (4 lines): a circle under a projective map
      was Undefined ("a conic"); it is a conic now (the key and the assertion).
    - kernel/test/helpers/degenerate-v11.ts (4 lines): pole(l, c) with l through the centre was
      Undefined; it is the point at infinity (Run 16a's queue).
    - kernel/test/construction-key.test.ts (4 lines, at its 400-line limit): the samples and the
      same-figure comparison of the conic tools come from a helper.
    - editor/test/intersection-lines.test.ts (4 lines): the parallel case asserted the refusal;
      it asserts the point at infinity, the notice and the selection (Run 16a's queue), and the
      header says so.
    - claims/test/kinds.test.ts: two lines inserted into the pinned lists of claim kinds and
      polynomial kinds (conconic); no line changed, but the assertion is wider.
    - editor/test/fixtures/run-16a-baseline.json: the summary of the new fixture, inserted lines
      only.

## Consequences

- A conic is a first-class object: drawn, constructed on, mapped, claimed about, and found by
  "What is special?".
- Every existing figure draws and reports as on the base (editor/test/figure-baseline-16b.test.ts).
- Exact conic figures are slower than circle ones (the normal form's factor); the exact rung's
  size budget falls through to mod p or floats when a figure is too large.
- In floats the image of a very eccentric conic under conic_to_circle can lose accuracy (one
  random figure in 200 of the theorem test, osculating radius about 4·10⁴; STATUS.md, Known
  bugs): that theorem test runs exactly over Q, and L3 compares floats with Q on its figures.

## Consequences

- A conic is a first-class object: drawn, constructed on, mapped, and claimed about.

## Alternatives considered

- **Coefficients never normalised** (as projective matrices, ADR-0040): the five points in another
  order would give another value, and float magnitudes would follow the formula's degree.
- **Normalising by one coefficient** (the first non-zero of a, c, b): a decision that flips, and a
  division by a small number in floats.
- **A circle's image under a projective map is a circle when the matrix is a similarity**: in
  floats that is a numeric test, so a figure's kind would differ between fields.
- **conic_to_circle onto the circle with diameter the normal chord at A**: as well conditioned,
  but undefined when the normal is an asymptotic direction (a parabola at its vertex).
- **Working with coefficients divided by one of them in exact fields** (smaller rationals):
  line values (tangent, polar) would differ between Q and floats in their direction's length,
  which L3 compares.
- **conconic with a fixed arity of six**: seven points of one conic could not be one fact.
- **conconic not searched** (`notSearched`): six points on a conic would never be found; with
  the claimKey fast path the search costs about 0.1 ms per candidate.
