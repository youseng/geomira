# ADR-0041: The add-only guard compares with the previous run's tag, not the highest run number

Status: accepted (Run 16b, found in the session protocol before any Run 16b work). Amends ADR-0001
item 16 ("the latest `run-*` tag (version order)") and the guard of ADR-0021. CLAUDE.md is
unchanged: it already says "test files that existed at the previous run's tag".

## Context

The maintainer's brief for Run 16b says the add-only guard compares with `run-16a` (335803e). On
that commit `pnpm rules` printed "frozen tests compared with run-17b": the guard took the highest
tag by version order, and Run 17 was done (and tagged `run-17b`) before Run 16a. So no test file
that Run 16a added or changed was frozen, and they would stay unfrozen until a `run-18` tag.
Verify was green; the guard was weaker than CLAUDE.md and the maintainer intend.

## Decision

1. The guard compares with the run tag on the most recent commit of HEAD's history: among the
   `run-*` tags reachable from HEAD (`git tag --merged HEAD`), the one whose commit has the most
   commits in its history; tags on one commit are ordered by version (run-16b after run-16a). A
   tag that is not in HEAD's history (another branch) is not used.
2. On one line of history (every earlier run) this is the tag the old rule chose, so the earlier
   tests of the rule hold unchanged; `scripts/check-rules/add-only-nearest.test.ts` adds the case
   where they differ (run-17b on an earlier commit than run-16a), a tag outside HEAD's history,
   two tags on one commit, and no tag. It failed before the change.

## Consequences

- From this commit on, the guard compares with `run-16a`: the tests Run 16a added are frozen, and
  every change Run 16b makes to them needs a commit citing an ADR, listed in STATUS.
- When the maintainer tags `run-16b` after the merge, Run 16c compares with it.

## Alternatives considered

- **Leaving it**: the 16a tests would stay unfrozen until Run 18, against CLAUDE.md.
- **`git describe --tags --abbrev=0 --match 'run-*'`**: picks the nearest tag by commit count from
  HEAD too, but on two tags of one commit it takes either; the rule above is explicit.
- **Commit dates**: not reliable (rebases, clocks); ancestry is.
