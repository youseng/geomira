# Exact successor failure at 7f8

Source: `7f838025c9ad1cbe2cd913f726ff507661b34d20`, push run
[`43875853221`](https://github.com/youseng/geomira/actions/runs/43875853221), web job
`133328567419`. Required verification, exports and the five-GUI diagnostic succeeded.
The exact push browser gate failed and produced no validated site candidate.

- Public: **880 passed / 1 failed / 1 dependency-not-run**, 882 total.
- Internal: **747 passed / 0 failed / 0 skipped**.
- All 33 screenshot comparisons representing 25 unique references passed.
- The public full-UI drag project did not run after its failed dependency. It is not
  counted as a successful timing measurement on this exact push.

The sole failed test is public `desktop-firefox`, `recovery-layout.spec.ts`,
“recovery opens, closes and reopens below controls at 390x380”. After focusing Text,
focusing the Recovery toggle and pressing Enter, `placedBelowControls` line 18 (called
at line 67) observed popup y **-203**, requiring at least **0**. The trace's final frame
shows the canvas and Text while the header and Recovery content are above the viewport;
the accessibility snapshot still marks the Recovery toggle expanded and active.

Independent trace inspection recorded application scrollTop 103 → 227 on Text focus →
162 on toggle focus → 364 when Recovery content was inserted. The roughly 202 px change
leaves the focused control and its disclosure offscreen. This is confirmed visible A18,
not merely a stale bounding-box assertion. Native causal reproduction and the narrow
disclosure fix belong to prompt 09; no cause is inferred from the unrelated PNG change.

The parallel PR merge-ref run `43875864676` passed all required jobs. Its distinct
source/build metadata does not satisfy this failed exact push gate, nor establish the
cause of the difference. No blind rerun or threshold/assertion change was used.

Failure archive `14231631973`: **4,316,871 bytes**, SHA256
`0d7841fd54a3a85731287c1569f6ec2765f94bba06b70d2071c75dec324f85af`.
The download hash was independently checked before decoding both complete reports.
Local report root: `/tmp/geomira-final11-ci-7f8/report`.
Firefox trace: `public/data/80ae21c0e5b545492c6f6df93b839407d6273366.zip`;
error context: `public/data/b43de3e1557348ea96b05d9865c8db200ac21a2c.md`.
The official active-job log endpoint was tried once before completion and returned
BlobNotFound; the full run was preserved until both reports uploaded.

No main merge or publication was performed. A18 must be resolved and the successor's
complete required validation and exact artifact checks must pass before publication.
