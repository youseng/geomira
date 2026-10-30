# GEOMIRA: Specification v1 (plan v3)

## 1. Mission and scope
The tool olympiad geometers open instead of GeoGebra: keyboard-first, text-canonical,
deterministic, honest about degeneracy, with export ready for AoPS posts and handouts.
Users: olympiad students, trainers, problem setters, handout authors.

v1 INCLUDES: construction kernel over several number fields, branch selectors,
similarity transformations, layers including derived layers, views (data model), the
text language, three-valued claims with local and global random-figure testing and
hypotheses, canvas editor, exports (SVG, PNG, TikZ, Asymptote) compiled in CI, share
links, static site.
v1.1 (Runs 12–13, before Phase 2): single-file offline build, PWA, views UI, long-tail
tools (spiral_center, isogonal, symmedian, pole, radical_center, arc), mutation-testing
gates. Run 14 (ADR-0032): inversion through Möbius maps (`inversion` and the presets of
ADR-0032), the range `outside` flag. Run 17 (ADR-0035, ADR-0036, ADR-0037; before Run 16, Run 15
skipped): discovery: the finder ("what is special?"), special-position hunting, lemma tags,
branch-fix diagnosis. Run 16a (ADR-0040): points at infinity (`IdealPoint`), projective maps
(`projective`, `send_to_infinity`), cross ratios and harmonic quadruples (claims and
`harmonic_conjugate`). Run 16b (ADR-0042): conics (`Conic`, `conic(A, B, C, D, E)`,
`conic_center`, the conic overloads of tangent, polar, pole, the tangents from a point, line ∩
conic and gliders, maps on conics, `conic_to_circle` and `circle_to_centre` for derived layers,
the claims on, tangent and `conconic`). Run 16c (ADR-0043): conic ∩ conic and conic ∩ circle
(up to four candidates, `other(P, Q, R)`), `foci(k)`.
Phase 2 (must not be referenced by v1 code; the extension points in §18 are built and
tested in v1): (inversion and Möbius maps moved to Run 14 by ADR-0032, projective maps to
Run 16a by ADR-0040, conics to Run 16b by ADR-0042), the symbolic
prover (the finder, special-position hunting and branch-fix diagnosis moved to Run 17 by
ADR-0035 and ADR-0036), the problem library,
write-ups, loci, animation, macros, accounts.

## 2. Repository and dependency rules
packages/num      tolerance, noise floor, seeded RNG, Field<T>: Float, Rational, ModP
packages/kernel   values, capabilities, document model + invariants, tool registry,
                  field-generic geometry, selectors, transformations, layers, evaluator
packages/claims   claim semantics (3-valued, NDG data, polynomial conditions),
                  hypotheses, samplers, the two-regime tester, verdict rungs, jobs
packages/lang     lexer, parser, printer, diagnostics, migrations, docs generator
packages/scene    viewport, scene builder, clipping, labels, hit-testing
packages/editor   editor core: applyEdit, history, selection, tool state machine, GUI
                  selector choice, autosave policy, share links, debug report (no DOM)
packages/export   SVG, PNG (via scene), TikZ, Asymptote, LaTeX text escaping
packages/discovery the finder, special positions, lemma tags, branch-fix diagnosis (ADR-0035)
apps/web          React UI, canvas renderer, worker host
docs/             SPEC.md, STATUS.md, adr/, language.md (generated),
                  examples-source.md, library-source.md (maintainer), beta-reports/
examples/         *.geo files (maintainer statements + classical theorems)

Allowed imports (dependency-cruiser enforces): num → (none) · kernel → num ·
claims → kernel, num · lang → kernel, claims, num · scene → kernel, num ·
editor → kernel, claims, lang, scene, num, discovery · export → scene, kernel, lang, num ·
discovery → kernel, claims, num (ADR-0035) · apps/web → all. The tool registry is a VALUE
from `createRegistry()`, passed as a parameter, never a singleton; tests may build extended registries.

## 3. Numerics (packages/num)
### 3.1 Tolerances (tolerance.ts is the only file with tolerance literals)
- `ctx.scale`: diameter of the bounding box of free points and explicit radii (≥ 1),
  passed in `EvalContext`, never global.
- `EPS = 1e-9` (relative): construction zero tests (`isZeroLen` vs EPS·scale,
  `isZeroArea` vs EPS·scale², dimensionless otherwise).
- `BAND = 1e-7` (relative): DECISION band for selectors, incidence in `other(P)`, and
  hypotheses. A deciding quantity inside the band → AMBIGUOUS → Undefined. No decision
  ever flips silently.
