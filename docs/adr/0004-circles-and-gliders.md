# ADR-0004: Circles, gliders and incidence (Run 3a)

Status: accepted (Run 3a). Extends ADR-0003 (items 10, 11, 18, 19); supersedes nothing.

## Context

Run 3a builds the circle values and tools of SPEC §4 and §6.2 (circle, circumcircle, cline,
diameter_circle, ninepoint_circle, center, tangent, polar, radical_axis, other, incenter,
excenter, incircle, excircle, bisector, ext_bisector) and the gliders `on(…)`, with no
branch selectors (a later run). SPEC fixes the values, the anchors and the degenerate cases
of §6.3, but leaves open how an incidence ("P on c") is decided, the exact glider formulas
and their edge cases, how explicit radii enter the scale, and several flags. Every choice
below is recorded so later runs can rely on it or change it by ADR.

## Decision

### Incidence (packages/kernel/src/incidence.ts)

1. **"P lies on c / on l" is a banded decision** with num's `sign3` (ADR-0002) on the gap
   measured as a LENGTH: for a circle |P − O| − r = (d² − r²)/(d + r), for a line the
   distance cross(P − p, d)/|d|. A gap within EPS·scale is "on"; inside the band (EPS·scale <
   |gap| < BAND·scale) is Undefined("ambiguous: within the band of incidence (…)"); larger
   is Undefined("… needs P on …"). In exact fields the raw d² − r² / cross is tested exactly.
   SPEC §7 says "P must lie on both objects within BAND"; this reading never decides
   silently inside the band (both readings make an off-object P Undefined; they differ only
   in the reason given inside the band).
2. `tangent(P, c)` and `other(a, b, P)` use it. For `other` with a segment or ray, P must
   lie on the CARRIER line; the range applies to the other point (as ADR-0003 item 15 for
   intersect: outside → Undefined, within the band of an end → ambiguous, mod p → Inexact).

### other(a, b, P) (packages/kernel/src/tools/other.ts)

3. Line and circle: the chord's midpoint is the foot F of the centre, so the other point is
   2F − P (Vieta, no square root). Two circles: the reflection of P in the line of
   centres. Tangency gives the double point P with no special case. Signatures are
   (linear, round, point), (round, linear, point), (round, round, point): two lines have no
   "other" intersection and are rejected by capability.

### Gliders (packages/kernel/src/glider.ts, tools/on.ts)

4. **Stereographic parameter** from the anchor A of a circle (centre O, e = A − O,
   f = rot90(e)): X(u : v) = O + ((u² − v²)·e + 2uv·f)/(u² + v²). It is rational and
   homogeneous of degree 0; X(u : 0) = A; X lies on the line through A with direction
   u·f − v·e. Inverse (exact, for points on the circle): with cos = (X − O)·e/r²,
   sin = (X − O)·f/r², (u : v) = (1 + cos : sin), or (sin : 1 − cos) when cos < 0 (the
   same ratio, better conditioned near the antipode; mod p the branch is chosen by an
   exact zero test of 1 + cos).
5. **(0 : 0)**: u and v both zero as dimensionless quantities (EPS) → Undefined. So
   u² + v² ≥ EPS² never underflows; mod p, p = 2^61 − 1 ≡ 3 (mod 4), so u² + v² ≡ 0 only
   for u ≡ v ≡ 0.
6. **Line gliders** `on(l, t)` = p + t·d with t clamped to [lo, hi]. Clamping is continuous,
   so it has no band case. Mod p a bounded range is Inexact (no order), as ADR-0003's
   consequences require ("the mod-p rung can never silently ignore a range"); a full line
   is exact mod p.
7. **Angle gliders** `on(c, θ)` (degrees from the +x axis about the centre) are accepted on
   every circle, not only circle(O, r): they need √r² and cos/sin, so they are Inexact
   over Q except at rational special values, and always mod p. `on(c, u, v)` on a circle
   without an anchor is Undefined with a hint to use the angle.
8. The **drag map** `dragParameter` projects the cursor (on a line: orthogonally, then
   clamps; on a circle: radially, which needs square roots, Inexact over Q unless they are
   rational) and returns the parameter; a cursor at the centre is Undefined.
   `gliderParameter` is its exact counterpart for points ON the object (round trips).
   Both are exported from the new subpath `@geomira/kernel/glider` for the editor run.
9. `on(obj)` without a parameter (SPEC §6.2 `on(obj[, param])`) is not a kernel signature:
   the language run will desugar it to an explicit default parameter, so a document always
   stores its free state (SPEC §5).

### Circle tools

10. `circle(O, r)`: r ≤ 0 → Undefined (zero and negative radius have their own reasons), r
    within the band of 0 → ambiguous; the exact value of r is also checked (as `div`,
    Run 2). Mod p the sign of r is not checked (as `param`, ADR-0003 item 16). No anchor.
