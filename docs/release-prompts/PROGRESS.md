# Integrated release work

Base: `f95e0056c9e2cb73d23c6dac900acaf9e7f1a06a` (main after PR #40).
Branch: `codex/release-integration`.

The maintainer authorized autonomous implementation and subagent delegation for the
remaining prompts. Each task is developed in a separate worktree, reviewed and
integrated here. Pushes and a draft integration PR were authorized first; the maintainer
subsequently authorized merge commits. The release PR may merge only after the remaining
checks and independent audit pass; main's configured deployment then validates and publishes
its own exact merged-revision artifact. Completion below requires integration and
task evidence, not merely a subagent's report. Final acceptance requires combined
verification, CI and the independent audit.

- [x] 01 Public claim testing removed — merged PR #38.
- [x] 02 Transactional persistence/recovery — merged PR #39.
- [x] 04 Modal/keyboard safety — merged PR #40.
- [x] 03 Document files and reliable sharing — integrated and cancellation fixes re-reviewed; ADR-0069; 46 unit / 27 browser checks.
- [x] 05 Properties and inherited visibility — integrated; ADR-0070; 48 unit / 20 browser checks.
- [x] 06 Tool dependencies and capabilities — integrated; ADR-0071; 108 unit / 3 browser checks.
- [x] 07 Stable geometry numerics — integrated and independently reviewed; ADR-0072; 101 independent tests.
- [x] 08 Randomize/shared sampler — integrated; ADR-0073; 125 unit / 3 browser checks.
- [x] 09 Responsive/discoverable interface — audit corrections integrated, including the later supported-engine panel/focus, native draft-layout and title-boundary defects. Correctness and settled-source performance corrections are integrated. Application source frozen at `a7a40e8`; final combined acceptance remains pending.
- [x] 10 Script editor/workflow — integrated; ADR-0075; 21 new / 16 existing browser checks; 27 command tests.
- [ ] 11 Release infrastructure/artifacts — infrastructure integrated; final candidate pending; ADR-0076.
- [ ] 12 Independent final audit — earlier sources `9622000381c6b253067680593090624fafdff23c` and `c540412` remain rejected as release candidates. The clean `ab0c5fe` checkout passed full verification; subsequent functional corrections require a fresh combined source and artifact audit.

## Verification

Fresh baseline installation: pinned pnpm 10.28.0, frozen lockfile, existing local store.
Immutable base `pnpm verify` passed: 4,904 tests / 534 files, with all static and coverage
gates preserved. Earlier invalidated in-place attempts are not counted as passes.
Final acceptance remains pending complete combined verification, CI and independent audit.
Per-task reports belong in `results/`; exact final commands and results will be recorded
in STATUS. No prior test result is counted as a new check.

## Final performance validation

The corrected full-UI benchmark genuinely drags P1 and retains the original 300 objects,
camera, traced path, 120 measured frames and 8 ms application gate. Its isolated application
median was **37.51 ms**, exceeding the limit. The previous **1.57 ms** trace performed
no drag and is invalid. Profiling identified per-preview source rebuilding that bypassed
the existing settled-panel policy. The eight-line ownership/drag guard is integrated at
`8264356`; prototype genuine public/internal medians were 7.58/5.56 ms. Final combined
measurements, full verification, CI and independent artifact acceptance remain required.
No threshold, history assertion or workload reduction was made.

## Latest combined focus and flow corrections

The image/docs-only `7f83802` push exposed a real short-screen Firefox Recovery disclosure
failure: its focused invoker and panel scrolled above the viewport. The unchanged native
path remains; a diagnostic reproduces its exact 162→364px scroll and -203px panel position.
A bounded explicit-open visibility correction passed 36 focused Chromium checks. A separate
short-grid defect let invalid Text diagnostics cover Command. All four native regressions
failed before the intrinsic-track/specificity fix; all seven panel-control cases passed
afterward, with raw data/caret/camera/backup/history and normal-height geometry preserved.
Both fixes are integrated at `a7a40e8`; fresh combined builds, independent checks, full
verification, supported-engine CI and exact artifact review remain required. See the
Recovery and short-panel integration reports in `results/`.
