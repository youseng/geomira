# Startup recovery expansion integration correction

Base: `519045d` (the native-layout correction, not a final accepted release).
Scope: ordinary pending initialization must not remove a failure-warning row during
geometry input. Final combined verification and CI remain owned by integration.

## Diagnosis and change

`Autosave.getStatus()` truthfully returns `phase: 'not-saved', message: null` before its
first acknowledged revision. This is not a failed write. Ordinary dirty work reports
`saving`; initialization/write failures set a message; protected conflicts report
`conflict`; malformed legacy input carries a warning message. Only the normal startup
state had been incorrectly treated as an automatic failure-panel trigger.

Recovery now expands automatically for a real message or conflict, or when the user
opens it. The header's status and the always available Recovery disclosure are unchanged.
No persistence state, acknowledgement, retry, storage or geometry mapping changed.
ADR-0067 records the corrected presentation policy, preserving ADR-0074's stable input.

## Failing-first evidence

- `PATH=/tmp/geomira-bin:$PATH pnpm exec vitest run apps/web/test/persistence-panel-state.test.tsx --maxWorkers 1`:
  **1 failed, 5 passed** before the source change. The real initial store rendered the
  recovery failure region despite `message: null`. The other five state checks passed.
- `PATH=/tmp/geomira-bin:$PATH pnpm --filter @geomira/web build`: both public builds and
  release packaging passed before changing source, providing the baseline browser artifact.
- `PATH=/tmp/geomira-bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/tmp/geomira-browsers pnpm --filter @geomira/web exec playwright test --config playwright.warning-temp.ts`:
  **2 failed, 1 passed** against that artifact. Delaying the real IndexedDB connection,
  then releasing it during native Point/box input changed the exact canvas rectangle
  from `{x:0,y:351.375,width:390,height:120}` to
  `{x:0,y:227,width:390,height:225}`. The real blocked-storage warning case already passed.
  An earlier attempt used a port already occupied by another task and did not run tests;
  it is not counted as a behavioral failure.

## Corrected validation

- The same six-case unit command: **6 passed**.
- The same public build command: **both builds and packaging passed**.
- The same focused hosted browser command: **4 passed**, 5.7 seconds. In addition to both
  gestures and the real denied-storage case, explicit Recovery downloaded a `.geo` backup
  while storage initialization remained held and the truthful status stayed `Not saved`.
- The same browser command with `--project offline`: **4 passed**, 6.3 seconds, against
  the freshly built single-file artifact over `file://`.
- After strengthening the Point assertion to compare the complete canonical document
  byte for byte, `PATH=/tmp/geomira-bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/tmp/geomira-browsers GEOMIRA_PREVIEW_PORT=4297 pnpm --filter @geomira/web exec playwright test startup-recovery-layout --project desktop --workers 1`:
  **4 passed**, 7.1 seconds, using the standard project configuration. The offline command
  above also passed again: **4 passed**, 4.2 seconds; that final temporary configuration
  contained only the offline project and needed no HTTP preview server.
- `PATH=/tmp/geomira-bin:$PATH pnpm exec tsc -p tsconfig.tests.json --noEmit`: passed.
- `PATH=/tmp/geomira-bin:$PATH pnpm exec eslint apps/web/src/PersistencePanel.tsx apps/web/test/persistence-panel-state.test.tsx apps/web/e2e/startup-recovery-layout.spec.ts --max-warnings 0`: passed.

The temporary browser configuration used one worker, Desktop Chrome, blocked service
workers and Vite preview on port 4297; its offline project used `apps/web/dist-single/`
as a file URL. It was removed before delivery. The integration owner is adding this new
`startup-recovery-layout.spec.ts` to the final hosted/offline supported-engine union.
No existing tests, snapshots, numerical tolerances or test-count floor were changed.

Local evidence covers Chromium native mouse input and real browser storage/downloads,
including the phone-size layout. Firefox/WebKit, composed short-height focus/exposure,
full verification and CI remain required on the final integrated source. No push, merge,
publication or deployment was performed by this correction.
