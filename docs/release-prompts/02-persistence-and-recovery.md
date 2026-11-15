# Prompt 02: make local saving and recovery dependable

Implement this task in Geomira. The maintainer has authorized correcting the release review's
data-loss defects. Deliver the implementation, focused regression tests and accurate
documentation. Do not publish, merge or deploy as part of this task.

Read `docs/release-prompts/README.md`, `CLAUDE.md`, `docs/SPEC.md`, `docs/STATUS.md` and the
required ADRs before changing code. Follow the shared execution contract. The audit baseline
is `95a7c7e9ff6d64947cf0f0e0b3e89d45412b5128`; verify current behavior on your branch first.
Do not interpret old "Known bugs: none" entries as overriding these reproductions.

## Reproduce the two failures first

**Competing tabs:** start with an empty browser profile. Create `A=(0,0)` in tab 1 and allow
autosave to finish. Open the same app in tab 2. Add `B=(1,0)` in tab 1 and allow its save.
Add `C=(0,1)` in tab 2 and allow its save. Reload tab 1. At baseline, B disappears: current
contains A+C, previous is null, and Restore previous figure cannot recover A+B.

**Unavailable storage:** emulate blocked storage so accessing localStorage throws
`SecurityError`. Open the app, enter `A=(123,456)`, then reload. At baseline there is no
visible saving warning, but the figure disappears. Also reproduce a `QuotaExceededError`
after a successful initial save: the storage retains old text while the autosave version
counter advances as if the write had succeeded.

Use controlled browser/storage failures, not changes to the user's actual browser settings.
Add failing tests before implementing the fixes.

## Required behavior

1. Give each editable document and editing session an identity and each persisted revision
   enough information to detect stale writes. A tab must not silently replace a newer
   revision written by another tab. Preserve both versions when a conflict occurs.
2. Choose a storage strategy with a defensible concurrency story: transactional persistence,
   or immutable independently keyed revisions plus a recoverable current pointer are valid
   approaches. A localStorage `storage` listener alone is insufficient; two tabs can both
   read the same revision before either writes. Test that interleaving explicitly.
3. Provide visible, accessible save state such as Saving, Saved locally, Not saved and
   Conflict. Set success only after the persistence operation actually succeeds. Distinguish
   "saved in this browser" from "downloaded to a file" and avoid promising cloud storage.
4. On quota, blocked access, serialization or partial-write failure, retain the in-memory
   figure and pending recovery information, present a persistent actionable notice and offer
   a portable backup. Implement a minimal working canonical `.geo` backup using the
   existing serializer; expose a narrow reusable download action for prompt 03. Do not
   leave this error action unwired or defer the only backup route to a later task.
5. Provide a way to inspect and restore recoverable versions, including another tab's
   displaced revision. Restoring a revision must preserve the figure it replaces and must
   itself remain recoverable. Name the source/time or revision clearly enough to choose.
6. Keep recovery storage bounded with a documented retention policy. Never remove the sole
   durable copy of a figure or an unresolved conflicting revision during routine cleanup.
   Do not accumulate unbounded history or browser storage indefinitely.
   When safe retention cannot fit, report the capacity problem and offer backup/conflict
   resolution instead of silently evicting protected data or reporting a successful save.
7. Migrate existing `geomira.autosave.current` and `geomira.autosave.previous` safely. Validate
   migrated documents; retain original recoverable data until the new store commits. A
   failed migration must leave a usable recovery path and must not reset to an empty figure.
8. Preserve the useful existing distinction between browsing an unedited example/link and
   editing one's own document. Merely opening examples must not evict personal work.
9. Flush valid pending saves on supported lifecycle events. Do not claim browsers guarantee
   asynchronous writes on unload. Keep meaningful save errors visible rather than treating
   a pagehide callback as evidence of durable completion.

## Starting points

- `apps/web/src/persist.ts`: global storage keys, swallowed read/write errors, `Autosave`.
- `packages/editor/src/autosave.ts`: `Session.saved`, first-write backup policy, slot model.
- `packages/editor/src/restore.ts`: startup and restore offers.
- `apps/web/src/hooks.ts`: autosave timer, `flushWhenHidden`, startup/link loading.
- `apps/web/src/store.ts`: opening/replacing documents and pending save interactions.
- `apps/web/src/page.ts`, `Header.tsx`: Restore previous figure and save status placement.
- `apps/web/test/persist-blocked.test.ts`, other persistence unit tests and E2E flows.
- Relevant autosave/recovery decisions in ADR-0012, ADR-0013, ADR-0028 and ADR-0030.

Keep DOM/storage APIs in the web host. Pure policy and revision/conflict decisions belong
in the appropriate pure package. Native browser storage APIs are available; avoid introducing
a runtime dependency that violates the repository's dependency rules.

## Acceptance tests

- The exact A/B/C two-tab reproduction retains both A+B and A+C after both tabs close and
  reopen. A conflict is surfaced or the sessions are safely separated; no silent loss.
- Exercise simultaneous stale writers with a controlled barrier, reversed write order,
  delayed storage events, a suspended tab that resumes, and opening a third tab.
- Simulate blocked storage, full quota and failure between any multi-step writes. The old
  durable state stays recoverable; the current figure stays in memory; no false Saved state.
- Restore permissions/storage capacity and retry: the pending edit can be saved without
  retyping it or overwriting a conflict. A failed retry leaves the error visible.
- Recovery entries identify distinct versions, open correctly and preserve their geometry,
  styles, layers, viewport, metadata, claims and assumptions. Claim data remains inert in
  the default app after prompt 01.
- Test migration from both legacy slots, a missing slot, malformed stored text and a failed
  new-store write. Confirm legacy data is not removed before successful migration.
- Browsing multiple examples or unedited links preserves the personal document. Editing
  an example produces a recoverable document without erasing the user's previous work.
- Refresh, close/reopen, PWA update and the supported single-file browser mode preserve the
  last successfully saved revision. A storage-denied single-file session warns and can export.
- Recovery retention limits are deterministic and cannot evict unresolved conflicts or the
  only recoverable revision of the open document. Add tests around the retention boundary.
- Verify keyboard/screen-reader access to the status and recovery actions. Error notices
  must not disappear merely because a routine drawing action changes another status line.

## Scope, integration and completion

This task owns persistence, migration, revision/conflict policy, recovery and truthful save
status. Prompt 03 owns New/Open/Save/Save As files and sharing; agree on document IDs, dirty
state, error reporting and the backup action before either branch changes the same host code.
Prefer landing this persistence contract before prompt 03. Do not introduce cloud accounts,
network uploads, collaboration infrastructure or a claim-testing interface.

If changing a specified autosave policy, write an ADR with the data-preservation guarantees
and migration approach. Add meaningful regressions; do not merely change the blocked-storage
test to tolerate a different silent failure. Follow the frozen-test exception process when
needed, keep the test-count floor, and run required verification plus browser persistence flows.

In the final handoff describe the concurrency interleaving handled, failure recovery behavior,
legacy migration and retention policy, exact test results, remaining platform limitations,
and the integration API for prompt 03. Do not mark a revision saved before demonstrating it.
