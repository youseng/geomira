# ADR-0001: Baseline (binding decisions of SPEC v1 and the Run 0 toolchain)

Status: accepted (Run 0)

## Context

GEOMIRA replaces a prototype that failed through edge-case bugs, features without a shared
architecture, and a prover that reported false claims as proved. docs/SPEC.md is the
constitution; CLAUDE.md holds the working rules. This ADR records, in one place, the
decisions every later run builds on, so that a change to any of them needs its own ADR
that names what it supersedes. It restates SPEC; where the two ever differ, SPEC wins
until an ADR changes it.

## Decision

### Binding decisions taken from SPEC

1. **Scope** (SPEC §1). v1 is the kernel, claims, language, editor, scene, export and web
   app; v1.1 (Runs 12–13) adds the listed long-tail tools and gates. Phase 2 items
   (inversion and Möbius maps, conics, the symbolic prover, finder, library, loci,
   animation, macros, accounts) are never referenced from v1 code.
2. **Packages and dependency directions** (SPEC §2): num → none; kernel → num; claims →
   kernel, num; lang → kernel, claims, num; scene → kernel, num; editor → kernel,
   claims, lang, scene, num; export → scene, kernel, lang, num; apps/web → all. The tool
   registry is a value from `createRegistry()`, never a singleton.
3. **Purity**: num, kernel, claims, lang, scene, editor and export have no DOM, no
   framework, no module-level mutable state, and run under Vitest in Node.
4. **Numerics** (SPEC §3): tolerances only in packages/num/src/tolerance.ts (EPS, BAND,
   noise floor constants), scaled by `ctx.scale`; decisions inside BAND are ambiguous →
   Undefined; seeded randomness only in packages/num/src/rng.ts; number literals are
   exact rationals; exactness is discovered by running over RationalField.
5. **Values** (SPEC §4): no NaN or ±Infinity inside a Value (except line-range bounds);
   degeneracy yields Undefined with a reason; `Inexact` means "not representable in this
   field".
6. **Document model** (SPEC §5): the document is the entire state, invariants I1–I8 are
   asserted after every edit in tests and dev builds.
7. **Tools** (SPEC §6): one `compute<T>` per tool over any Field; nothing outside the
   registry enumerates tools; every degenerate case listed is a test.
8. **Branch selection** (SPEC §7): explicit selectors, no tool reads previous values; the
   orientation-dependence definition and law L16.
9. **Claims** (SPEC §10): three-valued; verdict rungs exact over Q → exact mod p
   (polynomial kinds only) → numeric with the noise floor; verdicts state what was
   checked and never use the words reserved for the Phase 2 prover.
10. **Language** (SPEC §11): text is canonical; parse is total; laws P1–P3; mandatory
    `@version` with migrations.
11. **Testing laws L1–L17 and budgets** (SPEC §17) are the guarantee; they are never
    weakened to make code pass.

### Repository mechanics fixed in Run 0

12. **Toolchain**: Node 22, pnpm 10 workspace, TypeScript 5.9 (strict,
    noUncheckedIndexedAccess, exactOptionalPropertyTypes), ESLint 10 flat config with typescript-eslint (type-aware),
    Prettier 3, dependency-cruiser 17, Vitest 4 (`test.projects`, the successor of the
    workspace file), Vite 7 + React 19, Playwright 1.56. Exact versions are pinned in
    package.json and the lockfile.
13. **Package layout**: `packages/<name>/src` (shipped code, compiled without DOM or Node
    types) and `packages/<name>/test` (tests). Packages export TypeScript source through
    `exports`; there is no package build step.
14. **`pnpm verify`** = typecheck + lint (ESLint and Prettier) + depcruise + rules + test.
    CI (ci.yml) runs verify, build and the Playwright tests; CI is the source of truth.
15. **`pnpm rules`** (scripts/check-rules.ts), each rule tested with failing fixtures:
    (a) tolerance-like literals outside tolerance.ts and tests; (b) files over 400 lines;
    (c) Vitest test count below docs/test-count.txt; (d) disabled, focused, todo or
    expected-failure tests; (e) the add-only guard; (f) the words reserved for Phase 2 in
    apps/ and in string literals of packages/. Test files are `*.test.*`, `*.spec.*` and
    anything under `test/`, `tests/`, `e2e/` or `__tests__/`.
16. **Run tags and frozen tests**: when a run is ACCEPTED its commit is tagged `run-N`.
    The add-only guard compares every `*.test.ts(x)` / `*.spec.ts(x)` present at the
    latest `run-*` tag (version order) with the working tree; any deleted or modified line
    fails unless every commit that removed lines cites `ADR-NNNN` for an existing
    docs/adr/NNNN-*.md. Uncommitted removals and shallow clones fail.
17. **TeX toolchain**: tex.yml compiles fixtures in a Debian image with TeX Live (latex
    base, pictures, extra) and Asymptote, cached in GHCR under a hash of its Dockerfile.

## Consequences

- Every later run starts from a verified scaffold; violations of the purity, dependency,
  tolerance and test-integrity rules fail locally and in CI before review.
- Changing any decision above requires a new ADR that references this one.
- Tightening a rule is always allowed; loosening one is a deviation and needs an ADR.

## Alternatives considered

- Vitest workspace file: deprecated in Vitest 3.2 and removed in Vitest 4; `test.projects`
  is its replacement.
- `eslint-plugin-vitest`: the package was renamed to `@vitest/eslint-plugin`; the same
  rules (`no-disabled-tests`, `no-focused-tests`) are used from the new name.
- TypeScript 7 / 6.x and ESLint 9: typescript-eslint supports TypeScript below 6.1, so
  TypeScript 7 is out; 5.9 is the most established release in range (6.0 is a transition
  release). ESLint 9 is no longer supported upstream, so ESLint 10 is used.
- Building packages to `dist/`: unnecessary while every consumer (Vite, Vitest, tsc with
  bundler resolution) reads TypeScript source; it would add a step that can go stale.
