# ADR-0003: Kernel representation choices (values, document, registry, evaluation)

Status: accepted (Run 2). Extends ADR-0001 (items 5–7) and ADR-0002; supersedes nothing.

## Context

Run 2 builds the kernel core (SPEC §4, §5, §6.1, §9) and the line-based tools. SPEC fixes
the fields of every value and of the document, but leaves several representation details
open, and two points of §6.1 cannot be built yet without designing later runs' features
(branch selection is a later run). Every choice below is recorded so that later runs can
rely on it, or change it with an ADR.

## Decision

### Values (packages/kernel/src/value.ts)

1. **Unbounded line ranges are `null`**, not ±Infinity: `Line.lo` / `Line.hi` are `T | null`
   (null = −∞ for `lo`, +∞ for `hi`). SPEC §4 permits infinities only as range bounds; a
   `null` bound works in every field (a Rational has no infinity) and keeps "no ±Infinity
   inside a Value" absolute.
2. **`Num.exact` is a `Rational`**: the exact value of a number computed from exact literals
   by exact arithmetic (`+ − × ÷`, unary minus, `param`), carried in every field, so the
   float run still knows that `2/3` is exactly 2/3. Measures (dist, angle, …) never set it;
   exactness of constructions is still discovered by running over RationalField (§3.4).
3. Every SPEC §4 kind is in the `Value<T>` union now (Point, Line, Circle, Num, Polygon,
   Transform, Undefined, Inexact), so later tools add no kinds. Reserved kinds (IdealPoint,
   Conic, Locus) are documented only. Capability tests take any `{ kind: string }`, so an
   unknown future kind matches no capability and every tool rejects it with
   Undefined("<tool> does not accept …") (E2).

### Document (packages/kernel/src/document.ts)

4. **References are by id** (`{ kind: 'ref', id }`), so renaming never rewrites
   definitions. One counter `nextId` issues the ids of objects, claims, assumptions and
   layers (layer ids are `"L<n>"`, except `"main"`); I6 checks that every id is below it.
5. **Claims and assumptions are stored as data** `{ id, kind: string, args: Expr[] }`
   (claims also have an optional name). The kernel only checks I5 (their references
   exist); packages/claims gives `kind` its meaning.
6. **Managed names**: a derived layer's suffix is one or more `*` (SPEC §11.2: a trailing
   star is part of a name only on managed images), so user names never end in `*`. A
   managed object's name is its source's name plus the suffix (checked by I4).
7. **Edits on derived layers in Run 2**: rules are not created by Run 2's helpers (derived
   layers are a later run), but every helper keeps I4 on documents that have them:
   renaming a source renames its images; styling a source `[noimage]`, or moving it out of
   the rule's source layer, removes its images (with their dependents); removing a rule's
   transform clears the rule and removes its images; removing a derived layer removes its
   images; a layer that is the source of a rule cannot be removed; managed objects cannot
   be renamed, redefined or moved to other layers directly.
8. **Removing a layer** moves objects that lived only in it to `main` (objects are never
   deleted implicitly, except managed images as in 7) and drops it from every view.
9. **Redefine** rejects a definition that references the object itself or one of its
   dependents (cycle). Otherwise, if the new definition references a later object, the
   objects are reordered by a stable topological sort (original order as the tie-break),
   which keeps I2 and I4.

### Tools and registry (packages/kernel/src/tool.ts, registry.ts)

10. **`compute<T>(F, args, ctx)` has no `selectors` parameter in Run 2.** No Run 2 tool is
    branchable, and the selector values (`same_side(Q, l)` …) belong to the branch-selection
    run, which adds `candidates` and the evaluated selectors to ToolSpec by ADR. Until
    then, a call that carries selectors evaluates to Undefined("<tool> takes no
    selectors"). The selector syntax tree itself (`Selector` in expr.ts) is already part of
    the document model, so documents do not change shape later.
11. **Export mappings are `'numeric'` for every Run 2 tool.** Constructive mappings must be
    verified against the olympiad.asy source (SPEC §14), which arrives with the export
    run; 'numeric' is the explicit choice CLAUDE.md allows.
12. **Examples are data** (argument values as exact strings). The generated tool reference
    (docs/tools.md, `pnpm docs:tools`, freshness checked by a test) runs every example over
    FloatField and RationalField; a tool's "exact run" column says whether some example
    succeeds over RationalField, so exactness is discovered, not declared (§3.4).

### Tool semantics left open by SPEC

13. `area` is unsigned (|shoelace| / 2). |x| uses the field's sign; mod p there is no
    order, so `area`, `angle` and `dist`-like results are Inexact there.
14. `dangle(A, B, C)` is the directed angle ∡ABC (from line BA to line BC,
    counter-clockwise) as the representative in [0°, 180°). Choosing the representative is
    a decision: when cross(A − B, C − B) is zero (EPS) the result is exactly 0; inside the
    band it is Undefined("ambiguous: …"), never a silent jump between ~0° and ~180°.
15. `intersect(a, b)` on segments and rays requires the intersection to lie in both ranges:
    outside → Undefined; within the band of an endpoint → Undefined("ambiguous: …"); mod p
    (no order) → Inexact. `foot` projects onto the carrier line of a segment or ray.
16. `param(min, max, v)` requires min < max and v in [min, max] (both inclusive, decided
    with the band); mod p the range is not checked, because the mod-p rung draws free
    values itself and an identity does not depend on them.
17. Arithmetic treats numbers as dimensionless: division by a number that is zero
    (EPS, dimensionless) is Undefined("division by zero").
18. **Scale**: `evalContextFor(doc)` takes the bounding box of the free points (every
    `point(x, y)` call whose two arguments are literals, anywhere in a definition). SPEC
    §3.1 also counts explicit radii; circles arrive in a later run, which adds them here.
    A figure beyond MAX_SCALE has no context; `evaluate` with an invalid context returns
    Undefined for every object (it never throws).
19. **Float range** (found by law L1 in this run): FloatField intermediates can overflow
    even when every argument is finite (|d|² of coordinates near 1e200 is ∞, and
    `FloatField.sqrt(∞)` throws). `evaluate` therefore does not call a tool with a
    FloatField argument beyond 2^200 in magnitude: every v1 formula is a polynomial of
    degree ≤ 4 in its arguments whose divisors are at least (EPS·scale)², so below that
    bound no intermediate overflows. Such an argument, and a non-finite result, give
    Inexact ("not representable for geometry in this field"), so a Value never holds NaN
    or ±Infinity. A tool added later with higher-degree formulas must lower the bound
    (this ADR records the argument).
20. A value whose kind is outside the union (a future or test-only kind, E2) is passed
    through untouched by the evaluator's range checks; tools reject it by capability.

## Consequences

- Later runs extend ToolSpec (candidates, selectors, constructive export mappings) and
  evalContextFor (radii) by ADR; the value union and the document shape stay as they are.
- Mod p, any construction that needs an order (segment ranges, unsigned area, undirected
  angles) is Inexact, so the mod-p rung can never silently ignore a range or a sign.

## Alternatives considered

- ±Infinity for unbounded ranges: impossible in RationalField and ModPField without a
  separate bound type; `null` is simpler and field-independent.
- A try/catch around tool computations in `evaluate`: rejected. It would hide caller bugs
  and make law L1 vacuous; totality is guaranteed by explicit checks and tested by fuzzing.
- Signed area: its sign flips under mirroring and is not what a user means by area; a
  signed measure can be added later as a separate tool.
- Making intersections of segments ignore the ranges: GeoGebra-style "undefined outside
  the segment" is what users expect, and it keeps the segment a segment.
