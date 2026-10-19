# STATUS

## Run 0: ACCEPTED (2026-10-19)

Scaffold and guardrails. Everything is in place and green locally, in a clean clone and in
CI (ci, tex, deploy and nightly all succeeded on commit 76fb8bd). The last open criterion,
the GitHub Pages deployment, is now met: after PR #1 was merged, deploy.yml ran on `main`
(commit 50ee23d) and both its `build` and `deploy` jobs succeeded:
https://github.com/youseng/geomira/actions/runs/39219324273
Live site: https://youseng.github.io/geomira/ (serves the "Geomira" shell).

Starting point: no previous run, no `run-*` tag, no docs/adr/, no package.json, so there
was no `pnpm verify` to run and no red base to repair. This run creates both.

## Done (each item → the test file that proves it)

1. pnpm workspace per SPEC §2: packages num, kernel, claims, lang, scene, editor, export
   (each exports only `VERSION`) and apps/web (Vite + React + TypeScript). Shared
   tsconfig.base.json: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes (plus
   noImplicitReturns, noUnusedLocals/Parameters, verbatimModuleSyntax). Package `src/` is
   compiled with `lib: ES2022` and `types: []` (no DOM, no Node globals).
   → `packages/*/test/index.test.ts` (exports exactly `VERSION`, equal to package.json).
2. ESLint 10 (typescript-eslint strictTypeChecked, `@vitest/eslint-plugin`
   no-disabled-tests / no-focused-tests, ban on `.skip/.only/.todo/.fails/.skipIf/.runIf`
   in tests, purity bans in `packages/*/src`: Math.random, Date, performance, window,
   document, process, timers, module-level `let`/`var`, module-level Map/Set caches,
   react/react-dom/zustand and `node:*` imports; no `any`; no `as` casts outside tests;
   eslint-disable comments need a description), Prettier, dependency-cruiser generated
   from the SPEC §2 table, Vitest `test.projects`, Playwright in apps/web.
   → `scripts/lint-guards.test.ts`, `scripts/depcruise.test.ts` (all 42 ordered package
   pairs: exactly the SPEC-forbidden ones are flagged; Node built-ins and npm imports in
   pure packages flagged, lz-string allowed in editor; packages → apps flagged).
3. `pnpm rules` (scripts/check-rules.ts, rules in scripts/check-rules/), each rule with
   bad/good fixtures under scripts/check-rules/fixtures/:
   - (a) tolerance-like literals → `scripts/check-rules/tolerance.test.ts`
   - (b) files > 400 lines → `scripts/check-rules/file-length.test.ts`
   - (c) test count below docs/test-count.txt → `scripts/check-rules/test-count.test.ts`
   - (d) disabled/focused/todo/expected-failure tests → `scripts/check-rules/disabled-tests.test.ts`
   - (e) add-only guard → `scripts/check-rules/add-only.test.ts` (throwaway git repos:
     modified line, deleted line, deleted file, uncommitted change, missing ADR, one of
     several commits without ADR, version-ordered tags, shallow clone all fail; added
     lines and ADR-cited commits pass)
   - (f) proved/proof/proven → `scripts/check-rules/forbidden-words.test.ts`
   - CLI exit code and report → `scripts/check-rules/cli.test.ts`
4. `pnpm verify` = typecheck + lint (ESLint + Prettier) + depcruise + rules + test.
5. Workflows: `ci.yml` (install, verify, build, Playwright), `tex.yml` (GHCR-cached Debian
   image with texlive-latex-base, texlive-pictures, texlive-latex-extra, asymptote;
   compiles tests/fixtures/hello-tikz.tex and hello.asy and checks Asymptote's `write()`
   output), `deploy.yml` (build with base `/<repo>/`, base-path check, Playwright under
   that base, Pages artifact, deploy job on the default branch), `nightly.yml` (test
   suite with NIGHTLY=1, daily and on changes to the workflow).
6. apps/web renders "Geomira" and an empty canvas → `apps/web/test/App.test.tsx`,
   `apps/web/e2e/shell.spec.ts` (desktop and 390×664, no page errors, canvas > 100 px).
7. docs/STATUS.md (this file), docs/adr/0001-baseline.md, docs/test-count.txt (73).
8. Clean clone in a temp directory: `git clone` → `pnpm install --frozen-lockfile` →
   `pnpm verify` → `pnpm build` → `pnpm e2e`, all exit 0 (output below).
