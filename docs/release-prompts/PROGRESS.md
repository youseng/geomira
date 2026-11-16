# Integrated release work

Base: `f95e0056c9e2cb73d23c6dac900acaf9e7f1a06a` (main after PR #40).
Branch: `codex/release-integration`, PR #41.
Accepted checkpoint: **`e0ef71fb8d695ed37fb98c65568de44119757d17`**, 2026-11-16.

The maintainer authorized autonomous implementation, subagents, pushes, an integration PR
and later merge commits. All numbered repair/audit prompts are complete for the accepted
checkpoint below. Independent prompt 12 returned **GO** after complete current-source CI
and exact downloaded-artifact review. Main merge and production deployment have not been
performed at this checkpoint. The final documentation-only successor must pass its own
required CI before merge; main validates and publishes its own exact merged-revision bytes.

- [x] 01 Public claim testing removed — merged PR #38; public testing remains disabled.
- [x] 02 Transactional persistence/recovery — merged PR #39.
- [x] 04 Modal/keyboard safety — merged PR #40.
- [x] 03 Document files/sharing — integrated and cancellation fixes re-reviewed; ADR-0069.
- [x] 05 Properties/inherited visibility — integrated; ADR-0070.
- [x] 06 Tool dependencies/capabilities — integrated; ADR-0071.
- [x] 07 Stable geometry numerics — integrated and independently reviewed; ADR-0072.
- [x] 08 Randomize/shared sampler — integrated without public tester reactivation; ADR-0073.
- [x] 09 Responsive/discoverable interface — composed Recovery, focus, short-grid, menu, guide, overlay and native-coordinate corrections pass the complete supported-engine matrix; ADR-0074.
- [x] 10 Script editor/workflow — atomic batching, source preservation, accessible assistance, IME safety and native undo integrated; ADR-0075.
- [x] 11 Release infrastructure/artifacts — same-source gates, current public download, exact-byte provenance, all 25 reviewed references and full supported-engine validation accepted; ADR-0076; [final ledger](results/11-e0e-final.md).
- [x] 12 Independent final audit — **GO** for exact e0e and its downloaded artifact; [independent report](results/12-final-audit.md).

## Current acceptance evidence

Exact push run [43891722770](https://github.com/youseng/geomira/actions/runs/43891722770)
passed every required verification, browser, export and candidate job:

- `pnpm verify`: **5,046 tests / 553 files**, all static and coverage gates.
- Public **924/924** and internal **789/789** browser checks, zero skips; all three
  supported hosted/file engines. All six additive Recovery/short-source cases ran and
  passed in every selected project and mode: **84/84**.
- **33/33** visual comparisons representing **25** individually reviewed references.
- Nine early diagnostics passed; they supplement rather than replace the complete matrix.
- Genuine CI 300-object full-UI application medians **4.99/4.13 ms** meet the unchanged
  8 ms gate. Worker/fallback/discovery gates passed with their original limits.
- All four builds and required exports passed. The exact downloaded artifact and all
  15 manifest payload hashes were independently checked; the public standalone is
  **1,273,190 bytes**, SHA256
  `2b6ac1c2ea0b3c8f5ee360b5fd108fdf6dd3dc020087715198284867f7555a16`.

The independent quiet local `pnpm verify` on application source `56fbd30` passed
5,046 tests / 553 files in 663.24 s. Its six relevant local timing gates passed once,
with genuine app medians 7.16/6.81 ms. The 56→e0e delta is only tests, diagnostic workflows
and documentation; these local results are not relabelled as executions on e0e. Exact
e0e CI and downloaded-artifact results are separate in the final ledger.

## Historical results and remaining boundaries

Immutable base verification passed 4,904 tests / 534 files. Earlier `9622000` and
`c540412` candidates were rejected; their focused passes are not substituted for final
acceptance. The later `7f83802` Firefox Recovery failure was repaired. At 56, all six
new cases executed, but four WebKit ownership-test setup assumptions failed; the portable
native-scroll setup retains the active-control, raw-data and history checks. A disposable
guard-removal mutation independently confirmed the corrected test detects stolen scrolling.
All 84 current executions pass. Historical reports remain linked from the final ledger.

The invalid 1.57 ms no-drag result, genuine 37.51 ms failure and 404 worker 60.5 ms failure /
single 8.7 ms repeat remain recorded. No timing limit, history assertion, workload,
numerical/visual tolerance, test-count floor or coverage gate was weakened.

Physical devices, mobile software keyboards and real screen readers were unavailable.
The compact Text-open canvas can crowd complex labels; internal-only verdict-chip overlap
and deferred engine work remain reactivation limits. These remain explicit in the
independent report and final ledger. No separate tagged release was requested.