11. `cline(A, B, C)` decides collinearity with the same normalised EPS test as the
    circumcircle (ADR-0003 item 21). Collinear → the full line p = A, d = B − A (achiral);
    two coincident points → Undefined. There is no band case: near the switch the circle is
    huge and coincides with the line near the figure (tested: the curve stays within |h| of
    the midpoint of AB as C crosses the line).
12. `ninepoint_circle` is the circumcircle of the medial triangle (anchor: the midpoint of
    BC), built from the medial triangle directly (its cross product is cross/4 ≠ 0).
13. `incircle` / `excircle` (opposite A): centre (±a·A + b·B + c·C)/(±a + b + c), r² =
    (cross / (±a + b + c))², anchor the foot of the centre on BC. The excenter's
    denominator b + c − a is checked to be clearly positive (sign 1), so a triangle flatter
    than the precision of its side lengths is Undefined, never a division by a rounded 0.
14. **Bisectors**: w = (A − B)/|A − B| + (C − B)/|C − B|, rescaled so its 1-norm is
    |A − B| + |C − B| (a valid direction never looks like a zero length downstream).
    Straight angle (w zero, EPS) → bisector: the perpendicular at B, rot90(A − B), which is
    CHIRAL (a quarter turn); ext_bisector: the line BA, ACHIRAL. Otherwise bisector is
    along w (achiral) and ext_bisector along rot90(w) (chiral, as SPEC §4 lists). w inside
    the band of zero → Undefined (ambiguous), since the flag and the direction flip there.

### Scale, limits, docs

15. **Explicit radii** (SPEC §3.1, completing ADR-0003 item 18): the literal r of a
    `circle(O, r)` call counts as a diameter 2·|r|; scale = max(free-point diameter,
    2·max |r|). A radius beyond the float argument limit (2^200) is ignored: the float run
    makes that circle Inexact anyway and the exact runs do not use the scale. Computed
    radii do not count (the scale is syntactic, as for free points).
16. **Float range** (ADR-0003 item 19): the bound 2^200 on FloatField arguments still
    suffices. The largest intermediate of the new formulas is the squared exradius
    (cross/(b + c − a))² ≤ (2^403 / (BAND·scale))² ≈ 2^852, since coordinates below 2^200
    give cross products below 2^403 and b + c − a is checked to be at least BAND·scale;
    everything else stays below 2^610 (u²·e in the stereographic glider). All are below
    2^1024. The constant moved to an internal module (`limits.ts`) shared by evaluate
    and context.
17. Export mappings stay `'numeric'` (ADR-0003 item 11). ToolSpec examples gain a nested
    call form `{ call, args }`, and the generated reference shows a circle's anchor.
18. **Exactness is discovered**: `pnpm docs:exactness` (scripts/exactness/table.ts) prints,
    from the registry, each tool's exact-run result over its examples. The side-length
    tools have one Heronian example (exact) and one generic example (Inexact: √ not
    rational), as SPEC §3.4 expects.

### Tests

19. Frozen test files gain lines only (the add-only guard passes; no line is changed): the
    tool list in registry.test.ts, the `./glider` subpath in exports.test.ts, two spreads
    in degenerate.test.ts and tools.property.test.ts, and in l3-oracle.test.ts a circle
    argument and an argument plan (helpers/l3-plans.ts). The plan is needed because random
    inputs never satisfy "P on c" and random triangles never have rational sides: L3 would
    otherwise compare nothing for tangent, other and the incircle family. Incidence plans
    use dyadic points on circles built so that the float gap is EXACTLY zero (a rounding
    residual would be "within BAND of a degeneracy" and excluded).
20. Float theorem tests skip, and count, ILL-CONDITIONED figures in the sense of SPEC §3.1
    (moving the free points by FLOOR_DELTA·scale moves a position by more than
    FLOOR_MAX·scale), e.g. a triangle so flat that its excenter lies 10⁴ times its size
    away. Exact runs skip nothing but degenerate draws.

## Consequences

- Branch selection (a later run) adds `intersect` for curves and `tangent_from`,
  `tangent_point`; `other` and gliders already give every exact point on a circle without
  selectors, and the GUI's preferred `other(P)` selector can reuse incidence.ts.
- The mod-p rung sees segment and ray gliders as Inexact; the claims run decides whether
  the samplers draw such gliders on the carrier line instead.
- The editor run uses `dragParameter` / `gliderParameter` from `@geomira/kernel/glider`.

## Alternatives considered

- Incidence "on iff |gap| < BAND": a decision that flips silently at BAND, against SPEC
  §3.1 ("no decision ever flips silently").
- Gliders by angle on every circle: never exact over Q or mod p, so the exact rungs would be
  lost for every figure with a point on a circle.
- (u : v) normalised to u² + v² = 1: needs a square root; the homogeneous form is exact.
- Ignoring the range of a segment glider mod p: silently tests a different construction.
- Counting computed radii in the scale: the scale would depend on evaluation, and a radius
  computed from free points is already bounded by their diameter.
- Loosening float theorem tolerances for flat triangles: would weaken every figure to
  accommodate a few; skipping ill-conditioned samples is what the tester itself does.
