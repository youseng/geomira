# Geomira release-repair prompts

These are implementation instructions for future AI sessions, not completed fixes.
They implement the maintainer's decision to remove public claim testing for this
release while repairing the reviewed geometry, data-loss, interface and release issues.

Review baseline: `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128` (main after PR #36).
Inspect the actual checkout before working; reproduce against its current revision.
Never reset newer work to this historical baseline or assume line numbers still match.

## How to use

Give one numbered file to one implementation session with access to this repository.
The simplest safe approach is to run **01 → 02 → 04 → 03 → 05 → 06 → 07 → 08 →
09 → 10 → 11**, then give 12 to an independent reviewer. Modal safety (04) comes
before file actions (03), so new dialogs inherit a safe interaction boundary.
Each file is a copyable task with reproduction and acceptance
criteria. It refers to this common contract, so keep the directory in the checkout.

Example dispatch:

```text
Implement docs/release-prompts/01-hide-claim-testing.md.
First read docs/release-prompts/README.md and the repository instructions.
Work only on this task, reproduce the relevant failures, implement the change,
run its required checks, and report the actual results and remaining limitations.
Do not publish or deploy anything.
```

For the final review, use "Execute the independent review in .../12-final-release-audit.md"
instead of "Implement". Prompt 12 is deliberately read-only.

## Product decision already authorized

- This release focuses on construction, dragging, measurements, scripting, Randomize
  and export. Those features remain supported.
- Remove public local/global claim testing, discovery, special-position hunting,
  automated branch fixes, claim-entry UI and automated live claim verdicts. Do not
  leave a public experimental switch or a query parameter that restores them.
- Keep existing claim/assumption syntax and stored data compatible. Loading, editing,
  renaming, saving, sharing and exporting old figures must not silently discard it.
- Preserve the retained engine, its meaningful tests and shared dependencies. The
  geometry kernel, language and Randomize use parts of this infrastructure. Do not
  delete whole packages merely because their names contain `claims` or `discovery`.
- Explicit development/test builds or direct internal tests may exercise the engine.
  The normal hosted, PWA and downloadable builds must not dispatch or warm its jobs.
- Repair shared sampler defects that still affect Randomize. Retained-engine-only
  improvements may be deferred as documented reactivation gates; do not bring the
  public tester back during this work.
- This authorization supersedes older release-scope statements in SPEC/ADRs. Record
  the change with a new ADR and update the specification; do not silently contradict
  it or ask the maintainer to re-approve this already made decision.

## Common execution contract

1. Read `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the ADRs required by the
   repository protocol. Preserve unrelated working-tree changes. Record the base SHA.
2. Verify the actual package manager version against `package.json`; the reviewed
   revision uses pnpm 10.28.0 and Node >=22.19. Use the pinned manager, not an
   incompatible global version. Install from the lockfile without upgrading packages.
3. Establish the baseline according to the project protocol. Do not describe an old
   run's success as a check you performed. For an existing unrelated failure, identify
   it precisely and keep it visible instead of hiding it or doing an unrelated rewrite.
4. Before a bug fix, add a regression that demonstrates the old failure. Test meaningful
   observable behavior, mathematical invariants and recovery paths, not implementation
   details. For authorized feature removal, test the new public contract explicitly.
5. Keep the numeric, dependency, purity and document invariants. Do not bypass type
   checks, central tolerance rules or the shared tool registry. Explain any architecture
   change in an ADR. New runtime dependencies require the repository's dependency process.
6. Frozen tests are add-only unless a new ADR justifies a changed product contract.
   Feature removal requires deliberate public-UI test migration, not bulk deletion,
   `.skip`, raised tolerances, weakened assertions or a lowered test-count floor.
   Retain engine tests separately from public-release tests where appropriate. Do not
   inflate counts with meaningless tests. Record every required frozen-test change.
7. Run targeted checks during iteration, then the repository-required verification for
   the completed change. Run built-app browser flows for interaction changes, relevant
   export checks for geometry changes, and both builds for public-surface changes.
8. Update SPEC, generated documentation, CHANGELOG and STATUS only where the task
   requires it. Record commands, exact results, browser versions and real limitations.
   A test not run is not a pass; a screenshot mismatch needs inspection.
   Edit generator inputs rather than hand-editing generated files: `pnpm docs:tools`
   writes `docs/tools.md`, and `pnpm docs:lang` writes `docs/language.md`. Run the
   applicable generator and inspect its output. `pnpm docs:exactness` prints a report
   for STATUS when exactness behavior changes. Build generated HTML through the
   release pipeline; do not patch minified output by hand.
9. Keep the change focused and reviewable. Finish the authorized task rather than
   returning only a plan. Do not merge, push, release, publish or deploy unless the
   session separately instructs you to do so. The existing main branch auto-deploys.
10. Deliver: problem and resulting behavior, changed files, regression evidence,
    commands/results, any migration or compatibility effect, and unresolved risks.

The prior audit's artifacts are not required to execute these prompts: the necessary
scripts and UI sequences are described here. Do not depend on its temporary paths,
local servers, screenshots or a previous agent's memory.

## Task map and order

| Prompt                                          | Deliverable                                                          | Dependencies / shared ownership                                             |
| ----------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [01](01-hide-claim-testing.md)                  | Public-release scope, preserved claim data, disabled job paths       | First UI task; owns capability contract and affected public surfaces        |
| [02](02-persistence-and-recovery.md)            | Honest save state, conflict-safe persistence and recovery            | Can start independently; supplies storage contract to 03                    |
| [03](03-document-files-and-sharing.md)          | Native files, safe document switching, valid hosted/offline sharing  | Integrate 01, 02 and 04 first; touches Header/page/dialog entry points      |
| [04](04-modal-and-keyboard-safety.md)           | Modal isolation, focus and safe shortcuts                            | Integrate 01; rerun after 03 adds dialogs                                   |
| [05](05-properties-and-inherited-visibility.md) | Reliable rename/undo/style/visibility                                | Integrate 01 and 04; coordinate selection actions with 06                   |
| [06](06-tool-dependencies-and-capabilities.md)  | Dynamic dependencies, conic picks, variable-width selection inputs   | Can start in an isolated branch; follow 01's retained-claim policy          |
| [07](07-stable-geometry-numerics.md)            | Stable translated area and conic geometry                            | Independent numeric work; coordinate any shared numeric API changes with 08 |
| [08](08-randomize-and-retained-tester.md)       | Safe shared sampling and explicit retained-engine boundaries         | Integrate 01 and coordinate 07; never reactivate public testing             |
| [09](09-responsive-and-discoverable-ui.md)      | Responsive layout, tool discovery and navigation guidance            | After 01, 03–06; owns toolbar/sidebar layout                                |
| [10](10-script-editor-and-workflow.md)          | Existing-language editor and command consistency                     | After 01, 03, 05 and 09; owns text/command editor behavior                  |
| [11](11-release-artifacts-and-validation.md)    | Same-revision release gates, current download, reviewed visual tests | Infrastructure can start early; final artifact work follows 01–10           |
| [12](12-final-release-audit.md)                 | Independent release decision with evidence                           | After all implementation prompts are integrated                             |

For parallel work, use isolated branches/worktrees rather than multiple models editing
one tree. Start independent 02, 06 and 07 alongside 01 only with an integration owner.
Reserve ADR numbers centrally; do not let every branch create the same next ADR.
Merge documentation changes deliberately, especially SPEC, STATUS, CHANGELOG and test
counts. Recheck composed behavior after integrating branches; individual green runs
do not establish that the combined tree passes.

Keep repairs on integration branches until deployment gating is safe. Do not let an
intermediate merge onto auto-deploying main accidentally publish half of this work.

## Audit coverage: every primary finding has an owner

Numbers below match the release review; they are not repository issue numbers.

| Finding | Observed failure                                                        | Prompt / disposition                                                           |
| ------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1       | Fixed radii collapse; a false claim receives 200/200 passing samples    | 01 contains exposure; 08 repairs shared sampler; public testing stays disabled |
| 2       | Two tabs overwrite each other's work without recovery                   | 02                                                                             |
| 3       | Blocked/full storage silently loses work                                | 02; 03 provides file fallback                                                  |
| 4       | Advertised offline HTML is build `5f0ce3be`, far behind main            | 11                                                                             |
| 5       | Delete reaches the figure behind an Export dialog                       | 04                                                                             |
| 6       | Tangent/intersection deduplication confuses coincidence with dependency | 06                                                                             |
| 7       | Selection-first line claims reject point-pair inputs                    | 06, retained internal API regression; no public claim UI restoration           |
| 8       | Outside-close discards a typed rename                                   | 05                                                                             |
| 9       | Undo leaves stale style fields that resurrect undone values             | 05                                                                             |
| 10      | GUI Apply transformation rejects supported conics                       | 06                                                                             |
| 11      | Inherited-hidden image's eye/Show controls cannot reveal it             | 05                                                                             |
| 12      | Reversed parameter bounds throw in Randomize/global sampling            | 08                                                                             |
| 13      | Share emits links its own decoder rejects at 500 objects                | 03                                                                             |
| 14      | 768-pixel layout clips header controls and squeezes canvas              | 09                                                                             |
| 15      | Translated unit-triangle area becomes zero                              | 07                                                                             |
| 16      | Translated conic rejects tangent at a defining point                    | 07                                                                             |
| 17      | Offline Share produces a sender-local file URL                          | 03                                                                             |

Other reviewed concerns: native document management (03), swallowed tool-finish
refusals (06), command batching of singleton directives (10), navigation and keyboard
accessibility (04/09), stale screenshots and deploy-before-verification (11), and
independent browser/device coverage (12). Retained discovery freshness, circular order
degeneracy and expensive live claims belong to 08's deferred-engine boundary, not
reasons to restore the feature now.

## Scope control for proposed features

The launch prompts include concrete usability improvements, not every future idea.
Macros, animated loci, construction playback, a dependency-graph UI, export publication
presets, additional exact number fields, accounts and collaboration remain later work.
Do not start them while closing release defects. Prompt 10 improves the current language
without replacing its grammar or introducing a general-purpose execution runtime.

## Historical verification, for comparison only

At the reviewed SHA: 4,857 tests in 529 files passed; typecheck, lint, dependency rules,
repository rules, both builds and four isolated performance tests passed. Chromium
E2E had 132 passes and nine screenshot-comparison failures. At least the phone baseline
still contained a removed Style tab. Firefox/WebKit were not validated in that audit
because of environment startup/dependency failures; mobile was touch emulation.

These numbers are historical evidence, not acceptance results for the future repairs.
Run and report checks against the actual final revision and downloaded artifact.
