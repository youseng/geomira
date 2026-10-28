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
13. **conic_to_circle(k)**: in the conformal frame X = A + x·rot90(e) + y·e at the anchor A
    (e = g/|g|², g = ∇Q(A)/2), k is αx² + 2βxy + γy² + 2y = 0, and (x : y : z) ↦ (x + (β/α)y : y :
    (y − (2/α)(z + (δ′/2)y))/4), δ′ = γ − β²/α, sends it to x² + y² − 4y = 0. So the map fixes A and
    the tangent at A, and the image is the circle tangent to k at A with centre A + 2e and radius
    2/|g|; for a conic that is a circle it is the identity. Rational. No anchor → Undefined.
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

(Decisions 18–29 and 30, frozen tests: see the rest of this ADR as the run completes.)

## Consequences

- A conic is a first-class object: drawn, constructed on, mapped, and claimed about.

## Alternatives considered

- **Coefficients never normalised** (as projective matrices, ADR-0040): the five points in another
  order would give another value, and float magnitudes would follow the formula's degree.
- **Normalising by one coefficient** (the first non-zero of a, c, b): a decision that flips, and a
  division by a small number in floats.
- **A circle's image under a projective map is a circle when the matrix is a similarity**: in
  floats that is a numeric test, so a figure's kind would differ between fields.