- Noise floor for float claim evaluation: `floor = max(|r(x + δ_k) − r(x)| over k = 1..3,
  FLOOR_MIN)`, with δ_k three independent random perturbations of all free inputs of
  size 1e-10·scale and `FLOOR_MIN = 1e-14`. TRUE iff residual < 100·floor; FALSE iff
  residual > max(1e4·floor, FALSE_ABS) with `FALSE_ABS = 1e-8` (a residual of 1e-10 is
  never called false, whatever the floor estimate); otherwise AMBIGUOUS. A sample whose floor exceeds `FLOOR_MAX = 1e-6` is ILL-CONDITIONED
  (invalid, not false). The FLOOR_MIN clamp prevents "0 < 100·0" from failing on
  exact-looking float results.
- Determinism: bit-identical within one engine; across engines identical up to EPS with
  every discrete decision identical (guaranteed by the bands).
- Conics (ADR-0042) are decided with the same constants on normalised quantities: incidence on
  Q(P)/|∇Q(P)| as a length; the degeneracy of a conic on its semi-latus rectum
  √(|det M|/(a² + 2b² + c²)^{3/2}) as a length; its type on the sign of ac − b², a parabola
  when its centre is at infinity for the figure (the scale over its largest real semi-axis as a
  dimensionless number, ADR-0044); its asymptotic directions on dᵀM₂d over a² + 2b² + c², times
  |d|² (dimensionless).

### 3.2 Seeded RNG (rng.ts)
Explicit seed objects, no global state; every random procedure takes and reports a seed.
Cryptographic randomness is used only where §10.5 says so.

### 3.3 Fields (field.ts, rational.ts, modp.ts)
`interface Field<T> { zero, one, add, sub, mul, div, neg, eq, isZero(x, dim, ctx),
sign(x, dim, ctx) → -1|0|1|'ambiguous'|'none', sqrt(x) → T | Inexact,
sin/cos/atan2 → T | Inexact, fromRational, toNumber }`.
- `FloatField`: tolerance-aware zero/sign; sqrt/trig always succeed.
- `RationalField`: exact BigInt fractions; sign exact; sqrt succeeds only on perfect
  squares, otherwise `Inexact`; trig `Inexact` except exact special values (0°, 90°, …).
- `ModPField` (p = 2^61 − 1): exact; `sign` returns 'none' (no ordering), so any
  sign-based selector or hypothesis is not evaluable mod p; sqrt/trig `Inexact`.
`Inexact` propagates like Undefined but means "not representable in this field".
`withDivisorLog(F)` and `withSqrtLog(F)` record every divisor and every square-root
request (used for NDG conditions and "unsupported" reasons).
Reserved for Phase 2 (documented only): `QuadExt(F, d)` (for example d = 3 for 60°
rotations), `PolyFractionField`, `DegreeBoundField`.

### 3.4 Exactness
Number literals (`2`, `0.1`, `2/3`, `-3/4`) are exact rationals; arithmetic on exact
numbers stays exact. Exactness of a construction is DISCOVERED by running it over
RationalField (no hand-written tags). The generated docs list, for each tool, whether
its exact run can succeed. Known main gap: `rotate(O, θ)` for θ not a multiple of 90°
(60° needs √3), which QuadExt will close.

## 4. Values and capabilities (packages/kernel/value.ts)
Generic over the number type T:
- `Point { kind:'point', x, y }`
- `Line { kind:'line', p, d, lo, hi, chiral, outside? }`: points p + t·d, d ≠ 0 not
  normalised, t ∈ [lo, hi]; with `outside` (ADR-0032), t ≤ lo or t ≥ hi (two rays). `chiral` records how d behaves when the whole figure is mirrored:
  directions from two points (line, segment, ray) and bisectors are achiral; every 90°
  turn of a direction TOGGLES the flag (perp toggles its line's flag; perp_bisector,
  tangent, polar, radical_axis and ext_bisector turn an achiral direction, so they are
  chiral); parallels and transformed images keep their input's flag. Under mirroring,
  "further along d" keeps its meaning on achiral lines and swaps it on chiral ones;
  §7 relies on this, and a test checks the flag against actual mirrored figures.
- `Circle { kind:'circle', c, r2, arc: null | { from, to }, anchor?: Point }`: r2 > 0;
  arc counter-clockwise; `anchor` = a known point on the circle, used by gliders. Every
  circle tool that has one sets it: circle(O,A): A; circle(A,B,C), circumcircle, cline:
  A; diameter_circle(A,B): A; ninepoint_circle(A,B,C): the midpoint of BC; incircle and
  excircle: the touch point on BC; `apply(T, c)` maps the anchor (so circles in derived
  layers keep exact gliders). Only circle(O, r) has none.
