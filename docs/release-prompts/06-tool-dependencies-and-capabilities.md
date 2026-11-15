# Prompt 06: Make construction tools agree about dependencies and inputs

You are implementing this Geomira release task. The maintainer has authorized
these corrections and has separately decided to remove public claim-testing and
discovery controls for now. Do not restore those controls as part of this task.

Read `docs/release-prompts/README.md` first for the shared execution contract and
work order, then `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the ADRs required
by the repository. Inspect the current revision and existing changes. The audit
baseline is `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`; paths and line numbers may
have moved. Reproduce each issue before editing, and avoid duplicating a fix
already present. This prompt is an implementation task, not another review.

## Scope and starting points

Own construction identity, picker capabilities and selection-input consumption:

- `packages/editor/src/machine-build.ts`: `pointAt` and intersection filtering.
- `packages/editor/src/machine-tangents.ts`: `lineThere` and common tangents.
- `packages/editor/src/machine.ts`: `HIT_KINDS`, `PICK_WORDS` and input handling.
- `packages/editor/src/tools-v11.ts`: Apply transformation input metadata.
- `packages/editor/src/selection-tool.ts`: `fitOf`, `feed` and automatic finish.
- Existing tests include `common-tangents-tool.test.ts`,
  `tangent-coincidence.test.ts`, `conic-tools.test.ts` and
  `selection-tool.test.ts` in `packages/editor/test`.
- Read ADR-0024, ADR-0029, ADR-0042, ADR-0045, ADR-0051 and ADR-0064 closely.

## Reproduction A: coincidence suppresses a dynamic tangent

Load this script, choose Tangent, then choose `c` and `d`:

```text
O=(0,0)
B=(3,0)
c=circle(O,2)
d=circle(B,2)
a=line((-2,2),(5,2))
b=line((-2,-2),(5,-2))
```

Actual: “every common tangent of these curves is a line of the figure already.”
The two independent lines currently coincide with the two common tangents, but
depend on neither circle. Move `B` to `(3,1)`: their distances from its center
are 1 and 3, so neither remains tangent to the radius-2 circle.

Expected: create dependent tangents which continue to satisfy both circles.
An independently defined coincident line is not an equivalent construction.
Keep the existing reuse of equivalent constructions and one-undo batching.
Do not simply remove all deduplication or change dependency relationships of
existing independent objects without an explicit user action.

## Reproduction B: coincidence suppresses dependent intersections

```text
O=(0,0)
A=(-2,0)
B=(2,0)
c=circle(O,1)
l=line(A,B)
P=(-1,0)
Q=(1,0)
```

Choose Intersection, then `c` and `l`. Actual: refuses because both current
intersection positions already contain points. `P` and `Q` are free points.
Expected: construct intersections whose dependencies and branch choices survive
moving the parents; leave `P` and `Q` free. A repeated request for the same
dependent intersections should still reuse them according to the documented rule.

## Reproduction C: conic transformation works in text but not the GUI

```text
k=conic((2,0),(0,1),(-2,0),(0,-1),(6/5,4/5))
l=line((0,0),(1,0))
t=reflect(l)
x=apply(t,k)
```

The script's `x` evaluates to a conic. GUI Apply transformation accepts `t` but
rejects `k` with “pick a point, line, circle or polygon.” Make the GUI support
the kinds accepted by this operation. Inspect each consumer of shared pick
metadata: admitting conics everywhere could expose a different unsupported
overload. Direct `reflect(k,l)` sugar was also unsupported in the audited build;
do not treat it as the already-working reference. Use `apply(t,k)` as the oracle.
For ideal points, distinguish panel selection from nonexistent canvas hit shapes;
either implement supported panel behavior or explicitly document the boundary.

## Reproduction D: selection first disagrees with sequential picking

Create `A=(0,0)`, `B=(4,0)`, `C=(1,3)`, `D=(1,0)` and `l=line(A,B)`.
In the retained internal editor APIs, set Claim kind to `perpendicular`, return
to Move, select A, B, C, D in that order, then choose Claim. Actual: rejected as
the wrong number of objects. Choosing Claim first and feeding those four picks
sequentially creates `perpendicular(line(A,B),line(C,D))`. For `parallel`, a
selection of `l`, C, D fails in the same way.

One semantic line input can consume two selected points. Use the same input
consumption rules for preselection and sequential picks, including partial
pairs, repeated steps and order-free tools. Do not reintroduce a public Claim
button to test this; internal API tests retain coverage after prompt 01.

Also test this confirmed refusal-loss case: lock the main layer, select three
existing points, then choose Polygon. Automatic `finish` currently fails but its
reason is swallowed. The user sees pending picks without an explanation until
pressing Enter again. A complete failed construction must report its refusal
immediately while preserving the document and recoverable interaction state.

## Acceptance criteria

1. Add failing regressions for A–D and locked-layer finishing before fixes.
2. Compare dependency expressions as well as current coordinates. Move a parent
   after construction and assert the intended tangency/incidence still holds.
3. Preserve stable branch selection, genuine degeneracy handling, equivalent
   construction reuse, undo/redo, IDs, styles and document invariants.
4. Exercise both selection-first and sequential input for complete and partial
   selections, line-or-two-points slots, circles, variable-length polygons and
   order-free tools. Refused inputs must not partly modify the document.
5. Test Apply transformation on its supported ordinary shapes and conics;
   confirm text/GUI construction equivalence and the existing export path.
6. Add a focused browser regression for the visible tangent/intersection and
   conic-transform workflows. Test retained claim machinery at the API layer.
7. Keep the public testing/discovery surfaces disabled. These corrections must
   not undo prompt 01's product-scope decision.

## Boundaries, validation and handoff

This task does not add new geometry tools, redesign the palette, rewrite the
parser or expand the claim language. Prompt 07 owns numerical geometry;
prompt 08 owns sampling. Coordinate shared editor/UI changes with prompts 01
and 09 through the shared contract rather than editing their files concurrently.

Existing tests remain add-only unless an ADR explicitly changes the relevant
behavior. In particular, review the geometry-based reuse decision in ADR-0029;
write a superseding ADR if required instead of silently contradicting it.
Never disable tests, reduce the count floor or weaken tolerances to obtain green
results. Preserve unrelated historical decisions.

Run the relevant editor, kernel and browser regressions, then the repository's
required verification/build checks. Record commands actually run, outcomes and
environment limits; do not claim CI results that were not observed. Update
SPEC/STATUS/CHANGELOG and generated tool documentation only where this behavior
requires it. Return a concise before/after account, the regression locations,
any frozen-test changes with their ADR, and remaining capability gaps.