9. GitHub Pages deployment from the default branch (deploy.yml run 39219324273 on
   `main`, commit 50ee23d: `build` and `deploy` jobs both succeeded).

## Not done

Nothing for Run 0. The `run-0` tag is placed on the `main` commit that records this
acceptance; from then on the add-only guard freezes every test file present at that tag.

## Known bugs

None known.

## Uncertain

- No mathematical content in this run.
- Rule (a) is a textual check, as CLAUDE.md describes it ("greps for float literals"):
  it scans comments and strings too, and it does not catch tolerances written as
  expressions (for example a power of two with a negative exponent). Rule (f) uses a
  word match with camelCase boundaries; `improved`, `waterproof`, `provenance` are not
  hits, `unproven` and `isProven` are.
- Rule (d) bans the six test modifiers anywhere in code, as CLAUDE.md says
  ("anywhere"). A future method named `skip` (for example in a lexer) would have to be
  named differently.

## Changed frozen tests

None (no `run-*` tag existed).

## Acceptance command output

### Clean clone (temp directory, commit 76fb8bd)

```
$ git clone -q /home/user/geomira clean && cd clean
$ pnpm install --frozen-lockfile        # Done in 1.4s using pnpm v10.28.0
$ pnpm verify
> pnpm typecheck && pnpm lint && pnpm depcruise && pnpm rules && pnpm test
> pnpm -r run typecheck && tsc -p tsconfig.tests.json      (8 projects + tests: Done)
> eslint . --max-warnings 0 && prettier --check .
All matched files use Prettier code style!
> depcruise packages apps/web/src --config .dependency-cruiser.cjs
✔ no dependency violations found (24 modules, 17 dependencies cruised)
> tsx scripts/check-rules.ts
ok   tolerance: 87 files scanned, 0 violation(s)
ok   file-length: 87 files scanned, 0 violation(s)
ok   test-count: 73 tests, floor 73, 0 violation(s)
ok   disabled-tests: 87 files scanned, 0 violation(s)
ok   add-only: no run-* tag yet: nothing frozen, 0 violation(s)
ok   forbidden-words: 87 files scanned, 0 violation(s)
> vitest run
 Test Files  17 passed (17)
      Tests  73 passed (73)
$ pnpm build
dist/index.html                   0.55 kB │ gzip:  0.33 kB
dist/assets/index-C6lbls-J.css    0.76 kB │ gzip:  0.45 kB
dist/assets/index-Df2v0Kg9.js   193.95 kB │ gzip: 60.98 kB │ map: 912.63 kB
✓ built in 1.28s
$ pnpm e2e
  ✓  2 [desktop] › e2e/shell.spec.ts:3:1 › shows the title and an empty canvas (333ms)
  ✓  1 [mobile] › e2e/shell.spec.ts:3:1 › shows the title and an empty canvas (328ms)
  2 passed (2.5s)
```

### Every check-rules fixture fails as intended

The fixture tests above assert the exact `file:line` list of each bad tree and an empty
list for each good tree. The same trees through the real CLI
(`tsx scripts/check-rules.ts scripts/check-rules/fixtures/<rule>/bad`; every run exits 1;
test-count also fails there because a fixture tree has no floor file):

