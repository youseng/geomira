# @geomira/kernel

The construction kernel (SPEC §4, §5, §6, §9): field-generic values, the document model
and its invariants, the tool registry, and the evaluator. Pure: no DOM, no framework, no
module-level mutable state; it imports only `@geomira/num`. The root entry exports only
`VERSION`; import the subpath modules below (ADR-0002). Representation choices are in
ADR-0003.

| Module                           | Contents                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@geomira/kernel/value`          | `Value<T>` (Point, Line with `chiral`, Circle, Num, Polygon, Transform, Undefined, Inexact), capabilities  |
| `@geomira/kernel/expr`           | `Expr` (Ref by id, exact Lit, Call with selectors), `refsOf`, `exprEquals`                                 |
| `@geomira/kernel/names`          | the name grammar of SPEC §11.2 (`isUserName`, `nameProblem`)                                               |
| `@geomira/kernel/document`       | `Document` and its parts, `emptyDocument`                                                                  |
| `@geomira/kernel/invariants`     | `checkInvariants`, `assertInvariants` (I1–I8)                                                              |
| `@geomira/kernel/edit`           | immutable helpers: `addObject`, `removeCascade` (+ `dependents`), `renameObject`, `redefineObject`, styles |
| `@geomira/kernel/layers`         | `addLayer`, `updateLayer`, `removeLayer`                                                                   |
| `@geomira/kernel/tool`           | `ToolSpec` (one `compute<T>` per tool), `Signature`, `EvalContext`                                         |
| `@geomira/kernel/registry`       | `createRegistry()` (a value, never a singleton), capability-based overload resolution                      |
| `@geomira/kernel/context`        | `evalContextFor(doc)`: `scale` = diameter of the free points and explicit radii                            |
| `@geomira/kernel/evaluate`       | `evaluate` (total, any field), `evaluateFrom` (incremental, equal to a full evaluate)                      |
| `@geomira/kernel/docs`           | the tool reference generated from the registry (`pnpm docs:tools` → docs/tools.md)                         |
| `@geomira/kernel/glider`         | gliders: `gliderPoint`, `gliderParameter` (exact inverse), `dragParameter` (the drag map)                  |
| `@geomira/kernel/selector`       | branch selectors as values; `isOrientationDependent` (SPEC §7, law L16); `formatSelector`, `formatExpr`    |
| `@geomira/kernel/selector-check` | the parse-level checks of SPEC §7: bare indices, missing selectors, misapplied selectors (static kinds)    |

## Tools (Run 2)

point, param, midpoint, divide, foot, intersect, circumcenter, centroid, orthocenter, line,
segment, ray, parallel, perp, perp_bisector, dist, ratio, angle, dangle, area, polygon, add,
sub, mul, div, neg (Run 2); circle, circumcircle, cline, diameter_circle, ninepoint_circle,
center, on, other, tangent, polar, radical_axis, incenter, excenter, incircle, excircle,
bisector, ext_bisector, sqrt, sin, cos, tan (Run 3a; the functions on numbers by
ADR-0005); ninepoint_center, power, radius, tangent_point, tangent_from, and intersect of
lines and circles with branch selectors (Run 3b, ADR-0006: candidates decided on the
discriminant with the band, filters, rankers, other(P) by Vieta, along / orient). Their
signatures, degenerate cases and exactness are in
[docs/tools.md](../../docs/tools.md), generated from the registry; `pnpm docs:exactness`
prints the exactness table.

## Testing

- Laws (packages/kernel/test/laws/): L1 totality over 2,000 fuzzed documents in all three
  fields, L2 determinism and `evaluateFrom ≡ evaluate`, L3 the exact oracle (float vs
  RationalField, excluding inputs within BAND of a degeneracy) with a mod-p differential.
- Theorems over Float and Rational (Run 3a: 16 circle theorems, the side-length tools
  exactly on Heronian triangles), the chirality flag against mirrored figures, glider
  round trips and the drag map, cline switching, L1 for circle degeneracies
  (laws/l1-circles.test.ts) and for sqrt/sin/cos/tan (laws/l1-functions.test.ts), one
  property test per tool, one test per declared degenerate
  case, invariants under random helper sequences.
- Branch selection (Run 3b): every selector against its predicate on 500 random figures,
  mirror tests (gliders re-projected by position; orientation-dependent selectors pick the
  other candidate), every deciding quantity at the band edges, law L11 (continuity through
  tangency), L1 and L3 for branchable calls (laws/l1-branch, laws/l3-branch), 13 theorems
  that need selectors, the parse-level checks.
- Coverage: `pnpm test:coverage` (part of `pnpm verify`) fails below 90% lines or 85%
  branches. Mutation testing of the geometry (`geom.ts`, `tools/`): `pnpm mutation:kernel`,
  nightly in CI (reports in `reports/mutation/kernel/`).
