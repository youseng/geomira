# Restore settled source presentation during real dragging

Source base: `6723eace46ec559a116d8dc83d1d05e84e35086f`. The independently reviewed
benchmark correction is original `0e046a7`, integrated by this worktree as `15cc971`.
Only its native pickup setup changes; it strengthens exact document and history checks.
This record does not claim final integrated CI acceptance.

## Failure and profile

The original center press selected the nearby dependent M234 in the newly fitted
300-object figure. It refused to drag and produced an invalid low timing. The corrected
native press reaches the visible P1 dot one CSS pixel left and down from its projected
center, with the same camera, all 300 objects and the identical cyclic trace path.
The benchmark requires a coordinate-only P1 change, exact equality of every other source
line, one-step whole-document Undo and Redo, and its original 120 measured frames/8 ms gate.

The first genuine isolated baseline failed: application median **37.51 ms**, p95 **58.05 ms**,
maximum **82.59 ms**; raster median **10.03 ms**. The no-drag 1.57 ms result is invalid.
Agent 11 preserves that actual failure separately from the correction's timing.

An independent CDP V8 sampling profile of 100 genuine drag frames against the immutable
`c520823` app bytes identified about **1,216 ms inclusive** in
`TextPanel → TextApplier.parse → parseText`. Document construction dominated that path:
`addDefinition` about **858 ms inclusive**, including duplicate-construction checks. The
profile used the production source map; it was not a change to the measured gate.
Evidence: `/tmp/geomira-c520-drag.cpuprofile`,
`/tmp/geomira-c520-profile-mapped.json`. Raw sampling is approximate and adds overhead;
it identifies hot paths, not acceptance timings.

`SidePanel` already promises pre-drag panels through `useSettled`. The shared
`TextApplier` subscription bypassed it by publishing clean source on every preview.
The source correction is eight added lines in `TextApplier.follow`: reject an obsolete
caller document; while the authoritative host has a live drag, cancel the pending pause
and leave the source snapshot untouched. Existing store publication reconciles immediately
at End/Cancel. No geometry, parsing, persistence or measurement rule is weakened.

## Failing-first and focused checks

Pinned pnpm 10.28.0, Node 24.22.1; offline frozen-lockfile installation passed.

- New lifecycle suite before the fix: **3 failed / 2 passed**, 2.53 seconds. It exposed
  per-preview source replacement, cancellation losing clean formatting and an outstanding
  pending apply at drag start.
- After the fix, new lifecycle plus existing `text-apply`/`text-short` suites:
  **33 passed / 3 files**, 2.69 seconds. Tests cover live canonical geometry with settled
  source/cache, final-only notification, stale callback rejection, exact cancel formatting,
  dirty original-document association, IME backup, apply-before-down and Undo/Redo.
- TypeScript test/project check, scoped ESLint, Prettier and diff checks passed.
- Public and internal hosted/standalone working-tree builds passed. Their retained base
  build labels identify prototype artifacts, not immutable release source identities.
- Public `script-editor` plus `draft-pointer-layout`, desktop and touch/mobile projects:
  **32 passed**, 48.3 seconds. Covers source preservation/formatting, exact diagnostic spans,
  registry completion, conversion, composition, native Undo/Redo/caret, draft/title/download
  native pointer-down layout and canonical history.
- Internal `flows-typing` plus `flows-audit`, desktop: **8 passed**, 21.7 seconds.
  Preserves pause apply/coalescing, source/diagnostic/caret safety, dirty source across tab
  changes, pending-source drag precedence, delayed link adoption and canonical Undo.

## Isolated prototype timings

Both invocations used the corrected real-drag fixture, one worker, no dependency rerun,
and no other local browser, build or test workload. Original measurements and gates remain.

| Build    | App median | App p95 | App max | Raster median | Total median | Result |
| -------- | ---------- | ------- | ------- | ------------- | ------------ | ------ |
| Public   | 7.58 ms    | 16.52   | 54.59   | 10.76 ms      | 18.81 ms     | pass   |
| Internal | 5.56 ms    | 15.74   | 54.33   | 11.27 ms      | 17.23 ms     | pass   |

Each pass is one genuine run, not a selected retry. Only the app median has the 8 ms gate;
the complete frame and p95 do not fit an 8 ms claim. Full gates on the final combined
revision and CI remain necessary, especially with the public result's narrow margin.
Logs: `/tmp/geomira-performance-probe-drag.log` and
`/tmp/geomira-performance-probe-internal-drag.log`.

A separate post-fix 100-frame profile sampled **no TextPanel, ScriptEditor, parser or
highlighting work** in the drag window; snapshot access accounted for **0.174 ms total**.
Expected remaining work was scene label layout (about 352 ms inclusive) and live editor/
geometry updates (about 244 ms). No further speculative optimization was introduced.
Evidence: `/tmp/geomira-fixed-drag.cpuprofile` and
`/tmp/geomira-fixed-profile-mapped.json`.

These are local prototype results. Final source/artifact provenance, all supported engines,
complete verification and independent built-UI acceptance belong to integration. Physical
devices, actual software keyboards and real screen readers were not exercised here.
