# ADR-0006: Candidates and selectors (Run 3b)

Status: accepted (Run 3b). Supersedes ADR-0003 item 10 (`compute` takes no selectors);
extends ADR-0003 items 11, 15, 19 and ADR-0004 items 1–3 and the consequences of ADR-0005.

## Context

Run 3b builds branch selection (SPEC §7): candidate lists for `intersect` of curves,
`tangent_point` and `tangent_from`; the filters, rankers and low-level selectors; the band
rules; the parse-level errors for bare indices and missing selectors; and
`isOrientationDependent`. SPEC fixes the selector vocabulary and the rules, but leaves open
the shape of `compute` with selectors (SPEC §6.1 writes `compute(F, args, selectors, ctx)`,
while Run 2's frozen tests call `compute(F, args, ctx)`), how tangency is decided (the
maintainer's note on ADR-0005: on the discriminant itself, with tolerance.ts; in band → one
double point; clearly negative → Undefined; clearly positive → two candidates), how
`other(P)` is computed, what `on_arc` and `between` mean exactly, and where "parse-level"
checks live before the language exists. The run's acceptance also asks for every SPEC §6.2
tool to be registered; the audit found three tools that earlier runs missed.

## Decision

### Tool interface (packages/kernel/src/tool.ts, selector.ts)

1. **`compute<T>(F, args, ctx, selectors?)`**: the evaluated selectors are the LAST,
   optional parameter. SPEC §6.1's order (selectors before ctx) would change the meaning of
   every existing call `compute(F, args, ctx)` in Run 2's frozen tests; the content is the
   same. Tools without `candidates` never receive selectors: the evaluator keeps answering
   "<tool> takes no selectors".
2. **`candidates?<T>(F, args, ctx): readonly Value<T>[]`** as SPEC §6.1 says: the values a
   call can select, 0–2 (a double point is one), in a fixed order; none (or a degenerate
   input) → `[]`; positions that are not representable → Inexact entries (one per
   candidate). It is for the editor's GUI choice (a later run); `compute` gives reasons.
3. **`Signature.branch: BranchShape`** marks the overloads of a branchable tool:
   `{ candidates: 1 | 2, low: 'along' | 'orient' | 'none', other, describe }`. intersect:
   line ∩ line (1, none, no other), line ∩ circle (either order: 2, along), circle ∩ circle
   (2, orient); tangent_point / tangent_from (2, orient). The evaluator and the static check
   read it; nothing else enumerates tools.
4. **`EvaluatedSelector<T> = { selector, args, text }`**: the selector's syntax, the values
   of `selectorExprs(selector)` in order, and its text for messages (names of objects). An
   Undefined selector argument gives "Q is undefined" as for arguments; the float range
   limit of ADR-0003 item 19 applies to selector arguments too.
5. New public subpaths: `@geomira/kernel/selector` (`isOrientationDependent`,
   `selectorClass`, `formatSelector`, `formatExpr`) and `@geomira/kernel/selector-check`
   (the parse-level checks, item 14). Internal: `select.ts` (the selection engine),
   `tools/pairs.ts` (the geometry of candidates), `tools/range.ts` (segment and ray ranges,
   moved from intersect.ts), `tools/tangent-from.ts`.

### Candidates (packages/kernel/src/tools/pairs.ts, tangent-from.ts)

