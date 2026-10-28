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
- By construction: nothing
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
- By construction: nothing
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
- By construction:
  - `midpoint(point, point)`: collinear(result, #1, #2); length(#1, result, result, #2, 1); length(#1, #2, #1, result, 2); length(#1, #2, result, #2, 2)
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
- By construction:
  - `divide(point, point, number)`: collinear(result, #1, #2)
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
- By construction:
  - `foot(point, linear)`: on(result, #2); perpendicular(line(#1, result), #2)
  - `foot(point, point, point)`: collinear(result, #2, #3); perpendicular(line(#1, result), line(#2, #3))
- Degenerate cases:
  - foot(P, A, A) → Undefined (coincident points)
  - P on the line → P
  - a segment or ray is extended to its carrier line
- Examples:
  - `foot((1, 3), line((0, 0), (4, 0)))` → point (1, 0)
  - `foot((1, 3), (0, 0), (2, 2))` → point (2, 2)

### intersect

intersect(a, b, selectors): the common point of two lines, a line and a circle, two circles, or a line and a conic; a curve pair with two candidates needs selectors (along(±) on line ∩ circle and line ∩ conic, orient(±) on circle ∩ circle, other(P), near(P), same_side(Q, l), …).

- Signatures: `intersect(linear, linear)`, `intersect(linear, round)`, `intersect(round, linear)`, `intersect(round, round)`, `intersect(linear, conic)`, `intersect(conic, linear)`
- Result: point, ideal_point
- Exact run (RationalField): can succeed
- Export: constructive (intersect)
- Symmetry:
  - `intersect(linear, linear)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
  - `intersect(linear, round)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
  - `intersect(round, linear)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
  - `intersect(round, round)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
  - `intersect(linear, conic)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
  - `intersect(conic, linear)`: arguments 1, 2 in any order (the same value), and swapping them flips orient(±)
- By construction:
  - `intersect(linear, linear)`: on(result, #1); on(result, #2)
  - `intersect(linear, round)`: on(result, #1); on(result, #2)
  - `intersect(round, linear)`: on(result, #1); on(result, #2)
  - `intersect(round, round)`: on(result, #1); on(result, #2)
  - `intersect(linear, conic)`: on(result, #1); on(result, #2)
  - `intersect(conic, linear)`: on(result, #1); on(result, #2)
- Degenerate cases:
  - parallel lines → their ideal point (the first line's direction and flag)
  - parallel segments or rays → Undefined (no point at infinity is on them)
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
  - line ∩ conic: the line misses the conic → Undefined
  - line ∩ conic: tangency (the gap within the band) → the double point
  - line ∩ conic: an asymptotic direction (α within EPS) → the one finite common point (both along signs)
  - line ∩ conic: an asymptote → Undefined (no finite common point)
  - line ∩ conic: α within the band of an asymptotic direction → Undefined (ambiguous)
  - other(P) on line ∩ conic with an asymptotic direction → Undefined (the other point is at infinity)
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
- By construction:
  - `circumcenter(point, point, point)`: length(result, #1, result, #2, 1); length(result, #2, result, #3, 1); length(result, #1, result, #3, 1); on(result, perp_bisector(#1, #2)); on(result, perp_bisector(#2, #3)); on(result, perp_bisector(#3, #1))
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
- By construction:
  - `centroid(point, point, point)`: collinear(#1, result, midpoint(#2, #3)); collinear(#2, result, midpoint(#3, #1)); collinear(#3, result, midpoint(#1, #2))
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
- By construction:
  - `orthocenter(point, point, point)`: perpendicular(line(#1, result), line(#2, #3)); perpendicular(line(#2, result), line(#3, #1)); perpendicular(line(#3, result), line(#1, #2))
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
- By construction: nothing
- Degenerate cases: none
- Examples:
  - `center(circle((0, 0), (4, 0), (1, 3)))` → point (2, 1)

### on

Gliders: on(l, t) = p + t·d on a line, segment or ray (t clamped to the range); on(c, u, v): the stereographic parameter (u : v) from the anchor of c (rational; (u : 0) is the anchor); on(c, θ): the point at angle θ (degrees) from the center; on(k, u, v) on a conic: the second point of the line through its known point A with direction u·f − v·e (e = −∇Q(A)/2, f = rot90(e)); rational, Undefined at the points at infinity.

- Signatures: `on(linear, number)`, `on(round, number, number)`, `on(round, number)`, `on(conic, number, number)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Same construction: never (a free input: two of them are independent objects)
- By construction:
  - `on(linear, number)`: on(result, #1)
  - `on(round, number, number)`: on(result, #1)
  - `on(round, number)`: on(result, #1)
  - `on(conic, number, number)`: on(result, #1)
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
  - on(k, u, v) on a conic without a known point → Undefined
  - on(k, u, v) at a point at infinity of the conic (an asymptotic direction) → Undefined; within the band: ambiguous
- Examples:
  - `on(segment((0, 0), (4, 2)), 1/4)` → point (1, 1/2)
  - `on(circle((0, 0), (5, 0)), 1, 2)` → point (-3, 4)
  - `on(circle((0, 0), (5, 0)), 90)` → point (0, 5)
  - `on(circle((0, 0), (5, 0)), 30)` → point (4.33012701892, 2.5)

### other

other(a, b, P): the second intersection of a line and a circle, of two circles, or of a line and a conic, given one common point P (Vieta; exact).

- Signatures: `other(linear, round, point)`, `other(round, linear, point)`, `other(round, round, point)`, `other(linear, conic, point)`, `other(conic, linear, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction:
  - `other(linear, round, point)`: on(result, #1); on(result, #2)
  - `other(round, linear, point)`: on(result, #1); on(result, #2)
  - `other(round, round, point)`: on(result, #1); on(result, #2)
  - `other(linear, conic, point)`: on(result, #1); on(result, #2)
  - `other(conic, linear, point)`: on(result, #1); on(result, #2)
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
  - line and conic: an asymptotic direction → Undefined (the other point is at infinity)
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
- By construction:
  - `incenter(point, point, point)`: on(result, bisector(#2, #1, #3)); on(result, bisector(#1, #2, #3)); on(result, bisector(#1, #3, #2))
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
- By construction:
  - `excenter(point, point, point)`: on(result, bisector(#2, #1, #3)); on(result, ext_bisector(#1, #2, #3)); on(result, ext_bisector(#1, #3, #2))
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
- By construction:
  - `ninepoint_center(point, point, point)`: equal(result, midpoint(circumcenter(#1, #2, #3), orthocenter(#1, #2, #3))); collinear(result, circumcenter(#1, #2, #3), orthocenter(#1, #2, #3))
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
- Examples:
  - `ninepoint_center((0, 0), (4, 0), (1, 3))` → point (3/2, 1)

### tangent_point

tangent_point(P, c, selectors): a point where a tangent from P touches a circle or a conic; two candidates (orient(+): cross(O − P, T − P) > 0, O the center, or for a conic the midpoint of the chord of contact), one double point when P is on the curve.

- Signatures: `tangent_point(point, round)`, `tangent_point(point, conic)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction:
  - `tangent_point(point, round)`: on(result, #2); on(result, polar(#1, #2)); perpendicular(line(#1, result), line(center(#2), result))
  - `tangent_point(point, conic)`: on(result, #2); on(result, polar(#1, #2))
- Degenerate cases:
  - P inside c (or P = the center) → Undefined
  - P on c (the gap |OP| − r within the band) → the double point
  - two candidates and no selector → Undefined (ambiguous: add a selector)
  - along(±) → Undefined (use orient(±))
  - other(T) with T not a touch point → Undefined
  - square roots not representable → Inexact over Q and mod p (other(T) is exact)
  - a touch point outside an arc is not a candidate
  - a conic: P its center or no tangent from P (P inside it) → Undefined
  - a conic: P on an asymptote → Undefined (one touch point is at infinity)
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
- By construction: nothing
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
- By construction: nothing
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
- By construction:
  - `symmedian_point(point, point, point)`: on(result, symmedian(#1, #2, #3)); on(result, symmedian(#2, #3, #1)); on(result, symmedian(#3, #1, #2))
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
- Examples:
  - `symmedian_point((0, 0), (4, 0), (1, 3))` → point (14/11, 12/11)

### pole

pole(l, c): the pole of the line l with respect to a circle or a conic, the point whose polar is l (the inverse of polar); exact. A line through the center (a parabola: parallel to its axis) has its pole at infinity.

- Signatures: `pole(linear, round)`, `pole(linear, conic)`
- Result: point, ideal_point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction:
  - `pole(linear, round)`: perpendicular(line(center(#2), result), #1)
- Degenerate cases:
  - l through the center → the point at infinity perpendicular to l
  - l tangent to c → the touch point
  - a segment or ray is extended to its carrier line
  - a conic: l through its center (a parabola: l parallel to its axis) → the point at infinity of the pole
  - a conic within the band of a parabola → Undefined (ambiguous)
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
- By construction:
  - `radical_center(round, round, round)`: on(result, radical_axis(#1, #2)); on(result, radical_axis(#2, #3)); on(result, radical_axis(#1, #3))
- Degenerate cases:
  - two concentric circles → Undefined
  - collinear centers → Undefined (parallel radical axes)
  - coaxal circles → Undefined (the radical axes coincide)
- Examples:
  - `radical_center(circle((0, 0), 2), circle((6, 0), 3), circle((2, 5), 1))` → point (31/12, 13/6)

### harmonic_conjugate

harmonic_conjugate(A, B, C): the point D of line AB with (A, B; C, D) = −1 (C on AB; the midpoint gives the point at infinity of AB). harmonic_conjugate(a, b, c): the line d through the common point of the concurrent lines a, b, c with (a, b; c, d) = −1. Exact.

- Signatures: `harmonic_conjugate(point, point, ppoint)`, `harmonic_conjugate(linear, linear, linear)`
- Result: point, ideal_point, line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `harmonic_conjugate(point, point, ppoint)`: arguments 1, 2 in any order (the same value)
  - `harmonic_conjugate(linear, linear, linear)`: arguments 1, 2 in any order (the same value)
- By construction:
  - `harmonic_conjugate(point, point, ppoint)`: harmonic(#1, #2, #3, result); collinear(#1, #2, result)
  - `harmonic_conjugate(linear, linear, linear)`: harmonic_lines(#1, #2, #3, result)
- Degenerate cases:
  - A = B → Undefined
  - C not on line AB → Undefined (within the band: ambiguous)
  - C = A or C = B → Undefined
  - C the midpoint of AB → the point at infinity of AB
  - C the point at infinity of AB → the midpoint; of another direction → Undefined
  - lines: two of a, b, c the same line → Undefined
  - lines: a, b, c not concurrent → Undefined
  - lines: a parallel pencil → the parallel line; c midway → Undefined (the line at infinity)
- Examples:
  - `harmonic_conjugate((0, 0), (6, 0), (2, 0))` → point (-6, 0)
  - `harmonic_conjugate((0, 0), (6, 0), (3, 0))` → point at infinity, direction (6, 0)
  - `harmonic_conjugate(line((0, 0), (1, 0)), line((0, 0), (0, 1)), line((0, 0), (1, 1)))` → line (0, 0) + t·(1, -1), t ∈ [−∞, ∞], chiral

### conic_center

conic_center(k): the center of a conic, the pole of the line at infinity; a parabola's center is the point at infinity of its axis; exact.

- Signatures: `conic_center(conic)`
- Result: point, ideal_point
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction: nothing
- Degenerate cases:
  - a parabola → the point at infinity of its axis
  - a conic within the band of a parabola → Undefined (ambiguous)
- Examples:
  - `conic_center(conic((1, 1), (2, 1/2), (-1, -1), (4, 1/4), (1/2, 2)))` → point (0, 0)
  - `conic_center(conic((2, 0), (0, 1), (-2, 0), (0, -1), (6/5, 4/5)))` → point (0, 0)

## Lines

### line

The line through A and B (achiral direction B − A); through a point and a point at infinity, the parallel with its direction.

- Signatures: `line(point, point)`, `line(ppoint, ppoint)`
- Result: line
- Exact run (RationalField): can succeed
- Export: constructive (line)
- Symmetry:
  - `line(point, point)`: arguments 1, 2 in any order (the same figure; a direction, an anchor or the vertex order may differ)
  - `line(ppoint, ppoint)`: arguments 1, 2 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- By construction:
  - `line(point, point)`: on(#1, result); on(#2, result)
  - `line(ppoint, ppoint)`: on(#1, result); on(#2, result)
- Degenerate cases:
  - line(A, A) → Undefined (coincident points)
  - line(P, X) with X a point at infinity → the parallel through P (X's direction and flag)
  - line(X, Y) of two points at infinity → Undefined (the line at infinity is not an object)
- Examples:
  - `line((0, 0), (2, 1))` → line (0, 0) + t·(2, 1), t ∈ [−∞, ∞]
  - `line((0, 2), intersect(line((0, 0), (2, 1)), line((0, 1), (2, 2))))` → line (0, 2) + t·(2, 1), t ∈ [−∞, ∞]

### segment

The segment AB: A + t·(B − A) for t in [0, 1].

- Signatures: `segment(point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: constructive (segment)
- Symmetry:
  - `segment(point, point)`: arguments 1, 2 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- By construction:
  - `segment(point, point)`: on(#1, result); on(#2, result)
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
- By construction:
  - `ray(point, point)`: on(#1, result); on(#2, result)
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
- By construction:
  - `parallel(point, linear)`: on(#1, result); parallel(result, #2)
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
- By construction:
  - `perp(point, linear)`: on(#1, result); perpendicular(result, #2)
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
- By construction:
  - `perp_bisector(point, point)`: perpendicular(result, line(#1, #2)); on(midpoint(#1, #2), result)
- Degenerate cases:
  - perp_bisector(A, A) → Undefined (coincident points)
- Examples:
  - `perp_bisector((0, 0), (2, 1))` → line (1, 1/2) + t·(-1, 2), t ∈ [−∞, ∞], chiral

### tangent

tangent(P, c): the tangent to c at P (P on c); chiral (a quarter turn of P − O). tangent(P, k) on a conic: the tangent at P, direction a quarter turn of −∇Q(P).

- Signatures: `tangent(point, round)`, `tangent(point, conic)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction:
  - `tangent(point, round)`: on(#1, result); tangent(result, #2); perpendicular(result, line(center(#2), #1))
  - `tangent(point, conic)`: on(#1, result); tangent(result, #2)
- Degenerate cases:
  - P not on c → Undefined
  - P within the band of c → Undefined (ambiguous)
  - a conic: P not on k (the gap Q/|∇Q| as a length) → Undefined; within the band → ambiguous
- Examples:
  - `tangent((3, 4), circle((0, 0), (5, 0)))` → line (3, 4) + t·(-4, 3), t ∈ [−∞, ∞], chiral

### polar

polar(P, c): the polar of P with respect to c; chiral (a quarter turn of P − O). polar(P, k) for a conic: the line g(P)·X + h = 0, (g, h) = M·(P, 1).

- Signatures: `polar(point, round)`, `polar(point, conic)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction:
  - `polar(point, round)`: perpendicular(result, line(center(#2), #1))
- Degenerate cases:
  - P = the center → Undefined
  - P on c → the tangent at P
  - a conic: P = its center (g(P) = 0 as a length) → Undefined; P on k → the tangent at P
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
- By construction:
  - `radical_axis(round, round)`: perpendicular(result, line(center(#1), center(#2)))
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
- By construction:
  - `bisector(point, point, point)`: on(#2, result)
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
- By construction:
  - `ext_bisector(point, point, point)`: on(#2, result); perpendicular(result, bisector(#1, #2, #3))
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

tangent_from(P, c, selectors): a tangent from P to a circle or a conic, the line through its touch point T with direction rot90(T − O) (a conic: a quarter turn of −∇Q(T)) (chiral); selectors judge T.

- Signatures: `tangent_from(point, round)`, `tangent_from(point, conic)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction:
  - `tangent_from(point, round)`: on(#1, result); tangent(result, #2)
  - `tangent_from(point, conic)`: on(#1, result); tangent(result, #2)
- Degenerate cases:
  - P inside c (or P = the center) → Undefined
  - P on c (the gap |OP| − r within the band) → the double point
  - two candidates and no selector → Undefined (ambiguous: add a selector)
  - along(±) → Undefined (use orient(±))
  - other(T) with T not a touch point → Undefined
  - square roots not representable → Inexact over Q and mod p (other(T) is exact)
  - a touch point outside an arc is not a candidate
  - a conic: P its center or no tangent from P (P inside it) → Undefined
  - a conic: P on an asymptote → Undefined (one touch point is at infinity)
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
- By construction:
  - `symmedian(point, point, point)`: on(#1, result)
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
- By construction:
  - `circle(point, point)`: on(#2, result); equal(center(result), #1)
  - `circle(point, number)`: equal(center(result), #1)
  - `circle(point, point, point)`: on(#1, result); on(#2, result); on(#3, result); equal(center(result), circumcenter(#1, #2, #3))
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
- By construction:
  - `circumcircle(point, point, point)`: on(#1, result); on(#2, result); on(#3, result); equal(center(result), circumcenter(#1, #2, #3))
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
- By construction:
  - `cline(point, point, point)`: on(#1, result); on(#2, result); on(#3, result)
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
- By construction:
  - `diameter_circle(point, point)`: on(#1, result); on(#2, result); equal(center(result), midpoint(#1, #2))
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
- By construction:
  - `ninepoint_circle(point, point, point)`: on(midpoint(#2, #3), result); on(midpoint(#3, #1), result); on(midpoint(#1, #2), result); equal(center(result), ninepoint_center(#1, #2, #3))
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
- By construction:
  - `incircle(point, point, point)`: tangent(result, line(#1, #2)); tangent(result, line(#2, #3)); tangent(result, line(#3, #1)); equal(center(result), incenter(#1, #2, #3))
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
- By construction:
  - `excircle(point, point, point)`: tangent(result, line(#1, #2)); tangent(result, line(#2, #3)); tangent(result, line(#3, #1)); equal(center(result), excenter(#1, #2, #3))
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
- By construction:
  - `arc(point, point, point)`: on(#1, result); on(#2, result); on(#3, result)
- Degenerate cases:
  - coincident points → Undefined
  - collinear points → Undefined (use segment)
  - the orientation mod p → Inexact
- Examples:
  - `arc((4, 0), (0, 4), (-4, 0))` → circle center (0, 0), r² = 16, arc counter-clockwise from (4, 0) to (-4, 0), anchor (4, 0)
  - `arc((-4, 0), (0, 4), (4, 0))` → circle center (0, 0), r² = 16, arc counter-clockwise from (4, 0) to (-4, 0), anchor (-4, 0)

### conic

conic(A, B, C, D, E): the conic through five points (no three collinear), in the normal form det M = a² + 2b² + c² of Q = ax² + 2bxy + cy² + 2dx + 2ey + f; its known point (for gliders) is A; exact.

- Signatures: `conic(point, point, point, point, point)`
- Result: conic
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `conic(point, point, point, point, point)`: arguments 2, 3, 4, 5 in any order (the same value)
  - `conic(point, point, point, point, point)`: arguments 1, 2, 3, 4, 5 in any order (the same figure; a direction, an anchor or the vertex order may differ)
- By construction:
  - `conic(point, point, point, point, point)`: on(#1, result); on(#2, result); on(#3, result); on(#4, result); on(#5, result)
- Degenerate cases:
  - two coincident points → Undefined
  - four collinear points → Undefined (no unique conic)
  - three collinear points → Undefined (a pair of lines)
  - a conic within the band of a pair of lines → Undefined (ambiguous)
- Examples:
  - `conic((1, 1), (2, 1/2), (-1, -1), (4, 1/4), (1/2, 2))` → conic (a, b, c, d, e, f) = (0, 1, 0, 0, 0, -2), anchor (1, 1)
  - `conic((2, 0), (0, 1), (-2, 0), (0, -1), (6/5, 4/5))` → conic (a, b, c, d, e, f) = (-17/16, 0, -17/4, 0, 0, 17/4), anchor (2, 0)

## Transformations

### reflect

reflect(l): the reflection in the carrier line of l (an anti-similarity); reflect(P): the half turn about P. reflect(X, l) and reflect(X, P) are the images of X.

- Signatures: `reflect(linear)`, `reflect(point)`, `reflect(point, linear)`, `reflect(curve, linear)`, `reflect(polygon, linear)`, `reflect(point, point)`, `reflect(curve, point)`, `reflect(polygon, point)`
- Result: transform, point, line, circle, polygon
- Exact run (RationalField): can succeed
- Export: constructive (reflect)
- Symmetry: none
- By construction:
  - `reflect(point, linear)`: perpendicular(line(#1, result), #2); on(midpoint(#1, result), #2)
  - `reflect(point, point)`: collinear(#1, #2, result); length(#1, #2, #2, result, 1)
- As a map:
  - `reflect(linear)`: anti-similarity; an involution; ratio 1; fixes every point of #1; takes #1 onto itself
  - `reflect(point)`: similarity; an involution; ratio 1; turn 0°; fixes #1; signed ratio -1
  - `reflect(point, linear)`: the image of #1 under reflect(#2)
  - `reflect(curve, linear)`: the image of #1 under reflect(#2)
  - `reflect(polygon, linear)`: the image of #1 under reflect(#2)
  - `reflect(point, point)`: the image of #1 under reflect(#2)
  - `reflect(curve, point)`: the image of #1 under reflect(#2)
  - `reflect(polygon, point)`: the image of #1 under reflect(#2)
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
- By construction:
  - `rotate(point, point, number)`: length(#2, #1, #2, result, 1)
- As a map:
  - `rotate(point, number)`: similarity; ratio 1; turn #2°; fixes #1
  - `rotate(point, point, number)`: the image of #1 under rotate(#2, #3)
  - `rotate(curve, point, number)`: the image of #1 under rotate(#2, #3)
  - `rotate(polygon, point, number)`: the image of #1 under rotate(#2, #3)
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
- By construction:
  - `homothety(point, point, number)`: collinear(#2, #1, result)
- As a map:
  - `homothety(point, number)`: similarity; ratio #2; turn 0°; fixes #1; signed ratio #2
  - `homothety(point, point, number)`: the image of #1 under homothety(#2, #3)
  - `homothety(curve, point, number)`: the image of #1 under homothety(#2, #3)
  - `homothety(polygon, point, number)`: the image of #1 under homothety(#2, #3)
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
- By construction:
  - `translate(point, point, point)`: length(#1, result, #2, #3, 1); parallel(line(#1, result), line(#2, #3))
- As a map:
  - `translate(point, point)`: similarity; ratio 1; turn 0°; #1 ↦ #2
  - `translate(point, point, point)`: the image of #1 under translate(#2, #3)
  - `translate(curve, point, point)`: the image of #1 under translate(#2, #3)
  - `translate(polygon, point, point)`: the image of #1 under translate(#2, #3)
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
- By construction: nothing
- As a map:
  - `spiral(point, point, point, point)`: similarity; #1 ↦ #3; #2 ↦ #4
  - `spiral(point, point, point, point, point)`: the image of #1 under spiral(#2, #3, #4, #5)
  - `spiral(curve, point, point, point, point)`: the image of #1 under spiral(#2, #3, #4, #5)
  - `spiral(polygon, point, point, point, point)`: the image of #1 under spiral(#2, #3, #4, #5)
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
- By construction: nothing
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
- By construction: nothing
- Degenerate cases:
  - a reflection or a half turn → itself
  - a hand-built map with scale factor 0 → Undefined
  - an inversion → itself (its matrix up to a factor)
- Examples:
  - `inverse(homothety((1, 1), 2))` → similarity z ↦ (1/2, 0)·z + (1/2, 1/2)
  - `inverse(inversion((1, 1), 2))` → Möbius map (anti) z ↦ ((-1, -1)·z̄ + (0, 0)) / ((-1, 0)·z̄ + (1, -1))

### apply

apply(T, X): the image of a point, line, segment, ray, circle, arc, polygon, mark or text. Ranges are kept, an anti-similarity reverses arcs, the chirality flag and the anchor of a circle are mapped with it (gliders on an image circle stay exact). Under an inversion lines and circles exchange kinds, segments become arcs or rays, and the center has no image.

- Signatures: `apply(transform, point)`, `apply(transform, curve)`, `apply(transform, polygon)`, `apply(transform, annotation)`, `apply(transform, ideal)`, `apply(transform, conic)`
- Result: point, line, circle, polygon, angle_mark, segment_mark, text, ideal_point, conic
- Exact run (RationalField): can succeed
- Export: constructive (apply)
- Symmetry: none
- By construction: nothing
- As a map:
  - `apply(transform, point)`: the image of #2 under #1
  - `apply(transform, curve)`: the image of #2 under #1
  - `apply(transform, polygon)`: the image of #2 under #1
  - `apply(transform, annotation)`: the image of #2 under #1
  - `apply(transform, ideal)`: the image of #2 under #1
  - `apply(transform, conic)`: the image of #2 under #1
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
  - a point at infinity under a similarity → the point at infinity of the mapped direction
  - a point at infinity under a Möbius map with a pole → Undefined
  - under a projective map: a point on the line sent to infinity → a point at infinity
  - under a projective map: a point at infinity off its direction → a point
  - under a projective map: a segment crossing the line sent to infinity → two rays
  - under a projective map: the line sent to infinity → Undefined
  - under a projective map: a circle → a conic (never a circle); an arc → Undefined
  - a conic under a similarity or a projective map → a conic (its known point mapped, dropped at infinity)
  - a conic under a Möbius map with a pole → Undefined (a curve of degree 3 or 4)
  - under a projective map: a polygon with a side through infinity → Undefined
  - under a projective map: a segment mark → Undefined; an angle mark → not right
  - under a projective map: a position within the band of the line sent to infinity → Undefined (ambiguous)
  - mod p, a range through a projective map → Inexact (needs an order)
  - a composite of a Möbius map and a projective map → each map in turn
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
- By construction: nothing
- As a map:
  - `inversion(round)`: inversion; an involution; fixes every point of #1; takes #1 onto itself; centre center(#1)
  - `inversion(point, number)`: inversion; an involution; centre #1
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
- By construction: nothing
- As a map:
  - `sqrt_bc(point, point, point)`: moebius; an involution; #2 ↦ #3; #3 ↦ #2; circumcircle(#1, #2, #3) ↦ line(#2, #3); line(#2, #3) ↦ circumcircle(#1, #2, #3)
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
- By construction: nothing
- As a map:
  - `orthocenter_inversion(point, point, point)`: inversion; an involution; centre orthocenter(#1, #2, #3); #1 ↦ foot(#1, #2, #3); foot(#1, #2, #3) ↦ #1; #2 ↦ foot(#2, #3, #1); foot(#2, #3, #1) ↦ #2; #3 ↦ foot(#3, #1, #2); foot(#3, #1, #2) ↦ #3; circumcircle(#1, #2, #3) ↦ ninepoint_circle(#1, #2, #3); ninepoint_circle(#1, #2, #3) ↦ circumcircle(#1, #2, #3)
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
- By construction: nothing
- As a map:
  - `inversion_fixing(point, round)`: inversion; an involution; takes #2 onto itself; centre #1
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
- By construction: nothing
- As a map:
  - `inversion_swap(point, point, point)`: inversion; an involution; centre #1; #2 ↦ #3; #3 ↦ #2
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
- By construction: nothing
- As a map:
  - `feet_inversion(point, point, point)`: inversion; an involution; centre #1; #2 ↦ foot(#3, #1, #2); foot(#3, #1, #2) ↦ #2; #3 ↦ foot(#2, #1, #3); foot(#2, #1, #3) ↦ #3
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
- By construction: nothing
- As a map:
  - `sqrt_bc2(point, point, point)`: moebius; an involution; #2 ↦ midpoint(#1, #3); midpoint(#1, #3) ↦ #2; #3 ↦ midpoint(#1, #2); midpoint(#1, #2) ↦ #3
- Degenerate cases:
  - A = B or A = C → Undefined
  - collinear A, B, C → still defined (B goes to the midpoint of AC)
- Examples:
  - `sqrt_bc2((0, 0), (3, 4), (5, 0))` → Möbius map z ↦ ((0, 0)·z + (15/2, 10)) / ((1, 0)·z + (0, 0))

### projective

projective(A, B, C, D, A', B', C', D'): the projective map taking A to A', B to B', C to C' and D to D' (points, or points at infinity); no three of A, B, C, D (nor of A', B', C', D') collinear. Apply it with apply(T, X) or a derived layer. Exact.

- Signatures: `projective(ppoint, ppoint, ppoint, ppoint, ppoint, ppoint, ppoint, ppoint)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction: nothing
- As a map:
  - `projective(ppoint, ppoint, ppoint, ppoint, ppoint, ppoint, ppoint, ppoint)`: projective; #1 ↦ #5; #2 ↦ #6; #3 ↦ #7; #4 ↦ #8
- Degenerate cases:
  - three of A, B, C, D collinear (or coincident) → Undefined
  - three of A', B', C', D' collinear (or coincident) → Undefined
  - points at infinity among the eight → the map through them
- Examples:
  - `projective((0, 0), (4, 0), (4, 4), (0, 4), (0, 0), (4, 0), (3, 2), (1, 2))` → projective map [-16384, -8192, 0; 0, -16384, 0; 0, -4096, -16384]

### send_to_infinity

send_to_infinity(l): the projective map that swaps line l and the line at infinity: in the frame X = p + t·d + s·rot90(d) of l = p + t·d, X ↦ p + (t/s)·d + (1/s)·rot90(d). It is its own inverse; points of l go to infinity, points at infinity to l. Use it as `@layer inf = image(f, main)` with f = send_to_infinity(l). Exact.

- Signatures: `send_to_infinity(linear)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction: nothing
- As a map:
  - `send_to_infinity(linear)`: projective; an involution; takes the line at infinity onto #1
- Degenerate cases:
  - a line without direction → Undefined
  - a segment or ray → the map of its carrier line
  - l itself → Undefined under the map (sent to infinity)
  - applied twice → the identity (an involution)
- Examples:
  - `send_to_infinity(line((0, 0), (4, 0)))` → projective map [16, 0, 0; 0, 0, 64; 0, 4, 0]

### conic_to_circle

conic_to_circle(k): a projective map sending the conic k to a circle. It fixes the known point A of k and the tangent there; the image is the circle tangent to k at A with center A + 2g/|g|² and radius 2/|g| (g = ∇Q(A)/2, normal form); for a circle it is the identity. Use it as `@layer c = image(f, main)` with f = conic_to_circle(k). Exact.

- Signatures: `conic_to_circle(conic)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction: nothing
- As a map:
  - `conic_to_circle(conic)`: projective
- Degenerate cases:
  - a conic without a known point → Undefined
  - a circle as a conic → the identity
- Examples:
  - `conic_to_circle(conic((2, 0), (0, 1), (-2, 0), (0, -1), (6/5, 4/5)))` → projective map [-13/289, 0, -42/289; 0, -64/289, 0; 3/34, 0, -5/17]

### circle_to_centre

circle_to_centre(c, P): the projective map keeping the circle c and sending the point P inside it to its center (the hyperbolic translation along OP of the Klein model). It needs √(r²(r² − |OP|²)): exact over Q only when that is rational.

- Signatures: `circle_to_centre(round, point)`
- Result: transform
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry: none
- By construction: nothing
- As a map:
  - `circle_to_centre(round, point)`: projective; takes #1 onto itself; #2 ↦ center(#1)
- Degenerate cases:
  - P on c → Undefined
  - P within the band of c → Undefined (ambiguous)
  - P outside c → Undefined
  - P = the center → the identity
  - the square root not representable → Inexact over Q and mod p
- Examples:
  - `circle_to_centre(circle((0, 0), (5, 0)), (3, 0))` → projective map [25, 0, -75; 0, 20, 0; -3, 0, 25]
  - `circle_to_centre(circle((0, 0), (5, 0)), (1, 2))` → projective map [22.88854382, 1.05572809, -25; 1.05572809, 24.472135955, -50; -1, -2, 25]

## Measures

### dist

dist(A, B): the length AB; dist(P, l): the distance from P to the line l.

- Signatures: `dist(point, point)`, `dist(point, linear)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Symmetry:
  - `dist(point, point)`: arguments 1, 2 in any order (the same value)
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
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
- By construction: nothing
- Degenerate cases:
  - θ ≡ 90° (mod 180°) → Undefined
  - cos θ within the band of 0 counts as 0 → Undefined
  - tan θ not rational → Inexact (over Q; mod p unless θ is an exact multiple of 45°)
- Examples:
  - `tan(45)` → number 1
  - `tan(30)` → number 0.57735026919
