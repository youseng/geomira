# CLAUDE.md: project rules. Read fully before doing anything.

You are building GEOMIRA: a web-based dynamic geometry tool for Math Olympiad geometry
(IMO / ISL / national olympiads). It replaces an older prototype (Geomdraw) that failed because of
(1) many edge-case bugs, (2) features bolted on without a shared architecture, and
(3) a prover that sometimes called false claims "proved". Every rule below exists to
prevent one of those three failures. docs/SPEC.md is the constitution: binding unless an
ADR in docs/adr/ changes it.

## Session protocol (mandatory, in this order)
1. Read docs/SPEC.md, docs/STATUS.md and every file in docs/adr/.
2. Run `pnpm install && pnpm verify` (verify = typecheck + lint + test + rules check).
3. If the previous run is not marked ACCEPTED in STATUS.md, or verify fails: fix that
   first. Never build new work on a red base.
4. Work only on the run you were given. Do not start later runs' work, even partially.
5. Write the tests for this run's laws and acceptance items first, as a habit. The real
   guarantee is the laws (property tests), the exact oracle and differential fuzzing:
   never weaken them to make code pass.
6. Before finishing: `pnpm verify` green locally AND in CI; update docs/STATUS.md
   (template below) with the actual output of the acceptance commands. CI on GitHub is
   the source of truth; STATUS.md is the narrative.
7. Any deviation from SPEC.md needs docs/adr/NNNN-title.md (context, decision,
   consequences, alternatives). Never deviate silently.

## Honesty rules (the most important section)
- Never mark something done that is not done, tested and verified by a command you ran.
- If you are unsure about a mathematical fact (a theorem, a problem statement, a formula),
  write it under "Uncertain" in STATUS.md. Do not guess and do not invent problem
  statements or contest attributions. Contest problems come only from
  docs/examples-source.md and docs/library-source.md, written by the maintainer.
- FROZEN TESTS: test files that existed at the previous run's tag are ADD-ONLY. The CI
  guard (`pnpm rules`) diffs every such file against that tag and fails on any deleted or
  modified line unless the commit message references an ADR (`ADR-NNNN`) that justifies
  it; STATUS.md lists every such change. The total test count may also never drop below
  docs/test-count.txt. Loosening a tolerance, removing cases or weakening an assertion is
  a modification.
- When a test fails, assume the code is wrong before assuming the test is wrong.
- No `.skip`, `.only`, `.todo`, `it.fails` anywhere (lint-enforced).
- v1 user-facing text never uses the words "proved", "proof" or "proven". Verdicts say
  what was checked ("holds in this configuration, 200/200", "exact over Q"). The word is
  reserved for the Phase 2 prover.

## Engineering rules (non-negotiable)
- TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes. No `any`.
  No `as` casts outside tests unless a comment proves safety.
- Every union is handled by an exhaustive switch ending in `assertNever`.
- Packages num, kernel, claims, lang, scene, editor, export: ZERO DOM, ZERO framework
  imports, ZERO module-level mutable state (no `let` at module scope, no singletons, no
  caches outside explicit objects). They must run under Vitest in Node.
- Dependency directions are enforced by dependency-cruiser (see SPEC §2). Never bypass.
- Numeric tolerances: only in packages/num/src/tolerance.ts. `pnpm rules` greps for
  float literals like `1e-` and `0.0000` outside that file and outside tests, and fails.
- Randomness: only packages/num/src/rng.ts (seeded). `Math.random`, `Date.now`,
  `performance.now` are forbidden in pure packages (lint-enforced).
- No function may return or store NaN or ±Infinity inside a Value (the only allowed
  infinities are line-range bounds). Degenerate input → Undefined value with a reason.
- Every geometric primitive's doc comment lists its degenerate cases and the result for each.
- Files ≤ 400 lines (split by responsibility). Functions ≤ 60 lines unless justified.
- Every new tool, in the same commit: implementation, registry entry, degenerate-case
  tests, a property/theorem test using it, export mapping (or explicit `numeric`), docs
  generated from the registry.
- No stubs, no "not implemented" throws, no TODO-and-move-on, except items SPEC lists as
  Phase 2, which must not be referenced from v1 code at all.
- Bug fixes: first a failing test that reproduces the bug, then the fix, same commit.
- Allowed runtime dependencies: react, react-dom, zustand, lz-string. Anything else:
  propose in STATUS.md under "Requests"; do not install.
- Small commits with clear messages. Never force-push. Never rewrite history.

## STATUS.md template (keep these headings)
- Run N: ACCEPTED / NOT ACCEPTED
- Done (each item → the test file that proves it)
- Not done
- Known bugs (with reproduction)
- Uncertain (math or spec questions)
- Changed frozen tests (with ADR link), or "none"
- Acceptance command output (pasted)
- Requests (dependencies, decisions for the maintainer)

## Quality bar
"Nothing silently wrong." A saved file reproduces the same figure. A point never jumps
except through a genuine degeneracy, where it is undefined. Undefined is shown as
undefined, never as garbage. Every UI state is expressible in the text format. A claim is
never reported true or false when it is actually degenerate.
