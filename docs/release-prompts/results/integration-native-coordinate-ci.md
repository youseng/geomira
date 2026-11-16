# Native-coordinate CI classification and fixture corrections

CI source: `c540412ec2e4d4a68c93c4e59a26343756adaf69`, run `43854336027`.
Decoded evidence: `/tmp/geomira-final11-ci-c540/owner07.json`; full report index:
`/tmp/geomira-final11-ci-c540/report/review-index.json`.

| CI cases                                               | Count | Diagnosis                                                                                        | Resolution                                                                                                           |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Public/internal desktop `flows-measurements` angle     | 2     | Native pixel misses exact degeneracy; ADR-0027 correctly refuses a dependent-kind-changing round | Strict raw endpoint plus exact typed degeneracy/history                                                              |
| Internal file-firefox `file-url` drawing/worker/export | 3     | Integer delivered client coordinates differ from fractional requested coordinates                | Independent actual-pointer oracle; full canonical polygon equality                                                   |
| Internal desktop `flows-audit` / `flows-typing`        | 2     | Real 36px header collapse when the draft badge disappears during source blur                     | Source correction `bfc3f2a341fa75267ec9ef07676aa38dda1ebb94`; original exact-coordinate/history assertions unchanged |

The previously corrected five Guide-to-Point routes are separate from these seven cases.
Legacy claim/share, keyboard/focus, expand controls, PWA and visual cases are owned by
their respective integration agents; no claim about those failures is made here.

## Exact angle trace and oracle

Public trace ZIP:
`report/public/data/ca437f51c50c1a52e2d859595ede386cc420c473.zip`.
Internal counterpart:
`report/internal/data/8b2070eb0ad50464fc32d40e22717b7677cb87b3.zip`.
Native live capture reproduced a stable canvas at x=104, y=176.390625, CSS width 856,
height 461.609375 and logical dimensions 856×462, viewport (2,1.5), zoom 106. Requesting
y=566.0608766233765 delivered y=566.0608520507812. Independent projection yields
C.y=261223535/1125899906842624, approximately 0.0000002320131065. C is not coincident
with A; its vertical angle remains exactly 90°. The first visual reading mistook the
wrapped Rational numerator for a decimal; raw text/event capture corrected that diagnosis.

The expected initial document is a literal. The raw delivered endpoint is projected
without a production helper and formatted as an exact binary Rational; the complete
dragged document must match byte for byte. An intermediate oracle run used normalized
offsets first and introduced a spurious x=-1/2251799813685248. Computing in pixel units
before division fixes that independent floating-operation ordering, with no tolerance.
The test explicitly requires x=0. Native y=0 requires Undefined directly; otherwise the
native 90° state is followed by exact typed C=(0,0), original Undefined reason, exact Undo
back to the native document/90°, then Redo to Undefined.

## File triangle trace and retained coverage

Representative internal file-firefox ZIP:
`report/internal/data/170ba233fbc59861a28c90f2823eb380d22b2a3e.zip`.
Requests were (532,407.191665649), (732,407.191665649), (582,257.326943732), then the
closing first vertex. Firefox integer delivery explains the observed .0038/.0038/3.0065
world y values. Three native creates now use the existing rounded independent oracle;
their exact individual lines and complete polygon document are required. Local/global
engine tests, worker/fallback behavior and SVG/TikZ assertions are unchanged. The separate
share-link prefix correction belongs to agent 08 and is outside this commit.

## Focused commands and results

All browser commands below prefix `PATH=/tmp/geomira-bin:$PATH`,
`PLAYWRIGHT_BROWSERS_PATH=/tmp/geomira-browsers`, `GEOMIRA_BASE=/geomira/`,
`GEOMIRA_PREVIEW_PORT=4299`; internal ones also set `GEOMIRA_ENGINE_E2E=1`.

- Before the angle fixture correction, `pnpm --filter @geomira/web exec playwright test flows-measurements --grep 'an angle' --project desktop --workers 1 --trace on`:
  **1 failed**, reproducing the original Undefined expectation against the immutable public
  c540 artifact. Native event/rectangle capture then established the explanation above.
- After correction, the same public angle command without `--trace on`: **1 passed**,
  6.6 seconds. Final run after the explicit x=0 premise and local caption build:
  **1 passed**, 5.5 seconds.
- Internal `pnpm --filter @geomira/web exec playwright test draft-pointer-layout flows-audit flows-typing flows-measurements --grep 'a draft applied|draft status preserves|an edit typed in the text|a drag while a pause|an angle' --project desktop --workers 1`:
  **8 passed**, 16.0 seconds. This includes the stronger angle fixture and both unchanged
  legacy source-blur exact-coordinate/history checks.
- Internal `pnpm --filter @geomira/web exec playwright test file-url --grep 'one file and nothing else|without Web Workers the page runs|export from the file' --project file-chromium --workers 1`:
  **3 passed**, 17.9 seconds, against the copied immutable internal c540 artifact; final
  rerun against the local corrected-caption artifact: **3 passed**, 9.0 seconds.
- `PATH=/tmp/geomira-bin:$PATH pnpm exec tsc -p tsconfig.tests.json --noEmit`: passed.
- Targeted ESLint on the source correction and all changed/new TypeScript fixtures: passed.
- Prettier and `git diff --check`: passed.

No geometry engine, numeric tolerance, selection behavior or coordinate grid changed.
Only the separately documented draft-identity fix changes runtime UI. Local evidence is
Chromium; final supported-engine CI, combined-source identity and quiet full verification
remain integration work. No push, merge, publication or deployment was performed.
