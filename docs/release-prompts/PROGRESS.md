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
- [ ] 05 Properties and inherited visibility — in progress; ADR-0070.
- [ ] 06 Tool dependencies and capabilities — in progress; ADR-0071.
- [ ] 07 Stable geometry numerics — in progress; ADR-0072.
- [ ] 08 Randomize/shared sampler — in progress; ADR-0073.
- [ ] 09 Responsive/discoverable interface — pending integration; ADR-0074 reserved.
- [ ] 10 Script editor/workflow — pending shared draft integration; ADR-0075 reserved.
- [ ] 11 Release infrastructure/artifacts — infrastructure in progress; ADR-0076.
- [ ] 12 Independent final audit — pending final candidate.

## Verification

Fresh baseline installation: pinned pnpm 10.28.0, frozen lockfile, existing local store.
Baseline `pnpm verify` is running; results will be recorded before integrating repairs.
Per-task reports belong in `results/`; exact final commands and results will be recorded
in STATUS. No prior test result is counted as a new check.
