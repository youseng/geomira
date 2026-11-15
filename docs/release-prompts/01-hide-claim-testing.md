# Prompt 01: remove claim testing from the public release

Implement this task in the Geomira repository. The maintainer has authorized removing the
claim tester from the public interface for now, while retaining its implementation and saved
document compatibility. Deliver a reviewable implementation, tests and documentation; do not
publish, merge or deploy as part of this task.

Read `docs/release-prompts/README.md` first, then `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md`
and the required ADRs. Apply the shared execution contract. This explicit maintainer decision
supersedes the older specification's requirement to expose claim testing in the public app;
record that change in a new ADR and update the specification consistently.

The review baseline is commit `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`, including PR #36.
Inspect the current branch and preserve changes made since that baseline. This file is an
implementation prompt, not evidence that any fix has already been completed.

## Intended outcome

The normal hosted and single-file applications provide construction, dragging, measurements,
scripting, layers, Randomize and export. They do not present automated mathematical verdicts,
offer claim-testing/discovery actions, or execute those jobs in the background.

Retain the internal claim/discovery implementation and its substantive tests. A separate,
explicitly opted-in development/test build may exercise it. Production must default to the
disabled state; `?dev=1`, a public settings checkbox, or a persisted preference must not turn
the retired interface back on. Do not create a user-facing experimental escape hatch.

## Why this is necessary

At the review baseline, this document gives a false current-figure result but both sampled
tests report 200 true and 0 false because the sampler changes the fixed radius ratio:

```text
O=(0,0)
F=(1000,0)
c=circle(O,0.01)
d=circle(O,0.02)
A=on(c,0)
B=on(d,0)
claim length(O,A,O,B,1)
```

The retained engine's sampler correction belongs to its dedicated prompt. This task contains
the public feature now; it must not portray hidden code as repaired or silently discard old
claim statements to avoid the problem.

## Scope

1. Inventory every public entry point: header claim box, Claim tool and shortcuts, Claims
   tab, live canvas badges, local/global Test actions, automatic tests after assumptions,
   discovery, special-position hunting, branch-fix suggestions, result previews and any
   direct command paths that dispatch jobs. Remove their availability in the default build.
2. Gate behavior at the application orchestration/dispatch boundary, not only with CSS or
   hidden buttons. Stop unnecessary worker warming, automatic evaluation, subscriptions and
   job dispatch associated with the retired feature. Keep unrelated work functional.
3. Keep the language able to read, preserve, print, save, share and re-open existing `claim`
   and `assume` statements. They are document data. A script containing them must still
   build the same geometry and retain references after normal edits, rename and undo.
4. Ordinary command/text entry may preserve a claim statement, but must not trigger a test,
   create a verdict or advertise testing as an available command. Give concise neutral
   feedback where an explicit retired action is invoked.
5. Keep assumptions usable by Randomize where applicable. Do not remove `packages/claims`,
   its numeric helpers, sampling dependencies or registry metadata just because their names
   contain "claim". Trace the dependency graph before changing imports or initialization.
6. Remove public claims/discovery marketing and shortcut hints from the app, landing/about
   page, README and generated help as appropriate. Explain the current product accurately:
   constructing, exploring and exporting figures. Do not imply dragging establishes a
   general theorem. Preserve developer documentation needed to maintain the dormant engine.
7. Keep both build modes, PWA update behavior, file metadata and exports compatible. The
   release-artifact prompt owns regenerating and preparing the advertised offline copy;
   actual publication requires separate authorization.

## Starting points

- `apps/web/src/App.tsx`, `Header.tsx`, `SidePanel.tsx`, `Stage.tsx`, `ClaimBox.tsx`.
- `apps/web/src/page.ts`: `usePage`, worker warming, `testClaim` and header actions.
- `apps/web/src/test-runs.ts`, `discovery-runs.ts`, `discovery-view.tsx`, `worker/`.
- `apps/web/src/panels/ClaimsPanel.tsx`, `DiscoveryPanel.tsx`, `BranchFixes.tsx`.
- `packages/editor/src/tools.ts`, `tool-groups.ts`, `keymap.ts`, `command.ts`, `claim-tool.ts`.
- `packages/lang` parse/print paths; claim and assumption data in the document model.
- `apps/web/src/about.tsx`, public about/landing content, `README.md`, build configuration.

Treat these as search starting points, not an exhaustive list or a requirement to delete
whole files. Use one clear feature boundary instead of scattered contradictory booleans.

## Acceptance criteria

- Fresh default production builds show no Claim/Test/Discovery actions, verdict badges or
  claim-tool shortcuts on desktop and phone. The empty layout remains usable.
- Load the reproduction above and existing claim-heavy examples. Their geometry renders,
  their claim/assumption text survives all supported round trips, and no verdict appears.
- Instrument the job boundary: ordinary load, editing, dragging, switching examples and
  entering an assumption or claim do not dispatch retired jobs or warm their workers.
- A production build with `?dev=1`, old local settings or a saved claim-bearing link still
  has testing disabled. Verify the single-file build separately.
- Randomize, construction tools, measurements, ordinary commands, layers, undo/redo,
  SVG/PNG/TikZ/Asymptote exports and ordinary share links continue to work.
- The dormant engine can still be exercised in the explicitly enabled development/test
  configuration. Keep its meaningful unit/property tests and targeted browser coverage.
- Check keyboard navigation after removal: no dead tab, invisible focus target, empty panel,
  orphan action or misleading help entry remains.
- Update affected frozen UI tests through a documented ADR and the repository's exception
  process. Replace retired-public-UI expectations with meaningful default-off and data
  preservation assertions; do not disable tests or lower the test-count floor.
- Run the required verification/build checks and relevant browser flows. Report exact
  commands and results, including unavailable browsers. Update STATUS honestly.

## Boundaries and handoff

Do not redesign the language, delete existing claims from files, add accounts, remove
Randomize, or re-enable the feature after merely hiding its symptoms. Do not introduce a
second claim engine. Do not broadly rewrite unrelated tests or snapshots.

This task should land before the public GUI cleanup and final release-artifact work. It can
run alongside pure geometry and persistence work in separate branches. Coordinate changes
to `page.ts`, `Header.tsx`, `hooks.ts` and shared documentation with prompts 02 and 03.
In the final handoff list the disabled entry points, compatibility tests, development-only
activation mechanism, changed frozen tests/ADR, and any remaining reachable execution path.