```
FAIL tolerance: 3 files scanned, 7 violation(s)
     apps/web/src/zoom.ts:1  tolerance-like literal 1e-3
     packages/kernel/src/eps.ts:1  tolerance-like literal 1e-9
     packages/kernel/src/eps.ts:2  tolerance-like literal 0.0000001
     packages/kernel/src/eps.ts:3  tolerance-like literal 2.5E-7
     packages/kernel/src/eps.ts:4  tolerance-like literal 1e-12
     packages/kernel/src/eps.ts:5  tolerance-like literal .0001
     scripts/tool.ts:1  tolerance-like literal 3E-5
FAIL file-length: 3 files scanned, 3 violation(s)
     apps/web/src/long.css  401 lines (max 400)
     packages/kernel/src/long.ts  401 lines (max 400)
     packages/kernel/test/long.test.ts  401 lines (max 400)
FAIL disabled-tests: 8 files scanned, 14 violation(s)
     apps/web/e2e/fixme.spec.ts:2  `test.fixme(`
     apps/web/e2e/fixme.spec.ts:3  `test.describe.fail(`
     packages/kernel/test/conditional.test.ts:2  `.skipIf(`
     packages/kernel/test/conditional.test.ts:3  `.runIf(`
     packages/kernel/test/conditional.test.ts:4  `.skip(`
     packages/kernel/test/fails.test.ts:2  `.fails(`
     packages/kernel/test/jasmine.test.ts:1  `xit(`
     packages/kernel/test/jasmine.test.ts:2  `fdescribe(`
     packages/kernel/test/only.test.ts:2  `.only(`
     packages/kernel/test/only.test.ts:3  `.only(`
     packages/kernel/test/skip.test.ts:2  `.skip(`
     packages/kernel/test/skip.test.ts:3  `.skip(`
     packages/kernel/test/todo.test.ts:2  `.todo(`
     packages/lang/src/lexer.ts:1  `.skip(`
FAIL forbidden-words: 3 files scanned, 8 violation(s)
     apps/web/index.html:2  "Proofs" in apps/
     apps/web/src/Verdict.tsx:1  "Proved" in apps/
     apps/web/src/Verdict.tsx:2  "proven" in apps/
     apps/web/src/Verdict.tsx:3  "proof" in apps/
     packages/claims/src/verdict.ts:1  "proved" in a user-facing string
     packages/claims/src/verdict.ts:2  "unproven" in a user-facing string
     packages/claims/src/verdict.ts:3  "PROOF" in a user-facing string
     packages/claims/src/verdict.ts:4  "Proven" in a user-facing string
```

Rules (c) and (e) need injected counts and git history; they are covered by
test-count.test.ts and add-only.test.ts (all cases listed under Done).

### TeX fixtures (local, Ubuntu 24.04 TeX Live + Asymptote 2.87)

`sh tests/fixtures/compile-tex.sh` → hello-tikz.pdf written, Asymptote prints `(2,0)`,
"TeX and Asymptote fixtures compiled.", exit 0. With the expected coordinate changed to
`(9,9)` the script exits 1.

### CI on GitHub

On the branch (commit 76fb8bd, claude/run-0-scaffold-guardrails-crjyx4), tex.yml's
compile job ran inside `ghcr.io/youseng/geomira-tex`, wrote hello-tikz.pdf, and
Asymptote printed `(2,0)` ("TeX and Asymptote fixtures compiled."). tex and nightly have
path filters (TeX inputs, their own workflow file) and run again only when those change
or on their schedule / manual dispatch.

| Workflow      | Run                                                         | Result                                                          |
| ------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| ci            | https://github.com/youseng/geomira/actions/runs/39218199380 | success (verify, build, Playwright)                             |
| tex           | https://github.com/youseng/geomira/actions/runs/39218199382 | success (image built and pushed to GHCR; fixtures compiled)     |
| deploy        | https://github.com/youseng/geomira/actions/runs/39218199443 | success (build job; deploy job skipped off the default branch)  |
| nightly       | https://github.com/youseng/geomira/actions/runs/39218199640 | success                                                         |
| deploy (main) | https://github.com/youseng/geomira/actions/runs/39219324273 | success (merge of PR #1, commit 50ee23d; build and deploy jobs) |

## Requests

- None open. (Done: GitHub Pages enabled, branch merged as PR #1, deploy green on
  `main`.)

## Notes for later runs

- Dependencies: none beyond the allowed runtime set (react, react-dom). Dev tooling only:
  TypeScript, ESLint + plugins, Prettier, dependency-cruiser, Vitest, Vite,
  @vitejs/plugin-react, Playwright, tsx, @types/\*, globals.
- Deviations from the run text (not from SPEC), recorded in ADR-0001: Vitest
  `test.projects` instead of a workspace file (removed in Vitest 4);
  `@vitest/eslint-plugin` instead of `eslint-plugin-vitest` (renamed package, same
  rules).
- The tex image is based on `public.ecr.aws/docker/library/debian:trixie-slim` (the
  official Debian image via ECR Public) to avoid Docker Hub rate limits; GHCR package
  `geomira-tex` was created by the first tex.yml run.
- CI checks out full history (`fetch-depth: 0`) so the add-only guard can compare
  against the `run-*` tags.
