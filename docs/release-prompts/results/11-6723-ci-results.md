# Complete cross-engine diagnostic at 6723

Source: `6723eace46ec559a116d8dc83d1d05e84e35086f`, push run
[`43866405604`](https://github.com/youseng/geomira/actions/runs/43866405604), web job
`133296105854`. This is historical evidence before the source performance repair,
not final release acceptance.

The complete decoded reports were independently inspected. There are **no remaining
nonperformance failures**. Both failures are the original full-UI drag fixture's disabled
Undo assertion: its centre press selects dependent M234 instead of dragging P1. Its low
timings are invalid. The corrected native pickup subsequently exposed a genuine 37.51 ms
app median against the unchanged 8 ms limit; that repair and final validation are separate.

| Project                               | Public passed | Internal passed |
| ------------------------------------- | ------------: | --------------: |
| Chromium desktop                      |           202 |             228 |
| Chromium phone                        |           149 |             150 |
| Firefox hosted                        |           114 |             112 |
| WebKit hosted                         |           114 |             112 |
| Chromium standalone file              |            97 |              47 |
| Firefox standalone file               |            97 |              47 |
| WebKit standalone file                |            97 |              47 |
| Pages base path                       |             1 |    Not selected |
| PWA                                   |            10 |    Not selected |
| Retained worker timing                |  Not selected |               1 |
| **Passed total**                      |       **881** |         **744** |
| Failed full-UI drag                   |             1 |               1 |
| Dependency-not-run fallback/discovery |             0 |               2 |

No retries, skips or changed limits were used to turn those failures into passes. The two
internal fallback projects did not run after their failed drag dependency; they are not
counted as successful measurements.

Every case in each following file passed in **both build modes**, across all seven projects:
Chromium desktop/phone, hosted Firefox/WebKit, and standalone Chromium/Firefox/WebKit.

| Regression file                   | Cases per project and mode |
| --------------------------------- | -------------------------: |
| `canvas-coordinates.spec.ts`      |                          2 |
| `draft-pointer-layout.spec.ts`    |                          7 |
| `interaction-layout.spec.ts`      |                         18 |
| `panel-controls.spec.ts`          |                          3 |
| `recovery-layout.spec.ts`         |                          6 |
| `startup-recovery-layout.spec.ts` |                          4 |

This confirms the actual Firefox/WebKit native coordinate, panel-control, short-focus,
header/title stability, guide, overlay and startup-recovery corrections. Public document
files (11 cases), source assistance (9) and composed workspace (10) also pass all seven
projects; their internal hosted desktop/phone/Firefox/WebKit selections pass too.

All **33 visual assertions**, representing **25 unique references**, pass: 16 public and
17 internal comparisons, including eight shared export PNGs. No further reference bytes or
tolerances changed. The separate five-GUI diagnostic on this source also passed. The earlier
c520 full run was cancelled by branch concurrency after its GUI evidence was preserved;
that incomplete run is not described as a passing complete matrix.

Evidence archive `14227036591`, `playwright-6723eace46ec559a116d8dc83d1d05e84e35086f-1`:
**11,076,573 bytes**, SHA256
`c271a0e22c20f389fc308122ba80ff78a7f024daff2656f31688994fbe5386c0`.
Local decoded reports and classification:
`/tmp/geomira-final11-ci-6723/report/{public,internal}` and
`/tmp/geomira-final11-ci-6723/classification.json`.

Required verification and exports succeeded for this SHA. The failed web gate correctly
prevented tested-site upload and candidate packaging; only export and failure-evidence
archives were produced. A later source performance fix requires new builds, verification,
the complete browser matrix and an exact validated candidate artifact. No main merge or
production publication was performed for this diagnostic.
