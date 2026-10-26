# Tool reference

Generated from the tool registry by `pnpm docs:tools` (packages/kernel/src/docs.ts). Do not
edit by hand: a test fails when this file differs from the registry. Exact results are
shown as fractions; results that are not exact (Inexact over RationalField) are shown
from FloatField with 12 significant digits.

## Points

### point

The point with coordinates (x, y); `(x, y)` is the same. Free when x and y are literals.

- Signatures: `point(number, number)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Same construction: never (a free input: two of them are independent objects)
- Degenerate cases: none
- Examples:
  - `point(1, -2/3)` → point (1, -2/3)

### param

param(min, max, v): a free number v in [min, max] (a slider).

- Signatures: `param(number, number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Same construction: never (a free input: two of them are independent objects)
- Degenerate cases:
  - min ≥ max → Undefined
  - v outside [min, max] → Undefined
  - a range decision inside the band → Undefined (ambiguous)
  - mod p the range is not checked
- Examples:
  - `param(0, 1, 1/3)` → number 1/3

### midpoint

The midpoint of A and B.

- Signatures: `midpoint(point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: constructive (midpoint)
- Symmetry:
  - `midpoint(point, point)`: arguments 1, 2 in any order (the same value)
- Degenerate cases:
  - midpoint(A, A) = A
- Examples:
  - `midpoint((0, 0), (3, 1))` → point (3/2, 1/2)

### divide

divide(A, B, t) = A + t·(B − A): t = 1/2 is the midpoint, t = 2 reflects A in B.

- Signatures: `divide(point, point, number)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - divide(A, A, t) = A
- Examples:
  - `divide((0, 0), (3, 6), 1/3)` → point (1, 2)

### foot

foot(P, l) or foot(P, A, B): the orthogonal projection of P on the line.

- Signatures: `foot(point, linear)`, `foot(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: constructive (foot)
- Symmetry:
  - `foot(point, point, point)`: arguments 2, 3 in any order (the same value)
- Degenerate cases:
  - foot(P, A, A) → Undefined (coincident points)
  - P on the line → P
  - a segment or ray is extended to its carrier line
- Examples:
  - `foot((1, 3), line((0, 0), (4, 0)))` → point (1, 0)
  - `foot((1, 3), (0, 0), (2, 2))` → point (2, 2)

### intersect

intersect(a, b, selectors): the common point of two lines, a line and a circle, or two circles; a curve pair with two candidates needs selectors (along(±) on line ∩ circle, orient(±) on circle ∩ circle, other(P), near(P), same_side(Q, l), …).

- Signatures: `intersect(linear, linear)`, `intersect(linear, round)`, `intersect(round, linear)`, `intersect(round, round)`
- Result: point
- Exact run (RationalField): can succeed
- Export: constructive (intersect)
- Symmetry:
  - `intersect(linear, linear)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
  - `intersect(linear, round)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
  - `intersect(round, linear)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
  - `intersect(round, round)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
- Degenerate cases:
  - parallel lines → Undefined
  - coincident lines → Undefined
  - the intersection outside a segment or ray → Undefined
  - the intersection within the band of a segment end → Undefined (ambiguous)
  - a segment or ray range mod p → Inexact
  - a candidate outside an arc is not a candidate (none left → Undefined)
  - a candidate within the band of an arc end → Undefined (ambiguous)
  - line ∩ circle: the line misses the circle → Undefined
  - line ∩ circle: tangency (the gap within the band) → the double point
  - circle ∩ circle: apart or one inside the other → Undefined
  - circle ∩ circle: tangency (a gap within the band) → the double point
  - circle ∩ circle: the circles nearly coincide (centres and radii within the band) → two candidates by the half chord, or Undefined (ambiguous)
  - concentric circles → Undefined
  - two candidates and no selector → Undefined (ambiguous: add a selector)
  - a deciding quantity of a selector within the band → Undefined (ambiguous)
  - no candidate satisfies the selectors → Undefined
  - two candidates satisfy the selectors → Undefined (ambiguous: add a selector)
  - along(±), orient(±) or other(P) where it does not apply → Undefined
  - other(P) with P not on both objects → Undefined (within the band: ambiguous)
  - a candidate outside a segment or ray is not a candidate
  - square roots not representable → Inexact over Q and mod p (other(P) is exact)
  - a sign-based selector mod p → Inexact
- Examples:
  - `intersect(line((0, 0), (2, 2)), segment((0, 2), (2, 0)))` → point (1, 1)
  - `intersect(line((-4, -3), (4, 3)), circle((0, 0), (5, 0)), along(+))` → point (4, 3)
  - `intersect(circle((0, 0), (5, 0)), circle((6, 0), (3, 4)), orient(+))` → point (3, 4)
  - `intersect(line((3, 4), (0, 0)), circle((0, 0), (5, 0)), other(point(3, 4)))` → point (-3, -4)
  - `intersect(line((0, 0), (1, 0)), circle((0, 0), (1, 1)), along(+))` → point (1.41421356237, 0)

### circumcenter

The center of the circle through A, B, C.

- Signatures: `circumcenter(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: constructive (circumcenter)
- Symmetry:
  - `circumcenter(point, point, point)`: arguments 1, 2, 3 in any order (the same value)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined (use cline)
- Examples:
  - `circumcenter((0, 0), (4, 0), (1, 3))` → point (2, 1)

### centroid

The centroid (A + B + C) / 3, where the medians meet.

- Signatures: `centroid(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: constructive (centroid)
- Symmetry:
  - `centroid(point, point, point)`: arguments 1, 2, 3 in any order (the same value)
- Degenerate cases:
  - collinear or coincident vertices → the mean of the vertices
- Examples:
  - `centroid((0, 0), (4, 0), (1, 3))` → point (5/3, 1)

### orthocenter

The orthocenter, where the altitudes meet.

- Signatures: `orthocenter(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: constructive (orthocenter)
- Symmetry:
  - `orthocenter(point, point, point)`: arguments 1, 2, 3 in any order (the same value)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
- Examples:
  - `orthocenter((0, 0), (4, 0), (1, 3))` → point (1, 1)

### center

The center of a circle.

- Signatures: `center(round)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases: none
- Examples:
  - `center(circle((0, 0), (4, 0), (1, 3)))` → point (2, 1)

### on

Gliders: on(l, t) = p + t·d on a line, segment or ray (t clamped to the range); on(c, u, v): the stereographic parameter (u : v) from the anchor of c (rational; (u : 0) is the anchor); on(c, θ): the point at angle θ (degrees) from the center.

- Signatures: `on(linear, number)`, `on(round, number, number)`, `on(round, number)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Same construction: never (a free input: two of them are independent objects)
- Degenerate cases:
  - a glider on an Undefined object → Undefined
  - on(l, t) on a segment or ray clamps t to the range
  - a segment or ray range mod p → Inexact
  - on(c, u, v) on a circle without anchor → Undefined
  - on(c, 0, 0) → Undefined
  - on(c, u, 0) → the anchor
  - on(c, θ) over Q or mod p → Inexact unless r, cos θ and sin θ are representable
  - on an arc, the point is clamped to the nearer end
  - on an arc, both ends equally far → Undefined (ambiguous)
  - a hand-built arc mod p → Inexact
- Examples:
  - `on(segment((0, 0), (4, 2)), 1/4)` → point (1, 1/2)
  - `on(circle((0, 0), (5, 0)), 1, 2)` → point (-3, 4)
  - `on(circle((0, 0), (5, 0)), 90)` → point (0, 5)
  - `on(circle((0, 0), (5, 0)), 30)` → point (4.33012701892, 2.5)

### other

other(a, b, P): the second intersection of a line and a circle, or of two circles, given one common point P (Vieta; exact).

- Signatures: `other(linear, round, point)`, `other(round, linear, point)`, `other(round, round, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - P not on both objects → Undefined
  - P within the band of an object → Undefined (ambiguous)
  - tangency at P → P (the double point)
  - concentric circles → Undefined
  - the other point outside a segment or ray → Undefined
  - the other point within the band of a segment end → Undefined (ambiguous)
  - a segment or ray range mod p → Inexact
  - the other point outside an arc → Undefined
  - a hand-built arc mod p → Inexact
- Examples:
  - `other(line((3, 4), (-4, -3)), circle((0, 0), (3, 4)), (3, 4))` → point (-4, -3)
  - `other(circle((0, 0), (3, 4)), circle((6, 0), (3, 4)), (3, 4))` → point (3, -4)

### incenter

The incenter of ABC (where the internal bisectors meet).

- Signatures: `incenter(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: constructive (incenter)
- Symmetry:
  - `incenter(point, point, point)`: arguments 1, 2, 3 in any order (the same value)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
  - a side length not rational (over Q) → Inexact
- Examples:
  - `incenter((5, 12), (0, 0), (14, 0))` → point (6, 4)
  - `incenter((0, 0), (4, 0), (1, 3))` → point (1.45981848652, 1.05217763377)

### excenter

excenter(A, B, C): the excenter opposite A.

- Signatures: `excenter(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `excenter(point, point, point)`: arguments 2, 3 in any order (the same value)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
  - a side length not rational (over Q) → Inexact
- Examples:
  - `excenter((5, 12), (0, 0), (14, 0))` → point (8, -12)
  - `excenter((0, 0), (4, 0), (1, 3))` → point (5.70245917364, 4.1101000264)

### ninepoint_center

The center of the nine-point circle of ABC: the midpoint of the circumcenter and the orthocenter.

- Signatures: `ninepoint_center(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `ninepoint_center(point, point, point)`: arguments 1, 2, 3 in any order (the same value)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
- Examples:
  - `ninepoint_center((0, 0), (4, 0), (1, 3))` → point (3/2, 1)

### tangent_point

tangent_point(P, c, selectors): a point where a tangent from P touches c; two candidates (orient(+): cross(O − P, T − P) > 0), one double point when P is on c.

- Signatures: `tangent_point(point, round)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - P inside c (or P = the center) → Undefined
  - P on c (the gap |OP| − r within the band) → the double point
  - two candidates and no selector → Undefined (ambiguous: add a selector)
  - along(±) → Undefined (use orient(±))
  - other(T) with T not a touch point → Undefined
  - square roots not representable → Inexact over Q and mod p (other(T) is exact)
  - a touch point outside an arc is not a candidate
- Examples:
  - `tangent_point((5, 5), circle((0, 0), (5, 0)), orient(+))` → point (5, 0)
  - `tangent_point((6, 0), circle((0, 0), (5, 0)), orient(+))` → point (4.16666666667, -2.76385399196)

### spiral_center

spiral_center(A, B, C, D): the center of the spiral similarity taking A to C and B to D (the fixed point of spiral(A, B, C, D)); also the center of the one taking A to B and C to D; exact.

- Signatures: `spiral_center(point, point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `spiral_center(point, point, point, point)`: arguments 2, 3 in any order (the same value)
  - `spiral_center(point, point, point, point)`: arguments 1, 4 in any order (the same value)
- Degenerate cases:
  - D − C = B − A (a translation; four equal points included) → Undefined
  - A = B, C = D, A = C or B = D → that point
- Examples:
  - `spiral_center((0, 0), (4, 0), (1, 1), (3, 3))` → point (0, 2)

### isogonal

isogonal(P, A, B, C): the isogonal conjugate of P in triangle ABC (the reflections of AP, BP, CP in the bisectors at A, B, C meet there); (a²vw : b²wu : c²uv) in barycentrics; exact.

- Signatures: `isogonal(point, point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `isogonal(point, point, point, point)`: arguments 2, 3, 4 in any order (the same value)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
  - P a vertex → Undefined
  - P on the circumcircle → Undefined (the conjugate is at infinity)
  - P on a side line (not a vertex) → the opposite vertex
- Examples:
  - `isogonal((2, 1), (0, 0), (4, 0), (1, 3))` → point (1, 1)
  - `isogonal((1, 1), (0, 0), (4, 0), (1, 3))` → point (2, 1)

### symmedian_point

symmedian_point(A, B, C): the symmedian (Lemoine) point K, where the three symmedians meet: the isogonal conjugate of the centroid, a² : b² : c² in barycentrics; exact.

- Signatures: `symmedian_point(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `symmedian_point(point, point, point)`: arguments 1, 2, 3 in any order (the same value)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
- Examples:
  - `symmedian_point((0, 0), (4, 0), (1, 3))` → point (14/11, 12/11)

### pole

pole(l, c): the pole of the line l with respect to c, the point whose polar is l (the inverse of polar); exact.

- Signatures: `pole(linear, round)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - l through the center → Undefined (the pole is at infinity)
  - l tangent to c → the touch point
  - a segment or ray is extended to its carrier line
- Examples:
  - `pole(line((5, -5), (5, 5)), circle((0, 0), (5, 0)))` → point (5, 0)
  - `pole(line((2, 0), (0, 2)), circle((0, 0), (5, 0)))` → point (25/2, 25/2)

### radical_center

radical_center(c1, c2, c3): the point with equal power to the three circles, where their radical axes meet; exact.

- Signatures: `radical_center(round, round, round)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `radical_center(round, round, round)`: arguments 1, 2, 3 in any order (the same value)
- Degenerate cases:
  - two concentric circles → Undefined
  - collinear centers → Undefined (parallel radical axes)
  - coaxal circles → Undefined (the radical axes coincide)
- Examples:
  - `radical_center(circle((0, 0), 2), circle((6, 0), 3), circle((2, 5), 1))` → point (31/12, 13/6)

## Lines

### line

The line through A and B (achiral direction B − A).

- Signatures: `line(point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: constructive (line)
- Symmetry:
  - `line(point, point)`: arguments 1, 2 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - line(A, A) → Undefined (coincident points)
- Examples:
  - `line((0, 0), (2, 1))` → line (0, 0) + t·(2, 1), t ∈ [−∞, ∞]

### segment

The segment AB: A + t·(B − A) for t in [0, 1].

- Signatures: `segment(point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: constructive (segment)
- Symmetry:
  - `segment(point, point)`: arguments 1, 2 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - segment(A, A) → Undefined (coincident points)
- Examples:
  - `segment((0, 0), (2, 1))` → line (0, 0) + t·(2, 1), t ∈ [0, 1]

### ray

The ray from A through B: A + t·(B − A) for t ≥ 0.

- Signatures: `ray(point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: constructive (ray)
- Symmetry: none
- Degenerate cases:
  - ray(A, A) → Undefined (coincident points)
- Examples:
  - `ray((0, 0), (2, 1))` → line (0, 0) + t·(2, 1), t ∈ [0, ∞]

### parallel

The line through P parallel to l (keeps the chirality of l).

- Signatures: `parallel(point, linear)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - P on l → the carrier line of l
  - a segment or ray gives a full line
- Examples:
  - `parallel((0, 1), segment((0, 0), (2, 1)))` → line (0, 1) + t·(2, 1), t ∈ [−∞, ∞]

### perp

The line through P perpendicular to l (a quarter turn: toggles the chirality).

- Signatures: `perp(point, linear)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - P on l → the perpendicular at P
  - a segment or ray gives a full line
- Examples:
  - `perp((0, 1), line((0, 0), (2, 1)))` → line (0, 1) + t·(-1, 2), t ∈ [−∞, ∞], chiral

### perp_bisector

The perpendicular bisector of AB (chiral: a quarter turn of B − A).

- Signatures: `perp_bisector(point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `perp_bisector(point, point)`: arguments 1, 2 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - perp_bisector(A, A) → Undefined (coincident points)
- Examples:
  - `perp_bisector((0, 0), (2, 1))` → line (1, 1/2) + t·(-1, 2), t ∈ [−∞, ∞], chiral

### tangent

tangent(P, c): the tangent to c at P (P on c); chiral (a quarter turn of P − O).

- Signatures: `tangent(point, round)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - P not on c → Undefined
  - P within the band of c → Undefined (ambiguous)
- Examples:
  - `tangent((3, 4), circle((0, 0), (5, 0)))` → line (3, 4) + t·(-4, 3), t ∈ [−∞, ∞], chiral

### polar

polar(P, c): the polar of P with respect to c; chiral (a quarter turn of P − O).

- Signatures: `polar(point, round)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - P = the center → Undefined
  - P on c → the tangent at P
- Examples:
  - `polar((10, 5), circle((0, 0), (5, 0)))` → line (2, 1) + t·(-5, 10), t ∈ [−∞, ∞], chiral

### radical_axis

radical_axis(c1, c2): the points with equal power to both circles; chiral (a quarter turn of O₂ − O₁).

- Signatures: `radical_axis(round, round)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `radical_axis(round, round)`: arguments 1, 2 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - concentric circles → Undefined (equal circles included)
  - tangent circles → the common tangent at the touch point
- Examples:
  - `radical_axis(circle((0, 0), (5, 0)), circle((6, 0), 3))` → line (13/3, 0) + t·(0, 6), t ∈ [−∞, ∞], chiral

### bisector

bisector(A, B, C): the internal bisector of ∠ABC, through B (achiral).

- Signatures: `bisector(point, point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `bisector(point, point, point)`: arguments 1, 3 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - A = B or C = B → Undefined
  - within the band of a straight angle → Undefined (ambiguous)
  - an arm length not rational (over Q) → Inexact
  - a straight angle → the perpendicular at B
  - a zero angle → the line BA
- Examples:
  - `bisector((5, 12), (0, 0), (14, 0))` → line (0, 0) + t·(81/5, 54/5), t ∈ [−∞, ∞]
  - `bisector((0, 0), (4, 0), (1, 3))` → line (4, 0) + t·(-5.82842712475, 2.41421356237), t ∈ [−∞, ∞]

### ext_bisector

ext_bisector(A, B, C): the external bisector of ∠ABC, through B (chiral).

- Signatures: `ext_bisector(point, point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `ext_bisector(point, point, point)`: arguments 1, 3 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - A = B or C = B → Undefined
  - within the band of a straight angle → Undefined (ambiguous)
  - an arm length not rational (over Q) → Inexact
  - a straight angle → the line BA
  - a zero angle → the perpendicular at B
- Examples:
  - `ext_bisector((5, 12), (0, 0), (14, 0))` → line (0, 0) + t·(-54/5, 81/5), t ∈ [−∞, ∞], chiral
  - `ext_bisector((0, 0), (4, 0), (1, 3))` → line (4, 0) + t·(-2.41421356237, -5.82842712475), t ∈ [−∞, ∞], chiral

### tangent_from

tangent_from(P, c, selectors): a tangent from P to c, the line through its touch point T with direction rot90(T − O) (chiral); selectors judge T.

- Signatures: `tangent_from(point, round)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - P inside c (or P = the center) → Undefined
  - P on c (the gap |OP| − r within the band) → the double point
  - two candidates and no selector → Undefined (ambiguous: add a selector)
  - along(±) → Undefined (use orient(±))
  - other(T) with T not a touch point → Undefined
  - square roots not representable → Inexact over Q and mod p (other(T) is exact)
  - a touch point outside an arc is not a candidate
- Examples:
  - `tangent_from((5, 5), circle((0, 0), (5, 0)), orient(-))` → line (0, 5) + t·(-5, 0), t ∈ [−∞, ∞], chiral
  - `tangent_from((6, 0), circle((0, 0), (5, 0)), orient(-))` → line (4.16666666667, 2.76385399196) + t·(-2.76385399196, 4.16666666667), t ∈ [−∞, ∞], chiral

### symmedian

symmedian(A, B, C): the symmedian of triangle ABC from A (the median from A reflected in the bisector at A): the line from A to D on BC with BD : DC = AB² : AC²; achiral; exact. The symmedian point is symmedian_point(A, B, C).

- Signatures: `symmedian(point, point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `symmedian(point, point, point)`: arguments 2, 3 in any order (the same value)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
- Examples:
  - `symmedian((0, 0), (4, 0), (1, 3))` → line (0, 0) + t·(28/13, 24/13), t ∈ [−∞, ∞]

## Circles

### circle

circle(O, A): center O through A (anchor A); circle(O, r): center O, radius r (no anchor); circle(A, B, C): the circle through A, B, C (anchor A).

- Signatures: `circle(point, point)`, `circle(point, number)`, `circle(point, point, point)`
- Result: circle
- Exact run (RationalField): can succeed
- Export: constructive (circle)
- Symmetry:
  - `circle(point, point, point)`: arguments 2, 3 in any order (the same value)
  - `circle(point, point, point)`: arguments 1, 2, 3 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - circle(O, O) → Undefined (coincident points)
  - circle(O, r) with r ≤ 0 → Undefined
  - circle(O, r) with r within the band of 0 → Undefined (ambiguous)
  - circle(O, r) mod p: the sign of r is not checked
  - circle(A, B, C) with coincident points → Undefined
  - circle(A, B, C) with collinear points → Undefined (use cline)
- Examples:
  - `circle((1, 2), (4, 6))` → circle center (1, 2), r² = 25, anchor (4, 6)
  - `circle((1, 2), 5/2)` → circle center (1, 2), r² = 25/4
  - `circle((0, 0), (4, 0), (1, 3))` → circle center (2, 1), r² = 5, anchor (0, 0)

### circumcircle

The circle through A, B, C (the same as circle(A, B, C)); anchor A.

- Signatures: `circumcircle(point, point, point)`
- Result: circle
- Exact run (RationalField): can succeed
- Export: constructive (circumcircle)
- Same construction: `circumcircle(…)` is `circle(…)` with the same arguments
- Symmetry:
  - `circumcircle(point, point, point)`: arguments 2, 3 in any order (the same value)
  - `circumcircle(point, point, point)`: arguments 1, 2, 3 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined (use cline)
- Examples:
  - `circumcircle((0, 0), (4, 0), (1, 3))` → circle center (2, 1), r² = 5, anchor (0, 0)

### cline

The circle through A, B, C (anchor A), or the line AB when A, B, C are collinear.

- Signatures: `cline(point, point, point)`
- Result: circle, line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `cline(point, point, point)`: arguments 1, 2, 3 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - coincident points → Undefined
  - collinear points → the line through them
- Examples:
  - `cline((0, 0), (4, 0), (1, 3))` → circle center (2, 1), r² = 5, anchor (0, 0)
  - `cline((0, 0), (1, 1), (3, 3))` → line (0, 0) + t·(1, 1), t ∈ [−∞, ∞]

### diameter_circle

The circle with diameter AB; anchor A.

- Signatures: `diameter_circle(point, point)`
- Result: circle
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `diameter_circle(point, point)`: arguments 1, 2 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - diameter_circle(A, A) → Undefined (coincident points)
- Examples:
  - `diameter_circle((1, 2), (4, 6))` → circle center (5/2, 4), r² = 25/4, anchor (1, 2)

### ninepoint_circle

The nine-point circle of ABC (through the midpoints of the sides); anchor: the midpoint of BC.

- Signatures: `ninepoint_circle(point, point, point)`
- Result: circle
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `ninepoint_circle(point, point, point)`: arguments 2, 3 in any order (the same value)
  - `ninepoint_circle(point, point, point)`: arguments 1, 2, 3 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
- Examples:
  - `ninepoint_circle((0, 0), (4, 0), (1, 3))` → circle center (3/2, 1), r² = 5/4, anchor (5/2, 3/2)

### incircle

The incircle of ABC; anchor: its touch point on BC.

- Signatures: `incircle(point, point, point)`
- Result: circle
- Exact run (RationalField): can succeed
- Export: constructive (incircle)
- Symmetry:
  - `incircle(point, point, point)`: arguments 2, 3 in any order (the same value)
  - `incircle(point, point, point)`: arguments 1, 2, 3 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
  - a side length not rational (over Q) → Inexact
- Examples:
  - `incircle((5, 12), (0, 0), (14, 0))` → circle center (6, 4), r² = 16, anchor (6, 0)
  - `incircle((0, 0), (4, 0), (1, 3))` → circle center (1.45981848652, 1.05217763377), r² = 1.10707777301, anchor (2.20382042638, 1.79617957362)

### excircle

excircle(A, B, C): the excircle opposite A; anchor: its touch point on BC.

- Signatures: `excircle(point, point, point)`
- Result: circle
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `excircle(point, point, point)`: arguments 2, 3 in any order (the same value)
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
  - a side length not rational (over Q) → Inexact
- Examples:
  - `excircle((5, 12), (0, 0), (14, 0))` → circle center (8, -12), r² = 144, anchor (8, 0)
  - `excircle((0, 0), (4, 0), (1, 3))` → circle center (5.70245917364, 4.1101000264), r² = 16.892922227, anchor (2.79617957362, 1.20382042638)

### arc

arc(A, B, C): the arc from A through B to C of the circle through A, B, C (a circle value whose arc runs counter-clockwise; anchor A). Points ON it (intersect, other, on, tangent_point, tangent_from) must lie on the arc; tools that use the whole circle (center, radius, power, tangent, polar, pole, radical_axis, radical_center) use its circle.

- Signatures: `arc(point, point, point)`
- Result: circle
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `arc(point, point, point)`: arguments 1, 3 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - coincident points → Undefined
  - collinear points → Undefined (use segment)
  - the orientation mod p → Inexact
- Examples:
  - `arc((4, 0), (0, 4), (-4, 0))` → circle center (0, 0), r² = 16, arc counter-clockwise from (4, 0) to (-4, 0), anchor (4, 0)
  - `arc((-4, 0), (0, 4), (4, 0))` → circle center (0, 0), r² = 16, arc counter-clockwise from (4, 0) to (-4, 0), anchor (-4, 0)

## Transformations

### reflect

reflect(l): the reflection in the carrier line of l (an anti-similarity); reflect(P): the half turn about P. reflect(X, l) and reflect(X, P) are the images of X.

- Signatures: `reflect(linear)`, `reflect(point)`, `reflect(point, linear)`, `reflect(curve, linear)`, `reflect(polygon, linear)`, `reflect(point, point)`, `reflect(curve, point)`, `reflect(polygon, point)`
- Result: transform, point, line, circle, polygon
- Exact run (RationalField): can succeed
- Export: constructive (reflect)
- Symmetry: none
- Degenerate cases:
  - a line with no direction → Undefined
  - an Undefined mirror → Undefined
  - X on the mirror (X = P for a point) → X itself
- Examples:
  - `reflect(line((0, 0), (1, 1)))` → similarity (anti) z ↦ (0, 1)·z̄ + (0, 0)
  - `reflect((3, 1), line((0, 0), (1, 1)))` → point (1, 3)
  - `reflect((1, 2))` → similarity z ↦ (-1, 0)·z + (2, 4)
  - `reflect((3, 1), (1, 2))` → point (-1, 3)

### rotate

rotate(O, θ): the rotation by θ degrees counter-clockwise about O. rotate(X, O, θ) is the image of X. Exact over Q for multiples of 90°.

- Signatures: `rotate(point, number)`, `rotate(point, point, number)`, `rotate(curve, point, number)`, `rotate(polygon, point, number)`
- Result: transform, point, line, circle, polygon
- Exact run (RationalField): can succeed
- Export: constructive (rotate)
- Symmetry: none
- Degenerate cases:
  - θ a multiple of 360° → the identity
  - θ not a multiple of 90° → Inexact over Q and mod p
  - an Undefined center → Undefined
- Examples:
  - `rotate((0, 0), 90)` → similarity z ↦ (0, 1)·z + (0, 0)
  - `rotate((2, 0), (0, 0), 90)` → point (0, 2)
  - `rotate((1, 0), (0, 0), 60)` → point (0.5, 0.866025403784)

### homothety

homothety(O, k): the homothety with center O and ratio k (negative k allowed). homothety(X, O, k) is the image of X.

- Signatures: `homothety(point, number)`, `homothety(point, point, number)`, `homothety(curve, point, number)`, `homothety(polygon, point, number)`
- Result: transform, point, line, circle, polygon
- Exact run (RationalField): can succeed
- Export: constructive (homothety)
- Symmetry: none
- Degenerate cases:
  - k = 0 → Undefined
  - k = 1 → the identity; k = −1 → the half turn about O
- Examples:
  - `homothety((1, 1), 2)` → similarity z ↦ (2, 0)·z + (-1, -1)
  - `homothety((3, 1), (1, 1), 1/2)` → point (2, 1)
  - `homothety(circle((0, 0), (1, 0)), (2, 0), 3)` → circle center (-4, 0), r² = 9, anchor (-1, 0)

### translate

translate(A, B): the translation taking A to B. translate(X, A, B) is the image of X.

- Signatures: `translate(point, point)`, `translate(point, point, point)`, `translate(curve, point, point)`, `translate(polygon, point, point)`
- Result: transform, point, line, circle, polygon
- Exact run (RationalField): can succeed
- Export: constructive (translate)
- Symmetry: none
- Degenerate cases:
  - A = B → the identity
- Examples:
  - `translate((0, 0), (2, 3))` → similarity z ↦ (1, 0)·z + (2, 3)
  - `translate(line((0, 0), (1, 0)), (0, 0), (2, 3))` → line (2, 3) + t·(1, 0), t ∈ [−∞, ∞]

### spiral

spiral(A, B, C, D): the direct similarity taking A to C and B to D (a spiral similarity, or a translation when B − A = D − C). spiral(X, A, B, C, D) is the image of X.

- Signatures: `spiral(point, point, point, point)`, `spiral(point, point, point, point, point)`, `spiral(curve, point, point, point, point)`, `spiral(polygon, point, point, point, point)`
- Result: transform, point, line, circle, polygon
- Exact run (RationalField): can succeed
- Export: constructive (spiral)
- Symmetry: none
- Degenerate cases:
  - A = B or C = D → Undefined (coincident points)
  - B − A = D − C → a translation
- Examples:
  - `spiral((0, 0), (1, 0), (0, 0), (0, 2))` → similarity z ↦ (0, 2)·z + (0, 0)
  - `spiral((1, 1), (0, 0), (1, 0), (0, 0), (0, 2))` → point (-2, 2)

### compose

compose(T1, T2): the map X ↦ T1(T2(X)) (T2 first). Similarities and Möbius maps (inversions) compose in any combination.

- Signatures: `compose(transform, transform)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: constructive (compose)
- Symmetry: none
- Degenerate cases:
  - scale factors below EPS (10⁻⁵ · 10⁻⁵) → a valid map: a composition never collapses
  - a scale factor beyond the double range (floats) → Inexact
  - compose(T, inverse(T)) → the identity
  - two anti-similarities → a direct similarity
  - two inversions → a direct Möbius map (the same center: a homothety, with no pole)
  - a hand-built Möbius map with ad − bc = 0 → Undefined
- Examples:
  - `compose(reflect(line((0, 0), (1, 0))), reflect(line((0, 0), (0, 1))))` → similarity z ↦ (-1, 0)·z + (0, 0)
  - `compose(inversion((0, 0), 4), inversion((0, 0), 1))` → Möbius map z ↦ ((4, 0)·z + (0, 0)) / ((0, 0)·z + (1, 0))

### inverse

inverse(T): the inverse map (the preimage of Y is apply(inverse(T), Y)).

- Signatures: `inverse(transform)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: constructive (inverse)
- Symmetry: none
- Degenerate cases:
  - a reflection or a half turn → itself
  - a hand-built map with scale factor 0 → Undefined
  - an inversion → itself (its matrix up to a factor)
- Examples:
  - `inverse(homothety((1, 1), 2))` → similarity z ↦ (1/2, 0)·z + (1/2, 1/2)
  - `inverse(inversion((1, 1), 2))` → Möbius map (anti) z ↦ ((-1, -1)·z̄ + (0, 0)) / ((-1, 0)·z̄ + (1, -1))

### apply

apply(T, X): the image of a point, line, segment, ray, circle, arc, polygon, mark or text. Ranges are kept, an anti-similarity reverses arcs, the chirality flag and the anchor of a circle are mapped with it (gliders on an image circle stay exact). Under an inversion lines and circles exchange kinds, segments become arcs or rays, and the center has no image.

- Signatures: `apply(transform, point)`, `apply(transform, curve)`, `apply(transform, polygon)`, `apply(transform, annotation)`
- Result: point, line, circle, polygon, angle_mark, segment_mark, text
- Exact run (RationalField): can succeed
- Export: constructive (apply)
- Symmetry: none
- Degenerate cases:
  - X a number or a transform → Undefined (not imaged)
  - an Undefined T or X → Undefined
  - an anti-similarity reverses arcs; ranges and the chirality flag are kept
  - a circle without an anchor → an image without one
  - an anti-similarity reverses an angle mark (its arms swap)
  - the center of an inversion → Undefined (its image is at infinity)
  - a point within the band of the center → Undefined (ambiguous)
  - a line through the center → that line; a circle through it → a line (chiral)
  - a line off the center → a circle through it; a circle off it → a circle
  - a curve within the band of the center → Undefined (ambiguous)
  - a segment → an arc; a segment with an end at the center → a ray
  - a segment containing the center → the two rays outside
  - an arc through the center → a segment, a ray or two rays
  - a polygon under an inversion → Undefined (its sides become arcs)
  - a segment mark under an inversion → Undefined (lengths are not kept)
  - an angle mark under an inversion → the mark on the tangents (arms swapped)
  - mod p, an arc or a range through an inversion → Inexact (needs an order)
- Examples:
  - `apply(rotate((0, 0), 90), polygon((1, 0), (2, 0), (2, 1)))` → polygon (0, 1) (0, 2) (-1, 2)
  - `apply(reflect(line((0, 0), (1, 0))), circle((1, 2), (1, 3)))` → circle center (1, -2), r² = 1, anchor (1, -3)
  - `apply(inversion((0, 0), 4), line((1, 0), (1, 1)))` → circle center (2, 0), r² = 4, anchor (4, 0)

### inversion

inversion(c): the inversion in the circle c; inversion(O, k): the inversion with center O and power k (k < 0: followed by the half turn about O). An anti Möbius map: apply it with apply(T, X) or a derived layer. Exact for an exact power.

- Signatures: `inversion(round)`, `inversion(point, number)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - k = 0 → Undefined
  - k < 0 → the inversion with power |k| followed by the half turn about O
  - an arc → the inversion in its carrier circle
- Examples:
  - `inversion(circle((1, 1), (3, 1)))` → Möbius map (anti) z ↦ ((1, 1)·z̄ + (2, 0)) / ((1, 0)·z̄ + (-1, 1))
  - `inversion((0, 0), 4)` → Möbius map (anti) z ↦ ((0, 0)·z̄ + (4, 0)) / ((1, 0)·z̄ + (0, 0))

### sqrt_bc

sqrt_bc(A, B, C): the √(bc) inversion of triangle ABC at A, compose(reflect(bisector(B, A, C)), inversion(A, AB·AC)). It swaps B and C and maps the circumcircle to line BC.

- Signatures: `sqrt_bc(point, point, point)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `sqrt_bc(point, point, point)`: arguments 2, 3 in any order (the same value)
- Degenerate cases:
  - A = B or A = C → Undefined
  - collinear A, B, C → still defined (it swaps B and C)
- Examples:
  - `sqrt_bc((0, 0), (3, 4), (5, 0))` → Möbius map z ↦ ((0, 0)·z + (15, 20)) / ((1, 0)·z + (0, 0))

### orthocenter_inversion

orthocenter_inversion(A, B, C): the inversion at the orthocenter H with power HA·HD (D the foot from A; negative in an acute triangle), inversion(H, power(H, circumcircle(A, B, C)) / 2). It swaps each vertex with the foot of its altitude and the circumcircle with the nine-point circle.

- Signatures: `orthocenter_inversion(point, point, point)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `orthocenter_inversion(point, point, point)`: arguments 1, 2, 3 in any order (the same value)
- Degenerate cases:
  - coincident or collinear vertices → Undefined
  - a right angle (H on the circumcircle) → Undefined (power 0)
- Examples:
  - `orthocenter_inversion((0, 0), (4, 0), (1, 3))` → Möbius map (anti) z ↦ ((1, 1)·z̄ + (-4, 0)) / ((1, 0)·z̄ + (-1, 1))

### inversion_fixing

inversion_fixing(O, c): the inversion centered at O that maps c to itself, inversion(O, power(O, c)) (O inside c: a negative power, with the half turn).

- Signatures: `inversion_fixing(point, round)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - O on c → Undefined (power 0)
  - O inside c → a negative power (still fixes c)
- Examples:
  - `inversion_fixing((5, 0), circle((0, 0), (3, 0)))` → Möbius map (anti) z ↦ ((5, 0)·z̄ + (-9, 0)) / ((1, 0)·z̄ + (-5, 0))

### inversion_swap

inversion_swap(O, A, B): the inversion centered at O that swaps A and B, for O on line AB: inversion(O, power(O, diameter_circle(A, B))), power OA·OB (negative when O is between A and B).

- Signatures: `inversion_swap(point, point, point)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `inversion_swap(point, point, point)`: arguments 2, 3 in any order (the same value)
- Degenerate cases:
  - O off line AB → Undefined (no inversion centered at O swaps them)
  - A = B → Undefined
  - O = A or O = B → Undefined (power 0)
- Examples:
  - `inversion_swap((0, 0), (1, 0), (4, 0))` → Möbius map (anti) z ↦ ((0, 0)·z̄ + (4, 0)) / ((1, 0)·z̄ + (0, 0))

### feet_inversion

feet_inversion(A, B, C): the inversion at A with power AB·AC·cos A (the dot product of AB and AC), inversion(A, power(A, diameter_circle(B, C))). It maps B and C to the feet of the altitudes from C and B, the orthocenter to the foot from A, the circumcircle to line EF and line BC to the circle on diameter AH.

- Signatures: `feet_inversion(point, point, point)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `feet_inversion(point, point, point)`: arguments 2, 3 in any order (the same value)
- Degenerate cases:
  - AB⃗·AC⃗ = 0 (a right angle at A, or A = B or A = C) → Undefined
  - B = C → Undefined
  - AB⃗·AC⃗ < 0 (an obtuse angle at A) → the inversion followed by the half turn about A
  - collinear A, B, C → still defined (it swaps B and C)
- Examples:
  - `feet_inversion((0, 0), (4, 0), (1, 3))` → Möbius map (anti) z ↦ ((0, 0)·z̄ + (4, 0)) / ((1, 0)·z̄ + (0, 0))

### sqrt_bc2

sqrt_bc2(A, B, C): the √(bc/2) inversion of triangle ABC at A, compose(reflect(bisector(B, A, C)), inversion(A, AB·AC/2)). It maps B and C to the midpoints of AC and AB, the circumcircle to the midline through them, and is its own inverse.

- Signatures: `sqrt_bc2(point, point, point)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `sqrt_bc2(point, point, point)`: arguments 2, 3 in any order (the same value)
- Degenerate cases:
  - A = B or A = C → Undefined
  - collinear A, B, C → still defined (B goes to the midpoint of AC)
- Examples:
  - `sqrt_bc2((0, 0), (3, 4), (5, 0))` → Möbius map z ↦ ((0, 0)·z + (15/2, 10)) / ((1, 0)·z + (0, 0))

## Measures

### dist

dist(A, B): the length AB; dist(P, l): the distance from P to the line l.

- Signatures: `dist(point, point)`, `dist(point, linear)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `dist(point, point)`: arguments 1, 2 in any order (the same value)
- Degenerate cases:
  - dist(A, A) = 0
  - P on l → 0
  - a segment or ray is extended to its carrier line
- Examples:
  - `dist((0, 0), (3, 4))` → number 5
  - `dist((3, 4), segment((0, 0), (3, 0)))` → number 4

### ratio

ratio(A, B, C, D) = AB / CD.

- Signatures: `ratio(point, point, point, point)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - C = D → Undefined (coincident points)
  - A = B → 0
- Examples:
  - `ratio((0, 0), (3, 4), (0, 0), (3, 0))` → number 5/3

### angle

angle(A, B, C): the undirected angle ABC in degrees, in [0, 180].

- Signatures: `angle(point, point, point)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - A = B or C = B → Undefined
  - collinear: 0° or 180°
  - mod p → Inexact
- Examples:
  - `angle((3, 0), (0, 0), (0, 4))` → number 90
  - `angle((3, 4), (0, 0), (3, 0))` → number 53.1301023542

### dangle

dangle(A, B, C): the directed angle ∡ABC (line BA to line BC, counter-clockwise) mod 180°, in [0, 180).

- Signatures: `dangle(point, point, point)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - A = B or C = B → Undefined
  - collinear → 0
  - within the band of collinear → Undefined (ambiguous)
  - mod p → Inexact
- Examples:
  - `dangle((0, 4), (0, 0), (3, 0))` → number 90
  - `dangle((3, 4), (0, 0), (3, 0))` → number 126.869897646

### area

The (unsigned) area of a polygon, or of the polygon through the given points.

- Signatures: `area(polygon)`, `area(point, point, point, point…)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - collinear vertices → 0
  - mod p → Inexact (unsigned area needs an order)
- Examples:
  - `area((0, 0), (3, 0), (3, 4))` → number 6
  - `area(polygon((0, 0), (3, 0), (3, 4), (0, 4)))` → number 12

### power

power(P, c) = |PO|² − r²: negative inside c, zero on c, positive outside (exact).

- Signatures: `power(point, round)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - P on c → 0
  - P = the center → −r²
- Examples:
  - `power((7, 1), circle((0, 0), (3, 4)))` → number 25

### radius

radius(c) = √r²: exact over Q when r² is the square of a rational.

- Signatures: `radius(round)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - r² not the square of a rational → Inexact over Q (always Inexact mod p)
- Examples:
  - `radius(circle((0, 0), (3, 4)))` → number 5
  - `radius(circle((0, 0), (1, 1)))` → number 1.41421356237

## Display

### polygon

The polygon with the given vertices, in order (at least three).

- Signatures: `polygon(point, point, point, point…)`
- Result: polygon
- Exact run (RationalField): can succeed
- Export: constructive (polygon)
- Symmetry:
  - `polygon(point, point, point, point…)`: the arguments in any rotation or reversal (the same figure; a direction, an anchor or the vertex order may differ)
- Degenerate cases:
  - consecutive coincident vertices → Undefined
  - collinear vertices → a flat polygon
- Examples:
  - `polygon((0, 0), (4, 0), (1, 3))` → polygon (0, 0) (4, 0) (1, 3)

### mark_angle

mark_angle(A, B, C[, n]): n arcs (1–3, default 1) marking the convex angle ABC at B. Stored counter-clockwise; a reflection reverses it.

- Signatures: `mark_angle(point, point, point)`, `mark_angle(point, point, point, number)`
- Result: angle_mark
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - A = B or C = B → Undefined (coincident points)
  - a zero angle (A and C on one ray from B) → Undefined
  - a straight angle → Undefined (its inner side is not determined)
  - an angle within the band of 0° or 180° → Undefined (ambiguous)
  - an arc count that is not an exact 1, 2 or 3 → Undefined
  - mod p → Inexact (the inner side needs an order)
- Examples:
  - `mark_angle((4, 0), (0, 0), (1, 3))` → angle mark (1 arc(s)) at (0, 0) from (4, 0) to (1, 3)
  - `mark_angle((1, 3), (0, 0), (4, 0), 2)` → angle mark (2 arc(s)) at (0, 0) from (4, 0) to (1, 3)

### mark_right

mark_right(A, B, C): the right-angle square at B. Only a right angle (decided with the band) gets the mark; construct the right angle, the mark does not assume it.

- Signatures: `mark_right(point, point, point)`
- Result: angle_mark
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - A = B or C = B → Undefined (coincident points)
  - an angle that is not right → Undefined
  - an angle within the band of 90° → Undefined (ambiguous)
  - mod p → Inexact (the inner side needs an order)
- Examples:
  - `mark_right((3, 0), (0, 0), (0, 2))` → right-angle mark at (0, 0) from (3, 0) to (0, 2)

### mark_segment

mark_segment(A, B[, n]): n ticks (1–3, default 1) across the middle of segment AB.

- Signatures: `mark_segment(point, point)`, `mark_segment(point, point, number)`
- Result: segment_mark
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - A = B → Undefined (coincident points)
  - a tick count that is not an exact 1, 2 or 3 → Undefined
- Examples:
  - `mark_segment((0, 0), (4, 2))` → segment mark (1 tick(s)) (0, 0) – (4, 2)
  - `mark_segment((0, 0), (4, 2), 3)` → segment mark (3 tick(s)) (0, 0) – (4, 2)

### text

text(P, "…"): the string at P (label grammar: A_1, \omega, primes).

- Signatures: `text(point, string)`
- Result: text
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - an empty string → Undefined
- Examples:
  - `text((1, 2), "Let ABC be a triangle")` → text "Let ABC be a triangle" at (1, 2)

## Arithmetic

### add

a + b on numbers (exact when both are exact).

- Signatures: `add(number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: constructive (add)
- Symmetry: none
- Degenerate cases: none
- Examples:
  - `add(2/3, 3/4)` → number 17/12

### sub

a − b on numbers (exact when both are exact).

- Signatures: `sub(number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: constructive (sub)
- Symmetry: none
- Degenerate cases: none
- Examples:
  - `sub(2/3, 3/4)` → number -1/12

### mul

a × b on numbers (exact when both are exact).

- Signatures: `mul(number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: constructive (mul)
- Symmetry: none
- Degenerate cases: none
- Examples:
  - `mul(2/3, 3/4)` → number 1/2

### div

a ÷ b on numbers (exact when both are exact).

- Signatures: `div(number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: constructive (div)
- Symmetry: none
- Degenerate cases:
  - b = 0 → Undefined (division by zero)
- Examples:
  - `div(2/3, 3/4)` → number 8/9

### neg

−a (exact when a is exact).

- Signatures: `neg(number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: constructive (neg)
- Symmetry: none
- Degenerate cases: none
- Examples:
  - `neg(2/3)` → number -2/3

### sqrt

√x, the non-negative square root (exact on squares of rationals).

- Signatures: `sqrt(number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - x ≤ −BAND, or an exact x < 0 → Undefined (sqrt of a negative number)
  - −BAND < x < 0 counts as 0 → 0 (x ≥ 0 → √x: continuous)
  - x not the square of a rational → Inexact (over Q; mod p unless x is an exact square)
- Examples:
  - `sqrt(9/4)` → number 3/2
  - `sqrt(2)` → number 1.41421356237

### sin

sin θ, θ in degrees (exact where rational).

- Signatures: `sin(number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - off the angles where it is rational → Inexact (over Q; mod p unless the angle is exact)
- Examples:
  - `sin(30)` → number 1/2
  - `sin(45)` → number 0.707106781187

### cos

cos θ, θ in degrees (exact where rational).

- Signatures: `cos(number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - off the angles where it is rational → Inexact (over Q; mod p unless the angle is exact)
- Examples:
  - `cos(60)` → number 1/2
  - `cos(45)` → number 0.707106781187

### tan

tan θ, θ in degrees (exact where rational: multiples of 45°).

- Signatures: `tan(number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- Degenerate cases:
  - θ ≡ 90° (mod 180°) → Undefined
  - cos θ within the band of 0 counts as 0 → Undefined
  - tan θ not rational → Inexact (over Q; mod p unless θ is an exact multiple of 45°)
- Examples:
  - `tan(45)` → number 1
  - `tan(30)` → number 0.57735026919