- `Num { kind:'number', v, exact? }` · `Polygon { kind:'polygon', pts }`
- `Transform { kind:'transform', t: { type:'similarity', anti, a, b } }` (z ↦ az + b or
  a·z̄ + b) or `t: { type:'mobius', anti, a, b, c, d }` (z ↦ (aẑ + b)/(cẑ + d), ADR-0032), or
  `t: { type:'projective', m }` (a 3×3 matrix on (x, y, 1), never normalised) or
  `t: { type:'composite', maps }` (Möbius and projective factors in order, ADR-0040).
- `IdealPoint { kind:'ideal_point', d, chiral }` (ADR-0040): the point at infinity of the
  direction d (a representative, not normalised); never drawn; the meet of two parallel lines.
- `Conic { kind:'conic', a, b, c, d, e, f, anchor? }` (ADR-0042): the points where
  a·x² + 2b·xy + c·y² + 2d·x + 2e·y + f = 0, in the normal form det M = a² + 2b² + c² (M the
  symmetric 3×3 matrix), so one point set has one value; only non-degenerate real conics; the
  type (ellipse, parabola, hyperbola) is derived, never stored; `anchor` a known point (gliders,
  conic_to_circle). A circle is never a conic: circle tools keep returning circles; a projective
  map's image of a circle or conic is a conic.
- `Undefined { kind:'undefined', reason }` and `Inexact { kind:'inexact', reason }`.
Reserved kinds (documented only): Locus. Capabilities: point; curve
(line | circle); linear; round; number; transform; polygon; and (ADR-0040) ideal, ppoint (a
point or an ideal point), and (ADR-0042) conic, which only declaring overloads take. A kind a tool does not
accept → Undefined("<tool> does not accept <kind>"), so future kinds are safe by default.

## 5. Document model (packages/kernel/document.ts)
Document = { version, objects (construction order), layers, views, claims, assumptions,
viewport, meta }: the ENTIRE state.
Object = { id (never reused), name (unique), def: Expr, style, layers: non-empty set,
managedBy?: rule id }. Expr = Ref | Lit (exact) | Call(tool, Expr[], selectors).
Nested calls are trees; inline subexpressions have NO identity (they cannot be named,
claimed, styled, hit-tested or imaged; only their result object can). Free state lives
only in definitions: `(x, y)`, `on(obj, param)`, `param(min, max, v)`.
Invariants (`assertInvariants` after EVERY edit in tests and dev builds):
I1 names unique and grammatical, managed names reserved; I2 every Ref points to an
EARLIER object; I3 every object has ≥ 1 existing layer; I4 each managed object sits after
both its source and its rule's transform, and matches its rule exactly; I5 claims and
assumptions reference existing objects; I6 ids unique, never reused; I7 views reference
existing layers; I8 version current.

## 6. Tools (packages/kernel/tools/*)
### 6.1 ToolSpec
{ id, name, family, signatures (capability tuples, overloads), outputKinds,
  compute<T>(F: Field<T>, args, selectors, ctx) → Value<T>   // the ONLY implementation
  candidates?<T>(F, args, ctx) → Value<T>[]                   // branchable tools
  degenerate: string[] (each a test), export mapping or 'numeric', doc, examples }
Signatures also carry data read elsewhere: `symmetry` (ADR-0029), `guarantees` (the facts a
result has by construction, as claim templates: ADR-0035), `map` and `imageOf` (what a map
does, and which overloads are images: ADR-0039), `radical`, `absolute`, `preserves`.
Nothing outside the registry enumerates tools.

