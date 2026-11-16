# Integrated release work

Base: `f95e0056c9e2cb73d23c6dac900acaf9e7f1a06a` (main after PR #40).
Branch: `codex/release-integration`.

The maintainer authorized autonomous implementation and subagent delegation for the
remaining prompts. Each task is developed in a separate worktree, reviewed and
integrated here. Pushes and a draft integration PR are authorized; main merges and
production publication remain separate. Completion below requires integration and
task evidence, not merely a subagent's report. Final acceptance requires combined
verification, CI and the independent audit.

- [x] 01 Public claim testing removed — merged PR #38.
- [x] 02 Transactional persistence/recovery — merged PR #39.
- [x] 04 Modal/keyboard safety — merged PR #40.
- [ ] 03 Document files and reliable sharing — in progress; ADR-0069.
- [x] 05 Properties and inherited visibility — integrated; ADR-0070; 48 unit / 20 browser checks.
- [x] 06 Tool dependencies and capabilities — integrated; ADR-0071; 108 unit / 3 browser checks.
- [ ] 07 Stable geometry numerics — in progress; ADR-0072.
- [x] 08 Randomize/shared sampler — integrated; ADR-0073; 125 unit / 3 browser checks.
- [ ] 09 Responsive/discoverable interface — in progress on integrated 03/05/06; ADR-0074.
- [ ] 10 Script editor/workflow — in progress; atomic command regressions pass; ADR-0075.
- [ ] 11 Release infrastructure/artifacts — infrastructure integrated; final candidate pending; ADR-0076.
- [ ] 12 Independent final audit — pending final candidate.

## Verification

Fresh baseline installation: pinned pnpm 10.28.0, frozen lockfile, existing local store.
Baseline verification runs in an immutable checkout of the base SHA. An earlier attempt
was invalidated by moving scratch tests and stopped; it is not counted as a pass.
Full acceptance remains pending the baseline and final combined verification.
Per-task reports belong in `results/`; exact final commands and results will be recorded
in STATUS. No prior test result is counted as a new check.
