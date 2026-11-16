# Exact 56 cross-engine ownership fixture failure

Source: `56fbd30f3457635ac68d8ad48980b37b6f93ea0c`, push run
`43884468226`, web job `133358755323`. Required verification, exports and all five GUI
comparisons passed. Quiet independent local verification also passed 5,046 tests / 553
files at this exact source. The complete browser gate remains failed.

- Public: **921 passed / 2 failed / 1 dependency-not-run**, 924 total.
- Internal: **783 passed / 2 failed / 4 dependency-not-run**, 789 total.
- All **33 screenshot comparisons / 25 unique references** passed.
- Dependent timing projects did not execute and are not counted as CI timing passes.

Every failed case is the new “Recovery queued visibility yields to a later native Command
focus” test in `recovery-layout.spec.ts`: hosted WebKit and file WebKit in each build mode.
All four stop at line 131, `scroll.before > 0`, receiving **0**. The setup assumes native
Command focus synchronously scrolls the application, which those WebKit runs do not do.
The existing scrolling ownership, active-control hit, raw-draft and document/history
assertions must remain meaningful when making the setup portable; deleting the precondition
alone would not establish that the ownership guard works. Prompt 09 owns that correction
and the requested disposable guard-removal check. No production change is inferred here.

All six additive A18/A19 cases actually ran on Chromium desktop/phone, hosted Firefox and
WebKit, and file Chromium/Firefox/WebKit, in both build modes: **84 executions**, **80
passed / 4 failed**. Each WebKit project passes five cases and fails the ownership setup;
every other project passes all six. The Recovery activation repair, original Firefox
Recovery scenarios and all four short invalid-source/Command variants pass every selected
engine. No test selection or assertion was weakened.

The parallel PR run `43884477840`, using merge-ref source/build
`28830ef91a769cfcadd4e410044db2d8bc73663e`, has the same counts and the same four failures.
It remains distinct from the exact push source and artifact identities.

| Evidence            | Artifact    |     Bytes | SHA256                                                             |
| ------------------- | ----------- | --------: | ------------------------------------------------------------------ |
| Exact push report   | 14234854277 | 7,046,969 | `a2685139cc8408e2bd7344c82a3a4a85e9c36073abd80cd2f2c2e54cc5cf5e8e` |
| PR merge-ref report | 14235453123 | 6,855,460 | `e6e4355e2926c5a2b48a7f85c951417f27ffdba0b4651980d0c7b0066fc14793` |

Both complete report archives were downloaded and hashes checked before decoding. Local
roots are `/tmp/geomira-final11-ci-56-push/report` and
`/tmp/geomira-final11-ci-56-pr/report`; each mode's `review.json` lists every failing trace
and context file. The exact push's `new-six-case-coverage.json` records all 84 outcomes.
The active-job log endpoint was tried once before completion and returned BlobNotFound;
the entire run was preserved until the combined reports uploaded.

## Local timing fixture provenance

The six successful local timing checks are separate from the failed CI matrix. Their raw
JSON files identify config/root directory
`/workspace/geomira-perf11-56/apps/web/{playwright.config.ts,e2e}`; both invocations used
that exact 56 checkout, pinned pnpm, worker1/no-deps and candidate-56f build links.

The log's drag-test line 73 is a generated JavaScript location. The Playwright transform
source map maps generated line 73 to TypeScript line 86, and its `sourcesContent` is byte
identical to the committed 56 fixture, SHA256
`7167abbd9a6bb268e43c6b1fc77d0aaf28d24b0df7d49cc6f4bd827bf06ce599`.
The generated body includes the strict coordinate-only P1, unchanged other source and
complete Undo/Redo assertions. This is not an older fixture. Passed traces are not retained
by the existing `retain-on-failure` policy; raw JSON statuses and measurements are preserved
in `/tmp/geomira-final11-56-{public,internal}-performance.json` and
`11-56-performance.json`. No timing was rerun merely to explain the source-map location.
