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
- Degenerate cases: none
- Examples:
  - `point(1, -2/3)` → point (1, -2/3)

### param

param(min, max, v): a free number v in [min, max] (a slider).

- Signatures: `param(number, number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
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
- Export: numeric
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
- Degenerate cases:
  - divide(A, A, t) = A
- Examples:
  - `divide((0, 0), (3, 6), 1/3)` → point (1, 2)

### foot

foot(P, l) or foot(P, A, B): the orthogonal projection of P on the line.

- Signatures: `foot(point, linear)`, `foot(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases:
  - foot(P, A, A) → Undefined (coincident points)
  - P on the line → P
  - a segment or ray is extended to its carrier line
- Examples:
  - `foot((1, 3), line((0, 0), (4, 0)))` → point (1, 0)
  - `foot((1, 3), (0, 0), (2, 2))` → point (2, 2)

### intersect

The intersection point of two lines, segments or rays (on both ranges).

- Signatures: `intersect(linear, linear)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases:
  - parallel lines → Undefined
  - coincident lines → Undefined
  - the intersection outside a segment or ray → Undefined
  - the intersection within the band of a segment end → Undefined (ambiguous)
  - a segment or ray range mod p → Inexact
- Examples:
  - `intersect(line((0, 0), (2, 2)), segment((0, 2), (2, 0)))` → point (1, 1)

### circumcenter

The centre of the circle through A, B, C.

- Signatures: `circumcenter(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
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
- Export: numeric
- Degenerate cases:
  - collinear or coincident vertices → the mean of the vertices
- Examples:
  - `centroid((0, 0), (4, 0), (1, 3))` → point (5/3, 1)

### orthocenter

The orthocenter, where the altitudes meet.

- Signatures: `orthocenter(point, point, point)`
- Result: point
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases:
  - coincident vertices → Undefined
  - collinear vertices → Undefined
- Examples:
  - `orthocenter((0, 0), (4, 0), (1, 3))` → point (1, 1)

## Lines

### line

The line through A and B (achiral direction B − A).

- Signatures: `line(point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases:
  - line(A, A) → Undefined (coincident points)
- Examples:
  - `line((0, 0), (2, 1))` → line (0, 0) + t·(2, 1), t ∈ [−∞, ∞]

### segment

The segment AB: A + t·(B − A) for t in [0, 1].

- Signatures: `segment(point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases:
  - segment(A, A) → Undefined (coincident points)
- Examples:
  - `segment((0, 0), (2, 1))` → line (0, 0) + t·(2, 1), t ∈ [0, 1]

### ray

The ray from A through B: A + t·(B − A) for t ≥ 0.

- Signatures: `ray(point, point)`
- Result: line
- Exact run (RationalField): can succeed
- Export: numeric
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
- Degenerate cases:
  - perp_bisector(A, A) → Undefined (coincident points)
- Examples:
  - `perp_bisector((0, 0), (2, 1))` → line (1, 1/2) + t·(-1, 2), t ∈ [−∞, ∞], chiral

## Measures

### dist

dist(A, B): the length AB; dist(P, l): the distance from P to the line l.

- Signatures: `dist(point, point)`, `dist(point, linear)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
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
- Degenerate cases:
  - collinear vertices → 0
  - mod p → Inexact (unsigned area needs an order)
- Examples:
  - `area((0, 0), (3, 0), (3, 4))` → number 6
  - `area(polygon((0, 0), (3, 0), (3, 4), (0, 4)))` → number 12

## Display

### polygon

The polygon with the given vertices, in order (at least three).

- Signatures: `polygon(point, point, point, point…)`
- Result: polygon
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases:
  - consecutive coincident vertices → Undefined
  - collinear vertices → a flat polygon
- Examples:
  - `polygon((0, 0), (4, 0), (1, 3))` → polygon (0, 0) (4, 0) (1, 3)

## Arithmetic

### add

a + b on numbers (exact when both are exact).

- Signatures: `add(number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases: none
- Examples:
  - `add(2/3, 3/4)` → number 17/12

### sub

a − b on numbers (exact when both are exact).

- Signatures: `sub(number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases: none
- Examples:
  - `sub(2/3, 3/4)` → number -1/12

### mul

a × b on numbers (exact when both are exact).

- Signatures: `mul(number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases: none
- Examples:
  - `mul(2/3, 3/4)` → number 1/2

### div

a ÷ b on numbers (exact when both are exact).

- Signatures: `div(number, number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases:
  - b = 0 → Undefined (division by zero)
- Examples:
  - `div(2/3, 3/4)` → number 8/9

### neg

−a (exact when a is exact).

- Signatures: `neg(number)`
- Result: number
- Exact run (RationalField): can succeed
- Export: numeric
- Degenerate cases: none
- Examples:
  - `neg(2/3)` → number -2/3
