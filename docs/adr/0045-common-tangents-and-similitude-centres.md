# ADR-0045: Common tangents and centres of similitude

Status: accepted (maintainer request "usability, items 1–10", item 1). Extends SPEC §6.2 (the
tool set), §7 (branch selection: common tangents, a second low-level label) and ADR-0006
(candidates and selectors), ADR-0043 (the pencil, four candidates, the GUI choice for more than
two), ADR-0024 decision 2 (the Tangent tool builds every branch as one batch) and ADR-0029 (a
repeat is not added again). SPEC §6.2 and §7 are updated in the same commit (marked ADR-0045).

## Context

The maintainer asked for the common tangents of two circles (two external, two internal; none
when one circle is inside the other, with a reason), of two conics and of a circle and a conic
(up to four, the dual of Run 16c's conic ∩ conic, Inexact where roots are needed), one picked by
a selector chosen like the other branchable tools (SPEC §7, the choice.ts tiers, reflection-
equivariant first, law L16); and the centres of similitude exsimilicenter(c1, c2),
insimilicenter(c1, c2), with registry symmetry, guarantees, theorem tests (the external common
tangents pass through the exsimilicenter, the internal ones through the insimilicenter, Monge's
theorem) and a GUI tool each. SPEC §7 has no notion of a branchable LINE whose candidates are
four lines; its selectors judge points, and its low-level labels are one sign per candidate.

## Decision

### Representation (packages/kernel/src/tools/common-tangents.ts, dual-tangents.ts)

1. **Overloads of `tangent`** (the line) and of **`tangent_point`** (its touch point): (round,
   round), (conic, conic), (round, conic), (conic, round), each with a BranchShape of up to four
   candidates and `radical` (the values need square roots). `tangent` becomes a branchable tool
   (it has `candidates`); its point overloads `tangent(P, c)` keep one result and refuse a
   selector ("tangent(P, c): the tangent at P is unique: it takes no selector"), statically too
   (selector-check: "this tangent has one result and takes no selectors"; the same check now
   reports `foci(c, …)`). `tangent_point(c1, c2, …)` gives the touch point on c1 of the same
   choice: it is how the GUI decides a candidate as a point (as tangent_point does for
   tangent_from), and a user may name the touch point directly.
2. **What a selector judges**: a common tangent is judged by its touch point T on the FIRST
   curve (as tangent_from judges its touch point); the line is the tangent of c1 at T (through
   T, chiral). So the two orders of the curves are different calls: no registry symmetry is
   declared for these overloads (near(P) judges T₁ or T₂).
3. **Two circles, closed form, every field.** The touch points on c1 are O₁ + u with |u| = r₁ and
   u·w = r₁(r₁ − r₂) (external) or r₁(r₁ + r₂) (internal), w = O₂ − O₁:
   T = O₁ + (a/s)·w ∓ √(r₁²(s − (r₁ ∓ r₂)²))/s·rot90(w), s = |w|². The counts are decided as
   ADR-0006 decides tangency, on the gaps d − |r₁ − r₂| (external pair) and d − (r₁ + r₂)
   (internal pair) as LENGTHS with the band: clearly negative none, within the band one double
   tangent (the common tangent at the touch point of two tangent circles), clearly positive
   two. When a root is not representable over Q the exact signs of s − (r₁ ± r₂)² decide (from
   q = s − r₁² − r₂² and r₁²r₂², no root), so the Undefined cases agree with floats; mod p →
   Inexact. Nearly coincident circles (the external gap and |r₁ − r₂| both within the band) are
   decided on the half distance of the external touch points, as ADR-0027 does for circle ∩
   circle. Concentric circles → Undefined ("concentric circles: no common tangent"; equal ones
   "the circles coincide: every tangent is common"); one inside the other → "no common tangent:
   one circle lies inside the other". Exact over Q whenever the four tangents are rational.
4. **The low-level labels of two circles: along(±) and orient(±).** Every candidate carries two
   STRUCTURAL labels (ADR-0006 item 7: no numeric decision): `along(−)` the external pair,
   `along(+)` the internal pair (whose touch points on c1 lie further along O₁→O₂:
   r₁(r₁ + r₂) > r₁(r₁ − r₂)); `orient(±)` the side of the line of centres where T lies
   (cross(O₂ − O₁, T − O₁), circle ∩ circle's label); a double tangent satisfies both signs of
   orient. `BranchShape` gains `alsoLow: 'along'` (a second low-level selector) and a candidate
   an optional second label (`Cand.side2`). A label names a BRANCH: when the internal pair
   vanishes (the circles start to overlap), `along(+)` gives "no common tangent satisfies
   along(+)", never an external tangent (law L11 tests both tangencies).
   **L16.** along(±) here measures along O₁→O₂, a direction from two points (achiral), and there
   is no line argument, so by SPEC §7's definition it is reflection-equivariant (a mirror keeps
   the order of the projections on O₁O₂); orient(±) is orientation-dependent, as everywhere.
   The claims' and discovery's existing rule (`isOrientationDependent(selector, null)`) already
   classifies them so; a test mirrors random figures and checks that along/near/far_from give
   the mirror image and orient does only when flipped.
5. **A conic among the curves: the dual problem**, floats only. The tangent lines of a conic with
   matrix M are the points of its dual conic adj(M); in the frame x′ = (x − o)/L (L = ctx.scale)
   a line u·x′ + v·y′ + 1 = 0 is the dual point (u, v). The common tangents are the common
   points of the two duals, found by ADR-0043's pencil unchanged (in the dual chart, scale 1),
   then mapped back: the touch point on the first curve is the pole adj(M₁)·ℓ. The chart origin
   o is a point no tangent of the first curve passes through — a circle's centre, else a focus
   (its tangents are the isotropic lines), else an ellipse's centre — so no common tangent is at
   infinity in the dual chart and the first dual is bounded (about a focus it is a circle).
   Within the band the pencil merges a double common tangent (two curves that touch) as it
   merges a double point. The line at infinity (common to two parabolas) and an asymptote of the
   first curve (touching it at infinity) are not candidates; near them → Undefined (ambiguous).
   Over Q and mod p the common tangents are roots of a quartic: Inexact, never approximated (as
   ADR-0043 decision 9). No low-level selector (as conic ∩ conic), no other(…).
6. **No other(P) for common tangents** (other: false): four lines are not the two common points
   of a pair; the selector messages say "other(P) does not apply to tangent(c1, c2)". The "add a
   selector" message lists only the selectors that apply ("near(P), same_side(Q, l) or along(±),
   orient(±)" for circles; "near(P), same_side(Q, l)" with a conic); conic ∩ conic's message is
   unchanged.
7. **A latent pencil bug** (packages/kernel/src/conic-pencil.ts): `within` passed `gapTo`'s
   Infinity (a point at a curve's centre has no first-order distance) to the band decision,
   which throws on a non-finite number. The dual of two concentric curves reaches it (a
   conjugate line pair whose vertex is the common centre): evaluate threw a RangeError. A
   non-finite length is now "not within". The failing test came first
   (`degenerate-common-tangents.ts`, 'a conic: no common tangent → Undefined', circle(10) and the
   ellipse x²/4 + y² = 1, concentric).

### Centres of similitude (packages/kernel/src/tools/similitude.ts)

8. **`exsimilicenter(c1, c2)` = (r₂·O₁ − r₁·O₂)/(r₂ − r₁)**, **`insimilicenter(c1, c2)` =
   (r₂·O₁ + r₁·O₂)/(r₂ + r₁)**: both formulas symmetric (the same value, bit for bit, in either
   order): symmetry permute(0, 1) `same: 'value'`. Circles store r², so the radii are rational
   only when r² is a rational square: exact over Q then, else Inexact; mod p Inexact (no square
   roots); `radical` per ADR-0008 decision 9 (radical.test.ts's list gains them, an added line).
   Equal radii (exactly r₁² = r₂², or r₁ − r₂ zero as a length in floats) need no root: the
   exsimilicenter is the point at infinity of the direction O₁O₂ (ADR-0040; within the band of
   equal: Undefined, ambiguous; its representative direction is ±(O₂ − O₁) with the first
   non-zero coordinate positive, so both orders give the same value) and the insimilicenter the
   midpoint. Concentric circles →
   Undefined for both, as the request decides (Uncertain below). The carrier circles are used
   (an arc's circle), as radical_axis does. Guarantee: collinear with the two centres. No map
   facts (the tools build points, not maps). Export 'numeric'. Family points.

### The GUI (packages/editor, apps/web)

9. **The Tangent tool takes two curves.** `ToolUI.pair = { slot, prompt }` (data): when only the
   curve step is filled, a click on (or a panel choice of) ANOTHER circle or conic completes the
   tool with the two curves; a click that hits a point or the first curve itself keeps its
   meaning (the point; a glider on the first curve and the tangent there), so every earlier flow
   is unchanged. The status line says so after the first curve: "Tangent: point (or a second
   circle or conic for the common tangents)"; the first prompt ("point and circle, in either
   order", a frozen e2e test) is unchanged.
10. **One batch** (ADR-0024 decision 2, machine-tangents.ts): every common tangent that is not a
    full line of the figure yet (same carrier, decided with EPS; ADR-0029: a repeat is not added
    again, and with none left the build is refused with that reason) is written
    `tangent(c1, c2, selectors)` with the GUI choice for its touch point on c1 (choice.ts decides
    `tangent` of two curves as `tangent_point`, as it does tangent_from); one history entry. No
    common tangent → refused with the kernel's reason ("no common tangent: one circle lies inside
    the other"). With more than two candidates, tangents no selector singles out are named in the
    notice ("2 of 4 common tangents built; the others: …"); with two, the build is refused.
11. **The choice for common tangents** (choice-many.ts with every count, choice-tangents.ts):
    other(P, Q, R) (never applies) → the filters and near(P) of ADR-0043 decision 14 when one
    reaches ROBUST_SIGMAS → then the along(±) tier: along(±) alone when it singles the tangent out
    (the double tangent of two tangent circles); else along(±) with near(P) / far_from(P) for a
    point of the construction that tells the tangent from the other one of its pair by at least
    ROBUST_SIGMAS (both reflection-equivariant); else along(±), orient(±) (structural,
    orientation-dependent: the only orientation-dependent choice, written when nothing else
    decides, as SPEC §7's tier 3) → a weaker filter (the ADR-0043 fallback with its note) →
    near(P) for an incident point. Conic ∩ conic is unchanged (its pairs have no along label).
12. **Exsimilicenter and Insimilicenter tools** in the Centers group (tools-centers.ts): pick two
    circles, build `exsimilicenter(c1, c2)` / `insimilicenter(c1, c2)`. Every letter and digit is
    a tool's key already; their keys are `.` and `:` (free; `<` and `>` would be escaped in the
    palette's titles). Icons: apps/web/src/icons-similitude.tsx (two circles, two common tangents
    and their meeting point), spread into icons.tsx's Record.

### Tests (kernel, lang, discovery, editor)

13. Degenerate cases by name (`degenerate-similitude.ts`, `degenerate-common-tangents.ts`); the
    property tests (`similitude-properties.ts`: the homotheties of ratio ±r₂/r₁ about E and I take
    O₁ to O₂, in either order; equal radii; (O₁, O₂; I, E) harmonic); L3 on figures whose four
    tangents are rational (`laws/l3-common-tangents.test.ts`: r₁ ± r₂ = D·cos of two rational
    angles), with tangencies, equal radii and random circles; L11 through both tangencies
    (`laws/l11-common-tangents.test.ts`); the mirror test (`common-tangents-mirror.test.ts`);
    theorems (`theorems-common-tangents.test.ts`): the external common tangents meet at the
    exsimilicenter, the internal at the insimilicenter, Monge's theorem twice (exact over Q),
    and every common tangent of ellipses and circles is tangent to both curves and touches the
    first at tangent_point. Guarantees: tangent(c1, c2): tangent to both curves (the claims'
    `tangent` kind on both); tangent_point(c1, c2): on c1, and the tangent of c1 there is tangent
    to c2; discovery's guarantees-hold test checks each on figures stable under the local noise.
    The language reads, prints and diagnoses the new overloads (`lang/test/common-tangents.test.ts`).
    The editor: `editor/test/common-tangents-tool.test.ts` (four tangents in one entry, tangent to
    both circles, two along(−) and two along(+); reflection-equivariant selectors when a point
    separates the pairs; a repeat refused; inside refused with the kernel's reason; intersecting
    circles; a conic and a circle; the first curve clicked again; the two new tools, keys, group).

## Consequences

- Common tangents are one call with a structural choice for two circles: `along(−), orient(+)`
  reads "the external tangent on the left of O₁O₂", reflection-equivariant up to the side.
- `tangent` now chooses among candidates: the generated list of choosers in the "takes no
  selectors" hint gains it (a frozen test line, below).
- A common tangent that is an asymptote of the first curve is not a candidate (its touch point is
  at infinity); swapping the curves makes it one when the second curve touches it at a finite
  point.

## Frozen tests changed

- `packages/kernel/test/selector-check.test.ts:162`: the hint "remove the selectors: only
  intersect, tangent_point, tangent_from, foci choose among candidates" lists the registry's
  branchable tools, generated; `tangent` is one now: "only intersect, tangent, tangent_point,
  tangent_from, foci …". The line cannot grow by insertion (ADR-0044 item 2 is the precedent).
- `packages/kernel/test/helpers/conic-samples.ts:14`: the construction-key samples of tools
  declared outside construction-key.test.ts (which is at the 400-line limit, ADR-0042's reason for
  this helper) were one line, `samples: { conic: [...] }`; the two symmetric tools add their
  samples (`exsimilicenter: ['c', 'd']`, `insimilicenter: ['c', 'd']`), so the line becomes an
  object over several lines. The conic sample is unchanged.
- Added lines only (not changes): degenerate.test.ts (the new cases' spreads),
  registry.test.ts (two tool names), radical.test.ts (the flagged list), tools.property.test.ts
  (the property list), discovery's guarantees-hold.test.ts (figures of the new overloads).

## Alternatives considered

- **A new tool `common_tangent(c1, c2)`**: the request names the tangent tool; a second name for
  "tangent of two curves" adds nothing, and the hint line changes either way.
- **Judging a line by its own position** (its foot from a centre, its direction): the touch
  point is what the user clicks and what tangent_from already judges.
- **orient(±) alone as the circles' low-level selector** (with near(O₂) / far_from(O₂) to tell
  internal from external): a ranker ranks among the candidates that exist, so when the internal
  pair vanishes `near(O₂)` silently takes an external tangent — a jump through a tangency. The
  structural along(±) label gives Undefined there instead, and it is reflection-equivariant.
- **A new selector name (internal / external)**: a language change for what along(±) already
  expresses with SPEC §7's definitions.
- **other(T) via the reflection in the line of centres** (the mirror tangent, exact): useful but
  not asked; along/orient already name each branch structurally.
- **The resultant in the line coordinates** for conics: the pencil in the dual is the same
  algorithm ADR-0043 audited, with the same band decisions.
- **Concentric circles → the common centre** for both centres of similitude (the continuous
  limit): the request says Undefined; recorded as Uncertain for the maintainer.
