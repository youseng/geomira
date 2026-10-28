# ADR-0040: Ideal points, projective maps, cross-ratio claims (Run 16a)

Status: accepted (Run 16a). Moves ideal points and projective maps out of SPEC §1's Phase 2 list
and builds SPEC §18 E8 (the reserved kind IdealPoint) and E3 ('projective'). Conics (Run 16b)
stay reserved. Changes frozen tests (decision 22). SPEC §1, §3, §4, §6.2, §10.1, §18 are updated
in the same commit.

## Context

Run 16a's brief (the maintainer split Run 16 into 16a and 16b): (1) an `IdealPoint` kind:
parallel lines meet at an ideal point instead of Undefined; every tool that does not declare it
returns Undefined with a reason (E2), so dependents of existing documents behave as before; it is
declared where meaningful (the line through a point and an ideal point; two ideal points; collinear
and concurrent claims); it is not drawn; exports list it. (2) A `TransformData` 'projective' (a
3×3 matrix over the field) with compose, inverse and apply on every kind, exact over Q and mod p:
a point on the line sent to infinity → an ideal point, lines → lines, a segment crossing that line
→ two rays (ADR-0032's `outside`), circles → Undefined until conics exist; Möbius maps compose with
projective maps only as compose nodes (ADR-0019). (3) Constructors: the projective map taking four
points to four points, and `send_to_infinity(l)` with a stated normalisation. (4) A derived layer
`image(send_to_infinity(l), main)` with views and drag-through, no projective mode. (5) Claims
`cross_ratio(A, B, C, D) = k` and `harmonic(A, B; C, D)` for collinear points, concurrent lines and
concyclic points. (6) A tool `harmonic_conjugate`. (7) Theorem tests. (8) Discovery.

SPEC said nothing about how an ideal point is represented, how a projective map acts on a range,
a polygon or a mark, which affine chart `send_to_infinity` uses, what the cross ratio of four
concyclic points is as a field-generic condition, or what the claims do with ideal points.

## Decision

### Ideal points (packages/kernel/src/value.ts)

1. **`IdealPoint<T> = { kind: 'ideal_point', d, chiral }`**: the point at infinity of the lines
   with direction d (d ≠ 0; d and λd, λ ≠ 0, are the same point; d is a REPRESENTATIVE, not
   normalised, so float and exact runs agree entry by entry). `chiral` is SPEC §4's flag of d, so a
   line built from an ideal point gets the flag right. `numbersOf` lists d. VALUE_KINDS keeps SPEC
   §4's list (its frozen test enumerates it) and the new `PROJECTIVE_KINDS` lists `ideal_point`;
   `isKnownKind` accepts it.
2. **Two capabilities**, outside the frozen `CAPABILITIES` list: `ideal` (an ideal point) and
   `ppoint` (a projective point: a point or an ideal point). No existing signature takes them, so
   every existing tool rejects an ideal point by capability.
3. **E2 for ideal points** (evaluate.ts): when no overload accepts the arguments and one of them is
   an ideal point, the call is Undefined with "X is a point at infinity: midpoint does not take
   one" (X the argument's name, or "an argument"), instead of the registry's list of signatures.
   Before this run X was Undefined and its dependents read "X is undefined"; they are Undefined now
   too, with this reason. A kernel test runs every overload of every tool with an ideal point in
   each point position (kind safety, as E2's guard) and requires a declared overload or Undefined
   with a reason naming infinity.
4. **Where ideal points are declared:**
   - `intersect(l, m)` of two FULL lines that are parallel (decided as before, on the sine) is the
     ideal point with l's direction and flag. Coincident lines stay Undefined. A segment or a ray
     contains no point at infinity: parallel ranged lines stay Undefined, with "parallel lines:
     their common point is at infinity, which is not on a segment or ray".
   - `line(P, X∞)` and `line(X∞, P)` (a new overload `(ppoint, ppoint)` after `(point, point)`):
     the line through P with X∞'s direction and flag, i.e. the parallel. `line(X∞, Y∞)`: the line
     at infinity is not an object (it is not represented) → Undefined ("the line at infinity is
     not an object"); X∞ = Y∞ → Undefined (coincident).
   - `apply(T, X∞)`: a similarity maps the direction (a·d̂), a projective map per decision 9, a
     Möbius map with a pole → Undefined (it sends every point at infinity to one point, so a
     direction has no image of its own); with c = 0 it is a similarity.
   - `harmonic_conjugate(A, B, C)` takes an ideal C and may return one (decision 14);
     `projective(…)` takes ideal points (decision 11).
   - **Claims** (the maintainer's choice, asked during the run): `collinear` takes ideal points
     (homogeneous coordinates: X∞ lies on line PQ iff PQ has its direction; two ideal points span
     the line at infinity, which holds only ideal points); `concurrent` keeps its affine meaning
     (three parallel lines stay degenerate, as frozen tests pin it), so concurrency at infinity is
     written with `parallel`. Every other kind gives "X is at infinity" (undefined, as before:
     a claim on X was undefined), never invalid. The finder never uses ideal points as candidates.
5. **Not drawn** (scene shapes.ts): an ideal point is listed in the scene's `unavailable` with the
   reason "at infinity, direction θ° (mod 180°)" and the new flag `atInfinity`; the Objects panel
   shows "at infinity, direction θ°"; every export lists it as a warning ("X is at infinity
   (direction θ°): not drawn"), never as coordinates. The GUI intersection tool still refuses two
   parallel lines (it builds points it can show); the text builds the ideal point.
6. **Static kinds** (kinds.ts): `intersect`'s line ∩ line overload outputs `point` and
   `ideal_point`; imaging (derived.ts) treats `ideal_point` as geometric.

### Projective maps (packages/kernel/src/transform/projective*.ts)

7. **`Projective<T> = { type: 'projective', m }`**, m the 3×3 matrix row by row acting on
   homogeneous columns (x, y, 1), defined up to a non-zero factor and never normalised (L3 agrees
   entry by entry). Valid iff det m ≠ 0: exactly 0 → Undefined ("the map is not invertible (its
   determinant is 0)"); in floats a determinant that is not a finite double with a finite
   reciprocal → Inexact (ADR-0019 decision 3). Its LINE AT INFINITY's preimage ℓ is the line
   m₃₁x + m₃₂y + m₃₃ = 0 (absent when m₃₁ = m₃₂ = 0 exactly: an affine map).
8. **compose, inverse**: two projective maps, or a projective map and a similarity (as the matrix
   of z ↦ a·ẑ + b), multiply as matrices (no collapse test, ADR-0019 decision 2); the inverse is
   the adjugate. A projective map and a Möbius map with a pole are not one matrix: compose keeps
   them as a **`Composite` { type: 'composite', maps }** (the maps in the order they apply,
   adjacent maps of one family merged: similarity with either, Möbius with Möbius, projective with
   projective; merging is by type only, never by a numeric test, so every field builds the same
   shape). apply applies each map in turn, so the result is defined exactly where each step is
   (an inversion's centre, the line sent to infinity); inverse reverses and inverts each.
9. **apply per kind**, with W(X) = m₃·(x, y, 1) (the signed distance to ℓ times |(m₃₁, m₃₂)|):
   - **point**: X on ℓ (W as a length with the band: within EPS → on; inside the band → Undefined,
     ambiguous; mod p: exactly 0) → the ideal point with direction (m₁·X, m₂·X); otherwise
     (m₁·X, m₂·X)/W.
   - **ideal point** d: W = (m₃₁, m₃₂)·d decided as a sine (dimensionless) with the band: zero →
     the ideal point (m₁·d, m₂·d) (same flag), otherwise a point.
   - **line** p + t·d: the image line has the covector (a, b, c) = (Mp) × (Md) (homogeneous), its
     direction N = (b, −a) (the derivative's direction at every point: positive multiples of
     d/dt f(p + t·d), so the image is traversed in the same sense on each side of ℓ) and its base
     point the foot of the origin −c·(a, b)/(a² + b²). The line ℓ itself (p on ℓ and d ∥ ℓ, each
     with the band) → Undefined ("apply: the line is sent to infinity"). The parameter
     σ(t) = (X(t)·N)/(W(t)|N|²) is increasing on each side of ℓ, σ(t₀) = ∞ at t₀ where the line
     meets ℓ, and σ(∞) = (Md)ₓᵧ·N/(W(d)|N|²) (∞ when the line is parallel to ℓ). A range (ADR-0032
     decision 7's projective arc from start to end) maps to (σ(start), σ(end)), passing through ∞
     iff t₀ lies strictly inside it: a segment crossing ℓ → the two rays `outside`, a segment with
     an end on ℓ → a ray, a ray crossing ℓ → a segment, and so on. Whether t₀ is inside is decided
     from the signs of W at the finite ends (lengths with the band) and, for an end at ∞, the sign
     of W(d) (a sine with the band); mod p a range is Inexact (no order), a full line exact.
     Chirality: kept (the image direction is the derivative of an equivariant formula; tested
     against mirrored figures for maps built equivariantly).
   - **circle, arc** → Undefined ("apply: a projective map sends a circle to a conic, which is not
     an object until Run 16b"), never approximated, even when the matrix happens to be affine.
   - **polygon**: every vertex strictly on one side of ℓ (signs of W with the band) → the polygon of
     the images; otherwise Undefined (a side would pass through infinity); mod p Inexact.
   - **angle mark**: the vertex's image, the arms mapped by the derivative (J·v = (Mv)ₓᵧ·W − X·W(v)
     over W²), arms swapped when the map reverses orientation there (sign of det m · W(b)); the
     mark is no longer a right angle (`right` false: angles are not kept). Vertex on ℓ →
     Undefined. **segment mark** → Undefined (lengths are not kept). **text**: its anchor.
   - numbers, maps, strings → Undefined; Undefined and Inexact pass.
10. **Static kinds**: a new static kind `'projective'` (like ADR-0032's 'mobius', never a value's
    kind): the projective constructors output it, compose and inverse carry it, and an image under
    a map that may be projective may be a point or an ideal point where its source is either.

### Constructors (packages/kernel/src/transform/projective-tools.ts)

11. **`projective(A, B, C, D, A′, B′, C′, D′)`**: the map with A ↦ A′, …, D ↦ D′ (points or ideal
    points): M = N′·adj(N), N = [αA | βB | γC] with (α, β, γ) = adj([A | B | C])·D (homogeneous
    columns). No three of A, B, C, D (and of A′, B′, C′, D′) collinear, decided on the
    normalised determinant with EPS and the band (ADR-0003 item 21), else Undefined ("projective: A,
    B, C are collinear: no three of the four points may be"). Rational: exact over Q and mod p.
    Symmetry: none declared (permuting the pairs (X, X′) together gives the same map up to a
    factor, not the same matrix).
12. **`send_to_infinity(l)`** (l = p + t·d, n = rot90(d)): in the frame X = p + t·d + s·n,
    (t, s) ↦ (t/s, 1/s): the homogeneous coordinates (t : s : 1) ↦ (t : 1 : s). It swaps l and the
    line at infinity, is an INVOLUTION (its own inverse), fixes the line through p perpendicular to
    l, and is the harmonic homology with axis the parallel to l at distance |d| on the left of d
    and centre p − n. Why this chart: it is rational in p and d (exact over Q and mod p); it is
    continuous in p and d, so dragging l moves the image continuously (no case split, no choice
    that can flip); the chart's unit is |d| and its origin p, so a figure of the size of l's
    defining points keeps about its size in the image (a layer stays near the figure); it commutes
    with direct similarities of the whole figure (the samplers' random similarity, ADR-0028), so
    image facts are tested on consistent images. A projective map that sends a line to infinity
    cannot commute with a mirror symmetry of that line (the matrix conditions force a singular
    matrix), so a mirrored figure's image is the mirror image followed by the reflection in the
    line through p perpendicular to l when l is achiral (and equals it when l is chiral): the image
    figures are congruent, so every claim invariant under isometries keeps its truth.
    Degenerate: a line without direction → Undefined. The image of l itself is Undefined (sent to
    infinity); ideal points of other directions land on l.
13. **Layers, views, drag-through** need no change: `@layer inf = image(f, main)` with
    `f = send_to_infinity(l)` (ADR-0032 decision 19: the layer line names the map), the views UI of
    ADR-0031, and drag-through inverts the map; a cursor on the image of ℓ's preimage has an
    ideal preimage and is refused ("the preimage is a point at infinity"). Images of points of l
    are ideal points (not drawn, listed). The editor's drag-end rounding uses the local scale
    √(|det m|/|W(x)|³).

### Claims (packages/claims/src/kinds-projective.ts)

14. **`harmonic_conjugate(A, B, C)`** (points; C may be ideal): D with (A, B; C, D) = −1 on line AB,
    D = M + (|AB|²/4)/|MC|²·(C − M) (M the midpoint: MC·MD = MA², symmetric in A ↔ B, rational).
    C = M (a length with the band) → the ideal point of AB; C ideal with AB's direction → M; C not
    on AB (banded incidence) → Undefined; C = A or C = B → Undefined; A = B → Undefined.
    **Line form** `harmonic_conjugate(a, b, c)`: concurrent lines (decided as an incidence of a ∩ b
    with c, or for parallel lines on the sine): through P = a ∩ b with direction
    cross(w, v)·u − cross(u, w)·v (u, v, w the directions of a, b, c; symmetric in a ↔ b), chiral
    unless an odd number of the inputs is chiral (it is trilinear with one cross product); a
    parallel pencil gives the parallel line through the harmonic conjugate on the transversal
    through c's base point perpendicular to c (c's direction and flag); c = a or b, a = b, or lines
    that are not concurrent → Undefined. Symmetry a ↔ b and A ↔ B `'value'` (an ideal result is the
    same point with a direction of either sign: its representative may differ, decision 1).
    Guarantees: harmonic(A, B; C, result) and collinear(A, B, result); the line form
    harmonic_lines(a, b, c, result). Export: numeric.
15. **Claim kinds**: `cross_ratio(A, B, C, D, k)` and `harmonic(A, B, C, D)` on points, and
    `cross_ratio_lines(a, b, c, d, k)`, `harmonic_lines(a, b, c, d)` on lines, all polynomial
    (whitelisted, L12, L17 tested).
    - **Points**: the complex cross ratio (C − A)(D − B) = k·(C − B)(D − A) (two real conditions).
      It is real exactly when the four points are collinear or concyclic, and then it is the cross
      ratio on the line, or the cross ratio of the lines from any fifth point of the circle (an
      inversion centred at that point is the projection from it onto a line and keeps the complex
      cross ratio up to conjugation). So one kind covers four collinear points and four points on a
      circle; four points on neither make the claim false. NDG: the four points distinct.
      The brief's "NDG: on the circle" is a CONDITION here: an NDG item must be non-zero, and
      "on one circle" is an equation; a claim whose points are not on one circle is false, never
      silently true (Uncertain in STATUS).
    - **Lines**: concurrency (the determinant of every three, as `concurrent`) and
      cross(u_a, u_c)·cross(u_b, u_d) = k·cross(u_b, u_c)·cross(u_a, u_d) (the cross ratio of the
      pencil). NDG: the lines pairwise not parallel (a parallel pencil is degenerate, as concurrent
      keeps it).
    - Residuals: dimensionless (the complex residual over the sum of the moduli; the sines for
      lines). Symmetries: cross_ratio keeps (A, B; C, D) = (B, A; D, C) = (C, D; A, B);
      harmonic adds A ↔ B and C ↔ D. Finder: harmonic kinds are searched (arity 4); cross_ratio
      with a free k is not searched ("k is not searched; harmonic is").
16. **Notation** (packages/lang): `harmonic(A, B; C, D)` and `cross_ratio(A, B, C, D) = k` are
    printed for points; the line kinds print as calls (`harmonic_lines(a, b, c, d)`), and the read
    forms `harmonic(a, b; c, d)`, `cross_ratio(a, b, c, d) = k` with four line arguments (their
    static kinds) build the line kinds. `;` is a new punctuation token, only meaningful there.

### Discovery (ADR-0035, ADR-0039)

17. **Map facts**: a new MapType `'projective'` (send_to_infinity: involution; projective: none),
    with what it keeps: equal points, incidence of points and lines (on, collinear, concurrent),
    cross ratios and harmonic quadruples; never lengths, angles, circles or tangency. Transport
    through a projective map uses that list; through a Möbius map the point cross ratio kinds are
    kept too (a Möbius map keeps the complex cross ratio up to conjugation).
18. **Not flooding**: images in an `inf` layer are reported only when the preimages' fact is not
    already known (ADR-0039 decision 4); a test runs the finder on a projective layer as ADR-0039's
    inversion case does.

### Mutation testing, docs

19. New kernel files join stryker.kernel.json and existing light shards (the frozen test keeps
    eleven kernel shards); the claims kinds file joins its shard; discovery-d is not touched
    (ADR-0038's limit), new discovery logic lives in files of other shards. Shards are sized for a
    cold run.
20. docs/tools.md and docs/language.md are regenerated; every new tool has the full checklist
    (one compute, degenerate tests, L3, a theorem test, export mapping `'numeric'`, docs, symmetry).

### Behaviour of existing documents

21. Every example and fixture (examples/, tests/fixtures/, the language's migration fixtures)
    evaluates, draws and reports its claims exactly as before: their summaries were written on the
    base of the run and a test compares them. Visible differences elsewhere: an intersection of two
    parallel lines is an ideal point ("at infinity" in the Objects panel instead of "parallel
    lines"); its dependents say "X is a point at infinity: … does not take one" instead of "X is
    undefined"; collinear(…) with such a point is true or false instead of undefined.

### Frozen tests changed under this ADR

22. Listed in STATUS (each commit cites this ADR):
    - `packages/kernel/test/degenerate.test.ts`: the intersect case "parallel lines → Undefined"
      becomes "parallel lines → their ideal point", asserting the ideal point in every field (and
      the nearly parallel case: ideal in floats, a point over Q, as before).
    - `packages/claims/test/helpers/corpus-degenerate.ts`: "a claim on the intersection of parallel
      lines (Undefined)" claimed collinear(X, A, C) with X the ideal point of AB, which is FALSE in
      the projective plane; it now claims collinear(midpoint(X, A), A, C), a claim on an object
      built from the ideal point (still undefined, as the entry's name says). The claim itself
      joins the false corpus.
    - `packages/claims/test/screen.test.ts`: collinear(A, B, X) with X the ideal point of AB is
      now true (it was undefined).

## Consequences

- A figure can be sent to a chart where a chosen line is at infinity, as a derived layer, and
  claims about cross ratios and harmonic quadruples are tested exactly over Q and mod p.
- Ideal points are values everywhere (exhaustive switches list them); no tool silently draws or
  measures one.
- Circles under projective maps stay Undefined until conics (Run 16b).

## Alternatives considered

- **Keeping intersect of parallel lines Undefined and adding a separate `at_infinity(l)` tool**:
  against the brief, and every projective construction would need two forms.
- **Normalising ideal directions** (a sign convention such as x > 0): a decision on a coordinate,
  which flips when the direction passes the vertical; a line built from the ideal point would then
  switch its direction (and its along(±) branch) silently.
- **One matrix for every map** (Möbius maps as 3×3 matrices): an inversion is not projective.
- **send_to_infinity as the perspective from a point at a chosen height**: needs a length that is
  not in the figure, and a choice that changes the image's size arbitrarily.
- **Projective `concurrent`** (three parallel lines concurrent at infinity): the maintainer chose to
  keep `concurrent` affine; two more frozen tests would change and the finder would report every
  triple of parallel lines.
- **A circle-argument form of the cross ratio on a circle**: four points on one circle already
  determine it; the complex cross ratio is one polynomial form for both cases.