### 6.2 v1 tool set
Points: `(x,y)`/`point(x,y)` · `on(obj[, param])`: line-like (param t, clamped to the
range); circle with an anchor (homogeneous stereographic parameter (u : v) from the
anchor: rational, reaches the anchor at v = 0); `circle(O, r)` without a rational point
(angle parameter) · `param(min,max,v)` · `midpoint` · `divide(A,B,t)` · `intersect(a,b,
selectors)` · `other(a,b,P)` (Vieta / reflection in the line of centres: exact) ·
`foot(P,l)`, `foot(P,A,B)` · `center(c)` · `circumcenter`, `orthocenter`, `centroid`,
`ninepoint_center` · `incenter`, `excenter(A,B,C)` (opposite A) ·
`tangent_point(P,c,selectors)`.
Lines: `line`, `segment`, `ray` · `parallel(P,l)`, `perp(P,l)` · `perp_bisector` ·
`bisector(A,B,C)` (of ∠ABC at B), `ext_bisector` · `tangent(P,c)` (P on c) ·
`tangent_from(P,c,selectors)` · `polar(P,c)` · `radical_axis(c1,c2)`.
Circles: `circle(O,A)`, `circle(O,r)`, `circle(A,B,C)` = `circumcircle` · `cline(A,B,C)`
(a circle, or the line when collinear: the v1 variable-kind tool) · `diameter_circle` ·
`incircle`, `excircle` · `ninepoint_circle`.
Transformations: `reflect(l)`, `reflect(P)`, `rotate(O,θ)`, `homothety(O,k)`,
`translate(A,B)`, `spiral(A,B,C,D)` (A→C, B→D), `compose(T1,T2)` (T2 first),
`inverse(T)`, `apply(T,X)`, and image sugar `reflect(X,·)`, `rotate(X,O,θ)`,
`homothety(X,O,k)`, `translate(X,A,B)`, `spiral(X,A,B,C,D)`.
Measures: `dist`, `dangle(A,B,C)` (directed, mod 180°), `angle(A,B,C)` (undirected),
`ratio(A,B,C,D)`, `area`, `power(P,c)`, `radius(c)`; arithmetic and sqrt/sin/cos/tan
(degrees) on numbers.
Display: `polygon`, `mark_angle`, `mark_right`, `mark_segment`, `text`.
Sugar: `triangle A B C [acute|obtuse_at_A|…]` → three free points (deterministic from a
hash of the line), polygon, `assume` lines. Right angles are constructed, never assumed.
v1.1 tools (Run 13): `spiral_center`, `isogonal`, `symmedian`, `pole`,
`radical_center`, `arc`.
`symmedian_point` (ADR-0033, the Lemoine point). Run 14 (ADR-0032): `inversion(c)`, `inversion(O, k)`, and the presets `sqrt_bc`,
`orthocenter_inversion`, `inversion_fixing`, `inversion_swap`, and (ADR-0034) `feet_inversion`,
`sqrt_bc2` (compositions of the tools above). Run 16a (ADR-0040): `projective(A,B,C,D,A′,B′,C′,D′)`,
`send_to_infinity(l)` (the stated chart of ADR-0040 decision 12), `harmonic_conjugate(A,B,C)` and
`harmonic_conjugate(a,b,c)`; `intersect` of two parallel full lines is their ideal point, and
`line(P, X∞)` is the parallel through P. Run 16c (ADR-0043): `intersect(k1, k2, selectors)` of two
conics or a conic and a circle (up to four candidates; `other(P, Q, R)` gives the fourth exactly),
`foci(k, selectors)` (an ellipse's or hyperbola's two foci, a parabola's focus, a circle's centre).
ADR-0045: `tangent(c1, c2, selectors)` and `tangent_point(c1, c2, selectors)`, the common tangents
of two circles, two conics or a circle and a conic (up to four; the line is the tangent of c1 at
its touch point, which selectors judge), and `exsimilicenter(c1, c2)`, `insimilicenter(c1, c2)`.

### 6.3 Degenerate behaviour (each item is a test)
Parallel / coincident lines → Undefined; coincident defining points → Undefined;
collinear circumcircle → Undefined (use cline); concentric circles → Undefined; tangency
→ the double point; glider on a degenerate object → Undefined; zero homothety ratio →
Undefined; transform of Undefined → Undefined. Bisector of a straight angle → the
perpendicular at B; of a zero angle → that line; ext_bisector correspondingly.

## 7. Branch selection
Branchable tools produce a candidate list (0–2 values; 0–4 for conic ∩ conic and conic ∩ circle,
ADR-0043, and for common tangents, ADR-0045). Selectors (applied in order):
- Filters: `same_side(Q, l)`, `opposite_side(Q, l)`, `on_arc(B, C, [not] A)`,
  `between(A, B)`, `inside(c)`, `outside(c)`.
- Rankers: `other(P)` (P must lie on both objects within BAND; picks the candidate
  farther from P; both candidates within BAND of P → the double point), `near(P)`,
  `far_from(P)` (the nearest / farthest of any number of candidates; a tie with the runner-up
  within BAND → ambiguous). On conic ∩ conic `other(P, Q, R)` (three distinct common points)
  gives the fourth common point without square roots (ADR-0043).
