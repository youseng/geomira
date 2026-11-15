# Prompt 08: Correct shared sampling without restoring public claim testing

You are implementing this Geomira release task. The maintainer has chosen to
remove public claim-testing and discovery controls for now, while preserving
their implementation and saved-document syntax. Keep that scope reduction in
place. Randomize remains public and uses shared sampler code, so hiding the
testing UI does not make the sampling defects below irrelevant to the release.

Read `docs/release-prompts/README.md` for the shared execution contract and work
order, then `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the required ADRs.
Inspect the current revision and preserve unrelated changes. Audit baseline:
`95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`. Reproduce against current code before
editing. Do not enable a public experimental toggle as a shortcut to testing.

## Scope and starting points

- `packages/claims/src/sampler.ts`: literal radius sampling at 176–178 and
  `paramValue` at 213–219 in the audited revision.
- `packages/claims/src/free.ts`, sampler preparation and figure-size helpers.
- `packages/claims/src/randomize.ts` and `packages/editor/src/randomize.ts`.
- `apps/web/src/page.ts`: Randomize dispatch and error reporting.
- Internal `testClaim`/`evalClaim` entry points and the worker protocol.
- Later retained-engine checks: `apps/web/src/discovery-runs.ts` (`sameFigure`)
  and `packages/claims/src/hypotheses.ts` (`inOrder`).
- Read SPEC sections 3 and 10, ADR-0008 decision 13, ADR-0015, ADR-0017,
  ADR-0035 and ADR-0036 closely. Literal radii are fixed construction inputs
  scaled by a common similarity, not independent free radii.

## Release-critical reproduction A: unequal radii become equal

```text
O=(0,0)
F=(1000,0)
c=circle(O,0.01)
d=circle(O,0.02)
A=on(c,0)
B=on(d,0)
claim length(O,A,O,B,1)
```

Current evaluation correctly returns false, exact over Q. At seed 1 and n=200,
both local and global testing return all samples true. Browser testing with
fresh seeds also reproduced it. The distant unrelated F enlarges the sampling
grid; both literal radii round to zero and are replaced with one grid unit,
so sampled radii become 1/2 and 1/2. Removing F restores the false result.

Expected: the original 1:2 radius ratio is preserved by a common similarity.
Rounded free coordinates do not authorize changing fixed construction constants.
Fix the shared sampling semantics, not the displayed verdict or a special case
for this claim. Exercise the same invariant through Randomize as well as internal
testing. A possible design is one exact rational scale shared by fixed radii;
choose and justify the method that fits the existing field/budget architecture.

## Release-critical reproduction B: invalid inputs are silently repaired

```text
O=(0,0)
w=circle(O,0)
A=on(w,0)
claim on(A,w)
```

Actual: current construction is undefined, but the sampler makes the radius
positive and reports all sampled cases holding, including exact-over-Q results.
Expected: zero must not become positive merely to make sampling succeed. Retain
invalidity or return an explicit refusal/invalid-sample outcome according to the
documented contract. Do not invent a different valid construction.

## Release-critical reproduction C: reversed parameter bounds throw

```text
A=(0,0)
B=(1,0)
M=midpoint(A,B)
p=param(2,1,1)
claim collinear(A,M,B)
```

The parser accepts a document with an undefined parameter. Local testing of the
unrelated correct claim succeeds, but global testing throws because uniform(2,1)
is called before validating the range. Randomize with triangle type `any` raises
an uncaught RangeError and displays an Internal error banner.

Expected: validate the domain before sampling. Randomize returns a specific
actionable refusal with the figure unchanged; internal jobs return a structured
invalid/inconclusive result rather than an uncaught exception. Decide and document
how unrelated invalid free inputs affect sampling. Do not silently drop them,
swap user bounds or mutate an invalid value into a valid one.

## Acceptance criteria for the release-critical portion

1. Add failing tests for A–C before fixing them. Preserve seed determinism and
   inspect sampled documents, rather than checking only final verdict text.
2. Preserve exact ratios among fixed literal radii through common similarity
   scaling, including distinct small radii alongside far unrelated geometry.
   An equality that is false for every valid sample must not become a holds result.
3. Cover zero radius, negative radius, very small representable positive radii,
   reversed/equal parameter bounds and nonrepresentable numeric inputs using the
   kernel's documented validity rules. No guessed geometry or nonfinite values.
4. Exercise `randomFigure`, the editor Randomize action, internal local/global
   jobs and worker error transport. Invalid input must not corrupt the source,
   history or saved figure. Valid Randomize remains one undoable edit.
5. Verify the construction's dependency graph and fixed constants remain the
   intended ones across samples; do not fix ratios by freezing all free inputs.
6. Add a browser test for the remaining public Randomize refusal and a valid
   Randomize flow. Test hidden verdict machinery through internal APIs or the
   non-public development configuration established by prompt 01.
7. Check existing sampler, hypotheses, deterministic-seed, local/global and
   performance contracts. Record budgets honestly; do not conceal rejection
   exhaustion or silently reduce the requested sample count.

## Retained-engine hardening before any future re-enablement

These additional findings do not justify restoring public controls. Reproduce
and correct them in this task if practical; otherwise record separate, explicit
unresolved re-enablement gates. Do not describe the retained engine as ready while
they remain open. They are not required to expose testing again for this launch.

- **Stale discovery results:** source inspection confirmed `sameFigure` compares
  object definitions but ignores assumptions and claims. Changing an `assume`
  line can leave results marked fresh. Add a test through the discovery store:
  results, offered edits, viewed samples and late worker callbacks must be bound
  to the relevant construction, assumptions, claim and regime. Pure style changes
  may remain harmless; do not invalidate everything arbitrarily.
- **Coincident two-point circular order:** internal evaluation accepts
  `O=(0,0); w=circle(O,3); A=on(w,0); B=A; assume in_order(A,B,w)` as holding.
  The two points cannot be strictly ordered. Reproduce using separate lines in
  the Text parser; add distinctness and boundary tests under existing BAND rules.
  Confirm the intended incidence semantics before expanding this into unrelated
  hypothesis behavior. This was an API-level finding, not a separate UI flow.
- **Large live-claim cost:** inspect `packages/claims/src/kinds-incidence.ts` and
  its existential non-collinearity checks. Large concyclicity claims construct
  many triples and evaluate them eagerly. Before future live-verdict reactivation,
  benchmark representative large claims in isolation, use short-circuit evaluation
  where mathematically equivalent, and enforce a documented main-thread budget.
  Do not treat a measurement from a busy review environment as a stable baseline.
  This is a deferred performance concern, not permission to add live verdicts now.

## Boundaries, validation and handoff

Prompt 01 owns hiding public testing/discovery UI and disabling automatic jobs;
integrate with its capability boundary. Prompt 07 owns kernel coordinate
stability. Do not delete shared packages, remove claim/assumption document data,
change saved-file meaning, or redesign the language under this task.

Follow the shared contract for tests, ADRs and completion. Existing frozen tests
are add-only unless a justified ADR changes their specified behavior. Never
disable tests, lower the count floor or loosen thresholds to get green results.
Run relevant sampling/editor/worker tests and the required repository checks.
Update SPEC/STATUS/CHANGELOG for actual semantic changes and observed commands.
Return release-critical results separately from any deferred retained-engine
gates, with regression locations and confirmation that public testing stays off.