6. **The count is decided on the discriminant measured as a LENGTH, with the band**: line ∩
   circle on r − h (h the distance from the centre to the line), circle ∩ circle on
   r₁ + r₂ − d and d − |r₁ − r₂|, tangents from P on |OP| − r. Each is
   (a² − b²)/(a + b) from the squared quantities (`rootGap`, incidence.ts), so no square
   root of a rounding residue is ever taken (ADR-0005's consequence) and small and large
   circles are judged alike (as ADR-0004 item 1 does for incidence). sign3: clearly
   negative → Undefined ("no intersection: the line misses the circle", "… the circles are
   apart", "… one circle lies inside the other", "tangent_point(P, c): P lies inside the
   circle"); within the band (zero or ambiguous) → ONE double point; clearly positive →
   two candidates. Over Q the signs are exact (circle ∩ circle uses the exact sign of
   D = 2s(r₁² + r₂²) − s² − (r₁² − r₂²)² = 4s·h² when the radii are not rational). Mod p
   there is no order: an exact zero is the double point, anything else two candidates,
   whose square roots are Inexact; "misses" is not decidable mod p.
7. **Positions** are mid ∓ √rad·dir: mid is the foot of the centre on the line (line ∩
   circle), the point of the line of centres on the common chord (circle ∩ circle), the
   midpoint of the chord of contact O + (r²/|OP|²)·(P − O) (tangents); the double point is
   mid. The square root is the only Inexact source. Each candidate carries a STRUCTURAL
   low-level label: mid + off is further along the line's direction d (along(+)), has
   cross(O₂ − O₁, X − O₁) > 0 (orient(+) of two circles), and has cross(O − P, T − P) < 0
   (orient(−) of a tangent choice). The double point is labelled 0. No numeric decision is
   needed for a label: the count already decided that the candidates are distinct.
8. **Segments and rays**: a candidate outside the range is not a candidate (the list keeps
   the others; none left → "no intersection: it lies outside the segment"); within the band
   of an end → Undefined (ambiguous); mod p → Inexact (ADR-0003 item 15).
9. **tangent_from** is the tangent at the chosen touch point T: through T, direction
   rot90(T − O), CHIRAL (as tangent(T, c)); it passes through P. Selectors judge T (a line
   has no position to compare). tangent_point and tangent_from have identical candidates.

### Selection (packages/kernel/src/select.ts)

10. Selectors are applied IN ORDER to the candidate list; each keeps a sub-list:
    - filters keep the candidates that satisfy them: `same_side(Q, l)`,
      `opposite_side(Q, l)` (signed distances to the carrier of l, as lengths);
      `on_arc(B, C, [not] A)`: on A's side of line BC (for points of one circle through B
      and C this is the arc BC that contains A), `not`: the other side; `between(A, B)`:
      strictly between the perpendiculars to AB at A and at B (on segment AB for points of
      line AB); `inside(c)` / `outside(c)` (the gap to c as a length);
    - rankers keep the better of two candidates: `near(P)`, `far_from(P)` (distances
      compared as a length, ties within the band → Undefined); with one candidate they keep
      it;
    - low-level selectors keep the candidates with their label, and the double point under
      both signs. A label names a BRANCH of the pair (along(+): the further of the two
      intersections of the carrier line; orient(+): the one on the positive side), not a
      rank among the survivors: when that branch was removed (off a segment, by a filter)
      the result is "no … satisfies along(+)", never the other branch, so moving a figure
      never silently switches branches.
      A reference that is meaningless (Q on l, B = C, A = B, a non-circle for inside) →
      Undefined; a deciding quantity of a candidate or a reference within the band →
      Undefined("ambiguous: …"); mod p, any order-based decision → Inexact. After all
      selectors: zero survivors → Undefined("no intersection satisfies …"); two →
      Undefined("ambiguous: add a selector …"); one → the result.
11. **Two candidates and no selector** → Undefined("ambiguous: add a selector: line ∩
    circle has two intersections (for example …)") BEFORE any square root, so every field
    gives the same answer (over Q the roots might be irrational). With a segment or ray the
    list is computed first (one candidate may be off the range).
12. **other(P)** (a ranker, "P must lie on both objects within BAND"): P's incidence with
    both objects is the banded decision of incidence.ts (ADR-0004 item 1: on within
    EPS·scale, ambiguous inside the band, otherwise "needs the point on …"). The other
    point is computed WITHOUT square roots, exactly as the other() tool: Vieta (twice the
    foot of the centre minus P) on line ∩ circle, the reflection of P in the line of
    centres for two circles and in line OP for tangent choices (whose two objects are c and
    the polar of P: a point is a touch point iff it lies on both). So `other(P)` is exact in
    every field, which the mod-p rung needs (SPEC §10.5). The candidate list is the other
    point alone: other(P) keeps "the candidate farther from P", and P itself is never
    returned except as the double point (the other point within the band of P, or a count
    of one). Range checks apply to the other point only (as other()). other(·) may appear
    once per call (a second one could only empty the list). On two lines → Undefined.
13. **Applicability**: along(±) applies to line ∩ circle only; orient(±) to circle ∩ circle
    and tangent choices only; elsewhere → Undefined("along(+) does not apply to …: use
    orient(±)"). On line ∩ line (one candidate) along would choose nothing and could only
    mislead the orientation verdict (L16), so it is refused too.
14. **Parse-level checks** (`@geomira/kernel/selector-check`): `selectorDiagnostics` (a
    document) and `callDiagnostics` (one call, while parsing) decide STATICALLY,
    from the kinds an expression can have (a literal: number; a call: its tool's
    outputKinds; a reference: its object's), and report with a hint: a bare index (a
    trailing number on a branchable tool whose other arguments resolve), a call that can
    have two candidates and has no selector (for SOME argument kinds: `cline` may be a
    circle), selectors on a tool that takes none, along / orient / other where no overload
    accepts them, other twice. The language run reports these as parse errors with line and
    column; there is no parser yet. Evaluation agrees: a bare index evaluates to
    Undefined with the same message (instead of the registry's rejection), a two-candidate
    call without selectors to "ambiguous: add a selector", misapplied selectors as in 13.
15. **`isOrientationDependent(selector, line)`** is SPEC §7's definition verbatim:
    `orient(±)`, or `along(±)` with `line.chiral` (line: the line of a line ∩ circle call,
    null when there is none).

### Tangency, continuity and the band edge

16. In the band the count is one, so the call needs no selector and the result is the
    double point (SPEC §6.3), for exact and for rounded tangency alike. The price is a step
    at the EDGE of the band: just outside it the two candidates are mid ∓ h, h the exact
    half chord at the gap g = BAND·scale, so the selected point moves by h there:
    √(g(2r − g)) ≤ √(2rg) for line ∩ circle and for tangents from a point (to first
    order), and for two circles √(2r₁r₂g/(r₁ + r₂)) at external and √(2r₁r₂g/|r₁ − r₂|)
    at internal tangency (larger for nearly equal radii, i.e. nearly concentric circles).
    This h is exactly how far the exact intersection points move while the configuration
    crosses the band (they start together at tangency): the step is the problem's own
    conditioning over a band-wide motion, and it is bounded. Law L11's test checks this
    bound per pair; everywhere else the selected point moves continuously, and it never
    takes the other branch: through tangency it goes two → double point → Undefined.

### Float range

17. ADR-0003 item 19's bound still holds: the largest intermediates are cross²/|d|² on line
    ∩ circle (≤ 2⁸⁰⁴ / (EPS·scale)²), D / 4s² on circle ∩ circle (D ≤ 2⁸⁰⁴ as a product of
    four lengths in FloatField; s ≥ (EPS·scale)² after the concentric check) and
    r²(|w|² − r²)/|w|⁴ for tangents, all below 2⁹³⁰ < 2¹⁰²⁴. Laws L1 fuzz them.

### SPEC §6.2 audit

18. The registry was compared with SPEC §6.2 item by item (STATUS). Three tools that earlier
    runs should have registered were missing and are added: `ninepoint_center` (the
    midpoint of OH, family points), `power(P, c)` = |PO|² − r² and `radius(c)` = √r²
    (measures; radius is exact over Q exactly when r² is a rational square). The
    transformation tools (SPEC §8, a later run), the display marks and `text` (which need
    values the scene run defines) and the `triangle` sugar (the language run) are later
    runs' scope and are not registered here.

## Consequences

- Run 2's and 3a's tools and frozen tests are unchanged; line ∩ line keeps every reason.
- The claims run decides L16/L17 with `isOrientationDependent` and the selector kinds of a
  closure; `other(P)` keeps closures eligible for the mod-p rung.
- The language run calls `callDiagnostics` while parsing and turns each diagnostic into a
  parse error at the call's position; the editor's GUI choice uses `candidates`.
- A new branchable tool adds a Pair (two objects, a low-level reference, a count, mid/off,
  a Vieta map) and a BranchShape on its overloads.

## Alternatives considered

- SPEC §6.1's parameter order `compute(F, args, selectors, ctx)`: changes the meaning of
  frozen test calls (an ADR-justified modification of every direct-compute test) for no
  gain in content.
- Tangency within the band → Undefined ("ambiguous"): contradicts SPEC §6.3 (tangency → the
  double point) and the maintainer's rule; a tangent constructed with `tangent(P, c)` would
  have no intersection with its circle in FloatField.
- Deciding tangency on the half chord √disc: a rounding residue r of a zero discriminant
  becomes √r, up to ~3·10⁻⁴·scale, and a genuinely tangent figure gets two candidates.
- The raw discriminant as an area (vs BAND·scale²): calls a line at 0.95·r from the centre of
  a circle of radius 10⁻³·scale tangent.
- other(P) as a distance ranker over the square-root candidates: not exact, unusable mod p.
- other(P) returning P when the other point was filtered away (a literal "farther of the
  survivors"): returns the very point the user excluded.
- A richer `candidates` result (with reasons and labels): SPEC §6.1 fixes `Value<T>[]`;
  reasons come from `compute`.
- on_arc checking that A, B, C and the candidate are concyclic: the side test is the arc
  test whenever they are, and a definition that is total and continuous elsewhere.