- Low-level: `along(+)` / `along(−)` (line ∩ curve: the candidate further / less far
  along the line's direction d); `orient(+)` / `orient(−)` (circle ∩ circle: sign of
  cross(c2 − c1, P − c1); tangent choices: sign of cross(O − P, T − P)). Shown with a
  neutral note, never a warning. Common tangents of two circles (ADR-0045) carry both labels:
  `along(−)` the external pair, `along(+)` the internal pair (measured along O₁→O₂, achiral, no
  line argument: reflection-equivariant), `orient(±)` the side of O₁O₂ where the touch point lies.
ORIENTATION DEPENDENCE (exact definition): a selector is orientation-dependent iff it is
`orient(±)`, or `along(±)` on a line with `chiral = true`. All other selectors are
reflection-equivariant. Invariant (law L16): a script with no orientation-dependent
selector can never receive the orientation verdict of §10.5.
Rules: a deciding quantity within BAND → Undefined("ambiguous: …"); zero survivors →
Undefined("no intersection satisfies …"); two survivors → Undefined("ambiguous: add a
selector"); ranker ties within BAND → Undefined. No tool reads previous values. A bare
index (`intersect(a, b, 2)`) and a two-candidate call without selectors are parse errors
with a hint.
GUI choice (packages/editor) when the user clicks a candidate, in this order, taking the
first kind that singles it out (within a kind, the largest decision margin):
`other(P)` for an existing P at the other candidate → `same_side`/`opposite_side`/
`on_arc` with points from the construction → `along(±)` / `orient(±)` → `near(P)` only
for a named point incident (within BAND) with the clicked candidate. With four candidates
(ADR-0043): `other(P, Q, R)` with points at the three others → one filter, else two filters whose
kept candidates meet in the clicked one → `near(P)`; conic ∩ conic has no low-level selector.
Common tangents of two circles (ADR-0045): the tiers for four, then `along(±)` with a
reflection-equivariant selector that separates the pair, then `along(±), orient(±)`.

## 8. Transformations, layers, views
### 8.1 Transformations
Similarities in v1; Möbius maps (inversion) from Run 14 (ADR-0032: images of lines and
circles change kind, segments become arcs or rays, the centre's image is Undefined). `apply` maps every kind (ranges and arcs mapped, anti-similarities
reverse arc orientation, the chirality flag is kept). Laws: apply∘inverse = id; compose
associative; apply(compose(S,T)) = apply(S)∘apply(T); incidence preserved.

### 8.2 Layers
Layer = { id, name, visible, locked, opacity, order, rule? }; "main" always exists;
visible iff not hidden and ANY layer visible.
DERIVED LAYER rule = { transform: Ref, source: layer id, suffix: "*" (configurable),
exclude: object ids }. The kernel maintains a managed image `X*` = apply(T, X) for every
object X of the source layer (now and later), except objects styled `[noimage]` and
objects in `exclude`. There is NO closure-based exclusion: under `spiral(A,B,C,D)` the
images of A, B, C, D are wanted, and under √(bc) the images of B and C are the point of the
map. Images may be Undefined (the inversion centre's image exists, Undefined with its
reason). Images that coincide with their sources are hidden by the scene (§13), not
removed from the document. Managed names are reserved: a user object or
pasted text using such a name is an error ("A* is the image of A in layer inv"). Each
managed object is placed after both X and T (I4); adding an object to the source
appends its image; redefining or moving T re-validates. Deleting the rule deletes its
managed objects. Rules may chain; cycles are rejected. Building "in" a derived layer means
adding ordinary objects to it; the preimage of Y is `apply(inverse(T), Y)`.

### 8.3 Views
View = { name, layerVisibility, viewport? }. v1: data model, language and tests; UI in v1.1.

### 8.4 Drag-through
Dragging a managed image X* of a free input X sets X := T⁻¹(cursor) (gliders: projected
to their parameter). If T depends on X (X defines the reflecting line or the inversion
centre), X* is NOT draggable (stated rule, tested). Inversion inherits this unchanged.

## 9. Evaluation (packages/kernel/evaluate.ts)
`evaluate(doc, registry, F, ctx)` for any field F: total (never throws), construction
order, pure. `evaluateFrom` (incremental) must equal a full evaluate. The float run draws
the figure; the Rational run is the oracle; the ModP run serves the tester (§10.5).

## 10. Claims, hypotheses, random-figure testing (packages/claims)
### 10.1 Claim kinds
collinear · concyclic · concurrent · parallel · perpendicular · on(P, curve) ·
tangent(curve, curve) · equal points · `AB = k·CD` (k exact) · `AB/CD = EF/GH` or
`= number` · directed angles `n∡ABC = ∡DEF` (mod 180°) and `∡(l, m) = θ` · undirected
`angle(A,B,C) = angle(D,E,F)` and linear forms `angle(A,B,C) ± angle(D,E,F) = θ`
(statements like "∠BHC + ∠A = 180°" or "∠A + ∠B = 90°") · (ADR-0040) `cross_ratio(A,B,C,D) = k`
and `harmonic(A,B;C,D)` for four collinear or concyclic points (the complex cross ratio),
`cross_ratio_lines`, `harmonic_lines` for four concurrent lines; collinear accepts points at
infinity · (ADR-0042) on(P, k) and tangent(l, k) with a conic k, and `conconic(A,…,F,…)` (the
points on one conic: one determinant condition per point after the fifth, NDG distinct and no
three collinear).
Each kind defines, generically over Field<T>: `conditions(values)` (must all be 0),
`ndg(values)` (must all be non-zero: NON-DEGENERACY data), and a float `residual`
(dimensionless, ≥ 0). Directed angles use the complex form: with
z₁ = (C − B)·conj(A − B) and z₂ = (F − E)·conj(D − E), the condition is
Im(z₁ⁿ·conj(z₂)) = 0, NDG z₁ ≠ 0 and z₂ ≠ 0 (for n = 1 this is the cross/dot formula).
Lengths enter as squares. POLYNOMIAL KINDS (the whitelist for the prime-field rung):
collinear, concyclic, concurrent, parallel, perpendicular, on, tangent, equal points,
length and ratio equalities, directed angles, cross ratios and harmonic quadruples, conconic. Undirected angles and anything involving
order or inequality are NOT polynomial kinds. Kinds also carry their argument symmetries and
optional finder hints (ADR-0035); the kinds are a registry value (`claimKindRegistry`).

### 10.2 Three-valued evaluation
`evalClaim` → true | false | undefined(reason) for the current figure: NDG failure →
undefined("degenerate: …"); otherwise by the rung that applies (§10.5). Live badges show
exactly this for the current figure and never run a sampler.

### 10.3 Hypotheses (`assume …`)
Open conditions only, checked with a BAND margin: `acute(A,B,C)`, comparisons of
undirected angles or lengths (`angle(B,A,C) > 90`, `AB < AC`), `scalene(A,B,C)`,
`P inside polygon(…)`, `A, B, C, D in order on l` / `on c` (cyclic, either direction),
`convex(A,B,C,D)`, `AB ≠ AC`. Equality assumptions are parse errors ("construct it").

### 10.4 Samplers
LOCAL (default): random similarity + Gaussian noise σ = 0.02·scale on free points; glider
parameters perturbed locally; no mirroring. It cannot cross configuration boundaries.
GLOBAL: random similarity + σ = 0.3·scale; gliders uniform over their range (circle
gliders uniform in angle, then converted to (u : v)); params uniform; hypotheses enforced;
EXACTLY half the samples mirrored WITHOUT flipping any selector. "In order on" hypotheses
whose points are all gliders on one object are sampled ordered (sorted parameters);
otherwise by rejection, with a retry budget of 50·N and a "hard to satisfy" report below
5% acceptance (never silently testing fewer figures).
For exact rungs, samples are rounded to a coarse rational grid (denominators ≈ 2^10) and
glider parameters to coarse rationals.

### 10.5 Verdict rungs and verdicts
Per sample, the first rung that applies:
1. EXACT OVER Q: the claim's closure runs over RationalField without `Inexact`, within a
   size budget (BigInt bits per value; exceeding it falls through). Conditions are
   tested for exact zero.
2. EXACT MOD p: the claim kind is a POLYNOMIAL KIND (§10.1), the closure contains no
   sign-based selector and no sqrt/trig, and runs over ModPField (hypotheses play no role:
   an identity does not depend on them). Values
   are drawn uniformly mod p with cryptographic randomness (this rung tests the algebraic
   identity, independent of the figure's configuration). `other(P)` is allowed here
   (Vieta), which is one reason the GUI prefers it.
3. NUMERIC: float evaluation with the noise floor of §3.1.
The verdict states the rungs used ("exact over Q, 200/200").
LOCAL test (default "Test" and the first line shown): HOLDS IN THIS CONFIGURATION
(all valid samples true) · FALSE (all false; "true in the current figure only" when it
holds there) · MIXED (both; with an example and a counterexample document) ·
INCONCLUSIVE (too many undefined/ambiguous/ill-conditioned, with reasons).
GLOBAL test (on demand, and automatically after the local test when the script has
`assume` lines, as a second line from the worker): HOLDS ACROSS THE DECLARED
CONFIGURATION (counts, plus "n samples rejected by hypotheses") · ORIENTATION-DEPENDENT
(the closure contains k orientation-dependent selectors and EVERY failing sample holds when
those selectors are flipped in that sample; the tester flips all k together, then each one
alone (k + 1 evaluations), and when a single flip repairs every failing sample it names
that selector: "line 7's `orient(+)` encodes a side; use `same_side(A, …)`"; samples are classified by this flip test, not
by whether they came from the mirroring step, because large noise can also reverse a
figure's orientation; names the selector and line, and the reflection-equivariant
alternative) · CONFIGURATION-DEPENDENT (some failing sample does not hold even with the
selectors flipped; one example document) ·
INCONCLUSIVE. Global findings are information, never a red badge.
Never the words "proved", "proof", "proven" (CLAUDE.md). Every result carries its seed
and its counterexample documents.

## 11. Language (packages/lang)
### 11.1 Statements
`name = expr [attrs]` · `claim <claim> [name=…]` · `assume <condition>` ·
`triangle A B C [type]` · `style X <attrs>` (including `[noimage]`) · `label X "…"` ·
`@version 1` · `@layer name [visible=false] [locked] [opacity=…]` ·
`@layer inv = image(T, main) [suffix=*] [exclude=X,Y]` · `@view name layers=…` ·
`@viewport …` · `# comment`. Expressions: nested calls, names, exact numbers (with ° for
angles), point literals, arithmetic, selectors (`along(+)`, `orient(-)`, …) as trailing
arguments; math functions may start a statement (`k = sqrt(t)`).
### 11.2 Names and tokens
Points: uppercase Latin letter, then digits or `_` + (digits | one letter | `{alnum+}`),
then primes: `A`, `A1`, `A_1`, `M_a`, `M_{ab}`, `H'`, `A_1''`. A trailing `*` (or
`**`, …) is part of a name ONLY when it immediately follows a point name with no
whitespace; such names are reserved for managed images. Elsewhere `*` is multiplication;
since number names are lowercase, `a*b` and `A*` cannot collide; in claims `A*B*`
tokenises as A*, B*. Everything else starts lowercase or Greek (`\omega` → ω).
`Ma` → error "did you mean M_a?".
### 11.3 Laws
Parse is total (per-line recovery). P1: parse(print(doc)) = doc (up to ids). P2:
print∘parse is idempotent. P3: parseInto keeps ids and styles of persisting names.
Diagnostics carry line, column and a fix hint.
### 11.4 Versioning
`@version N` mandatory when printing; migrations with tests; old files load forever.

## 12. Editor core (packages/editor)
State = { doc, values, selection, hover, tool, toolState, history, viewport }. Every
change is an edit through `applyEdit` (add, remove with cascade list, rename, redefine,
style, layers, derived layers, views, drag, replaceText, claims, assumptions; viewport
outside history). Drag is coalesced; at drag end values are rounded to the FINER of the
power-of-ten grid 10^(⌊log10 scale⌋ − 4) and the power of ten just below 0.1 px at the
current zoom, and stored as exact decimals. GUI tools are data; one state machine runs
them; the GUI selector choice follows §7. Autosave: a document opened from a link is not
saved until the first edit; the previous autosave is kept with "Restore previous
figure". Share link `#s=` + lz-string(text). Debug report: text, app version, last 50
edits, user agent.

## 13. Scene and rendering (packages/scene)
values + doc → SceneBuilder → Scene (world-coordinate primitives) → canvas | exporters.
y-up world; flip only in viewport.ts. Hit-testing uses the SAME primitives that are
drawn (law L8). Labels: text grammar, offsets as (angle, pixels).
Coincident images: the scene does not draw a managed image whose value coincides with its
source within BAND (points on the mirror line or the inversion circle, the mirror line,
the inversion circle) WHILE THE SOURCE IS DRAWN. If the source is hidden (for example an
"image only" view), the image is drawn, so fixed points never disappear. Stateless, no
document change; tested.

## 14. Export (packages/export)
SVG · PNG · TikZ (snippet + standalone; six-digit colours) · Asymptote `standalone`
(self-contained helper functions, named pairs, constructive where mapped, numeric
otherwise) and `aops` (`import olympiad;`, only functions verified in the vendored
olympiad.asy source; if its licence does not allow vendoring, aops output is snapshot-
tested and checked by hand in each audit). Escaping table `texText` (ASCII specials,
Greek, ′ ″, ∩ ∪, ∠ ∡, ⟂ ∥, — –, °, ≤ ≥ ≠, →, ℓ with subscripts, √(…)); unknown characters
→ `?` + `% Warning` + UI message. CI (cached TeX Live + Asymptote image) compiles every
example's TikZ and standalone Asymptote and checks Asymptote's `write()` coordinates
against the kernel (≤ 1e-6·scale).

## 15. Web app
Panels: Text (two-way, per-line diagnostics), Objects (by layer, Undefined/Inexact
reasons), Layers, Claims (live badges; local verdict line; global verdict line;
"open counterexample"), Style. Command bar with registry autocomplete; shortcuts and help
generated from data; mobile (390×664) pan, pinch, drag and panels work. Views UI: v1.1.

## 16. Worker job protocol
`runJob(job)` is a pure generator in packages/claims yielding progress after each sample
(cancellable, time-sliceable). Jobs: `{ kind: 'testClaim', regime: 'local'|'global',
docText, claim, seed, n }`; packages/discovery adds 'find', 'hunt' and 'branchFix' (Run 17,
ADR-0035, ADR-0036; Phase 2 adds 'prove'). apps/web runs jobs in a Web
Worker; without workers, the page runs them in ≤ 16 ms slices (tested in v1.1 from
file://).

## 17. Testing laws, gates and budgets
L1 evaluate total; no NaN/±Infinity in Values (fuzzed). L2 determinism; evaluateFrom ≡
evaluate. L3 exact oracle: float vs RationalField for every tool whose exact run
succeeds, on random rational inputs EXCLUDING inputs within BAND of a degeneracy. L4
language laws P1–P3. L5 share-link and file round trips. L6 undo/redo. L7 invariants after
every edit. L8 hit/render consistency. L9 finite scenes. L10 exports parse/compile; Asymptote
coordinates match. L11 continuity: no jumps; through tangency → Undefined. L12 claim
corpora: ≥ 40 true theorems HOLD (local) for 20 seeds with zero flakes (exact rung where
available); ≥ 40 false claims FALSE or MIXED; ≥ 20 degenerate claims never true/false. L13
transforms and derived layers (§8 laws; sync under any edit sequence, including
"redefine T" and "move T"). L14 editor-level model-based fuzzing: ≥ 500 runs per CI,
20,000 nightly. L15 mutation testing: nightly incremental report (num, kernel geometry,
claims); gates num ≥ 80%, others ≥ 75% from v1.1. L16 orientation invariant: random scripts
without orientation-dependent selectors never receive ORIENTATION-DEPENDENT; scripts
whose only failures come from an `orient`/chiral `along` choice always do. L17 rung
whitelist: non-polynomial kinds and closures with sign-based selectors or sqrt never use
the mod-p rung.
Budgets (measured with Float, Rational and ModP fields all loaded): full evaluate of
500 objects ≤ 5 ms; incremental drag ≤ 2 ms; drag frame ≤ 8 ms at 300 objects; local
test (N = 200, 150 objects) ≤ 1.5 s in the worker; page interactive ≤ 1.5 s.

## 18. Phase 2 extension points (built and tested in v1)
E1 Field<T> with Rational and ModP in v1 → the prover adds PolyFraction, DegreeBound
and QuadExt and reuses the same tool and claim code (guard: L3, L17).
E2 Capability dispatch; kinds safe by default (guard: a test-only kind; ADR-0040: every overload
of every tool with an ideal point in each point position).
E3 Transform union → 'mobius' (built in Run 14, ADR-0032), 'projective' and 'composite' (built in
Run 16a, ADR-0040) (guard: exhaustive switches, §8 laws).
E4 Derived layers, exclusion rules, drag-through (guard: L13, editor tests).
E5 Arcs, cline, chirality flag (guard: tests; inversion maps segments → arcs and needs
   an `outside` range flag: built in Run 14, ADR-0032).
E6 Claim conditions/NDG as field-generic data (guard: L12, L17).
E7 Worker job protocol (guard: job tests).
E8 Reserved kind Locus; IdealPoint built in Run 16a (ADR-0040: parallel lines meet
in their ideal point; tools that do not declare it give Undefined with a reason, E2); Conic
built in Run 16b (ADR-0042: the capability `conic`; a conic where no overload takes one gives
Undefined "k is a conic: <tool> does not take one", E2, tested in every argument position).
E9 File versioning and migrations. E10 Registry-driven UI and docs.
