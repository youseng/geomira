# Prompt 11 — accepted candidate checkpoint

Accepted candidate: **`e0ef71fb8d695ed37fb98c65568de44119757d17`**, 2026-11-16.
Independent prompt 12 returned **GO** for this exact source, complete required gates and
downloaded bytes; see [the independent audit](12-final-audit.md).

This checkpoint completes prompts 11/12. **Main merge, production deployment and a tagged
release have not been performed.** The final documentation-only successor must pass its own
required CI before the authorized merge; main then validates and deploys its own exact merged
revision. This is not a claim that a future SHA has already passed.

## Complete required validation

Exact push run [43891722770](https://github.com/youseng/geomira/actions/runs/43891722770)
passed verification, web, exports and candidate packaging. Branch deployment/smoke were
correctly skipped because this is not main.

| Check                     | Actual result                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Required CI `pnpm verify` | 5,046 tests / 553 files; all static gates; Vitest 436.79 s                              |
| Coverage                  | 96.45% statements / 90.45% branches / 99.45% functions / 98.33% lines                   |
| Public browsers           | 924 passed, zero skipped, 12.4 min                                                      |
| Internal browsers         | 789 passed, zero skipped, 9.7 min                                                       |
| Visual comparisons        | 33 passed, representing 25 individually reviewed references                             |
| Early diagnostic          | Public GUI 2/2, internal GUI 3/3, public WebKit focus 2/2, internal WebKit focus 2/2    |
| Builds                    | Public/internal hosted and standalone builds passed at `/geomira/` with full source SHA |
| Required exports          | Fixture and generated-export compilation, including `--fuzz 60`, passed                 |

The matrices include Chromium desktop/phone, hosted Firefox/WebKit and file
Chromium/Firefox/WebKit. Public Pages and PWA checks also passed. All six additive
Recovery/short-source regressions actually passed in every selected project and both modes:
**84/84 executions**. No project was silently narrowed.

Independent quiet local verification on application source
`56fbd30f3457635ac68d8ad48980b37b6f93ea0c` passed 5,046 tests / 553 files in 663.24 s.
That is separate from exact e0e CI. The 56→e0e diff changes only tests, diagnostic workflows
and documentation; application, public assets and packages are unchanged.

## Genuine performance checks

The benchmark starts a native drag of the exposed P1 dot in the unchanged 300-object figure,
camera and cyclic path. It verifies a coordinate-only P1 change, identical other source,
complete one-step Undo/Redo, no older history and 120 measured frames.

| Required CI measurement           |               Public |                                                Internal | Unchanged gate                     |
| --------------------------------- | -------------------: | ------------------------------------------------------: | ---------------------------------- |
| Full-UI application median        |              4.99 ms |                                                 4.13 ms | ≤8 ms                              |
| Application p95 / maximum         |      6.57 / 14.24 ms |                                         6.08 / 11.88 ms | Median gate above                  |
| Software raster median            |              8.69 ms |                                                 7.74 ms | Reported separately under ADR-0014 |
| Total median                      |             13.75 ms |                                                11.98 ms | Reported separately under ADR-0014 |
| Retained worker maximum           | Not a public feature |                                    2.8 ms, no LongTasks | ≤16 ms                             |
| Workerless local/global maximum   | Not a public feature |                                      8 ms, no LongTasks | ≤16 ms                             |
| Workerless discovery, 150 objects | Not a public feature | 28.7 ms maximum; 1/2,394 tasks over 16 ms; no LongTasks | ≤150 ms and <1% over 16 ms         |

The six relevant local 56 gates passed once, public 3/3 and internal 3/3, with genuine app
medians 7.16/6.81 ms. [Raw local measurements](11-56-performance.json) retain every percentile.
The earlier 37.51 ms real failure, invalid 1.57 ms no-drag trace and separate 404 worker
60.5 ms failure / sole 8.7 ms repeat remain historical observations. No cause is inferred
for that worker pause. Final exact CI independently meets every original gate.

## Exact artifact provenance

| Field                         | Verified value                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Source                        | `e0ef71fb8d695ed37fb98c65568de44119757d17`                                                                |
| Run / attempt                 | `43891722770` / `1`                                                                                       |
| Build mode / base             | `public` / `/geomira/`                                                                                    |
| Tested-web artifact           | `14239416633`, 2,422,057-byte ZIP                                                                         |
| Archive SHA256                | `31b965ae03da94c97c5bed230d371ff3fe8954a8fc81b67df69cb85bc3393b4e`                                        |
| Pages artifact (API metadata) | `14238862856`, 2,420,877 bytes; SHA256 `d245d4e881352e2966a4280d5400c567d570e3446f2ea41f11ec2615ef61910a` |
| Offline HTML                  | 1,273,190 bytes                                                                                           |
| Offline SHA256                | `2b6ac1c2ea0b3c8f5ee360b5fd108fdf6dd3dc020087715198284867f7555a16`                                        |
| Public screenshot             | 1280×720, 121,162 bytes; SHA256 `6d17ceef7f61a3b2b6cd02c057399de88f39c6c518173d1c635b842a03e76aca`        |

The integration owner and independent reviewer checked the downloaded tested-web archive, manifest
source/run/attempt/mode/base and all 15 payload checksums. Every payload matches the exact
local e0e build; `geomira.html` matches the standalone byte for byte. Local reviewed bytes:
`/workspace/geomira-final-audit/ci-e0e/site/geomira.html`; manifest:
`/workspace/geomira-final-audit/ci-e0e/site/release.json`.

The non-expiring deployed download path is `/geomira/geomira.html`, packaged with the tested
site. [Process documentation](../../../releases/README.md) describes it. The unused shipped
screenshot was replaced with the exact reviewed public GUI reference; the manifest has no
`screenshots` field, and no new install-dialog feature was introduced.

Candidate packaging downloads the tested site rather than rebuilding it. It requires
same-run verification, browsers and exports, then checks source/run/attempt/base/checksums.
Earlier failed runs produced only diagnostic/export artifacts and no candidate. Early
failure uploads and the nine-check diagnostic have read-only permissions and cannot bypass
the required graph. Nightly mutation policy is unchanged.

## Controlled visuals and remaining limits

CI used Node 22.23.4, pnpm 10.28.0 and Playwright 1.56.1: Chromium 141.0.7390.37,
Firefox 142.0.1 and WebKit 26.0 on Ubuntu 24.04. Recorded font-file hashes match
[the reviewed reference environment](11-visual-references.json). Scene/export ratios remain
0.002 and full-GUI ratios 0.01. References were inspected individually, without blanket
acceptance or threshold increases. Local full-GUI font differences are not called passing
comparisons merely because CI reference bytes were selected.

- A phone with Text open retains a 120 px canvas; complex examples have crowded labels.
  Hide panels and Fit/Zoom provide the larger construction view. Adaptive compact fitting
  remains future work.
- Internal verdict chips can overlap phone labels. The public release has no such chips;
  this remains a [reactivation limit](../../claims-reactivation.md).
- Physical phones, actual mobile software keyboards and real screen-reader sessions were
  unavailable. Browser emulation does not establish those checks. Browser eviction,
  asynchronous unload and file-origin storage policies still make portable `.geo` backups
  useful.

Historical rejections are preserved in the [c540 disposition ledger](11-c540-ci-dispositions.md),
[7f8 Recovery failure](11-7f8-ci-results.md) and [56 ownership/source-map record](11-56-ci-results.md).
A disposable mutation independently proved the portable ownership test detects stolen
scrolling: removing only the production active-owner guard fails the same corrected test
(642→0 scroll). Production code was not changed to make the WebKit setup portable.
