# Prompt 07: Preserve valid geometry under coordinate translation

You are implementing this Geomira release task. Fix the two confirmed numerical
defects below without weakening the project's degeneracy semantics or exact
arithmetic. Public claim testing is being removed separately; measurements,
conics and their construction tools remain part of the released application.

Read `docs/release-prompts/README.md` for the shared execution contract and work
order, then `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the repository-required
ADRs. Inspect the current revision and preserve existing changes. The audited
baseline is `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`. Reproduce the cases on the
current code before editing; this is an implementation task, not a request to
make the test expectations match the current incorrect outputs.

## Scope and starting points

- `packages/kernel/src/tools/measures.ts`: `areaOf`, audited around line 126.
- `packages/kernel/src/conic.ts`: conic representation and `qValue`, around 76.
- `packages/kernel/src/tools/conics.ts`: tangent incidence check, around 87.
- Follow the conic creation/normalization/evaluation helpers those functions use.
- `packages/num/src/tolerance.ts` remains the sole numeric-tolerance authority.
- Read SPEC sections 3, 4, 6 and 17 and ADR-0042, ADR-0043 and ADR-0044 closely.
- Inspect existing `packages/kernel/test/conic-core-behaviour.test.ts`,
  `conic-type-scale.test.ts`, `conic-conic-far-centre.test.ts`,
  `conic-to-circle-conditioning.test.ts` and `laws/l3-oracle.test.ts`.

## Reproduction A: area of a translated unit triangle

```text
A=(100000000,100000000)
B=(100000001,100000000)
C=(100000000,100000001)
s=area(A,B,C)
```

Actual: FloatField produces 0. RationalField produces exactly 1/2. Subtracting
`(100000000,100000000)` from all three input points restores the float result 0.5.
The supplied coordinates and their unit differences are exactly representable.
The audited algorithm accumulates raw world-coordinate cross products, losing
the small area through cancellation.

Expected: an unsigned area of 0.5 for both coordinate placements, with the same
existing behavior for reversed orientation, polygons and collinear vertices.
Investigate an area computation relative to a local origin using the generic
field operations. Do not replace the shared implementation with a float-only
special case that diverges from RationalField or the other field semantics.

## Reproduction B: a conic rejects its own defining point

```text
A=(1000005,1000000)
B=(1000000,1000005)
C=(999995,1000000)
D=(1000000,999995)
E=(1000003,1000004)
k=conic(A,B,C,D,E)
t=tangent(A,k)
```

These five exact integer points lie on the circle of radius 5 centered at
`(1000000,1000000)`. They intentionally construct a conic, exercising that value
kind rather than the circle implementation.

Actual: `k` is constructed but `t` is Undefined with a message that the tangent
needs its point on the conic. The same shape translated to the origin works.
At offset 100000 the audited predicate can already be ambiguous. Normalizing
construction locally and then evaluating cancellation-prone world coefficients
does not retain that numerical benefit.

Expected: each defining point is incident within the documented numerical
contract, and its tangent is valid and transforms consistently with translation.
A point genuinely off the conic must still be rejected. Do not special-case
membership by object name or bypass the incidence check for named inputs.

## Implementation constraints

1. Choose a numerically stable computation or representation after tracing the
   relevant consumers. Explain why it retains useful precision in these cases.
2. Keep the field-generic exact path and current public APIs unless a justified
   design change is necessary. A representation change requires an ADR and a
   complete inventory of evaluation, transforms, clipping, hit-testing,
   selectors, printing and exports that consume it.
3. Do not simply enlarge EPS/BAND, loosen an assertion, snap points onto a curve,
   catch the failure and draw a guessed result, or hard-code these coordinates.
4. Distinguish cancellation in well-conditioned local geometry from genuinely
   ill-conditioned inputs. Retain Undefined/ambiguous results with honest reasons
   where the mathematical or representational limit requires them.
5. Introduce no NaN/infinity values, new runtime dependencies or alternate global
   tolerance constants. Keep deterministic behavior and existing field rules.

## Acceptance criteria

- First add regressions that fail for both scripts on the audited behavior.
- Assert exact RationalField results and compare FloatField on representable
  rational inputs away from genuine degeneracies, using existing tolerances.
- For area, cover points and polygon overloads, orientation reversal, collinearity,
  translation in both directions and a few meaningful scales.
- For conics, cover defining-point incidence, tangent validity, a nearby but
  genuinely off-curve point, center/type consistency and representative
  intersections before/after translation.
- Add focused translation/scaling properties with deterministic seeds. Include
  offsets 0, 100000 and 1000000 for the conic, and 100000000 for the unit-area
  case. Choose other inputs by their conditioning and representation, not a huge
  arbitrary sweep that mostly tests near-degenerate or unrepresentable cases.
- Ensure a stable local computation is not discarded by a later world-coordinate
  conversion in the same tool chain. Exercise at least one downstream consumer.
- Confirm the fixes do not change valid exact results, branch identity, undo/file
  behavior or the visual/export agreement in the existing regression suites.
- Run a focused browser check of the displayed area and conic tangent after the
  algorithmic tests, plus export checks appropriate to affected representations.

## Boundaries, validation and handoff

Prompt 06 owns GUI pickers and construction deduplication. Prompt 08 owns the
sampler and its exact fixed-radius ratios; do not work around sampler corruption
by altering the geometry kernel. Do not restore public testing/discovery controls.
New exact-field extensions and additional geometry tools are future work.

Follow the shared contract's failing-test-first workflow. Existing tests remain
add-only except explicitly justified ADR changes; do not disable tests, lower
the count floor or weaken numerical expectations. Run targeted regressions and
the required repository verification/build/export checks once the change settles.

Document actual commands and results, any platform limits, the numerical method,
its limits and any representation/API consequences in the prescribed project
records. Return the original incorrect result and corrected result for each
script, regression locations, and an explicit list of downstream consumers tested.
