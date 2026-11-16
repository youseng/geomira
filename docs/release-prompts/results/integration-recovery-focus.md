# A18: explicit Recovery after native Text focus

Base: `7f838025c9ad1cbe2cd913f726ff507661b34d20` in an isolated worktree.

## Evidence and correction

Public Firefox CI `43875853221` failed the unchanged short-phone Recovery sequence at
390×380. The actual trace and screenshot show the focused Recovery invoker above the
viewport. App scrollTop changed 103→227 on Text focus, retained 162 after Recovery focus,
then advanced to 364 when opening inserted a 202px messages track. Recovery started at
y=-203. The prior merge workflow passing the same application tree did not dismiss this
observed failure.

The unchanged native Chromium sequence passed three baseline repetitions. An additive
diagnostic then seeded only the exact observed 162px post-focus scroll and activated
Recovery with native Enter. It failed before the fix with the same y=-203 and scroll364.
This reproduces the observed precondition deterministically; it does not simulate or
claim a successful Firefox run.

Explicit opening now measures the inserted panel, header and workspace and makes the
smallest feasible app scroll to expose them. Each immediate/deferred adjustment requires
the connected Recovery invoker still to own focus. Close/unmount cancel ownership and
pending animation frames. The bounded microtask/two-frame correction adds no persistent
listener, anchor override, focus call or geometry/state mutation. Passive storage-error
and conflict expansion remain unchanged.

The additive regressions preserve exact invalid Text, caret17, unfinished Command and
canonical `.geo` backup bytes before/after Undo and Redo. They check close/reopen and
compare a later native Command focus/scroll before and after queued Recovery work. The
handoff is observed after panel insertion so legitimate native insertion anchoring is
included in its baseline. The original Firefox path and placement/hit-test assertions
are unchanged.

## Validation scope

Both public builds, production/test TypeScript, scoped ESLint and dependency-cruiser
(1,018 modules, 5,889 dependencies; no violations) passed. Root owns the final
full verification, retained-engine artifacts, supported-engine CI and independent audit.
Firefox/WebKit were not run locally for this follow-up; their final CI proof is required.
No screenshot reference, tolerance, existing assertion or dependency changed.

The final command `playwright test recovery-layout.spec.ts --project desktop --project
mobile --project file-chromium --workers 1` passed **36/36 (48.6 seconds)**. Its filename
filter includes `startup-recovery-layout.spec.ts`: eight Recovery cases and four startup/
blocked-storage/canvas-stability cases ran in each project. The prior intermediate probes
did not pass as a suite: the new handoff diagnostic was refined to measure ownership after
DOM insertion, and the independent Command overlap was recorded separately as above.

An initial new focus-handoff probe also confirmed an independent short-phone invalid Text
diagnostic covering Command's center. That issue is handed to prompt 08/A19; this branch
contains no CSS repair or visibility claim for it. The Recovery ownership diagnostic
checks native focus and scroll ownership separately instead of hiding that overlap.

Logs: `/tmp/geomira-recovery-focus-native-before.log`,
`/tmp/geomira-recovery-focus-seeded-before.log`,
`/tmp/geomira-recovery-focus-final2.log` and
`/tmp/geomira-recovery-focus-final-lint.log`. No push, merge or deployment was performed.
